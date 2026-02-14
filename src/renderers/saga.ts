import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { SagaData } from '../types';
import { PW_W, PW_H, SAGA_LAYOUT, ASSETS_DIR } from '../layout';
import { drawArt, drawCorners, drawBottomInfo, drawManaCost } from '../helpers';
import { drawSingleLineText, drawWrappedText, fillTextHeavy } from '../text';

function romanNumeral(n: number): string {
  switch(n) {
    case 1: return 'I'; case 2: return 'II'; case 3: return 'III';
    case 4: return 'IV'; case 5: return 'V'; case 6: return 'VI';
    default: return String(n);
  }
}

export async function renderSaga(card: SagaData): Promise<Buffer> {
  const cw = PW_W, ch = PW_H;
  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext('2d');
  const L = SAGA_LAYOUT;

  // Background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, cw, ch);

  // Art (right side)
  if (card.artUrl) await drawArt(ctx, card.artUrl, L.art, cw, ch);

  // Frame
  const framePath = path.join(ASSETS_DIR, 'frames', 'saga', `${card.frameColor}.png`);
  if (fs.existsSync(framePath)) ctx.drawImage(await loadImage(framePath), 0, 0, cw, ch);

  // Chapter numbers and dividers
  const chapterCount = card.chapters.length;
  const actualAbilityH = Math.min(L.ability.h, 0.55 / chapterCount);

  const chapterImg = await loadImage(path.join(ASSETS_DIR, 'frames', 'saga', 'sagaChapter.png'));
  const dividerImg = await loadImage(path.join(ASSETS_DIR, 'frames', 'saga', 'sagaDivider.png'));

  let sagaCount = 1;
  const chapterFontSize = ch * L.chapterFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'black';

  for (let i = 0; i < chapterCount; i++) {
    const abilityY = (L.ability.y + i * actualAbilityH) * ch;
    const abilityH = actualAbilityH * ch;
    const sagaX = L.saga.x * cw;
    const sagaW = L.saga.w * cw;

    // Divider line (CC draws for all chapters including first)
    ctx.drawImage(dividerImg, sagaX, abilityY - (L.divider.h * ch) / 2, sagaW, L.divider.h * ch);

    // Chapter numeral hex(es)
    const numX = sagaX + L.chapter.xOff * cw;
    const numW = L.chapter.w * cw;
    const numH = L.chapter.h * ch;
    const numY = abilityY + (abilityH - numH) / 2;
    const numTextX = numX + L.chapter.textOffX * cw;
    const numTextY = numY + L.chapter.textOffY * ch;
    const chapCount = card.chapters[i].count;

    // Set font for chapter numerals (use bold since we don't have plantinsemibold)
    ctx.font = `bold ${chapterFontSize}px "MPlantin"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'black';

    if (chapCount === 1) {
      ctx.drawImage(chapterImg, numX, numY, numW, numH);
      fillTextHeavy(ctx, romanNumeral(sagaCount), numTextX - ctx.measureText(romanNumeral(sagaCount)).width / 2, numTextY, 0.6);
      sagaCount++;
    } else if (chapCount === 2) {
      const spread = L.chapterSpread * ch;
      ctx.drawImage(chapterImg, numX, numY - spread, numW, numH);
      ctx.drawImage(chapterImg, numX, numY + spread, numW, numH);
      fillTextHeavy(ctx, romanNumeral(sagaCount), numTextX - ctx.measureText(romanNumeral(sagaCount)).width / 2, numTextY - spread, 0.6);
      fillTextHeavy(ctx, romanNumeral(sagaCount + 1), numTextX - ctx.measureText(romanNumeral(sagaCount + 1)).width / 2, numTextY + spread, 0.6);
      sagaCount += 2;
    } else if (chapCount === 3) {
      const spread = 2 * L.chapterSpread * ch;
      ctx.drawImage(chapterImg, numX, numY - spread, numW, numH);
      ctx.drawImage(chapterImg, numX, numY, numW, numH);
      ctx.drawImage(chapterImg, numX, numY + spread, numW, numH);
      fillTextHeavy(ctx, romanNumeral(sagaCount), numTextX - ctx.measureText(romanNumeral(sagaCount)).width / 2, numTextY - spread, 0.6);
      fillTextHeavy(ctx, romanNumeral(sagaCount + 1), numTextX - ctx.measureText(romanNumeral(sagaCount + 1)).width / 2, numTextY, 0.6);
      fillTextHeavy(ctx, romanNumeral(sagaCount + 2), numTextX - ctx.measureText(romanNumeral(sagaCount + 2)).width / 2, numTextY + spread, 0.6);
      sagaCount += 3;
    }

    // Ability text
    drawWrappedText(ctx, card.chapters[i].text,
      L.ability.x * cw, abilityY, L.ability.w * cw, abilityH,
      L.ability.font, L.ability.size * ch);
  }

  // Name, mana, type
  drawSingleLineText(ctx, card.name, L.name.x*cw, L.name.y*ch, L.name.w*cw, L.name.h*ch, L.name.font, L.name.size*ch);
  if (card.manaCost) await drawManaCost(ctx, card.manaCost, cw, ch, L.mana);
  drawSingleLineText(ctx, card.typeLine, L.type.x*cw, L.type.y*ch, L.type.w*cw, L.type.h*ch, L.type.font, L.type.size*ch);

  drawBottomInfo(ctx, card, cw, ch);
  drawCorners(ctx, cw, ch);
  return canvas.toBuffer('image/png');
}
