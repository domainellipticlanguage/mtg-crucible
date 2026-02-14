import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { CardData } from '../types';
import { STD_W, STD_H, STD_LAYOUT, ASSETS_DIR } from '../layout';
import { drawArt, drawCorners, drawSetSymbol, drawBottomInfo, drawManaCost } from '../helpers';
import { drawSingleLineText, drawWrappedText, drawRulesAndFlavor } from '../text';

export async function renderStandard(card: CardData): Promise<Buffer> {
  const cw = STD_W, ch = STD_H;
  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext('2d');
  const L = STD_LAYOUT;

  // Background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, cw, ch);

  // Art
  if (card.artUrl) await drawArt(ctx, card.artUrl, L.art, cw, ch);

  // Frame
  const framePath = path.join(ASSETS_DIR, 'frames', 'standard', `${card.frameColor}.png`);
  if (fs.existsSync(framePath)) ctx.drawImage(await loadImage(framePath), 0, 0, cw, ch);

  // Legend crown
  if (card.isLegendary) {
    const crownPath = path.join(ASSETS_DIR, 'crowns', `${card.frameColor}.png`);
    if (fs.existsSync(crownPath)) {
      // "Legend Crown Border Cover" — black bar behind crown top (CC's complementary:9)
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, cw, (137 / 2814) * ch);
      // Mask-clip the crown so frame's dark borders show through at edges
      const maskPath = path.join(ASSETS_DIR, 'crowns', 'maskCrownPinline.png');
      const crownImg = await loadImage(crownPath);
      if (fs.existsSync(maskPath)) {
        const maskImg = await loadImage(maskPath);
        const crownCanvas = createCanvas(cw, ch);
        const crownCtx = crownCanvas.getContext('2d');
        crownCtx.drawImage(maskImg, 0, 0, cw, ch);
        crownCtx.globalCompositeOperation = 'source-in';
        crownCtx.drawImage(crownImg, L.crown.x * cw, L.crown.y * ch, L.crown.w * cw, L.crown.h * ch);
        ctx.drawImage(crownCanvas, 0, 0);
      } else {
        ctx.drawImage(crownImg, L.crown.x * cw, L.crown.y * ch, L.crown.w * cw, L.crown.h * ch);
      }
    }
  }

  // P/T box
  if (card.power !== undefined && card.toughness !== undefined) {
    const ptPath = path.join(ASSETS_DIR, 'pt', `${card.frameColor}.png`);
    if (fs.existsSync(ptPath)) {
      ctx.drawImage(await loadImage(ptPath), L.ptBox.x * cw, L.ptBox.y * ch, L.ptBox.w * cw, L.ptBox.h * ch);
    }
  }

  // Set symbol
  await drawSetSymbol(ctx, card.rarity || 'common', L.setSymbol, ch, cw);

  // Name
  drawSingleLineText(ctx, card.name, L.name.x*cw, L.name.y*ch, L.name.w*cw, L.name.h*ch, L.name.font, L.name.size*ch);

  // Mana cost
  if (card.manaCost) await drawManaCost(ctx, card.manaCost, cw, ch, L.mana);

  // Type line
  drawSingleLineText(ctx, card.typeLine, L.type.x*cw, L.type.y*ch, L.type.w*cw, L.type.h*ch, L.type.font, L.type.size*ch);

  // Rules + flavor
  const rx = L.rules.x*cw, ry = L.rules.y*ch, rw = L.rules.w*cw, rh = L.rules.h*ch, rs = L.rules.size*ch;
  if (card.rulesText && card.flavorText) drawRulesAndFlavor(ctx, card.rulesText, card.flavorText, rx, ry, rw, rh, L.rules.font, rs);
  else if (card.rulesText) drawWrappedText(ctx, card.rulesText, rx, ry, rw, rh, L.rules.font, rs);
  else if (card.flavorText) drawWrappedText(ctx, card.flavorText, rx, ry, rw, rh, L.rules.font, rs, { fontFamily: 'MPlantin Italic' });

  // P/T text (white for vehicles since the badge is dark brown)
  if (card.power !== undefined && card.toughness !== undefined) {
    const ptColor = card.frameColor === 'v' ? 'white' : 'black';
    drawSingleLineText(ctx, `${card.power}/${card.toughness}`, L.pt.x*cw, L.pt.y*ch, L.pt.w*cw, L.pt.h*ch, L.pt.font, L.pt.size*ch, 'center', ptColor);
  }

  drawBottomInfo(ctx, card, cw, ch);
  drawCorners(ctx, cw, ch);
  return canvas.toBuffer('image/png');
}
