import { createCanvas, loadImage, GlobalFonts, ImageData, type SKRSContext2D } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import type { CardData, Color, FrameColor, AccentColor } from './types';
import { ASSETS_DIR } from './layout';

const FRAME_COLOR_CODES: Record<FrameColor, string> = {
  white: 'w', blue: 'u', black: 'b', red: 'r', green: 'g',
  colorless: 'c', multicolor: 'm', artifact: 'a', vehicle: 'v', land: 'l',
};

export function frameColorCode(fc: FrameColor | undefined): string {
  return fc ? FRAME_COLOR_CODES[fc] ?? 'c' : 'c';
}

/** Normalize frameColor (scalar or array) to an array of color codes. */
export function normalizeFrameColors(fc: CardData['frameColor']): string[] {
  if (!fc) return ['c'];
  if (Array.isArray(fc)) return fc.map(c => frameColorCode(c));
  return [frameColorCode(fc)];
}

/** Normalize accentColor (scalar or array) to an array of color codes, or undefined. */
export function normalizeAccentColors(ac: CardData['accentColor']): string[] | undefined {
  if (!ac) return undefined;
  if (Array.isArray(ac)) return ac.map(c => frameColorCode(c));
  return [frameColorCode(ac)];
}

/** Return the first frame color code (for single-value contexts like P/T). */
export function primaryFrameColorCode(fc: CardData['frameColor']): string {
  if (!fc) return 'c';
  if (Array.isArray(fc)) return frameColorCode(fc[0]);
  return frameColorCode(fc);
}

/**
 * Create a sine-smoothed gradient alpha mask for one zone in a multi-zone gradient.
 * For zone `zoneIndex` of `totalZones`, alpha ramps from 0→255 around the boundary.
 */
function createGradientMask(
  cw: number, ch: number,
  zoneIndex: number, totalZones: number,
  transitionFraction = 0.5,
): ImageData {
  const boundary = (zoneIndex / totalZones) * cw;
  const halfTrans = (cw / totalZones) * transitionFraction * 0.5;
  const transStart = boundary - halfTrans;
  const transEnd = boundary + halfTrans;

  // Use an offscreen canvas to get a proper ImageData
  const tmpCanvas = createCanvas(cw, ch);
  const tmpCtx = tmpCanvas.getContext('2d');
  const imgData = tmpCtx.createImageData(cw, ch);
  const data = imgData.data;

  for (let x = 0; x < cw; x++) {
    let alpha: number;
    if (x <= transStart) alpha = 0;
    else if (x >= transEnd) alpha = 255;
    else {
      const t = (x - transStart) / (transEnd - transStart);
      alpha = Math.round((0.5 - 0.5 * Math.cos(t * Math.PI)) * 255);
    }
    for (let y = 0; y < ch; y++) {
      const i = (y * cw + x) * 4;
      data[i + 3] = alpha;
    }
  }
  return imgData;
}

/**
 * Draw multiple frame colors with gradient blending.
 * colorCodes[0] is drawn as the base; each subsequent code is overlaid
 * through a sine-smoothed gradient mask.
 */
async function drawGradientFrames(
  ctx: SKRSContext2D,
  template: string | string[],
  colorCodes: string[],
  cw: number, ch: number,
): Promise<void> {
  if (colorCodes.length === 0) return;
  const dirs = Array.isArray(template) ? template : colorCodes.map(() => template);

  // Draw base frame
  const basePath = path.join(ASSETS_DIR, 'frames', dirs[0], `${colorCodes[0]}.png`);
  if (fs.existsSync(basePath)) {
    ctx.drawImage(await loadImage(basePath), 0, 0, cw, ch);
  }

  // Overlay each subsequent frame through gradient mask
  for (let i = 1; i < colorCodes.length; i++) {
    const framePath = path.join(ASSETS_DIR, 'frames', dirs[i], `${colorCodes[i]}.png`);
    if (!fs.existsSync(framePath)) continue;

    const mask = createGradientMask(cw, ch, i, colorCodes.length);
    const offscreen = createCanvas(cw, ch);
    const offCtx = offscreen.getContext('2d');
    offCtx.putImageData(mask, 0, 0);
    offCtx.globalCompositeOperation = 'source-in';
    offCtx.drawImage(await loadImage(framePath), 0, 0, cw, ch);
    ctx.drawImage(offscreen, 0, 0);
  }
}

