import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { NormalizedCardData } from '../types';
import { drawSingleLineText, drawWrappedText, drawRulesAndFlavor } from '../text';
import { drawArt, drawManaCost, drawSetSymbol, measureManaCostWidth, drawFrame, frameColorCode } from '../helpers';
import { getParsedAbilities, formatTypeLine } from '../parser';
import { SPLIT_RIGHT_LAYOUT, SPLIT_LEFT_LAYOUT } from '../layout';
import { ASSETS_DIR } from '../assets-dir';
import type { TemplateHooks } from './render';
import { placeElement } from './element';

/**
 * Split card renderer.
 *
 * Each half's text reads sideways. In the new convention every element
 * carries its own `angle: -90` and (x, y) is the local upper-left on the
 * tall canvas. `placeElement` translates to the anchor and rotates, so each
 * draw call works in a normal left-to-right local frame.
 */

async function renderSplitText(
  ctx: SKRSContext2D,
  card: NormalizedCardData,
  L: typeof SPLIT_RIGHT_LAYOUT,
  cw: number, ch: number,
  clipYMin: number, clipYMax: number,
) {
  ctx.save();
  // Clip to this half (canvas space).
  ctx.beginPath();
  ctx.rect(0, clipYMin, cw, clipYMax - clipYMin);
  ctx.clip();

  const manaW = card.manaCost ? measureManaCostWidth(card.manaCost, ch, L.mana.size) : 0;

  // Mana cost — anchored at its (x, y); drawn right-aligned at the local origin.
  if (card.manaCost) {
    await placeElement(ctx, L.mana, cw, ch, () => {
      // Use drawManaCost in normal cw/ch order; right-edge anchor at local (0, 0).
      return drawManaCost(ctx, card.manaCost!, cw, ch, {
        y: 0, w: 0,
        size: L.mana.size, shadowX: L.mana.shadowX, shadowY: L.mana.shadowY,
      });
    });
  }

  // Name — left-aligned in its local box, shrunk to avoid mana cost overlap.
  placeElement(ctx, L.name, cw, ch, ({ wDim, hDim }) => {
    const localBoxW = L.name.w * wDim - manaW;
    drawSingleLineText(ctx, card.name ?? '', 0, 0, localBoxW, L.name.h * hDim,
      L.name.font, L.name.size * ch, 'left', 'black');
  });

  // Type line.
  placeElement(ctx, L.type, cw, ch, ({ wDim, hDim }) => {
    drawSingleLineText(ctx, formatTypeLine(card.typeLine), 0, 0,
      L.type.w * wDim, L.type.h * hDim,
      L.type.font, L.type.size * ch, 'left', 'black');
  });

  // Set symbol — anchored at right-edge / vertical-center.
  // drawSetSymbol's signature is (ctx, rarity, layout, ch, cw); pass ch then cw.
  await placeElement(ctx, L.setSymbol, cw, ch, () => {
    return drawSetSymbol(ctx, card.rarity || 'common',
      { x: 0, y: 0, w: 0, h: L.setSymbol.h }, ch, cw);
  });

  // Rules text.
  const pa = getParsedAbilities(card);
  const rulesText = pa.unstructuredAbilities?.join('\n');
  placeElement(ctx, L.rules, cw, ch, ({ wDim, hDim }) => {
    const rw = L.rules.w * wDim;
    const rh = L.rules.h * hDim;
    if (rulesText && card.flavorText) {
      drawRulesAndFlavor(ctx, rulesText, card.flavorText, 0, 0, rw, rh, L.rules.font, L.rules.size * ch, []);
    } else if (rulesText) {
      drawWrappedText(ctx, rulesText, 0, 0, rw, rh, L.rules.font, L.rules.size * ch);
    } else if (card.flavorText) {
      drawWrappedText(ctx, card.flavorText, 0, 0, rw, rh, L.rules.font, L.rules.size * ch, { fontFamily: 'MPlantin Italic' });
    }
  });

  ctx.restore();
}

