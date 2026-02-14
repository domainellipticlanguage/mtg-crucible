import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { PlaneswalkerData } from '../types';
import { PW_W, PW_H, PW_LAYOUT, ASSETS_DIR } from '../layout';
import { drawArt, drawCorners, drawBottomInfo, drawManaCost } from '../helpers';
import { drawSingleLineText, drawWrappedText } from '../text';

export async function renderPlaneswalker(card: PlaneswalkerData): Promise<Buffer> {
  const cw = PW_W, ch = PW_H;
  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext('2d');
  const L = PW_LAYOUT;

  // Background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, cw, ch);

  // Art
  if (card.artUrl) await drawArt(ctx, card.artUrl, L.art, cw, ch);

  // Ability background shading (pre-frame)
  const abilityCount = card.abilities.length;
  const abilityStartY = L.ability.y;
  const abilityH = L.totalAbilityH / abilityCount;

  for (let i = 0; i < abilityCount; i++) {
    const y = (abilityStartY + i * abilityH) * ch;
    const h = abilityH * ch;
    const x = L.abilityBox.x * cw;
    const w = L.abilityBox.w * cw;
    ctx.save();
    if (i % 2 === 0) { ctx.fillStyle = 'white'; ctx.globalAlpha = 0.608; }
    else { ctx.fillStyle = '#a4a4a4'; ctx.globalAlpha = 0.706; }
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    // Ability line divider
    if (i > 0) {
      const lineImg = i % 2 === 0
        ? path.join(ASSETS_DIR, 'frames', 'planeswalker', 'abilityLineEven.png')
        : path.join(ASSETS_DIR, 'frames', 'planeswalker', 'abilityLineOdd.png');
      if (fs.existsSync(lineImg)) {
        const transH = ch * 0.0048;
        ctx.drawImage(await loadImage(lineImg), x, y - transH, w, transH * 2);
      }
    }
  }

  // Frame
  const framePath = path.join(ASSETS_DIR, 'frames', 'planeswalker', `${card.frameColor}.png`);
  if (fs.existsSync(framePath)) ctx.drawImage(await loadImage(framePath), 0, 0, cw, ch);

  // Loyalty cost icons (post-frame)
  const iconYPositions = L.abilityIconY[abilityCount] || L.abilityIconY[3];
  const plusImg = await loadImage(path.join(ASSETS_DIR, 'frames', 'planeswalker', 'planeswalkerPlus.png'));
  const minusImg = await loadImage(path.join(ASSETS_DIR, 'frames', 'planeswalker', 'planeswalkerMinus.png'));
  const neutralImg = await loadImage(path.join(ASSETS_DIR, 'frames', 'planeswalker', 'planeswalkerNeutral.png'));

  ctx.save();
  ctx.fillStyle = 'white';
  ctx.font = `${ch * L.iconTextSize}px "Beleren Bold SmCaps"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  for (let i = 0; i < abilityCount; i++) {
    const iconY = iconYPositions[i] * ch;
    const cost = card.abilities[i].cost;

    if (cost.includes('+')) {
      const ic = L.plusIcon;
      ctx.drawImage(plusImg, ic.x * cw, iconY + ic.yOff * ch, ic.w * cw, ic.h * ch);
      ctx.fillText(cost, L.iconTextX * cw, iconY + 0.0172 * ch);
    } else if (cost.includes('-')) {
      const ic = L.minusIcon;
      ctx.drawImage(minusImg, ic.x * cw, iconY + ic.yOff * ch, ic.w * cw, ic.h * ch);
      ctx.fillText(cost, L.iconTextX * cw, iconY + 0.0181 * ch);
    } else if (cost !== '') {
      const ic = L.neutralIcon;
      ctx.drawImage(neutralImg, ic.x * cw, iconY + ic.yOff * ch, ic.w * cw, ic.h * ch);
      ctx.fillText(cost, L.iconTextX * cw, iconY + 0.0191 * ch);
    }
  }
  ctx.restore();

  // Ability text
  for (let i = 0; i < abilityCount; i++) {
    const ay = (abilityStartY + i * abilityH) * ch;
    const ah = abilityH * ch;
    const ax = L.ability.x * cw;
    const aw = L.ability.w * cw;
    drawWrappedText(ctx, card.abilities[i].text, ax, ay, aw, ah, L.ability.font, L.ability.size * ch);
  }

  // Name, mana, type
  drawSingleLineText(ctx, card.name, L.name.x*cw, L.name.y*ch, L.name.w*cw, L.name.h*ch, L.name.font, L.name.size*ch);
  if (card.manaCost) await drawManaCost(ctx, card.manaCost, cw, ch, L.mana);
  drawSingleLineText(ctx, card.typeLine, L.type.x*cw, L.type.y*ch, L.type.w*cw, L.type.h*ch, L.type.font, L.type.size*ch);

  // Starting loyalty
  drawSingleLineText(ctx, card.startingLoyalty, L.loyalty.x*cw, L.loyalty.y*ch, L.loyalty.w*cw, L.loyalty.h*ch, L.loyalty.font, L.loyalty.size*ch, 'center', 'white');

  drawBottomInfo(ctx, card, cw, ch);
  drawCorners(ctx, cw, ch);
  return canvas.toBuffer('image/png');
}
