import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { CardData } from '../types';
import { BTL_W, BTL_H, BTL_LAYOUT, ASSETS_DIR } from '../layout';
import { drawArt, drawCorners, drawManaCost, getTypeLine, primaryFrameColorCode, drawColorIndicator, drawFrame } from '../helpers';
import { drawSingleLineText, drawWrappedText } from '../text';

export async function renderBattle(card: CardData): Promise<Buffer> {
  const cw = BTL_W, ch = BTL_H;
  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext('2d');
  const L = BTL_LAYOUT;
  const fc = primaryFrameColorCode(card.frameColor);

  // Background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, cw, ch);

  // Art
  if (card.artUrl) await drawArt(ctx, card.artUrl, L.art, cw, ch);

  // Frame (with accent compositing for colored lands/artifacts)
  await drawFrame(ctx, 'battle', card.frameColor, card.accentColor, cw, ch);

  // Name
  drawSingleLineText(ctx, card.name ?? '', L.name.x*cw, L.name.y*ch, L.name.w*cw, L.name.h*ch, L.name.font, L.name.size*ch);

  // Mana cost
  if (card.manaCost) await drawManaCost(ctx, card.manaCost, cw, ch, L.mana);

  // Type line
  const btlTypeX = L.type.x * cw, btlTypeY = L.type.y * ch, btlTypeH = L.type.h * ch;
  const btlIndOff = drawColorIndicator(ctx, card.colorIndicator, btlTypeX, btlTypeY, btlTypeH);
  drawSingleLineText(ctx, getTypeLine(card), btlTypeX + btlIndOff, btlTypeY, L.type.w * cw - btlIndOff, btlTypeH, L.type.font, L.type.size * ch);

  // Rules text
  if (card.oracleText) {
    drawWrappedText(ctx, card.oracleText,
      L.rules.x*cw, L.rules.y*ch, L.rules.w*cw, L.rules.h*ch,
      L.rules.font, L.rules.size*ch);
  }

  // Defense value
  drawSingleLineText(ctx, card.battleDefense ?? '0',
    L.defense.x*cw, L.defense.y*ch, L.defense.w*cw, L.defense.h*ch,
    L.defense.font, L.defense.size*ch, 'center', 'white');

  drawCorners(ctx, cw, ch);
  return canvas.toBuffer('image/png');
}
