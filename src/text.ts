import type { SKRSContext2D } from '@napi-rs/canvas';
import type { RichToken } from './types';
import { FONT_HEIGHT_RATIO } from './layout';
import { getManaSymbolSync } from './symbols';

export function fillTextHeavy(ctx: SKRSContext2D, text: string, x: number, y: number, strokeWidth = 0.4): void {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.strokeStyle = ctx.fillStyle as string;
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function tokenize(text: string): RichToken[] {
  const result: RichToken[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    const idx = remaining.indexOf('{');
    if (idx === -1) { result.push({ type: 'text', value: remaining }); break; }
    if (idx > 0) result.push({ type: 'text', value: remaining.slice(0, idx) });
    const endIdx = remaining.indexOf('}', idx);
    if (endIdx === -1) { result.push({ type: 'text', value: remaining.slice(idx) }); break; }
    result.push({ type: 'symbol', value: remaining.slice(idx + 1, endIdx) });
    remaining = remaining.slice(endIdx + 1);
  }
  return result;
}

export function measureTokenWidth(ctx: SKRSContext2D, tokens: RichToken[], textSize: number): number {
  const symbolSize = textSize * 0.78;
  const spacing = textSize * 0.06;
  let width = 0;
  for (const token of tokens) {
    if (token.type === 'text') width += ctx.measureText(token.value).width;
    else width += symbolSize + spacing;
  }
  return width;
}

export function measureRichText(ctx: SKRSContext2D, text: string, textSize: number): number {
  return measureTokenWidth(ctx, tokenize(text), textSize);
}

export function drawRichLine(ctx: SKRSContext2D, text: string, x: number, baselineY: number, textSize: number, strokeWidth = 0.4): void {
  const tokens = tokenize(text);
  const symbolSize = textSize * 0.78;
  const spacing = textSize * 0.03;
  let curX = x;
  for (const token of tokens) {
    if (token.type === 'text') {
      fillTextHeavy(ctx, token.value, curX, baselineY, strokeWidth);
      curX += ctx.measureText(token.value).width;
    } else {
      const img = getManaSymbolSync(token.value);
      if (img) {
        const symbolY = baselineY - symbolSize * 0.85;
        ctx.drawImage(img, curX + spacing, symbolY, symbolSize, symbolSize);
      }
      curX += symbolSize + spacing * 2;
    }
  }
}

export function drawSingleLineText(
  ctx: SKRSContext2D, text: string,
  x: number, y: number, w: number, h: number,
  font: string, size: number,
  align: 'left' | 'center' | 'right' = 'left',
  color: string = 'black',
): void {
  let textSize = size;
  while (textSize > 1) {
    ctx.font = `${textSize}px "${font}"`;
    if (ctx.measureText(text).width <= w) break;
    textSize -= 1;
  }
  ctx.font = `${textSize}px "${font}"`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const verticalAdjust = (h - textSize * 0.85) / 2;
  let drawX = x;
  if (align === 'center') drawX = x + (w - ctx.measureText(text).width) / 2;
  else if (align === 'right') drawX = x + w - ctx.measureText(text).width;
  ctx.fillText(text, drawX, y + verticalAdjust + textSize * FONT_HEIGHT_RATIO);
}

export function wrapParagraphs(ctx: SKRSContext2D, paragraphs: string[], maxWidth: number, textSize: number): { text: string; paraStart: boolean }[] {
  const lines: { text: string; paraStart: boolean }[] = [];
  for (let p = 0; p < paragraphs.length; p++) {
    const words = paragraphs[p].split(' ');
    let cur = '';
    let first = true;
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (measureRichText(ctx, test, textSize) > maxWidth && cur) {
        lines.push({ text: cur, paraStart: first && p > 0 });
        cur = word;
        first = false;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push({ text: cur, paraStart: first && p > 0 });
  }
  return lines;
}

export function computeHeight(lines: { paraStart: boolean }[], textSize: number, paraSpacing: number): number {
  let h = textSize;
  for (let i = 1; i < lines.length; i++) {
    h += textSize;
    if (lines[i].paraStart) h += paraSpacing;
  }
  return h;
}

export function drawWrappedText(
  ctx: SKRSContext2D, text: string,
  boxX: number, boxY: number, boxW: number, boxH: number,
  font: string, startingSize: number,
  options: { fontFamily?: string; color?: string } = {},
): { usedSize: number; usedHeight: number } {
  const color = options.color || 'black';
  const fontFamily = options.fontFamily || font;
  let textSize = startingSize;
  const paragraphs = text.split('\n').filter(p => p.trim());

  while (textSize > 8) {
    ctx.font = `${textSize}px "${fontFamily}"`;
    const lines = wrapParagraphs(ctx, paragraphs, boxW, textSize);
    const paraSpacing = textSize * 0.35;
    const totalH = computeHeight(lines, textSize, paraSpacing);
    if (totalH <= boxH) {
      const vertAdj = (boxH - totalH + textSize * 0.15) / 2;
      ctx.fillStyle = color;
      let curY = 0;
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) { curY += textSize; if (lines[i].paraStart) curY += paraSpacing; }
        drawRichLine(ctx, lines[i].text, boxX, boxY + vertAdj + curY + textSize * FONT_HEIGHT_RATIO, textSize);
      }
      return { usedSize: textSize, usedHeight: totalH };
    }
    textSize -= 1;
  }
  return { usedSize: textSize, usedHeight: 0 };
}

