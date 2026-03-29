import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { NormalizedCardData, TemplateName } from '../types';
import {
  STD_W, STD_H, STD_LAYOUT,
  PW_W, PW_H, PW_LAYOUT, PW_TALL_LAYOUT,
  SAGA_LAYOUT,
  BTL_W, BTL_H, BTL_LAYOUT,
  CLASS_LAYOUT,
  ADV_LAYOUT,
  TF_FRONT_LAYOUT, TF_BACK_LAYOUT,
  MDFC_FRONT_LAYOUT, MDFC_BACK_LAYOUT,
  SPLIT_RIGHT_LAYOUT,
  FLIP_LAYOUT,
  MUTATE_LAYOUT,
  PROTO_LAYOUT,
  LEVELER_LAYOUT,
  AFTERMATH_TOP_LAYOUT,
  ASSETS_DIR,
} from '../layout';
import { getParsedAbilities } from '../parser';

import {
  drawArt, drawCorners, drawSetSymbol, drawBottomInfo, drawManaCost, measureManaCostWidth,
  getTypeLine, frameColorCode,
  drawColorIndicator, drawFrame, drawGradientCrowns,
} from '../helpers';
import { drawSingleLineText, drawWrappedText, drawRulesAndFlavor, type ExclusionRect } from '../text';
import { planeswalkerHooks } from './planeswalker';
import { sagaHooks } from './saga';
import { classHooks } from './class';
import { battleHooks } from './battle';
import { adventureHooks } from './adventure';
import { transformFrontHooks, transformBackHooks, mdfcHooks } from './dfc';
import { splitHooks } from './split';
import { flipHooks } from './flip';
import { mutateHooks } from './mutate';
import { prototypeHooks } from './prototype';
import { levelerHooks } from './leveler';
import { aftermathHooks } from './aftermath';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLayout = Record<string, any>;

export interface TemplateHooks {
  preFrame?: (ctx: SKRSContext2D, card: NormalizedCardData, layout: AnyLayout, cw: number, ch: number) => Promise<void>;
  body?: (ctx: SKRSContext2D, card: NormalizedCardData, layout: AnyLayout, cw: number, ch: number) => Promise<void>;
  /** If true, the hook handles ALL text rendering (name, type, mana, rules, P/T). */
  skipStandardText?: boolean;
  /** If true, the hook handles frame rendering. */
  skipStandardFrame?: boolean;
}

interface TemplateConfig {
  layout: AnyLayout;
  w: number;
  h: number;
  frame: string;
  hooks?: TemplateHooks;
  /** Override crown asset directory (e.g. 'transformFront', 'transformBack', 'modal') */
  crownDir?: string;
  /** Override P/T box asset directory (e.g. 'transform') */
  ptDir?: string;
}

