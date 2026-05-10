import { type SKRSContext2D } from '@napi-rs/canvas';
import type { NormalizedCardData } from '../types';
import { drawSingleLineText, drawWrappedText, drawRulesAndFlavor, type ExclusionRect } from '../text';
import { drawArt, drawManaCost, drawSetSymbol, measureManaCostWidth, drawFrame, frameColorCode } from '../helpers';
import { getParsedAbilities, formatTypeLine } from '../parser';
import type { TemplateHooks, AnyLayout } from './render';

/**
 * Room renderer — Duskmourn-style split enchantments. Two doors stacked in
 * portrait, each read sideways like a split card.
 *
 * Differs from split: a single landscape "panorama" art spans both halves
 * rather than two independent arts. Per-door layout lives under L.door1 / L.door2.
 */

async function renderDoorText(
  ctx: SKRSContext2D,
  card: NormalizedCardData,
  L: AnyLayout,
  cw: number, ch: number,
  clipYMin: number, clipYMax: number,
) {
  const originY = L.name.y * ch;

  ctx.save();
  ctx.translate(0, originY);
  ctx.rotate(-Math.PI / 2);

  const localXMin = originY - clipYMax;
  const localXMax = originY - clipYMin;
  ctx.beginPath();
  ctx.rect(localXMin, 0, localXMax - localXMin, cw);
  ctx.clip();

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

  const nameW = L.mana.w * ch - manaW;
  drawSingleLineText(ctx, card.name ?? '', 0, L.name.x * cw, nameW, L.name.h * cw, L.name.font, L.name.size * ch, 'left', 'black');

  drawSingleLineText(ctx, formatTypeLine(card.typeLine), 0, L.type.x * cw, L.type.w * ch, L.type.h * cw, L.type.font, L.type.size * ch, 'left', 'black');

  await drawSetSymbol(ctx, card.rarity || 'common', L.setSymbol, cw, ch);

  const pa = getParsedAbilities(card);
  const rulesText = pa.unstructuredAbilities?.join('\n');
  const rulesY = (L.rules.y - L.name.y) * ch;
  const rulesX = L.rules.x * cw;
  const rulesW = L.rules.w * ch;
  const rulesH = L.rules.h * cw;

  const setH = L.setSymbol.h * cw;
  const setW = setH;
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

const roomBody: TemplateHooks['body'] = async (ctx, card, L, cw, ch) => {
  const door2 = card.linkedCard;
  const frameDir = L._frame ?? 'room';
  const splitY = (1000 / 2100) * ch;

  const frontCodes = card.frameColor.map(c => frameColorCode(c));
  const backCodes = door2 ? door2.frameColor.map(c => frameColorCode(c)) : frontCodes;
  const frontAccent = card.accentColor.length > 0 ? card.accentColor.map(c => frameColorCode(c)) : undefined;
  const backAccent = door2 && door2.accentColor.length > 0 ? door2.accentColor.map(c => frameColorCode(c)) : frontAccent;

  const topH = Math.round(splitY);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, cw, topH);
  ctx.clip();
  await drawFrame(ctx, frameDir, backCodes, backAccent, cw, ch, undefined, undefined,
    { horizontal: true, gradientRange: { start: 0, end: topH } });
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, topH, cw, ch - topH);
  ctx.clip();
  await drawFrame(ctx, frameDir, frontCodes, frontAccent, cw, ch, undefined, undefined,
    { horizontal: true, gradientRange: { start: topH, end: ch } });
  ctx.restore();

  // Single panorama art spanning both halves. User supplies landscape; rotate -90° to fit portrait region.
  const allowUnsafe = (L as any)._allowUnsafeArtUrls;
  if (card.artUrl && L.art) {
    await drawArt(ctx, card.artUrl, L.art, cw, ch, { rotate: -90, allowUnsafe });
  }

  await renderDoorText(ctx, card, L.door1, cw, ch, splitY, ch);
  if (door2) {
    await renderDoorText(ctx, door2, L.door2, cw, ch, 0, splitY);
  }
};

export const roomHooks: TemplateHooks = { body: roomBody, skipStandardText: true, skipStandardFrame: true };
