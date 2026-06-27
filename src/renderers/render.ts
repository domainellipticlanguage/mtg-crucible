import type { Ctx, RenderCanvas } from '../platform';
import { createCanvas, loadAssetImage, encode } from '../platform';
import type { NormalizedCardData, RenderQuality, RenderFormat } from '../types';
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
  FUSE_LAYOUT,
  FLIP_LAYOUT,
  MUTATE_LAYOUT,
  PROTO_LAYOUT,
  LEVELER_LAYOUT,
  AFTERMATH_LAYOUT,
  PREPARE_LAYOUT,
  OMEN_LAYOUT,
  ROOM_LAYOUT,
  FOOTER_LAYOUT,
} from '../layout';
import { getParsedAbilities, formatTypeLine } from '../parser';

import {
  drawArt, drawCorners, drawSetSymbol, drawBottomInfo,
  frameColorCode,
  drawColorIndicator, drawFrame, drawGradientCrowns,
  ensureInitialized, resolvePtImage,
} from '../helpers';
import { collectSymbolKeys, preloadSymbols } from '../symbols';
import { drawSingleLineText, drawWrappedText, drawRulesAndFlavor, type ExclusionRect } from '../text';
import { drawNameAndMana } from './element';
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
import { prepareHooks } from './prepare';
import { omenHooks } from './omen';
import { roomHooks } from './room';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLayout = Record<string, any>;

export interface TemplateHooks {
  preFrame?: (ctx: Ctx, card: NormalizedCardData, layout: AnyLayout, cw: number, ch: number) => Promise<void>;
  body?: (ctx: Ctx, card: NormalizedCardData, layout: AnyLayout, cw: number, ch: number) => Promise<void>;
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

export const TEMPLATES: Record<string, TemplateConfig> = {
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
  fuse:               { layout: FUSE_LAYOUT, w: PW_W, h: PW_H, frame: 'fuse', hooks: splitHooks },
  flip:               { layout: FLIP_LAYOUT, w: PW_W, h: PW_H, frame: 'flip', hooks: flipHooks },
  mutate:             { layout: MUTATE_LAYOUT, w: PW_W, h: PW_H, frame: 'mutate', hooks: mutateHooks },
  prototype:          { layout: PROTO_LAYOUT, w: PW_W, h: PW_H, frame: 'standard', hooks: prototypeHooks },
  leveler:            { layout: LEVELER_LAYOUT, w: PW_W, h: PW_H, frame: 'leveler', hooks: levelerHooks },
  aftermath:          { layout: AFTERMATH_LAYOUT, w: PW_W, h: PW_H, frame: 'aftermath', hooks: aftermathHooks },
  prepare:            { layout: PREPARE_LAYOUT, w: PW_W, h: PW_H, frame: 'prepare', hooks: prepareHooks },
  omen:               { layout: OMEN_LAYOUT, w: PW_W, h: PW_H, frame: 'omen', hooks: omenHooks },
  room:               { layout: ROOM_LAYOUT, w: PW_W, h: PW_H, frame: 'room', hooks: roomHooks },
};

// Quality scale factors relative to standard 2010x2814
const QUALITY_SCALE: Record<RenderQuality, number> = {
  high: 1,
  medium: 745 / STD_W,
  low: 350 / STD_W,
};

function isDebug(): boolean {
  return typeof process !== 'undefined' && !!process.env?.MTG_CRUCIBLE_DEBUG;
}

export async function renderCardImage(card: NormalizedCardData, templateOverride?: string, quality: RenderQuality = 'high', format: RenderFormat = 'png', allowUnsafeArtUrls = false): Promise<Uint8Array> {
  // Register fonts once, then warm only the symbols this card actually uses so the
  // synchronous rules-text layout can resolve them. Covers every render entry
  // point (renderCard, the individual renderers, and back-face renders).
  await ensureInitialized();
  await preloadSymbols(collectSymbolKeys(card));

  const templateKey = templateOverride ?? card.cardTemplate;
  const config = TEMPLATES[templateKey] ?? TEMPLATES.standard;
  // Shallow-clone the layout so hooks (notably preFrame) can mutate top-level
  // entries per-card without leaking back to the cached module-level JSON.
  // Hooks that need to swap a sub-object should assign a new one (`L.x = {...L.x, ...}`).
  const { layout: cachedLayout, w: cw, h: ch, frame, hooks, crownDir, ptDir } = config;
  const L = { ...cachedLayout };

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
  if (card.artUrl) await drawArt(ctx, card.artUrl, artBounds, cw, ch, { allowUnsafe: allowUnsafeArtUrls });

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
    // Pass the base template so masks resolve even when frameDirs is all effect
    // dirs (e.g. nyx/snow) — masks live under base template names.
    await drawFrame(ctx, frameDirs, expandedFrameColor, accentCodes, cw, ch, nameLineCodes, typeLineCodes, { maskTemplate: frame });
  }