/**
 * Draws the card frame, handling accent compositing and gradient blending.
 * Supports both scalar and array frameColor/accentColor.
 *
 * For accented frames (colored lands, colored artifacts):
 *   1. Draw the accent color frame(s) (the visible inner color, possibly gradient)
 *   2. Overlay the base frame's border using the frame mask (e.g. land rocky border)
 */
/**
 * Derive the color code for title/type bars from mana cost and color indicator.
 * Hybrid-only mana = colorless, unless mixed with non-hybrid colors.
 */
const MANA_LETTER_TO_FRAME: Record<string, FrameColor> = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green' };

export function deriveTitleColor(manaCost: string | undefined, colorIndicator: CardData['colorIndicator']): FrameColor {
  const WUBRG = ['W', 'U', 'B', 'R', 'G'];
  const nonHybrid = new Set<string>();
  const hybrid = new Set<string>();
  const symbols = manaCost?.match(/\{([^}]+)\}/g) || [];
  for (const sym of symbols) {
    const inner = sym.slice(1, -1).toUpperCase();
    const isHybrid = inner.includes('/');
    for (const c of WUBRG) {
      if (inner.includes(c)) {
        if (isHybrid) hybrid.add(c); else nonHybrid.add(c);
      }
    }
  }
  // Hybrid colors only count when mixed with non-hybrid
  const colors = nonHybrid.size > 0
    ? new Set([...nonHybrid, ...hybrid])
    : new Set<string>();
  // Fall back to color indicator
  if (colors.size === 0 && colorIndicator) {
    const COLOR_MAP: Record<string, string> = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G' };
    for (const c of colorIndicator) { if (COLOR_MAP[c]) colors.add(COLOR_MAP[c]); }
  }
  if (colors.size === 0) return 'artifact';
  if (colors.size === 1) return MANA_LETTER_TO_FRAME[[...colors][0]];
  return 'multicolor';
}

