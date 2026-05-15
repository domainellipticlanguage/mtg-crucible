import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { NormalizedCardData } from '../types';
import { drawSingleLineText, drawWrappedText, drawRulesAndFlavor } from '../text';
import { drawArt, drawManaCost, drawSetSymbol, measureManaCostWidth, drawFrame, frameColorCode } from '../helpers';
import { getParsedAbilities, formatTypeLine } from '../parser';
import { ASSETS_DIR } from '../assets-dir';
import type { TemplateHooks, AnyLayout } from './render';
import { placeElement } from './element';

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
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, clipYMin, cw, clipYMax - clipYMin);
  ctx.clip();

  const manaW = card.manaCost ? measureManaCostWidth(card.manaCost, ch, L.mana.size) : 0;

  if (card.manaCost) {
    await placeElement(ctx, L.mana, cw, ch, () => {
      return drawManaCost(ctx, card.manaCost!, cw, ch, {
        y: 0, w: 0,
        size: L.mana.size, shadowX: L.mana.shadowX, shadowY: L.mana.shadowY,
      });
    });
  }

  placeElement(ctx, L.name, cw, ch, ({ wDim, hDim }) => {
    const localBoxW = L.name.w * wDim - manaW;
    drawSingleLineText(ctx, card.name ?? '', 0, 0, localBoxW, L.name.h * hDim,
      L.name.font, L.name.size * ch, 'left', 'black');
  });

  if (L.type) {
    placeElement(ctx, L.type, cw, ch, ({ wDim, hDim }) => {
      drawSingleLineText(ctx, formatTypeLine(card.typeLine), 0, 0,
        L.type.w * wDim, L.type.h * hDim,
        L.type.font, L.type.size * ch, 'left', L.type.color ?? 'black');
    });
  }

  if (L.setSymbol) {
    // drawSetSymbol's signature is (ctx, rarity, layout, ch, cw); pass ch then cw.
    await placeElement(ctx, L.setSymbol, cw, ch, () => {
      return drawSetSymbol(ctx, card.rarity || 'common',
        { x: 0, y: 0, w: 0, h: L.setSymbol.h }, ch, cw);
    });
  }

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

  const maskPath = path.join(ASSETS_DIR, 'masks', 'room-mask.png');
  if (fs.existsSync(maskPath)) {
    const masked = createCanvas(cw, ch);
    const mCtx = masked.getContext('2d');
    mCtx.drawImage(await loadImage(maskPath), 0, 0, cw, ch);
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
