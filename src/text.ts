import type { SKRSContext2D } from '@napi-rs/canvas';
export type RichToken = { type: 'text' | 'symbol'; value: string; italic?: boolean };
import { FONT_HEIGHT_RATIO } from './layout';
import { getManaSymbolSync } from './symbols';

export interface ExclusionRect {
  x: number; y: number; w: number; h: number; // absolute pixel coords
}

/** Given a line's absolute Y and height, compute effective text width accounting for exclusion rects. */
function getEffectiveWidth(
  lineY: number, lineH: number,
  boxX: number, boxW: number,
  exclusionRects: ExclusionRect[],
): number {
  let effectiveW = boxW;
  for (const rect of exclusionRects) {
    if (lineY + lineH > rect.y && lineY < rect.y + rect.h) {
      const maxRight = rect.x - boxX;
      if (maxRight > 0 && maxRight < effectiveW) effectiveW = maxRight;
    }
  }
  return Math.max(effectiveW, boxW * 0.5);
}

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

/** Tokenize text into symbols ({X}), italic regions ((...)), and plain text.
 *  @param initialItalic — true if this text starts inside a parenthesized region from a previous line */
export function tokenize(text: string, initialItalic = false): RichToken[] {
  // First split into italic/non-italic regions based on parens
  const regions: { text: string; italic: boolean }[] = [];
  let rest = text;
  let inParen = initialItalic;
  while (rest.length > 0) {
    if (!inParen) {
      const openIdx = rest.indexOf('(');
      if (openIdx === -1) { regions.push({ text: rest, italic: false }); break; }
      if (openIdx > 0) regions.push({ text: rest.slice(0, openIdx), italic: false });
      rest = rest.slice(openIdx);
      inParen = true;
    } else {
      const closeIdx = rest.indexOf(')');
      if (closeIdx === -1) { regions.push({ text: rest, italic: true }); break; }
      regions.push({ text: rest.slice(0, closeIdx + 1), italic: true });
      rest = rest.slice(closeIdx + 1);
      inParen = false;
    }
  }

  // Then tokenize each region for {symbols}
  const result: RichToken[] = [];
  for (const region of regions) {
    let remaining = region.text;
    while (remaining.length > 0) {
      const idx = remaining.indexOf('{');
      if (idx === -1) { result.push({ type: 'text', value: remaining, italic: region.italic }); break; }
      if (idx > 0) result.push({ type: 'text', value: remaining.slice(0, idx), italic: region.italic });
      const endIdx = remaining.indexOf('}', idx);
      if (endIdx === -1) { result.push({ type: 'text', value: remaining.slice(idx), italic: region.italic }); break; }
      result.push({ type: 'symbol', value: remaining.slice(idx + 1, endIdx) });
      remaining = remaining.slice(endIdx + 1);
    }
  }
  return result;
}

const HYBRID_SCALE = 1.2;
function isHybridSymbol(sym: string): boolean { return sym.includes('/'); }

export function measureTokenWidth(ctx: SKRSContext2D, tokens: RichToken[], textSize: number): number {
  const baseSymbolSize = textSize * 0.78;
  const spacing = textSize * 0.06;
  let width = 0;
  const origFont = ctx.font;
  for (const token of tokens) {
    if (token.type === 'text') {
      if (token.italic && !origFont.includes('Italic')) {
        ctx.font = origFont.replace(/"([^"]*)"/, '"$1 Italic"');
      }
      width += ctx.measureText(token.value).width;
      if (token.italic && !origFont.includes('Italic')) ctx.font = origFont;
    } else {
      const symSize = isHybridSymbol(token.value) ? baseSymbolSize * HYBRID_SCALE : baseSymbolSize;
      width += symSize + spacing;
    }
  }
  return width;
}

export function measureRichText(ctx: SKRSContext2D, text: string, textSize: number, initialItalic = false): number {
  return measureTokenWidth(ctx, tokenize(text, initialItalic), textSize);
}

