/**
 * Spike v5: High-fidelity rendering of every card type.
 *
 * Card types: instant, sorcery, creature (legendary w/ crown), enchantment,
 * artifact, vehicle, land, planeswalker, saga, battle.
 */

import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D, type Image } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';

// ── Constants ────────────────────────────────────────────────────────

const FONT_HEIGHT_RATIO = 0.7;

const ASSETS = path.resolve(__dirname, '..', 'assets');
const OUT = '/tmp/mtg-crucible-spike';

// Standard card: 2010×2814
const STD_W = 2010;
const STD_H = 2814;

// Planeswalker / Saga: 1500×2100
const PW_W = 1500;
const PW_H = 2100;

// Battle: 2814×2010 (landscape)
const BTL_W = 2814;
const BTL_H = 2010;

// ── Standard layout (packM15RegularNew.js) ───────────────────────────

const STD_LAYOUT = {
  art:       { x: 0.0767, y: 0.1129, w: 0.8476, h: 0.4429 },
  name:      { x: 168/2010, y: 145/2814, w: 0.8292, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 176/2814, w: 1864/2010, size: 70.5/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 168/2010, y: 1588/2814, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  rules:     { x: 0.086, y: 1780/2814, w: 0.828, h: 0.2875, size: 0.0362, font: 'MPlantin' },
  pt:        { x: 0.7928, y: 0.902, w: 0.1367, h: 0.0372, size: 0.0372, font: 'Beleren Bold SmCaps' },
  ptBox:     { x: 0.7573, y: 0.8848, w: 0.188, h: 0.0733 },
  setSymbol: { x: 1862/2010, y: 0.5910, w: 0.12, h: 0.0410 },
  // New-style crown bounds (packM15LegendCrownsNew.js) — different from old!
  crown:     { x: 44/2010, y: 53/2814, w: 1922/2010, h: 493/2814 },
};

// ── Planeswalker layout (packPlaneswalkerRegular.js) ─────────────────

const PW_LAYOUT = {
  art:       { x: 0.0767, y: 0.1129, w: 0.8476, h: 0.4429 },
  name:      { x: 0.0867, y: 0.0372, w: 0.8267, h: 0.0548, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0481, w: 0.9292, size: 71/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.0867, y: 0.5625, w: 0.8267, h: 0.0548, size: 0.0324, font: 'Beleren Bold' },
  ability:   { x: 0.18, y: 0.6239, w: 0.7467, h: 0.0972, size: 0.0353, font: 'MPlantin' },
  loyalty:   { x: 0.806, y: 0.902, w: 0.14, h: 0.0372, size: 0.0372, font: 'Beleren Bold SmCaps' },
  // Y positions for loyalty icons at each ability count (regular layout, from CC)
  abilityIconY: {
    1: [0.7467],
    2: [0.6953, 0.822],
    3: [0.6639, 0.7467, 0.8362],
    4: [0.6505, 0.72, 0.7905, 0.861],
  } as Record<number, number[]>,
  // Icon bounds from CC's versionPlaneswalker.js
  plusIcon:    { x: 0.0294, yOff: -0.0258, w: 0.14, h: 0.0724 },
  minusIcon:  { x: 0.028, yOff: -0.0153, w: 0.1414, h: 0.0705 },
  neutralIcon:{ x: 0.028, yOff: -0.0153, w: 0.1414, h: 0.061 },
  iconTextX:  0.1027,
  iconTextSize: 0.0286,
  // Ability textbox region
  abilityBox: { x: 0.1167, w: 0.8094 },
};

// ── Saga layout (packSagaRegular.js) ─────────────────────────────────

const SAGA_LAYOUT = {
  art:       { x: 0.5, y: 0.1124, w: 0.4247, h: 0.7253 },
  name:      { x: 0.0854, y: 0.0522, w: 0.8292, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0613, w: 0.9292, size: 71/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.0854, y: 0.8481, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  ability:   { x: 0.1334, y: 0.2896, w: 0.35, h: 0.1786, size: 0.0305, font: 'MPlantin' },
  // Saga chapter area
  saga:      { x: 0.1, w: 0.3947 },
  chapter:   { w: 0.0787, h: 0.0629, textOffX: 0.0394, textOffY: 0.0429, xOff: -0.0614 },
  divider:   { h: 0.0029 },
  chapterSpread: 0.0358,
  chapterFont: 0.0324,
};

// ── Battle layout (packBattle.js) ────────────────────────────────────

const BTL_LAYOUT = {
  art:     { x: 167/2100, y: 60/1500, w: 1873/2100, h: 1371/1500 },
  name:    { x: 387/2100, y: 81/1500, w: 1547/2100, h: 114/1500, size: (0.0381*2100)/1500, font: 'Beleren Bold' },
  mana:    { y: 100/1500, w: 1957/2100, size: ((71/1638)*2100)/1500, shadowX: -0.001, shadowY: 0.0029 },
  type:    { x: 268/2100, y: 873/1500, w: 1667/2100, h: 114/1500, size: (0.0324*2100)/1500, font: 'Beleren Bold' },
  rules:   { x: 272/2100, y: 1008/1500, w: 1661/2100, h: 414/1500, size: (0.0362*2100)/1500, font: 'MPlantin' },
  defense: { x: 1920/2100, y: 1320/1500, w: 86/2100, h: 123/1500, size: (0.0372*2100)/1500, font: 'Beleren Bold SmCaps' },
};

// ── Setup ────────────────────────────────────────────────────────────

function registerFonts() {
  GlobalFonts.registerFromPath(path.join(ASSETS, 'fonts', 'beleren-b.ttf'), 'Beleren Bold');
  GlobalFonts.registerFromPath(path.join(ASSETS, 'fonts', 'beleren-bsc.ttf'), 'Beleren Bold SmCaps');
  GlobalFonts.registerFromPath(path.join(ASSETS, 'fonts', 'mplantin.ttf'), 'MPlantin');
  GlobalFonts.registerFromPath(path.join(ASSETS, 'fonts', 'mplantin-i.ttf'), 'MPlantin Italic');
}

function fetchBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve, reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── Mana symbol cache & loading ──────────────────────────────────────

const manaCache = new Map<string, Image | null>();

async function loadManaSymbol(symbol: string): Promise<Image | null> {
  const key = symbol.toLowerCase().replace(/\//g, '');
  if (manaCache.has(key)) return manaCache.get(key)!;
  const svgPath = path.join(ASSETS, 'symbols', `${key}.svg`);
  if (!fs.existsSync(svgPath)) { manaCache.set(key, null); return null; }
  const img = await loadImage(svgPath);
  manaCache.set(key, img);
  return img;
}

function getManaSymbolSync(symbol: string): Image | null {
  const key = symbol.toLowerCase().replace(/\//g, '');
  return manaCache.get(key) ?? null;
}

async function preloadAllSymbols() {
  const symbolDir = path.join(ASSETS, 'symbols');
  const files = fs.readdirSync(symbolDir).filter(f => f.endsWith('.svg'));
  for (const f of files) {
    const key = f.replace('.svg', '');
    if (!manaCache.has(key)) {
      const img = await loadImage(path.join(symbolDir, f));
      manaCache.set(key, img);
    }
  }
}

// ── Rich text tokenization (inline mana symbols) ─────────────────────

type RichToken = { type: 'text'; value: string } | { type: 'symbol'; value: string };

function tokenize(text: string): RichToken[] {
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

function measureTokenWidth(ctx: SKRSContext2D, tokens: RichToken[], textSize: number): number {
  const symbolSize = textSize * 0.78;
  const spacing = textSize * 0.06;
  let width = 0;
  for (const token of tokens) {
    if (token.type === 'text') width += ctx.measureText(token.value).width;
    else width += symbolSize + spacing;
  }
  return width;
}

function measureRichText(ctx: SKRSContext2D, text: string, textSize: number): number {
  return measureTokenWidth(ctx, tokenize(text), textSize);
}

function drawRichLine(ctx: SKRSContext2D, text: string, x: number, baselineY: number, textSize: number, strokeWidth = 0.4) {
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

function parseManaString(mana: string): string[] {
  const matches = mana.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1, -1));
}

/** Draw mana cost symbols, right-aligned. Works with any canvas dimensions. */
async function drawManaCost(
  ctx: SKRSContext2D, manaStr: string,
  cw: number, ch: number,
  manaLayout: { y: number; w: number; size: number; shadowX: number; shadowY: number },
) {
  const symbols = parseManaString(manaStr);
  if (symbols.length === 0) return;

  const textSize = manaLayout.size * ch;
  const symbolSize = textSize * 0.78;
  const spacing = textSize * 0.04;
  const totalWidth = symbols.length * symbolSize + symbols.length * spacing * 2;
  const rightX = manaLayout.w * cw;
  const textY = manaLayout.y * ch;
  const symbolCenterY = textY + textSize * 0.32;

  ctx.save();
  ctx.shadowColor = 'black';
  ctx.shadowOffsetX = manaLayout.shadowX * cw;
  ctx.shadowOffsetY = manaLayout.shadowY * ch;
  ctx.shadowBlur = 3;

  let x = rightX - totalWidth;
  for (const sym of symbols) {
    const img = await loadManaSymbol(sym);
    if (img) {
      ctx.drawImage(img, x + spacing, symbolCenterY - symbolSize / 2, symbolSize, symbolSize);
    }
    x += symbolSize + spacing * 2;
  }
  ctx.restore();
}

// ── Text rendering ───────────────────────────────────────────────────

function fillTextHeavy(ctx: SKRSContext2D, text: string, x: number, y: number, strokeWidth = 0.4) {
  ctx.save();
  ctx.textAlign = 'left';
  ctx.strokeStyle = ctx.fillStyle as string;
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawSingleLineText(
  ctx: SKRSContext2D, text: string,
  x: number, y: number, w: number, h: number,
  font: string, size: number,
  align: 'left' | 'center' | 'right' = 'left',
  color: string = 'black',
) {
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

function wrapParagraphs(ctx: SKRSContext2D, paragraphs: string[], maxWidth: number, textSize: number): { text: string; paraStart: boolean }[] {
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

function computeHeight(lines: { paraStart: boolean }[], textSize: number, paraSpacing: number): number {
  let h = textSize;
  for (let i = 1; i < lines.length; i++) {
    h += textSize;
    if (lines[i].paraStart) h += paraSpacing;
  }
  return h;
}

function drawWrappedText(
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

function drawRulesAndFlavor(
  ctx: SKRSContext2D,
  rulesText: string, flavorText: string,
  boxX: number, boxY: number, boxW: number, boxH: number,
  font: string, startingSize: number,
) {
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

// ── Shared rendering helpers ─────────────────────────────────────────

async function drawArt(ctx: SKRSContext2D, artUrl: string, bounds: {x:number;y:number;w:number;h:number}, cw: number, ch: number) {
  try {
    const buf = await fetchBuffer(artUrl);
    const img = await loadImage(buf);
    const ax = bounds.x * cw, ay = bounds.y * ch, aw = bounds.w * cw, ah = bounds.h * ch;
    const artAspect = img.width / img.height;
    const boxAspect = aw / ah;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (artAspect > boxAspect) { sw = img.height * boxAspect; sx = (img.width - sw) / 2; }
    else { sh = img.width / boxAspect; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, ax, ay, aw, ah);
  } catch (e) { console.warn(`  Failed to load art: ${e}`); }
}

function drawCorners(ctx: SKRSContext2D, cw: number, ch: number) {
  const r = 0.048 * cw;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'black';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r, 0); ctx.arc(r, r, r, -Math.PI/2, Math.PI, true); ctx.lineTo(0, 0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cw, 0); ctx.lineTo(cw-r, 0); ctx.arc(cw-r, r, r, -Math.PI/2, 0, false); ctx.lineTo(cw, 0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cw, ch); ctx.lineTo(cw, ch-r); ctx.arc(cw-r, ch-r, r, 0, Math.PI/2, false); ctx.lineTo(cw, ch); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, ch); ctx.lineTo(0, ch-r); ctx.arc(r, ch-r, r, Math.PI, Math.PI/2, true); ctx.lineTo(0, ch); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

async function drawSetSymbol(ctx: SKRSContext2D, rarity: string, layout: {x:number;y:number;w:number;h:number}, ch: number, cw: number) {
  const setSymPath = path.join(ASSETS, 'symbols', `set-${rarity}.svg`);
  if (!fs.existsSync(setSymPath)) return;
  const setImg = await loadImage(setSymPath);
  const sh = layout.h * ch;
  const sw = sh * (setImg.width / setImg.height);
  const sx = layout.x * cw - sw;
  const sy = layout.y * ch - sh / 2;
  ctx.drawImage(setImg, sx, sy, sw, sh);
}

function drawBottomInfo(ctx: SKRSContext2D, card: CardData, cw: number, ch: number) {
  const fontSize = ch * 0.0143;
  const y = ch * 0.955;
  const leftX = cw * 0.0647;
  const rightX = cw * 0.935;
  ctx.save();
  ctx.font = `${fontSize}px "MPlantin"`;
  ctx.fillStyle = 'white';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'black'; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1; ctx.shadowBlur = 2;
  const num = card.collectorNumber || '000';
  const set = card.setCode || 'CRU';
  ctx.fillText(`${num} \u2022 ${set}`, leftX, y);
  const artist = card.artist || '';
  if (artist) ctx.fillText(`\u{1F58C}\uFE0E ${artist}`, leftX, y + fontSize * 1.4);
  ctx.textAlign = 'right';
  ctx.fillText('mtg-crucible', rightX, y + fontSize * 1.4);
  ctx.textAlign = 'left';
  ctx.restore();
}

// ── Standard card renderer ───────────────────────────────────────────

interface CardData {
  name: string;
  manaCost?: string;
  typeLine: string;
  rulesText?: string;
  flavorText?: string;
  power?: string;
  toughness?: string;
  frameColor: string;
  artUrl?: string;
  rarity?: 'common' | 'uncommon' | 'rare' | 'mythic';
  artist?: string;
  collectorNumber?: string;
  setCode?: string;
  isLegendary?: boolean;
}

async function renderStandard(card: CardData): Promise<Buffer> {
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
  const framePath = path.join(ASSETS, 'frames', 'standard', `${card.frameColor}.png`);
  if (fs.existsSync(framePath)) ctx.drawImage(await loadImage(framePath), 0, 0, cw, ch);

  // Legend crown
  if (card.isLegendary) {
    const crownPath = path.join(ASSETS, 'crowns', `${card.frameColor}.png`);
    if (fs.existsSync(crownPath)) {
      // "Legend Crown Border Cover" — black bar behind crown top (CC's complementary:9)
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, cw, (137 / 2814) * ch);
      // Mask-clip the crown so frame's dark borders show through at edges
      const maskPath = path.join(ASSETS, 'crowns', 'maskCrownPinline.png');
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
    const ptPath = path.join(ASSETS, 'pt', `${card.frameColor}.png`);
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

// ── Planeswalker renderer ────────────────────────────────────────────

interface PlaneswalkerData extends CardData {
  abilities: { cost: string; text: string }[];
  startingLoyalty: string;
}

async function renderPlaneswalker(card: PlaneswalkerData): Promise<Buffer> {
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
  const totalAbilityH = 0.28; // approximate total height for ability area
  const abilityH = totalAbilityH / abilityCount;

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
        ? path.join(ASSETS, 'frames', 'planeswalker', 'abilityLineEven.png')
        : path.join(ASSETS, 'frames', 'planeswalker', 'abilityLineOdd.png');
      if (fs.existsSync(lineImg)) {
        const transH = ch * 0.0048;
        ctx.drawImage(await loadImage(lineImg), x, y - transH, w, transH * 2);
      }
    }
  }

  // Frame
  const framePath = path.join(ASSETS, 'frames', 'planeswalker', `${card.frameColor}.png`);
  if (fs.existsSync(framePath)) ctx.drawImage(await loadImage(framePath), 0, 0, cw, ch);

  // Loyalty cost icons (post-frame)
  const iconYPositions = L.abilityIconY[abilityCount] || L.abilityIconY[3];
  const plusImg = await loadImage(path.join(ASSETS, 'frames', 'planeswalker', 'planeswalkerPlus.png'));
  const minusImg = await loadImage(path.join(ASSETS, 'frames', 'planeswalker', 'planeswalkerMinus.png'));
  const neutralImg = await loadImage(path.join(ASSETS, 'frames', 'planeswalker', 'planeswalkerNeutral.png'));

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

// ── Saga renderer ────────────────────────────────────────────────────

interface SagaData extends CardData {
  chapters: { count: number; text: string }[];
}

async function renderSaga(card: SagaData): Promise<Buffer> {
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
  const framePath = path.join(ASSETS, 'frames', 'saga', `${card.frameColor}.png`);
  if (fs.existsSync(framePath)) ctx.drawImage(await loadImage(framePath), 0, 0, cw, ch);

  // Chapter numbers and dividers
  const chapterCount = card.chapters.length;
  const totalAbilityH = chapterCount * L.ability.h;
  const actualAbilityH = Math.min(L.ability.h, 0.55 / chapterCount); // fit in available space

  const chapterImg = await loadImage(path.join(ASSETS, 'frames', 'saga', 'sagaChapter.png'));
  const dividerImg = await loadImage(path.join(ASSETS, 'frames', 'saga', 'sagaDivider.png'));

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

function romanNumeral(n: number): string {
  switch(n) {
    case 1: return 'I'; case 2: return 'II'; case 3: return 'III';
    case 4: return 'IV'; case 5: return 'V'; case 6: return 'VI';
    default: return String(n);
  }
}

// ── Battle renderer ──────────────────────────────────────────────────

interface BattleData extends CardData {
  defense: string;
}

async function renderBattle(card: BattleData): Promise<Buffer> {
  const cw = BTL_W, ch = BTL_H;
  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext('2d');
  const L = BTL_LAYOUT;

  // Background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, cw, ch);

  // Art
  if (card.artUrl) await drawArt(ctx, card.artUrl, L.art, cw, ch);

  // Frame
  const framePath = path.join(ASSETS, 'frames', 'battle', `${card.frameColor}.png`);
  if (fs.existsSync(framePath)) ctx.drawImage(await loadImage(framePath), 0, 0, cw, ch);

  // Name
  drawSingleLineText(ctx, card.name, L.name.x*cw, L.name.y*ch, L.name.w*cw, L.name.h*ch, L.name.font, L.name.size*ch);

  // Mana cost
  if (card.manaCost) await drawManaCost(ctx, card.manaCost, cw, ch, L.mana);

  // Type line
  drawSingleLineText(ctx, card.typeLine, L.type.x*cw, L.type.y*ch, L.type.w*cw, L.type.h*ch, L.type.font, L.type.size*ch);

  // Rules text
  if (card.rulesText) {
    drawWrappedText(ctx, card.rulesText,
      L.rules.x*cw, L.rules.y*ch, L.rules.w*cw, L.rules.h*ch,
      L.rules.font, L.rules.size*ch);
  }

  // Defense value
  drawSingleLineText(ctx, card.defense,
    L.defense.x*cw, L.defense.y*ch, L.defense.w*cw, L.defense.h*ch,
    L.defense.font, L.defense.size*ch, 'center', 'white');

  drawCorners(ctx, cw, ch);
  return canvas.toBuffer('image/png');
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  registerFonts();
  await preloadAllSymbols();
  fs.mkdirSync(OUT, { recursive: true });
  let idx = 1;

  function fname(name: string) { return path.join(OUT, `${String(idx++).padStart(2, '0')}-${name}.png`); }

  // 1. Instant — Lightning Bolt
  console.log('Rendering Lightning Bolt (Instant)...');
  fs.writeFileSync(fname('lightning-bolt'), await renderStandard({
    name: 'Lightning Bolt', manaCost: '{R}', typeLine: 'Instant',
    rulesText: 'Lightning Bolt deals 3 damage to any target.',
    flavorText: '"The sparkmage shrieked, calling on the rage of the storms of his youth. To his surprise, the sky responded with a fierce energy he had never thought to see again."',
    frameColor: 'r', rarity: 'uncommon', artist: 'Christopher Moeller', collectorNumber: '141',
  }));

  // 2. Sorcery — Wrath of God
  console.log('Rendering Wrath of God (Sorcery)...');
  fs.writeFileSync(fname('wrath-of-god'), await renderStandard({
    name: 'Wrath of God', manaCost: '{2}{W}{W}', typeLine: 'Sorcery',
    rulesText: 'Destroy all creatures. They can\'t be regenerated.',
    flavorText: '"Legend speaks of the Creators\' rage at their most prized creation, humanity, for its hubris in believing it could attain divinity."',
    frameColor: 'w', rarity: 'rare', artist: 'Willian Murai', collectorNumber: '049',
  }));

  // 3. Legendary Creature — Questing Beast (with crown)
  console.log('Rendering Questing Beast (Legendary Creature w/ Crown)...');
  fs.writeFileSync(fname('questing-beast'), await renderStandard({
    name: 'Questing Beast', manaCost: '{2}{G}{G}', typeLine: 'Legendary Creature \u2014 Beast',
    rulesText: 'Vigilance, deathtouch, haste\nQuesting Beast can\'t be blocked by creatures with power 2 or less.\nCombat damage that would be dealt by creatures you control can\'t be prevented.\nWhenever Questing Beast deals combat damage to an opponent, it deals that much damage to target planeswalker that player controls.',
    power: '4', toughness: '4', frameColor: 'g', rarity: 'mythic',
    artist: 'Igor Kieryluk', collectorNumber: '171', isLegendary: true,
  }));

  // 4. Legendary Creature with custom art — Archangel Avacyn (with crown)
  console.log('Rendering Archangel Avacyn (Legendary + Custom Art)...');
  fs.writeFileSync(fname('avacyn'), await renderStandard({
    name: 'Archangel Avacyn', manaCost: '{3}{W}{W}', typeLine: 'Legendary Creature \u2014 Angel',
    rulesText: 'Flash\nFlying, vigilance\nWhen Archangel Avacyn enters the battlefield, creatures you control gain indestructible until end of turn.\nWhen a non-Angel creature you control dies, transform Archangel Avacyn at the beginning of the next upkeep.',
    power: '4', toughness: '4', frameColor: 'w', rarity: 'mythic',
    artist: 'James Ryman', collectorNumber: '005', isLegendary: true,
    artUrl: 'https://cards.scryfall.io/art_crop/front/7/f/7f4893ef-f983-418b-b7a4-5f073c844545.jpg?1673149345',
  }));

  // 5. Enchantment — Rhystic Study
  console.log('Rendering Rhystic Study (Enchantment)...');
  fs.writeFileSync(fname('rhystic-study'), await renderStandard({
    name: 'Rhystic Study', manaCost: '{2}{U}', typeLine: 'Enchantment',
    rulesText: 'Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.',
    flavorText: '"Friends teach what you want to know. Enemies teach what you need to know."',
    frameColor: 'u', rarity: 'rare', artist: 'Paul Scott Canavan', collectorNumber: '100',
  }));

  // 6. Artifact — Sol Ring
  console.log('Rendering Sol Ring (Artifact)...');
  fs.writeFileSync(fname('sol-ring'), await renderStandard({
    name: 'Sol Ring', manaCost: '{1}', typeLine: 'Artifact',
    rulesText: '{T}: Add {C}{C}.',
    flavorText: '"The ring maintains a nigh-unbreachable connection to the sun."',
    frameColor: 'a', rarity: 'uncommon', artist: 'Mike Bierek', collectorNumber: '249',
  }));

  // 7. Vehicle — Smuggler's Copter
  console.log('Rendering Smuggler\'s Copter (Vehicle)...');
  fs.writeFileSync(fname('smugglers-copter'), await renderStandard({
    name: 'Smuggler\'s Copter', manaCost: '{2}', typeLine: 'Artifact \u2014 Vehicle',
    rulesText: 'Flying\nWhenever Smuggler\'s Copter attacks or blocks, you may draw a card. If you do, discard a card.\nCrew 1',
    power: '3', toughness: '3', frameColor: 'v', rarity: 'rare',
    artist: 'Florian de Gesincourt', collectorNumber: '235',
  }));

  // 8. Land — Command Tower
  console.log('Rendering Command Tower (Land)...');
  fs.writeFileSync(fname('command-tower'), await renderStandard({
    name: 'Command Tower', typeLine: 'Land',
    rulesText: '{T}: Add one mana of any color in your commander\'s color identity.',
    flavorText: '"When defeat is near and guidance is scarce, all look to the tower for hope."',
    frameColor: 'l', rarity: 'common', artist: 'Evan Shipard', collectorNumber: '351',
  }));

  // 9. Planeswalker — Liliana of the Veil
  console.log('Rendering Liliana of the Veil (Planeswalker)...');
  fs.writeFileSync(fname('liliana'), await renderPlaneswalker({
    name: 'Liliana of the Veil', manaCost: '{1}{B}{B}',
    typeLine: 'Legendary Planeswalker \u2014 Liliana',
    frameColor: 'b', rarity: 'mythic', isLegendary: true,
    artist: 'Steve Argyle', collectorNumber: '105',
    startingLoyalty: '3',
    abilities: [
      { cost: '+1', text: 'Each player discards a card.' },
      { cost: '-2', text: 'Target player sacrifices a creature.' },
      { cost: '-6', text: 'Separate all permanents target player controls into two piles. That player sacrifices all permanents in the pile of their choice.' },
    ],
  }));

  // 10. Saga — The Eldest Reborn
  console.log('Rendering The Eldest Reborn (Saga)...');
  fs.writeFileSync(fname('eldest-reborn'), await renderSaga({
    name: 'The Eldest Reborn', manaCost: '{4}{B}',
    typeLine: 'Enchantment \u2014 Saga',
    frameColor: 'b', rarity: 'uncommon',
    artist: 'Jenn Ravenna', collectorNumber: '090',
    chapters: [
      { count: 1, text: 'Each opponent sacrifices a creature or planeswalker.' },
      { count: 1, text: 'Each opponent discards a card.' },
      { count: 1, text: 'Put target creature or planeswalker card from a graveyard onto the battlefield under your control.' },
    ],
  }));

  // 11. Gold multicolor — Maelstrom Wanderer
  console.log('Rendering Maelstrom Wanderer (Gold Multicolor)...');
  fs.writeFileSync(fname('maelstrom-wanderer'), await renderStandard({
    name: 'Maelstrom Wanderer', manaCost: '{5}{U}{R}{G}',
    typeLine: 'Legendary Creature \u2014 Elemental',
    rulesText: 'Creatures you control have haste.\nCascade, cascade',
    flavorText: '"The brewing of the immense elemental was a sight to behold, nature itself bowing to its whims as it rampaged across the land."',
    power: '7', toughness: '5', frameColor: 'm', rarity: 'mythic',
    artist: 'Thomas M. Baxa', collectorNumber: '206', isLegendary: true,
  }));

  // 12. Phyrexian mana — Birthing Pod
  console.log('Rendering Birthing Pod (Phyrexian Mana)...');
  fs.writeFileSync(fname('birthing-pod'), await renderStandard({
    name: 'Birthing Pod', manaCost: '{3}{G/P}',
    typeLine: 'Artifact',
    rulesText: '{1}{G/P}, {T}, Sacrifice a creature: Search your library for a creature card with mana value equal to 1 plus the sacrificed creature\'s mana value, put that card onto the battlefield, then shuffle.',
    frameColor: 'a', rarity: 'rare',
    artist: 'Daarken', collectorNumber: '104',
  }));

  // 13. Battle — Invasion of Gobakhan
  console.log('Rendering Invasion of Gobakhan (Battle)...');
  fs.writeFileSync(fname('invasion-gobakhan'), await renderBattle({
    name: 'Invasion of Gobakhan', manaCost: '{1}{W}',
    typeLine: 'Battle \u2014 Siege',
    rulesText: 'When Invasion of Gobakhan enters the battlefield, look at target opponent\'s hand and exile a nonland card from it. For as long as that card remains exiled, its owner may play it. A spell cast this way costs {2} more to cast.',
    frameColor: 'w', rarity: 'rare',
    artist: 'Zoltan Boros', collectorNumber: '014',
    defense: '3',
  }));

  console.log(`\nDone! ${idx - 1} cards rendered to ${OUT}`);
}

main().catch(console.error);
