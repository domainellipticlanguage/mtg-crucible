import { loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import * as path from 'path';
import type { NormalizedCardData, SagaAbilities } from '../types';
import { ASSETS_DIR } from '../assets-dir';
import { drawWrappedText, fillTextHeavy, wrapParagraphs, computeHeight } from '../text';
import { getParsedAbilities } from '../parser';

function romanNumeral(n: number): string {
  return [
    '', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
    'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX',
    'XXXI', 'XXXII', 'XXXIII', 'XXXIV', 'XXXV', 'XXXVI', 'XXXVII', 'XXXVIII', 'XXXIX', 'XL',
    'XLI', 'XLII', 'XLIII', 'XLIV', 'XLV', 'XLVI', 'XLVII', 'XLVIII', 'XLIX', 'L',
  ][n] || String(n);
}

async function body(ctx: SKRSContext2D, card: NormalizedCardData, L: Record<string, any>, cw: number, ch: number): Promise<void> {
  const pa = getParsedAbilities(card);
  const saga = pa.structuredAbilities as SagaAbilities;
  const chapters = saga.chapters;
  const chapterCount = chapters.length;

  // Measure and render reminder text if present
  let reminderOffsetN = 0;
  const reminderSize = L.ability.size * ch * 0.85;
  const reminderText = pa.unstructuredAbilities?.join('\n');
  if (reminderText) {
    const reminderX = L.ability.x * cw;
    const reminderW = L.ability.w * cw;
    ctx.font = `${reminderSize}px "MPlantin"`;
    const reminderParas = reminderText.split('\n').filter(p => p.trim());
    const reminderLines = wrapParagraphs(ctx, reminderParas, reminderW, reminderSize);
    const reminderH = computeHeight(reminderLines, reminderSize, reminderSize * 0.35);
    const reminderPadding = reminderSize * 0.5;
    reminderOffsetN = (reminderH + reminderPadding) / ch;

    drawWrappedText(ctx, reminderText,
      reminderX, L.ability.y * ch, reminderW, reminderH + reminderPadding,
      'MPlantin', reminderSize);
  }

  const chapterStartYN = L.ability.y + reminderOffsetN;
  const chapterEndYN = L.type.y - 0.015;
  const totalAvailableH = (chapterEndYN - chapterStartYN) * ch;

  // Measure natural text height for each chapter to distribute space proportionally
  const textSize = L.ability.size * ch;
  const abilityW = L.ability.w * cw;
  ctx.font = `${textSize}px "${L.ability.font}"`;
  const minChapterH = L.chapter.h * ch + textSize * 0.5;
  const naturalHeights: number[] = [];
  for (const chapter of chapters) {
    const paras = chapter.text.split('\n').filter((p: string) => p.trim());
    const lines = wrapParagraphs(ctx, paras, abilityW, textSize);
    const textH = computeHeight(lines, textSize, textSize * 0.35);
    naturalHeights.push(Math.max(minChapterH, textH + textSize * 0.8));
  }
  const totalNatural = naturalHeights.reduce((a, b) => a + b, 0);
  const scale = totalAvailableH / totalNatural;
  const chapterHeights = naturalHeights.map(h => h * scale);

  const chapterImg = await loadImage(path.join(ASSETS_DIR, 'frames', 'saga', 'sagaChapter.png'));
  const dividerImg = await loadImage(path.join(ASSETS_DIR, 'frames', 'saga', 'sagaDivider.png'));

  const chapterFontSize = ch * L.chapterFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'black';

  let curY = chapterStartYN * ch;
  for (let i = 0; i < chapterCount; i++) {
    const abilityY = curY;
    const abilityH = chapterHeights[i];
    const sagaX = L.saga.x * cw;
    const sagaW = L.saga.w * cw;

    // Divider line
    ctx.drawImage(dividerImg, sagaX, abilityY - (L.divider.h * ch) / 2, sagaW, L.divider.h * ch);

    // Chapter numeral hex(es)
    const numX = sagaX + L.chapter.xOff * cw;
    const numW = L.chapter.w * cw;
    const numH = L.chapter.h * ch;
    const numY = abilityY + (abilityH - numH) / 2;
    const numTextX = numX + L.chapter.textOffX * cw;
    const numTextY = numY + L.chapter.textOffY * ch;
    const chapterNumbers = chapters[i].chapterNumbers;
    const chapCount = chapterNumbers.length;

    ctx.font = `bold ${chapterFontSize}px "MPlantin"`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'black';

    if (chapCount === 1) {
      ctx.drawImage(chapterImg, numX, numY, numW, numH);
      const label = romanNumeral(chapterNumbers[0]);
      fillTextHeavy(ctx, label, numTextX - ctx.measureText(label).width / 2, numTextY, 0.6);
    } else if (chapCount === 2) {
      const spread = L.chapterSpread * ch;
      ctx.drawImage(chapterImg, numX, numY - spread, numW, numH);
      ctx.drawImage(chapterImg, numX, numY + spread, numW, numH);
      const label0 = romanNumeral(chapterNumbers[0]);
      const label1 = romanNumeral(chapterNumbers[1]);
      fillTextHeavy(ctx, label0, numTextX - ctx.measureText(label0).width / 2, numTextY - spread, 0.6);
      fillTextHeavy(ctx, label1, numTextX - ctx.measureText(label1).width / 2, numTextY + spread, 0.6);
    } else if (chapCount === 3) {
      const spread = 2 * L.chapterSpread * ch;
      ctx.drawImage(chapterImg, numX, numY - spread, numW, numH);
      ctx.drawImage(chapterImg, numX, numY, numW, numH);
      ctx.drawImage(chapterImg, numX, numY + spread, numW, numH);
      const label0 = romanNumeral(chapterNumbers[0]);
      const label1 = romanNumeral(chapterNumbers[1]);
      const label2 = romanNumeral(chapterNumbers[2]);
      fillTextHeavy(ctx, label0, numTextX - ctx.measureText(label0).width / 2, numTextY - spread, 0.6);
      fillTextHeavy(ctx, label1, numTextX - ctx.measureText(label1).width / 2, numTextY, 0.6);
      fillTextHeavy(ctx, label2, numTextX - ctx.measureText(label2).width / 2, numTextY + spread, 0.6);
    }

    // Ability text
    drawWrappedText(ctx, chapters[i].text,
      L.ability.x * cw, abilityY, L.ability.w * cw, abilityH,
      L.ability.font, L.ability.size * ch);

    curY += abilityH;
  }
}

export const sagaHooks = { body };