export function drawRichLine(ctx: SKRSContext2D, text: string, x: number, baselineY: number, textSize: number, strokeWidth = 0.4, initialItalic = false): void {
  const tokens = tokenize(text, initialItalic);
  const baseSymbolSize = textSize * 0.78;
  const spacing = textSize * 0.03;
  const origFont = ctx.font;
  const isBaseItalic = origFont.includes('Italic');
  let curX = x;
  for (const token of tokens) {
    if (token.type === 'text') {
      if (token.italic && !isBaseItalic) ctx.font = origFont.replace(/"([^"]*)"/, '"$1 Italic"');
      fillTextHeavy(ctx, token.value, curX, baselineY, strokeWidth);
      curX += ctx.measureText(token.value).width;
      if (token.italic && !isBaseItalic) ctx.font = origFont;
    } else {
      const symSize = isHybridSymbol(token.value) ? baseSymbolSize * HYBRID_SCALE : baseSymbolSize;
      const img = getManaSymbolSync(token.value);
      if (img) {
        const symbolY = baselineY - symSize * 0.85;
        ctx.drawImage(img, curX + spacing, symbolY, symSize, symSize);
      }
      curX += symSize + spacing * 2;
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

export function wrapParagraphs(
  ctx: SKRSContext2D, paragraphs: string[], maxWidth: number | ((lineIndex: number) => number), textSize: number,
): { text: string; paraStart: boolean; insideParens: boolean }[] {
  const getWidth = typeof maxWidth === 'function' ? maxWidth : () => maxWidth;
  const lines: { text: string; paraStart: boolean; insideParens: boolean }[] = [];
  let inParens = false;
  for (let p = 0; p < paragraphs.length; p++) {
    const words = paragraphs[p].split(' ');
    let cur = '';
    let first = true;
    let lineStartParens = inParens;
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      const w = getWidth(lines.length);
      if (measureRichText(ctx, test, textSize, lineStartParens) > w && cur) {
        lines.push({ text: cur, paraStart: first && p > 0, insideParens: lineStartParens });
        // Track paren state: count unmatched parens in the emitted line
        for (const ch of cur) {
          if (ch === '(') inParens = true;
          else if (ch === ')') inParens = false;
        }
        lineStartParens = inParens;
        cur = word;
        first = false;
      } else {
        cur = test;
      }
    }
    if (cur) {
      lines.push({ text: cur, paraStart: first && p > 0, insideParens: lineStartParens });
      for (const ch of cur) {
        if (ch === '(') inParens = true;
        else if (ch === ')') inParens = false;
      }
    }
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

/** Measure the height text would need at a given font size, without drawing. */
export function measureWrappedHeight(
  ctx: SKRSContext2D, text: string, maxWidth: number,
  font: string, textSize: number,
): number {
  ctx.font = `${textSize}px "${font}"`;
  const paragraphs = text.split('\n').filter(p => p.trim());
  const lines = wrapParagraphs(ctx, paragraphs, maxWidth, textSize);
  return computeHeight(lines, textSize, textSize * 0.35);
}

export function drawWrappedText(
  ctx: SKRSContext2D, text: string,
  boxX: number, boxY: number, boxW: number, boxH: number,
  font: string, startingSize: number,
  options: { fontFamily?: string; color?: string; exclusionRects?: ExclusionRect[] } = {},
): { usedSize: number; usedHeight: number } {
  const color = options.color || 'black';
  const fontFamily = options.fontFamily || font;
  const exclusions = options.exclusionRects || [];
  let textSize = startingSize;
  const paragraphs = text.split('\n').filter(p => p.trim());

  while (textSize > 8) {
    ctx.font = `${textSize}px "${fontFamily}"`;
    const paraSpacing = textSize * 0.35;

    let lines: { text: string; paraStart: boolean; insideParens: boolean }[];
    let totalH: number;
    let vertAdj: number;

    if (exclusions.length > 0) {
      // Wrap with exclusion-aware widths, using vertAdj=0 (text at top of box)
      // to conservatively estimate which lines overlap badges
      lines = wrapParagraphs(ctx, paragraphs, (lineIdx: number) => {
        const lineY = boxY + lineIdx * textSize;
        return getEffectiveWidth(lineY, textSize, boxX, boxW, exclusions);
      }, textSize);
      totalH = computeHeight(lines, textSize, paraSpacing);
      vertAdj = (boxH - totalH + textSize * 0.15) / 2;
    } else {
      lines = wrapParagraphs(ctx, paragraphs, boxW, textSize);
      totalH = computeHeight(lines, textSize, paraSpacing);
      vertAdj = (boxH - totalH + textSize * 0.15) / 2;
    }

    if (totalH <= boxH) {
      ctx.fillStyle = color;
      let curY = 0;
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) { curY += textSize; if (lines[i].paraStart) curY += paraSpacing; }
        drawRichLine(ctx, lines[i].text, boxX, boxY + vertAdj + curY + textSize * FONT_HEIGHT_RATIO, textSize, 0.4, lines[i].insideParens);
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
  exclusionRects: ExclusionRect[] = [],
): void {
  let textSize = startingSize;
  const ruleParas = rulesText.split('\n').filter(p => p.trim());
  const flavorParas = flavorText.split('\n').filter(p => p.trim());

  while (textSize > 8) {
    ctx.font = `${textSize}px "${font}"`;
    const paraSpacing = textSize * 0.35;
    const barHeight = 8;
    const flavorSize = textSize;

    let rulesLines: { text: string; paraStart: boolean; insideParens: boolean }[];
    let flavorLines: { text: string; paraStart: boolean; insideParens: boolean }[];
    let totalH: number;
    let vertAdj: number;

    if (exclusionRects.length > 0) {
      // Wrap with exclusion-aware widths, using vertAdj=0 for conservative Y estimates
      ctx.font = `${textSize}px "${font}"`;
      rulesLines = wrapParagraphs(ctx, ruleParas, (lineIdx: number) => {
        const lineY = boxY + lineIdx * textSize;
        return getEffectiveWidth(lineY, textSize, boxX, boxW, exclusionRects);
      }, textSize);
      ctx.font = `${flavorSize}px "MPlantin Italic"`;
      const rulesH = computeHeight(rulesLines, textSize, paraSpacing);
      const flavorStartY = boxY + rulesH + textSize + barHeight + textSize;
      flavorLines = wrapParagraphs(ctx, flavorParas, (lineIdx: number) => {
        const lineY = flavorStartY + lineIdx * flavorSize;
        return getEffectiveWidth(lineY, flavorSize, boxX, boxW, exclusionRects);
      }, flavorSize);
      totalH = rulesH + textSize + barHeight + textSize + computeHeight(flavorLines, flavorSize, flavorSize * 0.35);
      vertAdj = (boxH - totalH + textSize * 0.15) / 2;
    } else {
      rulesLines = wrapParagraphs(ctx, ruleParas, boxW, textSize);
      ctx.font = `${flavorSize}px "MPlantin Italic"`;
      flavorLines = wrapParagraphs(ctx, flavorParas, boxW, flavorSize);
      totalH = computeHeight(rulesLines, textSize, paraSpacing) + textSize + barHeight + textSize + computeHeight(flavorLines, flavorSize, flavorSize * 0.35);
      vertAdj = (boxH - totalH + textSize * 0.15) / 2;
    }

    if (totalH <= boxH) {
      let curY = 0;
      ctx.font = `${textSize}px "${font}"`;
      ctx.fillStyle = 'black';
      for (let i = 0; i < rulesLines.length; i++) {
        if (i > 0) { curY += textSize; if (rulesLines[i].paraStart) curY += paraSpacing; }
        drawRichLine(ctx, rulesLines[i].text, boxX, boxY + vertAdj + curY + textSize * FONT_HEIGHT_RATIO, textSize, 0.4, rulesLines[i].insideParens);
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
