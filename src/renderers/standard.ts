import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { CardData } from '../types';
import { STD_W, STD_H, STD_LAYOUT, ASSETS_DIR } from '../layout';
import { drawArt, drawCorners, drawSetSymbol, drawBottomInfo, drawManaCost, getTypeLine, frameColorCode, drawColorIndicator, drawFrame } from '../helpers';
import { drawSingleLineText, drawWrappedText, drawRulesAndFlavor } from '../text';

export async function renderStandard(card: CardData): Promise<Buffer> {
  const cw = STD_W, ch = STD_H;
  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext('2d');
  const L = STD_LAYOUT;
  const fc = frameColorCode(card.frameColor);
  // For accent frames, use accent color for elements like P/T box and crown
  const visualFc = card.accentColor ? frameColorCode(card.accentColor === 'multicolor' ? 'multicolor' : card.accentColor) : fc;

  // Background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, cw, ch);

  // Art
  if (card.artUrl) await drawArt(ctx, card.artUrl, L.art, cw, ch);

  // Frame (with accent compositing for colored lands/artifacts)
  await drawFrame(ctx, 'standard', card.frameColor, card.accentColor, cw, ch);

  // Legend crown
  if (card.supertypes?.includes('legendary')) {
    const crownPath = path.join(ASSETS_DIR, 'crowns', `${visualFc}.png`);
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

  // P/T box (use accent color when available, e.g. green P/T on a green land)
  if (card.power !== undefined && card.toughness !== undefined) {
    const ptPath = path.join(ASSETS_DIR, 'pt', `${visualFc}.png`);
    if (fs.existsSync(ptPath)) {
      ctx.drawImage(await loadImage(ptPath), L.ptBox.x * cw, L.ptBox.y * ch, L.ptBox.w * cw, L.ptBox.h * ch);
    }
  }

  // Set symbol
  await drawSetSymbol(ctx, card.rarity || 'common', L.setSymbol, ch, cw);

  // Name
  drawSingleLineText(ctx, card.name ?? '', L.name.x*cw, L.name.y*ch, L.name.w*cw, L.name.h*ch, L.name.font, L.name.size*ch);

  // Mana cost
  if (card.manaCost) await drawManaCost(ctx, card.manaCost, cw, ch, L.mana);

  // Type line (with optional color indicator)
  const typeX = L.type.x * cw;
  const typeY = L.type.y * ch;
  const typeH = L.type.h * ch;
  const indicatorOffset = drawColorIndicator(ctx, card.colorIndicator, typeX, typeY, typeH);
  drawSingleLineText(ctx, getTypeLine(card), typeX + indicatorOffset, typeY, L.type.w * cw - indicatorOffset, typeH, L.type.font, L.type.size * ch);

  // Rules + flavor
  const rx = L.rules.x*cw, ry = L.rules.y*ch, rw = L.rules.w*cw, rh = L.rules.h*ch, rs = L.rules.size*ch;
  if (card.oracleText && card.flavorText) drawRulesAndFlavor(ctx, card.oracleText, card.flavorText, rx, ry, rw, rh, L.rules.font, rs);
  else if (card.oracleText) drawWrappedText(ctx, card.oracleText, rx, ry, rw, rh, L.rules.font, rs);
  else if (card.flavorText) drawWrappedText(ctx, card.flavorText, rx, ry, rw, rh, L.rules.font, rs, { fontFamily: 'MPlantin Italic' });

  // P/T text (white for vehicles since the badge is dark brown)
  if (card.power !== undefined && card.toughness !== undefined) {
    const ptColor = card.frameColor === 'vehicle' ? 'white' : 'black';
    drawSingleLineText(ctx, `${card.power}/${card.toughness}`, L.pt.x*cw, L.pt.y*ch, L.pt.w*cw, L.pt.h*ch, L.pt.font, L.pt.size*ch, 'center', ptColor);
  }

  drawBottomInfo(ctx, card, cw, ch);
  drawCorners(ctx, cw, ch);
  return canvas.toBuffer('image/png');
}