const TEMPLATES: Record<string, TemplateConfig> = {
  standard:           { layout: STD_LAYOUT, w: STD_W, h: STD_H, frame: 'standard' },
  planeswalker:       { layout: PW_LAYOUT, w: PW_W, h: PW_H, frame: 'planeswalker', hooks: planeswalkerHooks },
  'planeswalker_tall': { layout: PW_TALL_LAYOUT, w: PW_W, h: PW_H, frame: 'planeswalker_tall', hooks: planeswalkerHooks },
  saga:               { layout: SAGA_LAYOUT, w: PW_W, h: PW_H, frame: 'saga', hooks: sagaHooks },
  class:              { layout: CLASS_LAYOUT, w: PW_W, h: PW_H, frame: 'class', hooks: classHooks },
  battle:             { layout: BTL_LAYOUT, w: BTL_W, h: BTL_H, frame: 'battle', hooks: battleHooks },
  adventure:          { layout: ADV_LAYOUT, w: PW_W, h: PW_H, frame: 'adventure', hooks: adventureHooks },
  transform_front:    { layout: TF_FRONT_LAYOUT, w: PW_W, h: PW_H, frame: 'transformFront', hooks: transformFrontHooks, crownDir: 'transformFront' },
  transform_back:     { layout: TF_BACK_LAYOUT, w: PW_W, h: PW_H, frame: 'transformBack', hooks: transformBackHooks, crownDir: 'transformBack', ptDir: 'transform' },
  mdfc_front:         { layout: MDFC_FRONT_LAYOUT, w: PW_W, h: PW_H, frame: 'modalFront', hooks: mdfcHooks, crownDir: 'modal' },
  mdfc_back:          { layout: MDFC_BACK_LAYOUT, w: PW_W, h: PW_H, frame: 'modalBack', hooks: mdfcHooks, crownDir: 'modal' },
  split:              { layout: SPLIT_RIGHT_LAYOUT, w: PW_W, h: PW_H, frame: 'split', hooks: splitHooks },
  fuse:               { layout: SPLIT_RIGHT_LAYOUT, w: PW_W, h: PW_H, frame: 'fuse', hooks: splitHooks },
  flip:               { layout: FLIP_LAYOUT, w: PW_W, h: PW_H, frame: 'flip', hooks: flipHooks },
  mutate:             { layout: MUTATE_LAYOUT, w: PW_W, h: PW_H, frame: 'mutate', hooks: mutateHooks },
  prototype:          { layout: PROTO_LAYOUT, w: PW_W, h: PW_H, frame: 'standard', hooks: prototypeHooks },
  leveler:            { layout: LEVELER_LAYOUT, w: PW_W, h: PW_H, frame: 'leveler', hooks: levelerHooks },
  aftermath:          { layout: AFTERMATH_TOP_LAYOUT, w: PW_W, h: PW_H, frame: 'aftermath', hooks: aftermathHooks },
};

