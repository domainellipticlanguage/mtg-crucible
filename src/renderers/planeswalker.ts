import { loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { NormalizedCardData, PlaneswalkerAbilities } from '../types';
import { ASSETS_DIR } from '../assets-dir';
import { getParsedAbilities } from '../parser';

/** Combine unstructured abilities (as cost-less entries) with loyalty abilities. */
function getAllAbilities(card: NormalizedCardData): { cost: string; text: string }[] {
  const pa = getParsedAbilities(card);
  const pw = pa.structuredAbilities as PlaneswalkerAbilities;
  const statics = (pa.unstructuredAbilities ?? []).map(text => ({ cost: '', text }));
  return [...statics, ...pw.loyaltyAbilities];
}
import { drawSingleLineText, drawWrappedText, measureWrappedHeight } from '../text';

/**
 * Find the largest uniform font size where all abilities fit the total height,
 * then distribute vertical space proportionally to each ability's text needs.
 * Returns font size and the Y offset + height for each ability box.
 */
function computeAbilityLayout(
  ctx: SKRSContext2D, abilities: { cost: string; text: string }[],
  L: Record<string, any>, cw: number, ch: number,
): { fontSize: number; boxes: { y: number; h: number }[] } {
  const totalH = L.totalAbilityH * ch;
  const startY = L.ability.y * ch;
  const aw = L.ability.w * cw;
  const font = L.ability.font;
  const maxSize = L.ability.size * ch;
  const minBoxH = totalH / abilities.length * 0.5; // no box smaller than half of equal

  for (let size = maxSize; size > 8; size -= 1) {
    const rawHeights = abilities.map(a =>
      measureWrappedHeight(ctx, a.text, aw, font, size),
    );
    const sumH = rawHeights.reduce((s, h) => s + h, 0);
    if (sumH <= totalH) {
      // Distribute proportionally, with a minimum box height
      const clamped = rawHeights.map(h => Math.max(h, minBoxH));
      const clampedSum = clamped.reduce((s, h) => s + h, 0);
      const scale = totalH / clampedSum;
      const heights = clamped.map(h => h * scale);
      const boxes: { y: number; h: number }[] = [];
      let curY = startY;
      for (const h of heights) {
        boxes.push({ y: curY, h });
        curY += h;
      }
      return { fontSize: size, boxes };
    }
  }
  // Fallback: equal split
  const equalH = totalH / abilities.length;
  const boxes = abilities.map((_, i) => ({ y: startY + i * equalH, h: equalH }));
  return { fontSize: 8, boxes };
}

async function preFrame(ctx: SKRSContext2D, card: NormalizedCardData, L: Record<string, any>, cw: number, ch: number): Promise<void> {
  const abilities = getAllAbilities(card);
  const { boxes } = computeAbilityLayout(ctx, abilities, L, cw, ch);

  for (let i = 0; i < abilities.length; i++) {
    const x = L.abilityBox.x * cw;
    const w = L.abilityBox.w * cw;
    ctx.save();
    if (i % 2 === 0) { ctx.fillStyle = 'white'; ctx.globalAlpha = 0.608; }
    else { ctx.fillStyle = '#a4a4a4'; ctx.globalAlpha = 0.706; }
    ctx.fillRect(x, boxes[i].y, w, boxes[i].h);
    ctx.restore();

    // Ability line divider
    if (i > 0) {
      const lineImg = i % 2 === 0
        ? path.join(ASSETS_DIR, 'frames', 'planeswalker', 'abilityLineEven.png')
        : path.join(ASSETS_DIR, 'frames', 'planeswalker', 'abilityLineOdd.png');
      if (fs.existsSync(lineImg)) {
        const transH = ch * 0.0048;
        ctx.drawImage(await loadImage(lineImg), x, boxes[i].y - transH, w, transH * 2);
      }
    }
  }
}

async function body(ctx: SKRSContext2D, card: NormalizedCardData, L: Record<string, any>, cw: number, ch: number): Promise<void> {
  const abilities = getAllAbilities(card);
  const { fontSize, boxes } = computeAbilityLayout(ctx, abilities, L, cw, ch);
  const aw = L.ability.w * cw;

  // Loyalty cost icons — positioned at the vertical center of each box
  const plusImg = await loadImage(path.join(ASSETS_DIR, 'frames', 'planeswalker', 'planeswalkerPlus.png'));
  const minusImg = await loadImage(path.join(ASSETS_DIR, 'frames', 'planeswalker', 'planeswalkerMinus.png'));
  const neutralImg = await loadImage(path.join(ASSETS_DIR, 'frames', 'planeswalker', 'planeswalkerNeutral.png'));

  ctx.save();
  ctx.fillStyle = 'white';
  ctx.font = `${ch * L.iconTextSize}px "Beleren Bold SmCaps"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  for (let i = 0; i < abilities.length; i++) {
    const iconY = boxes[i].y + boxes[i].h / 2;
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

  // Ability text — uniform font size, proportional boxes
  for (let i = 0; i < abilities.length; i++) {
    const ax = L.ability.x * cw;
    drawWrappedText(ctx, abilities[i].text, ax, boxes[i].y, aw, boxes[i].h, L.ability.font, fontSize);
  }

  // Starting loyalty
  if (L.loyalty) {
    drawSingleLineText(ctx, card.startingLoyalty ?? '0', L.loyalty.x * cw, L.loyalty.y * ch, L.loyalty.w * cw, L.loyalty.h * ch, L.loyalty.font, L.loyalty.size * ch, 'center', 'white');
  }
}

export const planeswalkerHooks = { preFrame, body };