  // Template-specific body (abilities, chapters, levels, etc.)
  // Expose frame dir + unsafe-art flag to hooks via a transient layout clone, so we don't
  // mutate the cached/imported layout object (which would otherwise leak these fields back
  // to disk when the dev-server saves the layout).
  const bodyLayout = { ...L, _frame: frame, _allowUnsafeArtUrls: allowUnsafeArtUrls };
  if (hooks?.body) await hooks.body(ctx, card, bodyLayout, cw, ch);

  // Legend crown (planeswalkers use their own frame treatment)
  // Drawn after body hook so it sits above any body overlays (e.g. prepare pinline).
  if (L.crown && card.typeLine.supertypes.includes('legendary') && !templateKey.startsWith('planeswalker')) {
    const crownBase = crownDir ? `crowns/${crownDir}` : 'crowns';
    const crownImg = await loadAssetImage(`${crownBase}/${crownCodes[0]}.png`);
    if (crownImg) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, cw, (137 / 2814) * ch);
      const maskImg = await loadAssetImage('crowns/maskCrownPinline.png');
      await drawGradientCrowns(ctx, crownCodes, L.crown.x * cw, L.crown.y * ch, L.crown.w * cw, L.crown.h * ch, maskImg, cw, ch, crownBase);
    }
  }

  // P/T box image — drawn after body hook so it sits above any body overlays (e.g. prepare panel)
  if (L.ptBox && card.power && card.toughness) {
    const ptBase = ptDir ? `pt/${ptDir}` : 'pt';
    const bx = L.ptBox.x * cw, by = L.ptBox.y * ch, bw = L.ptBox.w * cw, bh = L.ptBox.h * ch;
    if (ptBoxCodes.length === 1) {
      const ptImg = await resolvePtImage(ptBase, ptBoxCodes[0]);
      if (ptImg) {
        ctx.drawImage(ptImg, bx, by, bw, bh);
      }
    } else {
      // Gradient blend: draw base, then overlay each subsequent color through a sine-smoothed mask
      const n = ptBoxCodes.length;
      const basePtImg = await resolvePtImage(ptBase, ptBoxCodes[0]);
      if (basePtImg) {
        ctx.drawImage(basePtImg, bx, by, bw, bh);
      }
      // The leftmost 39px of the 377px-wide PT asset is drop shadow — skip it when dividing zones
      const shadowFrac = 39 / 377;
      const contentStart = shadowFrac * bw;
      const contentW = bw - contentStart;
      for (let i = 1; i < n; i++) {
        const ptImg = await resolvePtImage(ptBase, ptBoxCodes[i]);
        if (!ptImg) continue;
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
        offCtx.drawImage(ptImg, 0, 0, bw, bh);
        ctx.drawImage(offscreen, bx, by);
      }
    }
  }

  const debugRects: { color: string; x: number; y: number; w: number; h: number }[] = [];

  if (!hooks?.skipStandardText) {
    // Set symbol — modern convention: back faces of transform/mdfc cards don't show
    // a rarity indicator (the front face's set symbol represents the whole card).
    let setSymW = 0;
    const isBackFace = templateKey === 'transform_back' || templateKey === 'mdfc_back';
    if (L.setSymbol && !isBackFace) {
      setSymW = await drawSetSymbol(ctx, card.rarity || 'common', L.setSymbol, ch, cw);
    }

    // Name + mana cost (name width derived from the mana geometry)
    await drawNameAndMana(ctx, L.name, L.mana, cw, ch, card.name ?? '', card.manaCost, { color: L.name.color ?? textColor });

    // Type line + color indicator (shrink available width to avoid set symbol)
    const typeX = L.type.x * cw;
    const typeY = L.type.y * ch;
    const typeH = L.type.h * ch;
    const indicatorOffset = drawColorIndicator(ctx, card.colorIndicator, typeX, typeY, typeH);
    const typeW = L.type.w * cw - indicatorOffset - setSymW;
    drawSingleLineText(ctx, formatTypeLine(card.typeLine), typeX + indicatorOffset, typeY, typeW, typeH, L.type.font, L.type.size * ch, 'left', L.type.color ?? textColor);

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
      if (L.ptBox && card.power && card.toughness) {
        exclusionRects.push({ x: L.ptBox.x * cw - hPad + 50, y: L.ptBox.y * ch, w: L.ptBox.w * cw + hPad, h: L.ptBox.h * ch });
      }
      if (L.loyalty && card.startingLoyalty) {
        exclusionRects.push({ x: L.loyalty.x * cw - hPad, y: L.loyalty.y * ch, w: L.loyalty.w * cw + hPad, h: L.loyalty.h * ch });
      }
      // MDFC flipside hint box: shrink rules area so text doesn't overlap
      if (L.flipside && card.linkedCard) {
        const flipsideTop = L.flipside.y * ch;
        const rulesBottom = ry + rh;
        if (flipsideTop < rulesBottom) {
          rh = flipsideTop - ry;
        }
      }

      if (isDebug()) {
        debugRects.push({ color: 'blue', x: rx, y: ry, w: rw, h: rh });
        for (const r of exclusionRects) {
          debugRects.push({ color: 'red', ...r });
        }
      }

      if (rulesText && card.flavorText) drawRulesAndFlavor(ctx, rulesText, card.flavorText, rx, ry, rw, rh, L.rules.font, rs, exclusionRects);
      else if (rulesText) drawWrappedText(ctx, rulesText, rx, ry, rw, rh, L.rules.font, rs, { exclusionRects });
      else if (card.flavorText) drawWrappedText(ctx, card.flavorText, rx, ry, rw, rh, L.rules.font, rs, { fontFamily: 'MPlantin Italic', exclusionRects });
    }

    // P/T text
    if (L.pt && card.power && card.toughness) {
      const ptTextColor = L.textColor || 'black';
      drawSingleLineText(ctx, `${card.power}/${card.toughness}`, L.pt.x * cw, L.pt.y * ch, L.pt.w * cw, L.pt.h * ch, L.pt.font, L.pt.size * ch, 'center', ptTextColor);
    }
  }

  // Bottom info (battles: rotated to portrait orientation along right edge)
  if (templateKey === 'battle') {
    ctx.save();
    ctx.translate(cw, 0);
    ctx.rotate(Math.PI / 2);
    await drawBottomInfo(ctx, card, ch, cw, FOOTER_LAYOUT);
    ctx.restore();
  } else {
    await drawBottomInfo(ctx, card, cw, ch, FOOTER_LAYOUT);
  }

  // Corners
  drawCorners(ctx, cw, ch, format);

  // Debug overlays (drawn last so they're always visible)
  if (isDebug() && debugRects.length > 0) {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    for (const r of debugRects) {
      ctx.strokeStyle = r.color;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
    ctx.restore();
  }

  // Battles are rendered landscape; rotate to portrait for output
  if (frame === 'battle') {
    const rotated = createCanvas(ch, cw);
    const rctx = rotated.getContext('2d');
    rctx.translate(0, cw);
    rctx.rotate(-Math.PI / 2);
    rctx.drawImage(canvas, 0, 0);
    return scaleOutput(rotated, STD_W, STD_H, quality, format);
  }

  return scaleOutput(canvas, STD_W, STD_H, quality, format);
}

