import { loadImage, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import type { CardData, Color, FrameColor } from './types';
import { ASSETS_DIR } from './layout';

const FRAME_COLOR_CODES: Record<FrameColor, string> = {
  white: 'w', blue: 'u', black: 'b', red: 'r', green: 'g',
  multicolor: 'm', artifact: 'a', vehicle: 'v', land: 'l',
};

export function frameColorCode(fc: FrameColor | undefined): string {
  return fc ? FRAME_COLOR_CODES[fc] ?? 'a' : 'a';
}

export function getTypeLine(card: CardData): string {
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const parts: string[] = [];
  if (card.supertypes) parts.push(...card.supertypes.map(capitalize));
  if (card.types) parts.push(...card.types.map(capitalize));
  let line = parts.join(' ');
  if (card.subtypes && card.subtypes.length > 0) {
    line += ' \u2014 ' + card.subtypes.join(' ');
  }
  return line;
}

const COLOR_HEX: Record<Color, string> = {
  white: '#ccced0',
  blue: '#005f9a',
  black: '#1a1918',
  red: '#c12d1f',
  green: '#006336',
};

/**
 * Draws a color indicator circle to the left of the type line.
 * Returns the horizontal offset (in pixels) the type text should shift right.
 * Returns 0 if the card has no color indicator.
 */
export function drawColorIndicator(
  ctx: SKRSContext2D,
  colors: Color[] | undefined,
  x: number, y: number, h: number,
): number {
  if (!colors || colors.length === 0) return 0;

  const diameter = h * 0.44;
  const r = diameter / 2 - 1;
  const cx = x + r;
  const cy = y + h * 0.55 - 5;

  // Outer shadow: dark on top half (impressed into card, light from below)
  // Draw 3 passes for intensity, tight radius
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,1)';
    ctx.shadowBlur = r * 0.4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = -r * 0.1;
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Bottom highlight (anti-shadow) — 5 passes, tight radius
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.5)';
    ctx.shadowBlur = r * 0.3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = r * 0.08;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Fill the circle with color
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  if (colors.length === 1) {
    ctx.fillStyle = COLOR_HEX[colors[0]];
    ctx.fillRect(cx - r, cy - r, diameter, diameter);
  } else {
    // Pie slices, starting from top (12 o'clock)
    const sliceAngle = (Math.PI * 2) / colors.length;
    const startOffset = -Math.PI / 2;
    for (let i = 0; i < colors.length; i++) {
      ctx.fillStyle = COLOR_HEX[colors[i]];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r + 1, startOffset + i * sliceAngle, startOffset + (i + 1) * sliceAngle);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();

  // Thin dark outline
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = Math.max(3, r * 0.08 + 2);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  return diameter + h * 0.15; // circle width + gap
}

import { loadManaSymbol, parseManaString, preloadAllSymbols } from './symbols';

let initialized = false;

function registerFonts(): void {
  GlobalFonts.registerFromPath(path.join(ASSETS_DIR, 'fonts', 'beleren-b.ttf'), 'Beleren Bold');
  GlobalFonts.registerFromPath(path.join(ASSETS_DIR, 'fonts', 'beleren-bsc.ttf'), 'Beleren Bold SmCaps');
  GlobalFonts.registerFromPath(path.join(ASSETS_DIR, 'fonts', 'mplantin.ttf'), 'MPlantin');
  GlobalFonts.registerFromPath(path.join(ASSETS_DIR, 'fonts', 'mplantin-i.ttf'), 'MPlantin Italic');
}

export async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  registerFonts();
  await preloadAllSymbols();
  initialized = true;
}

export function fetchBuffer(url: string): Promise<Buffer> {
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

export async function drawArt(
  ctx: SKRSContext2D, artUrl: string,
  bounds: { x: number; y: number; w: number; h: number },
  cw: number, ch: number,
): Promise<void> {
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

export function drawCorners(ctx: SKRSContext2D, cw: number, ch: number): void {
  const r = 0.048 * cw;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'black';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r, 0); ctx.arc(r, r, r, -Math.PI/2, Math.PI, true); ctx.lineTo(0, 0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cw, 0); ctx.lineTo(cw-r, 0); ctx.arc(cw-r, r, r, -Math.PI/2, 0, false); ctx.lineTo(cw, 0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cw, ch); ctx.lineTo(cw, ch-r); ctx.arc(cw-r, ch-r, r, 0, Math.PI/2, false); ctx.lineTo(cw, ch); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, ch); ctx.lineTo(0, ch-r); ctx.arc(r, ch-r, r, Math.PI, Math.PI/2, true); ctx.lineTo(0, ch); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

export async function drawSetSymbol(
  ctx: SKRSContext2D, rarity: string,
  layout: { x: number; y: number; w: number; h: number },
  ch: number, cw: number,
): Promise<void> {
  const setSymPath = path.join(ASSETS_DIR, 'symbols', `set-${rarity}.svg`);
  if (!fs.existsSync(setSymPath)) return;
  const setImg = await loadImage(setSymPath);
  const sh = layout.h * ch;
  const sw = sh * (setImg.width / setImg.height);
  const sx = layout.x * cw - sw;
  const sy = layout.y * ch - sh / 2;
  ctx.drawImage(setImg, sx, sy, sw, sh);
}

export function drawBottomInfo(ctx: SKRSContext2D, card: CardData, cw: number, ch: number): void {
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

export async function drawManaCost(
  ctx: SKRSContext2D, manaStr: string,
  cw: number, ch: number,
  manaLayout: { y: number; w: number; size: number; shadowX: number; shadowY: number },
): Promise<void> {
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
