import { type SKRSContext2D } from '@napi-rs/canvas';
import type { CardData } from '../types';
import { drawSingleLineText, drawWrappedText, drawRulesAndFlavor } from '../text';
import { drawArt, drawManaCost, drawSetSymbol, measureManaCostWidth, getTypeLine, drawFrame } from '../helpers';
import { getParsedAbilities } from '../parser';
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
  card: CardData,
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

  // Name
  const textW = L.name.w * ch;
  const manaW = card.manaCost ? measureManaCostWidth(card.manaCost, cw, L.mana.size) : 0;
  const nameW = textW - manaW;
  drawSingleLineText(ctx, card.name ?? '', 0, L.name.x * cw, nameW, L.name.h * cw, L.name.font, L.name.size * ch, 'left', 'black');

  // Mana cost — right-aligned in the name bar
  if (card.manaCost) {
    await drawManaCost(ctx, card.manaCost, ch, cw, {
      y: L.mana.y,
      w: L.mana.w,
      size: L.mana.size,
      shadowX: L.mana.shadowX,
      shadowY: L.mana.shadowY,
    });
  }

  // Type line
  drawSingleLineText(ctx, getTypeLine(card), 0, L.type.x * cw, L.type.w * ch, L.type.h * cw, L.type.font, L.type.size * ch, 'left', 'black');

  // Set symbol (in rotated space: swap ch/cw)
  await drawSetSymbol(ctx, card.rarity || 'common', L.setSymbol, cw, ch);

  // Rules text
  const pa = getParsedAbilities(card);
  const rulesText = pa.unstructuredAbilities?.join('\n');
  const rulesY = (L.rules.y - L.name.y) * ch;
  if (rulesText && card.flavorText) {
    drawRulesAndFlavor(ctx, rulesText, card.flavorText, rulesY, L.rules.x * cw, L.rules.w * ch, L.rules.h * cw, L.rules.font, L.rules.size * ch, []);
  } else if (rulesText) {
    drawWrappedText(ctx, rulesText, rulesY, L.rules.x * cw, L.rules.w * ch, L.rules.h * cw, L.rules.font, L.rules.size * ch);
  } else if (card.flavorText) {
    drawWrappedText(ctx, card.flavorText, rulesY, L.rules.x * cw, L.rules.w * ch, L.rules.h * cw, L.rules.font, L.rules.size * ch, { fontFamily: 'MPlantin Italic' });
  }

  ctx.restore();
}

const splitBody: TemplateHooks['body'] = async (ctx, card, L, cw, ch) => {
  const other = card.linkedCard;
  const frameDir = L._frame ?? 'split';
  const splitY = (1000 / 2100) * ch;

  // Standard pipeline drew card.frameColor for the whole card.
  // Front card renders in the bottom half (LEFT layout), so overdraw the
  // top half with the linked card's frame color.
  if (other?.frameColor) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, splitY);
    ctx.clip();
    await drawFrame(ctx, frameDir, other.frameColor, other.accentColor, cw, ch);
    ctx.restore();
  }

  // Draw art for both halves (standard pipeline only draws front art in wrong position)
  if (card.artUrl) await drawArt(ctx, card.artUrl, SPLIT_LEFT_LAYOUT.art, cw, ch);
  if (other?.artUrl) await drawArt(ctx, other.artUrl, SPLIT_RIGHT_LAYOUT.art, cw, ch);

  // Render text for both halves, clipping each to its half
  await renderSplitText(ctx, card, SPLIT_LEFT_LAYOUT, cw, ch, splitY, ch);
  if (other) {
    await renderSplitText(ctx, other, SPLIT_RIGHT_LAYOUT, cw, ch, 0, splitY);
  }
};

export const splitHooks: TemplateHooks = { body: splitBody, skipStandardText: true };