const WEBP_QUALITY: Record<RenderQuality, number> = { low: 60, medium: 70, high: 80 };

function encodeCanvas(canvas: RenderCanvas, format: RenderFormat, quality: RenderQuality): Promise<Uint8Array> {
  return encode(canvas, format, format === 'webp' ? WEBP_QUALITY[quality] : undefined);
}

function scaleOutput(source: RenderCanvas, targetW: number, targetH: number, quality: RenderQuality, format: RenderFormat): Promise<Uint8Array> {
  const scale = QUALITY_SCALE[quality];
  const outW = Math.round(targetW * scale);
  const outH = Math.round(targetH * scale);
  if (source.width === outW && source.height === outH) {
    return encodeCanvas(source, format, quality);
  }
  // Step-down scaling: halve dimensions iteratively for much better resampling
  let current: RenderCanvas = source;
  while (current.width / 2 >= outW && current.height / 2 >= outH) {
    const halfW = Math.round(current.width / 2);
    const halfH = Math.round(current.height / 2);
    const step = createCanvas(halfW, halfH);
    const sctx = step.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(current, 0, 0, halfW, halfH);
    current = step;
  }
  // Final step to exact target dimensions
  const out = createCanvas(outW, outH);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(current, 0, 0, outW, outH);
  return encodeCanvas(out, format, quality);
}
