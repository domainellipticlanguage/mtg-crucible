import type { Ctx } from '../platform';
import { createCanvas, loadAssetImage } from '../platform';
import type { NormalizedCardData } from '../types';
import { drawArt, drawFrame, frameColorCode } from '../helpers';
import { getParsedAbilities, formatTypeLine } from '../parser';
import type { TemplateHooks, AnyLayout } from './render';
import { drawSingleLineAt, drawWrappedAt, drawRulesAndFlavorAt, drawNameAndMana, drawSetSymbolAt } from './element';

/**
 * Room renderer — Duskmourn-style split enchantments. Two doors stacked in
 * portrait, each read sideways like a split card.
 *
 * Differs from split: a single landscape "panorama" art spans both halves
 * rather than two independent arts. Per-door layout lives under L.door1 / L.door2.
 */

async function renderDoorText(
  ctx: Ctx,
  card: NormalizedCardData,
  L: AnyLayout,
  cw: number, ch: number,
  clipYMin: number, clipYMax: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, clipYMin, cw, clipYMax - clipYMin);
  ctx.clip();

  await drawNameAndMana(ctx, L.name, L.mana, cw, ch, card.name ?? '', card.manaCost);
  if (L.type) drawSingleLineAt(ctx, L.type, cw, ch, formatTypeLine(card.typeLine), { color: L.type.color ?? 'black' });
  if (L.setSymbol) await drawSetSymbolAt(ctx, L.setSymbol, cw, ch, card.rarity || 'common');

  const rulesText = getParsedAbilities(card).unstructuredAbilities?.join('\n');
  if (rulesText && card.flavorText) drawRulesAndFlavorAt(ctx, L.rules, cw, ch, rulesText, card.flavorText);
  else if (rulesText) drawWrappedAt(ctx, L.rules, cw, ch, rulesText);
  else if (card.flavorText) drawWrappedAt(ctx, L.rules, cw, ch, card.flavorText, { italic: true });

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

  // Single panorama art spanning both halves — drawn first so the frame's pinlines/borders sit on top.
  // User supplies landscape; rotate -90° to fit portrait region.
  const allowUnsafe = (L as any)._allowUnsafeArtUrls;
  if (card.artUrl && L.art) {
    await drawArt(ctx, card.artUrl, L.art, cw, ch, { rotate: -90, allowUnsafe });
  }

  // Pre-render each door's frame to a full-canvas offscreen, then blend through the
  // room mask so doors with different colors get a soft seam instead of a hard line.
  const door1Canvas = createCanvas(cw, ch);
  await drawFrame(door1Canvas.getContext('2d'), frameDir, frontCodes, frontAccent, cw, ch, undefined, undefined,
    { horizontal: true, gradientRange: { start: topH, end: ch } });

  const door2Canvas = createCanvas(cw, ch);
  await drawFrame(door2Canvas.getContext('2d'), frameDir, backCodes, backAccent, cw, ch, undefined, undefined,
    { horizontal: true, gradientRange: { start: 0, end: topH } });

  // door1 (front, bottom half) is the base; door2 (back, top half) is masked on top.
  ctx.drawImage(door1Canvas, 0, 0);

  const roomMask = await loadAssetImage('masks/room-mask.png');
  if (roomMask) {
    const masked = createCanvas(cw, ch);
    const mCtx = masked.getContext('2d');
    mCtx.drawImage(roomMask, 0, 0, cw, ch);
    mCtx.globalCompositeOperation = 'source-in';
    mCtx.drawImage(door2Canvas, 0, 0);
    ctx.drawImage(masked, 0, 0);
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, topH);
    ctx.clip();
    ctx.drawImage(door2Canvas, 0, 0);
    ctx.restore();
  }

  await renderDoorText(ctx, card, L.door1, cw, ch, splitY, ch);
  if (door2) {
    await renderDoorText(ctx, door2, L.door2, cw, ch, 0, splitY);
  }
};

export const roomHooks: TemplateHooks = { body: roomBody, skipStandardText: true, skipStandardFrame: true };