export async function renderCardImage(card: NormalizedCardData, templateOverride?: string): Promise<Buffer> {
  const templateKey = templateOverride ?? card.cardTemplate;
  const config = TEMPLATES[templateKey] ?? TEMPLATES.standard;
  const { layout: L, w: cw, h: ch, frame, hooks, crownDir, ptDir } = config;

  // Convert FrameColor names to single-letter codes once at the top of the pipeline
  const frameCodes = card.frameColor.map(c => frameColorCode(c));
  const accentCodes = card.accentColor.length > 0 ? card.accentColor.map(c => frameColorCode(c)) : undefined;
  const crownCodes = accentCodes ?? frameCodes;

  // Text color override (transform back uses white)
  const textColor = L.textColor || 'black';

  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, cw, ch);

  // Art (colorless and devoid frames are full-bleed)
  const isFullBleed = card.frameColor[0] === 'colorless' || card.frameEffect.includes('devoid');
  const artBounds = isFullBleed ? { x: 0, y: 0, w: 1, h: 1 } : L.art;
  if (card.artUrl) await drawArt(ctx, card.artUrl, artBounds, cw, ch);

  // Pre-frame hook (e.g. planeswalker ability backgrounds)
  if (hooks?.preFrame) await hooks.preFrame(ctx, card, L, cw, ch);

  // Frame — resolve per-color directories based on frame effects
  // When effects and colors aren't 1:1, compute LCM to split into enough segments.
  const effects = card.frameEffect;

  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const lcm = (a: number, b: number) => (a * b) / gcd(a, b);
  const segmentCount = lcm(frameCodes.length, effects.length);

  // Stretch each element proportionally across segments (not interleaved)
  const stretchExpand = <T>(arr: T[], count: number): T[] => {
    const segsPerItem = count / arr.length;
    return Array.from({ length: count }, (_, i) => arr[Math.floor(i / segsPerItem)]);
  };
  const expandedColors = stretchExpand(frameCodes, segmentCount);
  const expandedEffects = stretchExpand(effects, segmentCount);

  const frameDirs = expandedColors.map((_, i) => {
    const effect = expandedEffects[i];
    if (effect === 'normal') return frame;
    if (frame !== 'standard') {
      console.warn(`Frame effect '${effect}' is not supported for '${frame}' layout, falling back to normal`);
      return frame;
    }
    return effect;
  });

  // Expand frameColor codes to match segment count
  const expandedFrameColor = stretchExpand(frameCodes, segmentCount);

  const nameLineCodes = card.nameLineColor.map(c => frameColorCode(c));
  const typeLineCodes = card.typeLineColor.map(c => frameColorCode(c));
  const ptBoxCodes = card.ptBoxColor.length > 0
    ? card.ptBoxColor.map(c => frameColorCode(c))
    : typeLineCodes;

  if (!hooks?.skipStandardFrame) {
    await drawFrame(ctx, frameDirs, expandedFrameColor, accentCodes, cw, ch, nameLineCodes, typeLineCodes);
  }

  // Legend crown (planeswalkers use their own frame treatment)
  if (L.crown && card.supertypes?.includes('legendary') && !templateKey.startsWith('planeswalker')) {
    const crownBase = crownDir ? path.join(ASSETS_DIR, 'crowns', crownDir) : path.join(ASSETS_DIR, 'crowns');
    const crownPath = path.join(crownBase, `${crownCodes[0]}.png`);
    if (fs.existsSync(crownPath)) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, cw, (137 / 2814) * ch);
      const maskPath = path.join(ASSETS_DIR, 'crowns', 'maskCrownPinline.png');
      const maskImg = fs.existsSync(maskPath) ? await loadImage(maskPath) : null;
      await drawGradientCrowns(ctx, crownCodes, L.crown.x * cw, L.crown.y * ch, L.crown.w * cw, L.crown.h * ch, maskImg, cw, ch, crownBase);
    }
  }

  // P/T box image
  if (L.ptBox && card.power && card.toughness) {
    const ptBase = ptDir ? path.join(ASSETS_DIR, 'pt', ptDir) : path.join(ASSETS_DIR, 'pt');
    const bx = L.ptBox.x * cw, by = L.ptBox.y * ch, bw = L.ptBox.w * cw, bh = L.ptBox.h * ch;
    if (ptBoxCodes.length === 1) {
      const ptPath = path.join(ptBase, `${ptBoxCodes[0]}.png`);
      if (fs.existsSync(ptPath)) {
        ctx.drawImage(await loadImage(ptPath), bx, by, bw, bh);
      }
    } else {
      // Gradient blend: draw base, then overlay each subsequent color through a sine-smoothed mask
      const n = ptBoxCodes.length;
      const basePtPath = path.join(ptBase, `${ptBoxCodes[0]}.png`);
      if (fs.existsSync(basePtPath)) {
        ctx.drawImage(await loadImage(basePtPath), bx, by, bw, bh);
      }
      // The leftmost 39px of the 377px-wide PT asset is drop shadow — skip it when dividing zones
      const shadowFrac = 39 / 377;
      const contentStart = shadowFrac * bw;
      const contentW = bw - contentStart;
      for (let i = 1; i < n; i++) {
        const ptPath = path.join(ptBase, `${ptBoxCodes[i]}.png`);
        if (!fs.existsSync(ptPath)) continue;
        // Boundary within the content area, offset by shadow
        const boundary = contentStart + (i / n) * contentW;
        const halfTrans = (contentW / n) * 0.5 * 0.5;
        const offscreen = createCanvas(Math.round(bw), Math.round(bh));
        const offCtx = offscreen.getContext('2d');
        const imgData = offCtx.createImageData(Math.round(bw), Math.round(bh));
        const data = imgData.data;
        const mw = Math.round(bw), mh = Math.round(bh);
        for (let x = 0; x < mw; x++) {
          let alpha: number;
          if (x <= boundary - halfTrans) alpha = 0;
          else if (x >= boundary + halfTrans) alpha = 255;
          else {
            const t = (x - (boundary - halfTrans)) / (halfTrans * 2);
            alpha = Math.round((0.5 - 0.5 * Math.cos(t * Math.PI)) * 255);
          }
          for (let y = 0; y < mh; y++) {
            const idx = (y * mw + x) * 4;
            data[idx + 3] = alpha;
          }
        }
        offCtx.putImageData(imgData, 0, 0);
        offCtx.globalCompositeOperation = 'source-in';
        offCtx.drawImage(await loadImage(ptPath), 0, 0, bw, bh);
        ctx.drawImage(offscreen, bx, by);
      }
    }
  }

  // Template-specific body (abilities, chapters, levels, etc.)
  // Expose frame dir to hooks via layout (e.g. split needs it for second-half coloring)
  L._frame = frame;
  if (hooks?.body) await hooks.body(ctx, card, L, cw, ch);

  if (!hooks?.skipStandardText) {
    // Set symbol
    let setSymW = 0;
    if (L.setSymbol) {
      setSymW = await drawSetSymbol(ctx, card.rarity || 'common', L.setSymbol, ch, cw);
    }

    // Mana cost
    if (card.manaCost) await drawManaCost(ctx, card.manaCost, cw, ch, L.mana);

    // Name (shrink available width to avoid mana cost)
    const manaW = card.manaCost ? measureManaCostWidth(card.manaCost, ch, L.mana.size) : 0;
    const nameW = L.name.w * cw - manaW;
    drawSingleLineText(ctx, card.name ?? '', L.name.x * cw, L.name.y * ch, nameW, L.name.h * ch, L.name.font, L.name.size * ch, 'left', L.name.color ?? textColor);

    // Type line + color indicator (shrink available width to avoid set symbol)
    const typeX = L.type.x * cw;
    const typeY = L.type.y * ch;
    const typeH = L.type.h * ch;
    const indicatorOffset = drawColorIndicator(ctx, card.colorIndicator, typeX, typeY, typeH);
    const typeW = L.type.w * cw - indicatorOffset - setSymW;
    drawSingleLineText(ctx, getTypeLine(card), typeX + indicatorOffset, typeY, typeW, typeH, L.type.font, L.type.size * ch, 'left', L.type.color ?? textColor);

    // Rules + flavor text (for templates with a rules area)
    const pa = getParsedAbilities(card);
    const rulesText = pa.unstructuredAbilities?.join('\n');
    if (L.rules && (rulesText || card.flavorText)) {
      const rx = L.rules.x * cw, ry = L.rules.y * ch, rw = L.rules.w * cw, rs = L.rules.size * ch;
      let rh = L.rules.h * ch;

      // Build exclusion rects for badges that overlap the rules area (e.g. battle defense/backPt)
      // Horizontal padding so text doesn't butt up against badges
      const exclusionRects: ExclusionRect[] = [];
      const hPad = rs * 0.3;
      if (L.defense && card.battleDefense) {
        exclusionRects.push({ x: L.defense.x * cw - hPad, y: L.defense.y * ch, w: L.defense.w * cw + hPad, h: L.defense.h * ch });
      }
      if (L.backPt && card.linkedCard?.power && card.linkedCard?.toughness) {
        exclusionRects.push({ x: L.backPt.x * cw - hPad, y: L.backPt.y * ch, w: L.backPt.w * cw + hPad, h: L.backPt.h * ch });
      }
      // MDFC flipside hint box: shrink rules area so text doesn't overlap
      if (L.flipside && card.linkedCard) {
        const flipsideTop = L.flipside.y * ch;
        const rulesBottom = ry + rh;
        if (flipsideTop < rulesBottom) {
          rh = flipsideTop - ry;
        }
      }

      if (rulesText && card.flavorText) drawRulesAndFlavor(ctx, rulesText, card.flavorText, rx, ry, rw, rh, L.rules.font, rs, exclusionRects);
      else if (rulesText) drawWrappedText(ctx, rulesText, rx, ry, rw, rh, L.rules.font, rs, { exclusionRects });
      else if (card.flavorText) drawWrappedText(ctx, card.flavorText, rx, ry, rw, rh, L.rules.font, rs, { fontFamily: 'MPlantin Italic', exclusionRects });
    }

    // P/T text
    if (L.pt && card.power && card.toughness) {
      const ptTextColor = L.textColor || (card.frameColor[0] === 'vehicle' ? 'white' : 'black');
      drawSingleLineText(ctx, `${card.power}/${card.toughness}`, L.pt.x * cw, L.pt.y * ch, L.pt.w * cw, L.pt.h * ch, L.pt.font, L.pt.size * ch, 'center', ptTextColor);
    }
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

  // Battles are rendered landscape; rotate to portrait for output
  if (frame === 'battle') {
    const rotated = createCanvas(ch, cw);
    const rctx = rotated.getContext('2d');
    rctx.translate(0, cw);
    rctx.rotate(-Math.PI / 2);
    rctx.drawImage(canvas, 0, 0);
    return rotated.toBuffer('image/png');
  }

  return canvas.toBuffer('image/png');
}
