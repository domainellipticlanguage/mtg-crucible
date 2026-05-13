import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { NormalizedCardData } from '../types';
import { drawSingleLineText, drawWrappedText, drawRulesAndFlavor, type ExclusionRect } from '../text';
import { drawArt, drawManaCost, drawSetSymbol, measureManaCostWidth, drawFrame, frameColorCode } from '../helpers';
import { getParsedAbilities, formatTypeLine } from '../parser';
import { SPLIT_RIGHT_LAYOUT, SPLIT_LEFT_LAYOUT } from '../layout';
import { ASSETS_DIR } from '../assets-dir';
import type { TemplateHooks, AnyLayout } from './render';

/**
 * Split card renderer.
 *
 * CC coordinates use rotation=-90: the anchor (x, y) is the starting point,
 * "width" spans vertically (up from anchor), "height" spans horizontally.
 *
 * We rotate -90° around each anchor point, then draw in local space where:
 *   local x+ = card y- (upward)
 *   local y+ = card x+ (rightward)
 */

async function renderSplitText(
  ctx: SKRSContext2D,
  card: NormalizedCardData,
  L: typeof SPLIT_RIGHT_LAYOUT,
  cw: number, ch: number,
  clipYMin: number, clipYMax: number,
) {
  // Rotation origin is decoupled from name.y so editing name doesn't shift other entries.
  // Falls back to name.y for layouts that haven't been migrated.
  const origin = ((L as any)._rotationOriginY ?? L.name.y) as number;
  const originY = origin * ch;

  ctx.save();
  ctx.translate(0, originY);
  ctx.rotate(-Math.PI / 2);

  // Clip in rotated local space: local x = originY - canvas_y
  // canvas_y range [clipYMin, clipYMax] → local x range [originY - clipYMax, originY - clipYMin]
  const localXMin = originY - clipYMax;
  const localXMax = originY - clipYMin;
  ctx.beginPath();
  ctx.rect(localXMin, 0, localXMax - localXMin, cw);
  ctx.clip();

  // In rotated space:
  //   local x spans "up" the card = text width direction
  //   local y spans "right" across card = text height direction
  // Font size scales with ch (the dimension text flows along).

  // In rotated local space:
  //   local x+ = card y- (text flows "up" the card, scaled by ch)
  //   local y+ = card x+ (perpendicular, scaled by cw)
  //
  // drawManaCost(ctx, mana, cwArg, chArg, layout) computes:
  //   rightX = layout.w * cwArg    (right edge of mana area)
  //   textY  = layout.y * chArg    (vertical position)
  //   size   = layout.size * chArg (symbol pixel size)
  //
  // We need rightX along local-x (scaled by ch), textY along local-y (scaled by cw),
  // and symbol size proportional to the name bar height (scaled by cw).

  // Mana cost — far right of the name line
  const manaW = card.manaCost ? measureManaCostWidth(card.manaCost, cw, L.mana.size) : 0;
  if (card.manaCost) {
    await drawManaCost(ctx, card.manaCost, ch, cw, {
      y: L.mana.y,
      w: L.mana.w,
      size: L.mana.size,
      shadowX: L.mana.shadowX,
      shadowY: L.mana.shadowY,
    });
  }

  // Name — left-aligned, shrunk to avoid mana cost overlap
  const nameW = L.mana.w * ch - manaW;
  const nameLocalX = (L.name.y - origin) * ch;
  drawSingleLineText(ctx, card.name ?? '', nameLocalX, L.name.x * cw, nameW, L.name.h * cw, L.name.font, L.name.size * ch, 'left', 'black');

  // Type line
  const typeLocalX = (L.type.y - origin) * ch;
  drawSingleLineText(ctx, formatTypeLine(card.typeLine), typeLocalX, L.type.x * cw, L.type.w * ch, L.type.h * cw, L.type.font, L.type.size * ch, 'left', 'black');

  // Set symbol (in rotated space: swap ch/cw)
  await drawSetSymbol(ctx, card.rarity || 'common', L.setSymbol, cw, ch);

  // Rules text
  const pa = getParsedAbilities(card);
  const rulesText = pa.unstructuredAbilities?.join('\n');
  const rulesY = (L.rules.y - origin) * ch;
  const rulesX = L.rules.x * cw;
  const rulesW = L.rules.w * ch;
  const rulesH = L.rules.h * cw;

  // Set symbol exclusion rect in rotated local space
  const setH = L.setSymbol.h * cw;
  const setW = setH; // approximately square
  const setLocalX = (L.setSymbol.x - L.name.y) * ch - setW;
  const setLocalY = L.setSymbol.y * cw - setH / 2;
  const exclusionRects: ExclusionRect[] = [{ x: setLocalX, y: setLocalY, w: setW, h: setH }];

  if (rulesText && card.flavorText) {
    drawRulesAndFlavor(ctx, rulesText, card.flavorText, rulesY, rulesX, rulesW, rulesH, L.rules.font, L.rules.size * ch, exclusionRects);
  } else if (rulesText) {
    drawWrappedText(ctx, rulesText, rulesY, rulesX, rulesW, rulesH, L.rules.font, L.rules.size * ch, { exclusionRects });
  } else if (card.flavorText) {
    drawWrappedText(ctx, card.flavorText, rulesY, rulesX, rulesW, rulesH, L.rules.font, L.rules.size * ch, { fontFamily: 'MPlantin Italic', exclusionRects });
  }

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
  if (isFuse && (L as any).fuseText) {
    const ft = (L as any).fuseText;
    const fuseOrigin = ((L as any)._rotationOriginY ?? 1.0) as number;
    ctx.save();
    ctx.translate(0, fuseOrigin * ch);
    ctx.rotate(-Math.PI / 2);
    const localX = (ft.y - fuseOrigin) * ch;
    drawSingleLineText(
      ctx,
      'Fuse (You may cast one or both halves of this card from your hand.)',
      localX, ft.x * cw, ft.w * ch, ft.h * cw,
      ft.font, ft.size * ch, 'left', ft.color ?? 'white',
    );
    ctx.restore();
  }
};

export const splitHooks: TemplateHooks = { body: splitBody, skipStandardText: true, skipStandardFrame: true };