const splitBody: TemplateHooks['body'] = async (ctx, card, L, cw, ch) => {
  const other = card.linkedCard;
  const frameDir = L._frame ?? 'split';
  const splitY = (1000 / 2100) * ch;

  // Draw each half's frame clipped to its region.
  // Each half may itself be multi-color (hybrid) — use horizontal gradient within that half.
  // Top half = other (right card), bottom half = card (left card).
  const frontCodes = card.frameColor.map(c => frameColorCode(c));
  const backCodes = other ? other.frameColor.map(c => frameColorCode(c)) : frontCodes;
  const frontAccent = card.accentColor.length > 0 ? card.accentColor.map(c => frameColorCode(c)) : undefined;
  const backAccent = other && other.accentColor.length > 0 ? other.accentColor.map(c => frameColorCode(c)) : frontAccent;

  // Draw each half's frame. For fuse, use Card Conjurer's top alpha mask so the
  // fuse strip stays attached to the correct half and the seam gets a soft fade.
  // Bottom half is drawn first as the base; top half is layered through the mask.
  // For non-fuse split, rect-clip is fine — the frame art has its own pinline at topH.
  const topH = Math.round(splitY);
  const isFuse = frameDir === 'fuse';
  const fuseTopMask = path.join(ASSETS_DIR, 'masks', 'fuse-top.png');
  const useFuseMask = isFuse && fs.existsSync(fuseTopMask);

  if (useFuseMask) {
    // Bottom half (card/left card) as full-canvas base
    const bottomCanvas = createCanvas(cw, ch);
    await drawFrame(bottomCanvas.getContext('2d'), frameDir, frontCodes, frontAccent, cw, ch, undefined, undefined,
      { horizontal: true, gradientRange: { start: topH, end: ch } });
    ctx.drawImage(bottomCanvas, 0, 0);

    // Top half (other/right card) masked over the base
    const topCanvas = createCanvas(cw, ch);
    await drawFrame(topCanvas.getContext('2d'), frameDir, backCodes, backAccent, cw, ch, undefined, undefined,
      { horizontal: true, gradientRange: { start: 0, end: topH } });
    const masked = createCanvas(cw, ch);
    const mCtx = masked.getContext('2d');
    mCtx.drawImage(await loadImage(fuseTopMask), 0, 0, cw, ch);
    mCtx.globalCompositeOperation = 'source-in';
    mCtx.drawImage(topCanvas, 0, 0);
    ctx.drawImage(masked, 0, 0);
  } else {
    // Top half (other/right card)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, topH);
    ctx.clip();
    await drawFrame(ctx, frameDir, backCodes, backAccent, cw, ch, undefined, undefined,
      { horizontal: true, gradientRange: { start: 0, end: topH } });
    ctx.restore();

    // Bottom half (card/left card)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, topH, cw, ch - topH);
    ctx.clip();
    await drawFrame(ctx, frameDir, frontCodes, frontAccent, cw, ch, undefined, undefined,
      { horizontal: true, gradientRange: { start: topH, end: ch } });
    ctx.restore();
  }

  // Draw art for both halves — user supplies landscape, we rotate -90° into portrait boxes
  const allowUnsafe = (L as any)._allowUnsafeArtUrls;
  if (card.artUrl) await drawArt(ctx, card.artUrl, SPLIT_LEFT_LAYOUT.art, cw, ch, { rotate: -90, allowUnsafe });
  if (other?.artUrl) await drawArt(ctx, other.artUrl, SPLIT_RIGHT_LAYOUT.art, cw, ch, { rotate: -90, allowUnsafe });

  // Render text for both halves, clipping each to its half
  await renderSplitText(ctx, card, SPLIT_LEFT_LAYOUT, cw, ch, splitY, ch);
  if (other) {
    await renderSplitText(ctx, other, SPLIT_RIGHT_LAYOUT, cw, ch, 0, splitY);
  }

  // Fuse reminder strip — spans across both halves along the read-bottom of the card.
  // Parser strips this line from abilities, so we re-render it from the canonical text here.
  // Uses drawWrappedText so the parenthetical reminder gets the standard italic styling.
  if (isFuse && (L as any).fuseText) {
    const ft = (L as any).fuseText;
    placeElement(ctx, ft, cw, ch, ({ wDim, hDim }) => {
      drawWrappedText(
        ctx,
        'Fuse (You may cast one or both halves of this card from your hand.)',
        0, 0, ft.w * wDim, ft.h * hDim,
        ft.font, ft.size * ch,
      );
    });
  }
};

export const splitHooks: TemplateHooks = { body: splitBody, skipStandardText: true, skipStandardFrame: true };
