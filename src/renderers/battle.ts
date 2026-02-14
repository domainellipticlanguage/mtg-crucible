import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { BattleData } from '../types';
import { BTL_W, BTL_H, BTL_LAYOUT, ASSETS_DIR } from '../layout';
import { drawArt, drawCorners, drawManaCost } from '../helpers';
import { drawSingleLineText, drawWrappedText } from '../text';

export async function renderBattle(card: BattleData): Promise<Buffer> {
  const cw = BTL_W, ch = BTL_H;
  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext('2d');
  const L = BTL_LAYOUT;

  // Background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, cw, ch);

  // Art
  if (card.artUrl) await drawArt(ctx, card.artUrl, L.art, cw, ch);

  // Frame
  const framePath = path.join(ASSETS_DIR, 'frames', 'battle', `${card.frameColor}.png`);
  if (fs.existsSync(framePath)) ctx.drawImage(await loadImage(framePath), 0, 0, cw, ch);

  // Name
  drawSingleLineText(ctx, card.name, L.name.x*cw, L.name.y*ch, L.name.w*cw, L.name.h*ch, L.name.font, L.name.size*ch);

  // Mana cost
  if (card.manaCost) await drawManaCost(ctx, card.manaCost, cw, ch, L.mana);

  // Type line
  drawSingleLineText(ctx, card.typeLine, L.type.x*cw, L.type.y*ch, L.type.w*cw, L.type.h*ch, L.type.font, L.type.size*ch);

  // Rules text
  if (card.rulesText) {
    drawWrappedText(ctx, card.rulesText,
      L.rules.x*cw, L.rules.y*ch, L.rules.w*cw, L.rules.h*ch,
      L.rules.font, L.rules.size*ch);
  }

  // Defense value
  drawSingleLineText(ctx, card.defense,
    L.defense.x*cw, L.defense.y*ch, L.defense.w*cw, L.defense.h*ch,
    L.defense.font, L.defense.size*ch, 'center', 'white');

  drawCorners(ctx, cw, ch);
  return canvas.toBuffer('image/png');
}
