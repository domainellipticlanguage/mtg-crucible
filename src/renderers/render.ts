import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { CardData, ParsedAbilities, PlaneswalkerAbilities } from '../types';
import {
  STD_W, STD_H, STD_LAYOUT,
  PW_W, PW_H, PW_LAYOUT, PW_TALL_LAYOUT,
  SAGA_LAYOUT,
  BTL_W, BTL_H, BTL_LAYOUT,
  CLASS_LAYOUT,
  ASSETS_DIR,
} from '../layout';
import {
  drawArt, drawCorners, drawSetSymbol, drawBottomInfo, drawManaCost,
  getTypeLine, primaryFrameColorCode, normalizeFrameColors, normalizeAccentColors,
  drawColorIndicator, drawFrame, drawGradientCrowns,
} from '../helpers';
import { drawSingleLineText, drawWrappedText, drawRulesAndFlavor, type ExclusionRect } from '../text';
import { planeswalkerHooks } from './planeswalker';
import { sagaHooks } from './saga';
import { classHooks } from './class';
import { battleHooks } from './battle';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLayout = Record<string, any>;

export interface TemplateHooks {
  preFrame?: (ctx: SKRSContext2D, card: CardData, layout: AnyLayout, cw: number, ch: number) => Promise<void>;
  body?: (ctx: SKRSContext2D, card: CardData, layout: AnyLayout, cw: number, ch: number) => Promise<void>;
}

interface TemplateConfig {
  layout: AnyLayout;
  w: number;
  h: number;
  frame: string;
  hooks?: TemplateHooks;
}

const TEMPLATES: Record<string, TemplateConfig> = {
  standard:           { layout: STD_LAYOUT, w: STD_W, h: STD_H, frame: 'standard' },
  planeswalker:       { layout: PW_LAYOUT, w: PW_W, h: PW_H, frame: 'planeswalker', hooks: planeswalkerHooks },
  'planeswalker_tall': { layout: PW_TALL_LAYOUT, w: PW_W, h: PW_H, frame: 'planeswalker_tall', hooks: planeswalkerHooks },
  saga:               { layout: SAGA_LAYOUT, w: PW_W, h: PW_H, frame: 'saga', hooks: sagaHooks },
  class:              { layout: CLASS_LAYOUT, w: PW_W, h: PW_H, frame: 'class', hooks: classHooks },
  battle:             { layout: BTL_LAYOUT, w: BTL_W, h: BTL_H, frame: 'battle', hooks: battleHooks },
};

/** Extract ParsedAbilities from card, handling string | ParsedAbilities | undefined. */
export function getParsedAbilities(card: CardData): ParsedAbilities {
  if (card.abilities && typeof card.abilities === 'object') return card.abilities;
  return {};
}

export function resolveTemplate(card: CardData): string {
  const pa = getParsedAbilities(card);
  if (pa.structuredAbilities?.kind === 'planeswalker') {
    const pw = pa.structuredAbilities as PlaneswalkerAbilities;
    const totalAbilities = (pa.unstructuredAbilities?.length ?? 0) + pw.loyaltyAbilities.length;
    return totalAbilities >= 4 ? 'planeswalker_tall' : 'planeswalker';
  }
  if (pa.structuredAbilities?.kind === 'saga') return 'saga';
  if (pa.structuredAbilities?.kind === 'class') return 'class';
  if (card.battleDefense) return 'battle';
  return 'standard';
}