export function drawRulesAndFlavor(
  ctx: SKRSContext2D,
  rulesText: string, flavorText: string,
  boxX: number, boxY: number, boxW: number, boxH: number,
  font: string, startingSize: number,
): void {
  let textSize = startingSize;
  const ruleParas = rulesText.split('\n').filter(p => p.trim());
  const flavorParas = flavorText.split('\n').filter(p => p.trim());

  while (textSize > 8) {
    ctx.font = `${textSize}px "${font}"`;
    const rulesLines = wrapParagraphs(ctx, ruleParas, boxW, textSize);
    const flavorSize = textSize;
    ctx.font = `${flavorSize}px "MPlantin Italic"`;
    const flavorLines = wrapParagraphs(ctx, flavorParas, boxW, flavorSize);
    const paraSpacing = textSize * 0.35;
    let totalH = computeHeight(rulesLines, textSize, paraSpacing);
    const barHeight = 8;
    totalH += textSize + barHeight + textSize;
    totalH += computeHeight(flavorLines, flavorSize, flavorSize * 0.35);

    if (totalH <= boxH) {
      const vertAdj = (boxH - totalH + textSize * 0.15) / 2;
      let curY = 0;
      ctx.font = `${textSize}px "${font}"`;
      ctx.fillStyle = 'black';
      for (let i = 0; i < rulesLines.length; i++) {
        if (i > 0) { curY += textSize; if (rulesLines[i].paraStart) curY += paraSpacing; }
        drawRichLine(ctx, rulesLines[i].text, boxX, boxY + vertAdj + curY + textSize * FONT_HEIGHT_RATIO, textSize);
      }
      curY += textSize + textSize * 0.5;
      const barY = boxY + vertAdj + curY;
      const barW = boxW * 0.85;
      const barX = boxX + (boxW - barW) / 2;
      ctx.save(); ctx.globalAlpha = 0.35; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(barX, barY); ctx.lineTo(barX + barW, barY); ctx.stroke();
      ctx.restore();
      curY += barHeight + textSize * 0.5;
      ctx.font = `${flavorSize}px "MPlantin Italic"`;
      ctx.fillStyle = 'black';
      for (let i = 0; i < flavorLines.length; i++) {
        if (i > 0) { curY += flavorSize; if (flavorLines[i].paraStart) curY += flavorSize * 0.35; }
        drawRichLine(ctx, flavorLines[i].text, boxX, boxY + vertAdj + curY + flavorSize * FONT_HEIGHT_RATIO, flavorSize);
      }
      return;
    }
    textSize -= 1;
  }
}
