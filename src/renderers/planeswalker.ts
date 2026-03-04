import { loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { CardData, PlaneswalkerAbilities } from '../types';
import { ASSETS_DIR } from '../layout';
import { getParsedAbilities } from './render';
import { drawSingleLineText, drawWrappedText } from '../text';

async function preFrame(ctx: SKRSContext2D, card: CardData, L: Record<string, any>, cw: number, ch: number): Promise<void> {
  const pw = getParsedAbilities(card).structuredAbilities as PlaneswalkerAbilities;
  const abilities = pw.loyaltyAbilities;
  const abilityCount = abilities.length;
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
}

async function body(ctx: SKRSContext2D, card: CardData, L: Record<string, any>, cw: number, ch: number): Promise<void> {
  const pw = getParsedAbilities(card).structuredAbilities as PlaneswalkerAbilities;
  const abilities = pw.loyaltyAbilities;
  const abilityCount = abilities.length;
  const abilityStartY = L.ability.y;
  const abilityH = L.totalAbilityH / abilityCount;

  // Loyalty cost icons
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
    const cost = abilities[i].cost;

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
    drawWrappedText(ctx, abilities[i].text, ax, ay, aw, ah, L.ability.font, L.ability.size * ch);
  }

  // Starting loyalty
  if (L.loyalty) {
    drawSingleLineText(ctx, card.startingLoyalty ?? '0', L.loyalty.x * cw, L.loyalty.y * ch, L.loyalty.w * cw, L.loyalty.h * ch, L.loyalty.font, L.loyalty.size * ch, 'center', 'white');
  }
}

export const planeswalkerHooks = { preFrame, body };
