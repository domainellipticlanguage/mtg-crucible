import { type SKRSContext2D } from '@napi-rs/canvas';
import type { NormalizedCardData } from '../types';
import { drawSingleLineText, drawWrappedText, drawRulesAndFlavor, type ExclusionRect } from '../text';
import { drawArt, drawManaCost, drawSetSymbol, measureManaCostWidth, drawFrame, frameColorCode } from '../helpers';
import { getParsedAbilities, formatTypeLine } from '../parser';
import { SPLIT_RIGHT_LAYOUT, SPLIT_LEFT_LAYOUT } from '../layout';
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
  const originY = L.name.y * ch;

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
  drawSingleLineText(ctx, card.name ?? '', 0, L.name.x * cw, nameW, L.name.h * cw, L.name.font, L.name.size * ch, 'left', 'black');

  // Type line
  drawSingleLineText(ctx, formatTypeLine(card.typeLine), 0, L.type.x * cw, L.type.w * ch, L.type.h * cw, L.type.font, L.type.size * ch, 'left', 'black');

  // Set symbol (in rotated space: swap ch/cw)
  await drawSetSymbol(ctx, card.rarity || 'common', L.setSymbol, cw, ch);

  // Rules text
  const pa = getParsedAbilities(card);
  const rulesText = pa.unstructuredAbilities?.join('\n');
  const rulesY = (L.rules.y - L.name.y) * ch;
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

  // Draw each half's frame clipped to its region. Use gradientRange so
  // multi-color gradient zones are computed within the half, not the full card.
  const topH = Math.round(splitY);

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

  // Draw art for both halves — user supplies landscape, we rotate -90° into portrait boxes
  if (card.artUrl) await drawArt(ctx, card.artUrl, SPLIT_LEFT_LAYOUT.art, cw, ch, { rotate: -90 });
  if (other?.artUrl) await drawArt(ctx, other.artUrl, SPLIT_RIGHT_LAYOUT.art, cw, ch, { rotate: -90 });

  // Render text for both halves, clipping each to its half
  await renderSplitText(ctx, card, SPLIT_LEFT_LAYOUT, cw, ch, splitY, ch);
  if (other) {
    await renderSplitText(ctx, other, SPLIT_RIGHT_LAYOUT, cw, ch, 0, splitY);
  }
};

export const splitHooks: TemplateHooks = { body: splitBody, skipStandardText: true, skipStandardFrame: true };
