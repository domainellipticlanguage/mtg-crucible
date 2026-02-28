import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { CardData, SagaAbilities } from '../types';
import { PW_W, PW_H, SAGA_LAYOUT, ASSETS_DIR } from '../layout';
import { drawArt, drawCorners, drawBottomInfo, drawManaCost, getTypeLine, primaryFrameColorCode, drawColorIndicator, drawFrame } from '../helpers';
import { drawSingleLineText, drawWrappedText, fillTextHeavy, wrapParagraphs, computeHeight } from '../text';

function romanNumeral(n: number): string {
  return [
    '', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX',
    'XXI', 'XXII', 'XXIII', 'XXIV', 'XXV', 'XXVI', 'XXVII', 'XXVIII', 'XXIX', 'XXX',
    'XXXI', 'XXXII', 'XXXIII', 'XXXIV', 'XXXV', 'XXXVI', 'XXXVII', 'XXXVIII', 'XXXIX', 'XL',
    'XLI', 'XLII', 'XLIII', 'XLIV', 'XLV', 'XLVI', 'XLVII', 'XLVIII', 'XLIX', 'L',
  ][n] || String(n);
}

export async function renderSaga(card: CardData): Promise<Buffer> {
  const cw = PW_W, ch = PW_H;
  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext('2d');
  const L = SAGA_LAYOUT;
  const fc = primaryFrameColorCode(card.frameColor);
  const saga = card.structuredAbilities as SagaAbilities;
  const chapters = saga.chapters;

  // Background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, cw, ch);

  // Art (right side)
  if (card.artUrl) await drawArt(ctx, card.artUrl, L.art, cw, ch);

  // Frame (with accent compositing for colored lands/artifacts)
  await drawFrame(ctx, 'saga', card.frameColor, card.accentColor, cw, ch);

  // Chapter numbers and dividers
  const chapterCount = chapters.length;

  // Measure and render reminder text if present (e.g. saga lore counter reminder)
  let reminderOffsetN = 0; // normalized offset for chapter start
  const reminderSize = L.ability.size * ch * 0.85;
  if (card.unstructuredAbilities) {
    const reminderX = L.ability.x * cw;
    const reminderW = L.ability.w * cw;
    ctx.font = `${reminderSize}px "MPlantin Italic"`;
    const reminderParas = card.unstructuredAbilities.split('\n').filter(p => p.trim());
    const reminderLines = wrapParagraphs(ctx, reminderParas, reminderW, reminderSize);
    const reminderH = computeHeight(reminderLines, reminderSize, reminderSize * 0.35);
    const reminderPadding = reminderSize * 0.5;
    reminderOffsetN = (reminderH + reminderPadding) / ch;

    drawWrappedText(ctx, card.unstructuredAbilities,
      reminderX, L.ability.y * ch, reminderW, reminderH + reminderPadding,
      'MPlantin Italic', reminderSize, { fontFamily: 'MPlantin Italic' });
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

    // Divider line (CC draws for all chapters including first)
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

    // Set font for chapter numerals (use bold since we don't have plantinsemibold)
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

  // Name, mana, type
  drawSingleLineText(ctx, card.name ?? '', L.name.x*cw, L.name.y*ch, L.name.w*cw, L.name.h*ch, L.name.font, L.name.size*ch);
  if (card.manaCost) await drawManaCost(ctx, card.manaCost, cw, ch, L.mana);
  const sagaTypeX = L.type.x * cw, sagaTypeY = L.type.y * ch, sagaTypeH = L.type.h * ch;
  const sagaIndOff = drawColorIndicator(ctx, card.colorIndicator, sagaTypeX, sagaTypeY, sagaTypeH);
  drawSingleLineText(ctx, getTypeLine(card), sagaTypeX + sagaIndOff, sagaTypeY, L.type.w * cw - sagaIndOff, sagaTypeH, L.type.font, L.type.size * ch);

  drawBottomInfo(ctx, card, cw, ch);
  drawCorners(ctx, cw, ch);
  return canvas.toBuffer('image/png');
}