export async function drawFrame(
  ctx: SKRSContext2D,
  template: string | string[],
  frameColor: CardData['frameColor'],
  accentColor: CardData['accentColor'],
  cw: number, ch: number,
  nameLineCodes?: string[],
  typeLineCodes?: string[],
): Promise<void> {
  const frameCodes = normalizeFrameColors(frameColor);
  const accentCodes = normalizeAccentColors(accentColor);
  // Mask paths always use the base template name (e.g. 'standard'), not effect dirs
  const maskTemplate = Array.isArray(template) ? template.find(t => ['standard', 'planeswalker', 'planeswalker_tall', 'saga', 'class', 'battle'].includes(t)) ?? 'standard' : template;

  if (accentCodes) {
    // Draw base frame fully (gold/artifact/land fills name box, type box, PT, etc.)
    await drawGradientFrames(ctx, template, frameCodes, cw, ch);

    // Pre-render accent frame for pinline/rules regions
    const accentCanvas = createCanvas(cw, ch);
    const accentCtx = accentCanvas.getContext('2d');
    await drawGradientFrames(accentCtx, template, accentCodes, cw, ch);

    // Pre-render name line color canvas
    const nlCodes = nameLineCodes ?? accentCodes;
    let nameCanvas = accentCanvas;
    if (nlCodes.join() !== accentCodes.join()) {
      nameCanvas = createCanvas(cw, ch);
      await drawGradientFrames(nameCanvas.getContext('2d'), template, nlCodes, cw, ch);
    }

    // Pre-render type line color canvas
    const tlCodes = typeLineCodes ?? accentCodes;
    let typeCanvas = accentCanvas;
    if (tlCodes.join() !== accentCodes.join()) {
      typeCanvas = createCanvas(cw, ch);
      await drawGradientFrames(typeCanvas.getContext('2d'), template, tlCodes, cw, ch);
    } else if (tlCodes.join() === nlCodes.join()) {
      typeCanvas = nameCanvas;
    }

    // Overlay through each available mask region
    const allMasks = ['title', 'type', 'pinline', 'rules', 'pinline-textbox'];
    for (const maskName of allMasks) {
      const maskPath = path.join(ASSETS_DIR, 'masks', `${maskTemplate}-${maskName}.png`);
      if (!fs.existsSync(maskPath)) continue;
      const source = maskName === 'title' ? nameCanvas : maskName === 'type' ? typeCanvas : accentCanvas;
      const offscreen = createCanvas(cw, ch);
      const offCtx = offscreen.getContext('2d');
      offCtx.drawImage(await loadImage(maskPath), 0, 0, cw, ch);
      offCtx.globalCompositeOperation = 'source-in';
      offCtx.drawImage(source, 0, 0);
      ctx.drawImage(offscreen, 0, 0);
    }

    // Overlay accent colors on banner (N-color vertical split)
    const bannerPath = path.join(ASSETS_DIR, 'masks', `${maskTemplate}-banner.png`);
    if (fs.existsSync(bannerPath)) {
      const bannerMask = await loadImage(bannerPath);
      const n = accentCodes.length;

      // Find horizontal bounds of the banner mask
      const bboxCanvas = createCanvas(cw, ch);
      const bboxCtx = bboxCanvas.getContext('2d');
      bboxCtx.drawImage(bannerMask, 0, 0, cw, ch);
      const imgData = bboxCtx.getImageData(0, 0, cw, ch);
      let minX = cw, maxX = 0;
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          if (imgData.data[(y * cw + x) * 4 + 3] > 0) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
          }
        }
      }
      const bannerW = maxX - minX + 1;
      const stripW = Math.ceil(bannerW / n);

      for (let i = 0; i < n; i++) {
        const dirs = Array.isArray(template) ? template : accentCodes.map(() => template);
        const framePath = path.join(ASSETS_DIR, 'frames', dirs[i % dirs.length], `${accentCodes[i]}.png`);
        if (!fs.existsSync(framePath)) continue;

        const strip = createCanvas(cw, ch);
        const sCtx = strip.getContext('2d');
        // Draw banner mask
        sCtx.drawImage(bannerMask, 0, 0, cw, ch);
        // Clip to this color's vertical strip within the banner bounds
        sCtx.globalCompositeOperation = 'destination-in';
        sCtx.fillStyle = 'white';
        sCtx.fillRect(minX + stripW * i, 0, stripW, ch);
        // Fill with color frame
        sCtx.globalCompositeOperation = 'source-in';
        sCtx.drawImage(await loadImage(framePath), 0, 0, cw, ch);

        ctx.drawImage(strip, 0, 0);
      }
    }
  } else {
    // No accent — draw frame(s) with gradient blending
    await drawGradientFrames(ctx, template, frameCodes, cw, ch);

    // Overlay name/type line colors if they differ from the frame
    const overlays: { mask: string; codes: string[] }[] = [];
    if (nameLineCodes && nameLineCodes.join() !== frameCodes.join()) {
      overlays.push({ mask: 'title', codes: nameLineCodes });
    }
    if (typeLineCodes && typeLineCodes.join() !== frameCodes.join()) {
      overlays.push({ mask: 'type', codes: typeLineCodes });
    }
    // Cache pre-rendered canvases by codes key to avoid duplicating work
    const canvasCache = new Map<string, typeof ctx>();
    for (const { mask, codes } of overlays) {
      const key = codes.join();
      if (!canvasCache.has(key)) {
        const c = createCanvas(cw, ch);
        await drawGradientFrames(c.getContext('2d'), template, codes, cw, ch);
        canvasCache.set(key, c.getContext('2d'));
      }
    }
    for (const { mask, codes } of overlays) {
      const maskPath = path.join(ASSETS_DIR, 'masks', `${maskTemplate}-${mask}.png`);
      if (!fs.existsSync(maskPath)) continue;
      const srcCtx = canvasCache.get(codes.join())!;
      const offscreen = createCanvas(cw, ch);
      const offCtx = offscreen.getContext('2d');
      offCtx.drawImage(await loadImage(maskPath), 0, 0, cw, ch);
      offCtx.globalCompositeOperation = 'source-in';
      offCtx.drawImage(srcCtx.canvas, 0, 0);
      ctx.drawImage(offscreen, 0, 0);
    }
  }
}

