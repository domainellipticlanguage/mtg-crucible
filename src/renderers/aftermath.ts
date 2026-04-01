import { type SKRSContext2D } from '@napi-rs/canvas';
import type { NormalizedCardData } from '../types';
import { drawSingleLineText, drawWrappedText, drawRulesAndFlavor } from '../text';
import { drawArt, drawManaCost, measureManaCostWidth, drawFrame, frameColorCode } from '../helpers';
import { getParsedAbilities, formatTypeLine } from '../parser';
import { AFTERMATH_BOTTOM_LAYOUT } from '../layout';
import type { TemplateHooks, AnyLayout } from './render';

/**
 * Aftermath card renderer.
 *
 * Top half is rendered by the standard pipeline (normal orientation).
 * Bottom half (linkedCard) is rendered here, rotated 90° clockwise.
 *
 * CC uses rotation:90 on text fields. We rotate the context 90° around the
 * anchor point, then draw in local space where:
 *   local x+ = card y+ (downward)
 *   local y+ = card x- (leftward)
 */

async function renderBottomText(
  ctx: SKRSContext2D,
  card: NormalizedCardData,
  cw: number, ch: number,
) {
  const L = AFTERMATH_BOTTOM_LAYOUT;

  // Rotate 90° clockwise around the anchor point (top-right of bottom half)
  const originX = L.name.x * cw;
  const originY = L.name.y * ch;

  ctx.save();
  ctx.translate(originX, originY);
  ctx.rotate(Math.PI / 2);

  // In rotated local space:
  //   local x+ = card y+ (downward on card, scaled by ch)
  //   local y+ = card x- (leftward on card, scaled by cw)
  // Text width flows along local x (ch), text height along local y (cw).

  // Name
  const textW = L.name.w * ch;
  const manaW = card.manaCost ? measureManaCostWidth(card.manaCost, cw, L.mana.size) : 0;
  const nameW = textW - manaW;
  drawSingleLineText(ctx, card.name ?? '', 0, 0, nameW, L.name.h * cw, L.name.font, L.name.size * ch, 'left', 'black');

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

  // Type line — offset in local y (leftward from anchor = increasing y)
  const typeY = (L.name.x - L.type.x) * cw;
  drawSingleLineText(ctx, formatTypeLine(card.typeLine), 0, typeY, L.type.w * ch, L.type.h * cw, L.type.font, L.type.size * ch, 'left', 'black');

  // Rules text
  const pa = getParsedAbilities(card);
  const rulesText = pa.unstructuredAbilities?.join('\n');
  // local x = text flow (card y+), local y = perpendicular (card x-, leftward from anchor)
  const rulesLocalX = (L.rules.y - L.name.y) * ch;
  const rulesLocalY = (L.name.x - L.rules.x) * cw;
  if (rulesText && card.flavorText) {
    drawRulesAndFlavor(ctx, rulesText, card.flavorText, rulesLocalX, rulesLocalY, L.rules.w * ch, L.rules.h * cw, L.rules.font, L.rules.size * ch, []);
  } else if (rulesText) {
    drawWrappedText(ctx, rulesText, rulesLocalX, rulesLocalY, L.rules.w * ch, L.rules.h * cw, L.rules.font, L.rules.size * ch);
  } else if (card.flavorText) {
    drawWrappedText(ctx, card.flavorText, rulesLocalX, rulesLocalY, L.rules.w * ch, L.rules.h * cw, L.rules.font, L.rules.size * ch, { fontFamily: 'MPlantin Italic' });
  }

  ctx.restore();
}

const aftermathBody: TemplateHooks['body'] = async (ctx, card, L, cw, ch) => {
  const other = card.linkedCard;
  const frameDir = L._frame ?? 'aftermath';

  // Overdraw the bottom half frame with the linked card's color.
  if (other && other.frameColor.length > 0) {
    ctx.save();
    ctx.beginPath();
    // Bottom half starts roughly at y = 0.54 of the card
    const splitY = 0.54 * ch;
    ctx.rect(0, splitY, cw, ch - splitY);
    ctx.clip();
    const otherFrameCodes = other.frameColor.map(c => frameColorCode(c));
    const otherAccentCodes = other.accentColor.length > 0 ? other.accentColor.map(c => frameColorCode(c)) : undefined;
    await drawFrame(ctx, frameDir, otherFrameCodes, otherAccentCodes, cw, ch);
    ctx.restore();
  }

  // Bottom half art + text (rotated 90°)
  if (other) {
    if (other.artUrl) await drawArt(ctx, other.artUrl, AFTERMATH_BOTTOM_LAYOUT.art, cw, ch, { rotate: 90 });
    await renderBottomText(ctx, other, cw, ch);
  }
};

export const aftermathHooks: TemplateHooks = { body: aftermathBody };