export async function renderCardImage(card: CardData, templateOverride?: string): Promise<Buffer> {
  const templateKey = templateOverride ?? resolveTemplate(card);
  const config = TEMPLATES[templateKey] ?? TEMPLATES.standard;
  const { layout: L, w: cw, h: ch, frame, hooks } = config;

  const fc = primaryFrameColorCode(card.frameColor);
  const frameCodes = normalizeFrameColors(card.frameColor);
  const accentCodes = normalizeAccentColors(card.accentColor);
  const crownCodes = accentCodes ?? frameCodes;

  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, cw, ch);

  // Art
  if (card.artUrl) await drawArt(ctx, card.artUrl, L.art, cw, ch);

  // Pre-frame hook (e.g. planeswalker ability backgrounds)
  if (hooks?.preFrame) await hooks.preFrame(ctx, card, L, cw, ch);

  // Frame
  await drawFrame(ctx, frame, card.frameColor, card.accentColor, cw, ch);

  // Legend crown (planeswalkers use their own frame treatment)
  if (L.crown && card.supertypes?.includes('legendary') && !templateKey.startsWith('planeswalker')) {
    const crownPath = path.join(ASSETS_DIR, 'crowns', `${crownCodes[0]}.png`);
    if (fs.existsSync(crownPath)) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, cw, (137 / 2814) * ch);
      const maskPath = path.join(ASSETS_DIR, 'crowns', 'maskCrownPinline.png');
      const maskImg = fs.existsSync(maskPath) ? await loadImage(maskPath) : null;
      await drawGradientCrowns(ctx, crownCodes, L.crown.x * cw, L.crown.y * ch, L.crown.w * cw, L.crown.h * ch, maskImg, cw, ch);
    }
  }

  // P/T box image
  if (L.ptBox && card.power !== undefined && card.toughness !== undefined) {
    const ptPath = path.join(ASSETS_DIR, 'pt', `${fc}.png`);
    if (fs.existsSync(ptPath)) {
      ctx.drawImage(await loadImage(ptPath), L.ptBox.x * cw, L.ptBox.y * ch, L.ptBox.w * cw, L.ptBox.h * ch);
    }
  }

  // Template-specific body (abilities, chapters, levels, etc.)
  if (hooks?.body) await hooks.body(ctx, card, L, cw, ch);

  // Set symbol
  if (L.setSymbol) {
    await drawSetSymbol(ctx, card.rarity || 'common', L.setSymbol, ch, cw);
  }

  // Name
  drawSingleLineText(ctx, card.name ?? '', L.name.x * cw, L.name.y * ch, L.name.w * cw, L.name.h * ch, L.name.font, L.name.size * ch);

  // Mana cost
  if (card.manaCost) await drawManaCost(ctx, card.manaCost, cw, ch, L.mana);

  // Type line + color indicator
  const typeX = L.type.x * cw;
  const typeY = L.type.y * ch;
  const typeH = L.type.h * ch;
  const indicatorOffset = drawColorIndicator(ctx, card.colorIndicator, typeX, typeY, typeH);
  drawSingleLineText(ctx, getTypeLine(card), typeX + indicatorOffset, typeY, L.type.w * cw - indicatorOffset, typeH, L.type.font, L.type.size * ch);

  // Rules + flavor text (for templates with a rules area)
  const pa = getParsedAbilities(card);
  const rulesText = pa.unstructuredAbilities?.join('\n');
  if (L.rules && (rulesText || card.flavorText)) {
    const rx = L.rules.x * cw, ry = L.rules.y * ch, rw = L.rules.w * cw, rh = L.rules.h * ch, rs = L.rules.size * ch;

    // Build exclusion rects for badges that overlap the rules area (e.g. battle defense/backPt)
    // Horizontal padding so text doesn't butt up against badges
    const exclusionRects: ExclusionRect[] = [];
    const hPad = rs * 0.3;
    if (L.defense && card.battleDefense !== undefined) {
      exclusionRects.push({ x: L.defense.x * cw - hPad, y: L.defense.y * ch, w: L.defense.w * cw + hPad, h: L.defense.h * ch });
    }
    if (L.backPt && card.linkedCard?.power !== undefined && card.linkedCard?.toughness !== undefined) {
      exclusionRects.push({ x: L.backPt.x * cw - hPad, y: L.backPt.y * ch, w: L.backPt.w * cw + hPad, h: L.backPt.h * ch });
    }

    if (rulesText && card.flavorText) drawRulesAndFlavor(ctx, rulesText, card.flavorText, rx, ry, rw, rh, L.rules.font, rs, exclusionRects);
    else if (rulesText) drawWrappedText(ctx, rulesText, rx, ry, rw, rh, L.rules.font, rs, { exclusionRects });
    else if (card.flavorText) drawWrappedText(ctx, card.flavorText, rx, ry, rw, rh, L.rules.font, rs, { fontFamily: 'MPlantin Italic', exclusionRects });
  }

  // P/T text
  if (L.pt && card.power !== undefined && card.toughness !== undefined) {
    const ptFrameColor = Array.isArray(card.frameColor) ? card.frameColor[0] : card.frameColor;
    const ptColor = ptFrameColor === 'vehicle' ? 'white' : 'black';
    drawSingleLineText(ctx, `${card.power}/${card.toughness}`, L.pt.x * cw, L.pt.y * ch, L.pt.w * cw, L.pt.h * ch, L.pt.font, L.pt.size * ch, 'center', ptColor);
  }

  // Bottom info (battles: rotated to portrait orientation along right edge)
  if (templateKey === 'battle') {
    ctx.save();
    ctx.translate(cw, 0);
    ctx.rotate(Math.PI / 2);
    drawBottomInfo(ctx, card, ch, cw);
    ctx.restore();
  } else {
    drawBottomInfo(ctx, card, cw, ch);
  }

  // Corners
  drawCorners(ctx, cw, ch);

  return canvas.toBuffer('image/png');
}