/**
 * Draw overlay effect frames (e.g. miracle) on top of existing frames.
 * overlayDirs[i] is the effect directory name or null (skip that color).
 * Each overlay is clipped to its gradient zone so it only covers its portion.
 */
export async function drawFrameOverlay(
  ctx: SKRSContext2D,
  overlayDirs: (string | null)[],
  colorCodes: string[],
  cw: number, ch: number,
): Promise<void> {
  if (colorCodes.length === 0) return;
  const n = colorCodes.length;

  if (n === 1) {
    // Single color: overlay covers the whole card
    const dir = overlayDirs[0];
    if (!dir) return;
    const imgPath = path.join(ASSETS_DIR, 'frames', dir, `${colorCodes[0]}.png`);
    if (fs.existsSync(imgPath)) {
      ctx.drawImage(await loadImage(imgPath), 0, 0, cw, ch);
    }
    return;
  }

  // Multiple colors: each overlay is drawn through its gradient zone mask
  for (let i = 0; i < n; i++) {
    const dir = overlayDirs[i];
    if (!dir) continue;
    const imgPath = path.join(ASSETS_DIR, 'frames', dir, `${colorCodes[i]}.png`);
    if (!fs.existsSync(imgPath)) continue;

    if (i === 0) {
      // First zone: use inverted mask of zone 1 (opaque on left, transparent on right)
      const mask = createGradientMask(cw, ch, 1, n);
      const data = mask.data;
      for (let j = 3; j < data.length; j += 4) {
        data[j] = 255 - data[j];
      }
      const offscreen = createCanvas(cw, ch);
      const offCtx = offscreen.getContext('2d');
      offCtx.putImageData(mask, 0, 0);
      offCtx.globalCompositeOperation = 'source-in';
      offCtx.drawImage(await loadImage(imgPath), 0, 0, cw, ch);
      ctx.drawImage(offscreen, 0, 0);
    } else {
      const mask = createGradientMask(cw, ch, i, n);
      const offscreen = createCanvas(cw, ch);
      const offCtx = offscreen.getContext('2d');
      offCtx.putImageData(mask, 0, 0);
      offCtx.globalCompositeOperation = 'source-in';
      offCtx.drawImage(await loadImage(imgPath), 0, 0, cw, ch);
      ctx.drawImage(offscreen, 0, 0);
    }
  }
}

/**
 * Draw gradient-blended crown assets for legendary cards with multi-color accents.
 * Same algorithm as drawGradientFrames but for crown images.
 */
export async function drawGradientCrowns(
  ctx: SKRSContext2D,
  colorCodes: string[],
  x: number, y: number, w: number, h: number,
  maskImg: any | null,
  cw: number, ch: number,
): Promise<void> {
  if (colorCodes.length === 0) return;

  const drawCrown = async (crownCtx: SKRSContext2D, code: string) => {
    const crownPath = path.join(ASSETS_DIR, 'crowns', `${code}.png`);
    if (fs.existsSync(crownPath)) {
      crownCtx.drawImage(await loadImage(crownPath), x, y, w, h);
    }
  };

  // Build composite crown on offscreen canvas
  const crownCanvas = createCanvas(cw, ch);
  const crownCtx = crownCanvas.getContext('2d');

  // Draw base crown
  await drawCrown(crownCtx, colorCodes[0]);

  // Overlay subsequent crowns through gradient masks
  for (let i = 1; i < colorCodes.length; i++) {
    const crownPath = path.join(ASSETS_DIR, 'crowns', `${colorCodes[i]}.png`);
    if (!fs.existsSync(crownPath)) continue;

    const mask = createGradientMask(cw, ch, i, colorCodes.length);
    const offscreen = createCanvas(cw, ch);
    const offCtx = offscreen.getContext('2d');
    offCtx.putImageData(mask, 0, 0);
    offCtx.globalCompositeOperation = 'source-in';
    offCtx.drawImage(await loadImage(crownPath), x, y, w, h);
    crownCtx.drawImage(offscreen, 0, 0);
  }

  // Draw unmasked crown first so drop shadows are preserved
  ctx.drawImage(crownCanvas, 0, 0);

  // Apply pinline mask on top — opaque crown body overwrites, shadows remain underneath
  if (maskImg) {
    const maskedCanvas = createCanvas(cw, ch);
    const maskedCtx = maskedCanvas.getContext('2d');
    maskedCtx.drawImage(maskImg, 0, 0, cw, ch);
    maskedCtx.globalCompositeOperation = 'source-in';
    maskedCtx.drawImage(crownCanvas, 0, 0);
    ctx.drawImage(maskedCanvas, 0, 0);
  }
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
    const n = colors.length;
    const sliceAngle = (Math.PI * 2) / n;
    // Per-count rotation: 2=45° CW from top, 3=60° CW, 4=45° CW, 5=36° CW
    const rotations: Record<number, number> = {
      2: Math.PI / 4 + Math.PI,  // 225°
      3: Math.PI / 3,       // 60° CW
      4: -Math.PI / 4,      // 45° CCW
      5: -Math.PI / 5,      // 36° CCW
    };
    const startOffset = -Math.PI / 2 + (rotations[n] ?? 0);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = COLOR_HEX[colors[i]];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r + 1, startOffset + i * sliceAngle, startOffset + (i + 1) * sliceAngle);
      ctx.closePath();
      ctx.fill();
    }

    // Spoke lines between wedges
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = Math.max(3, r * 0.06 + 2);
    for (let i = 0; i < n; i++) {
      const angle = startOffset + i * sliceAngle;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * (r + 1), cy + Math.sin(angle) * (r + 1));
      ctx.stroke();
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
): Promise<number> {
  const setSymPath = path.join(ASSETS_DIR, 'symbols', 'set', `set-${rarity}.svg`);
  if (!fs.existsSync(setSymPath)) return 0;
  const setImg = await loadImage(setSymPath);
  const sh = layout.h * ch;
  const sw = sh * (setImg.width / setImg.height);
  const sx = layout.x * cw - sw;
  const sy = layout.y * ch - sh / 2;
  ctx.drawImage(setImg, sx, sy, sw, sh);
  return sw;
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

const HYBRID_SCALE = 1.2;
function isHybridSymbol(sym: string): boolean { return sym.includes('/'); }

export function measureManaCostWidth(manaStr: string, ch: number, manaSize: number): number {
  const symbols = parseManaString(manaStr);
  if (symbols.length === 0) return 0;
  const textSize = manaSize * ch;
  const baseSize = textSize * 0.78;
  const spacing = textSize * 0.04;
  let total = 0;
  for (const sym of symbols) {
    const size = isHybridSymbol(sym) ? baseSize * HYBRID_SCALE : baseSize;
    total += size + spacing * 2;
  }
  return total;
}

export async function drawManaCost(
  ctx: SKRSContext2D, manaStr: string,
  cw: number, ch: number,
  manaLayout: { y: number; w: number; size: number; shadowX: number; shadowY: number },
): Promise<void> {
  const symbols = parseManaString(manaStr);
  if (symbols.length === 0) return;

  const textSize = manaLayout.size * ch;
  const baseSize = textSize * 0.78;
  const spacing = textSize * 0.04;
  const totalWidth = measureManaCostWidth(manaStr, ch, manaLayout.size);
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
    const size = isHybridSymbol(sym) ? baseSize * HYBRID_SCALE : baseSize;
    const img = await loadManaSymbol(sym);
    if (img) {
      ctx.drawImage(img, x + spacing, symbolCenterY - size / 2, size, size);
    }
    x += size + spacing * 2;
  }
  ctx.restore();
}
