import type { NormalizedCardData, Color, FrameColor } from './types';
import type { Ctx, CtxImageData, CanvasImage } from './platform';
import { createCanvas, loadAssetImage, loadImageBytes, loadArt, loadFont } from './platform';
import { assetExists } from './asset-manifest';

// Load a frame mask only if it exists (per the manifest). Mask coverage varies
// per template, so requesting a fixed region list would otherwise 404 on the
// regions a given template doesn't ship.
function loadMask(rel: string): Promise<CanvasImage | null> {
  return assetExists(rel) ? loadAssetImage(rel) : Promise.resolve(null);
}

const FRAME_COLOR_CODES: Record<FrameColor, string> = {
  white: 'w', blue: 'u', black: 'b', red: 'r', green: 'g',
  colorless: 'c', multicolor: 'm', artifact: 'a', vehicle: 'v', land: 'l',
};

export function frameColorCode(fc: FrameColor | undefined): string {
  return fc ? FRAME_COLOR_CODES[fc] ?? 'c' : 'c';
}

function isBytes(v: unknown): v is Uint8Array {
  return v instanceof Uint8Array;
}

/**
 * Create a sine-smoothed gradient alpha mask for one zone in a multi-zone gradient.
 * For zone `zoneIndex` of `totalZones`, alpha ramps from 0→255 around the boundary.
 */
function createGradientMask(
  cw: number, ch: number,
  zoneIndex: number, totalZones: number,
  transitionFraction = 0.5,
  horizontal = false,
  gradientRange?: { start: number; end: number },
): CtxImageData {
  const fullSpan = horizontal ? ch : cw;
  // If a sub-range is specified, compute gradient zones within that range
  const rangeStart = gradientRange?.start ?? 0;
  const rangeSpan = gradientRange ? (gradientRange.end - gradientRange.start) : fullSpan;
  const boundary = rangeStart + (zoneIndex / totalZones) * rangeSpan;
  const halfTrans = (rangeSpan / totalZones) * transitionFraction * 0.5;
  const transStart = boundary - halfTrans;
  const transEnd = boundary + halfTrans;

  // Use an offscreen canvas to get a proper ImageData
  const tmpCanvas = createCanvas(cw, ch);
  const tmpCtx = tmpCanvas.getContext('2d');
  const imgData = tmpCtx.createImageData(cw, ch);
  const data = imgData.data;

  if (horizontal) {
    for (let y = 0; y < ch; y++) {
      let alpha: number;
      if (y <= transStart) alpha = 0;
      else if (y >= transEnd) alpha = 255;
      else {
        const t = (y - transStart) / (transEnd - transStart);
        alpha = Math.round((0.5 - 0.5 * Math.cos(t * Math.PI)) * 255);
      }
      for (let x = 0; x < cw; x++) {
        data[(y * cw + x) * 4 + 3] = alpha;
      }
    }
  } else {
    for (let x = 0; x < cw; x++) {
      let alpha: number;
      if (x <= transStart) alpha = 0;
      else if (x >= transEnd) alpha = 255;
      else {
        const t = (x - transStart) / (transEnd - transStart);
        alpha = Math.round((0.5 - 0.5 * Math.cos(t * Math.PI)) * 255);
      }
      for (let y = 0; y < ch; y++) {
        data[(y * cw + x) * 4 + 3] = alpha;
      }
    }
  }
  return imgData;
}

/** Resolve a frame image, falling back to artifact for colorless when c.png doesn't exist. */
async function resolveFrameImage(dir: string, code: string): Promise<CanvasImage | null> {
  if (assetExists(`frames/${dir}/${code}.png`)) return loadAssetImage(`frames/${dir}/${code}.png`);
  // Colorless has no variant in many specialized dirs (transform, modal, …) — fall
  // back to the standard colorless frame rather than 404 then guess at artifact.
  if (code === 'c' && dir !== 'standard') return loadAssetImage('frames/standard/c.png');
  return null;
}

/**
 * Resolve a P/T box image. `ptBase` is the box dir (e.g. 'pt' or 'pt/transform').
 * Colorless has no variant in the specialized 'pt/transform' dir, so fall back to
 * the base colorless P/T box rather than 404 / draw nothing.
 */
export async function resolvePtImage(ptBase: string, code: string): Promise<CanvasImage | null> {
  if (assetExists(`${ptBase}/${code}.png`)) return loadAssetImage(`${ptBase}/${code}.png`);
  if (code === 'c' && ptBase !== 'pt') return loadAssetImage('pt/c.png');
  return null;
}

/** Resolve the existing frame-image path for (dir, code), mirroring
 *  `resolveFrameImage`'s fallback. Returns null when nothing exists. */
function frameImagePath(dir: string, code: string): string | null {
  if (assetExists(`frames/${dir}/${code}.png`)) return `frames/${dir}/${code}.png`;
  if (code === 'c' && dir !== 'standard' && assetExists('frames/standard/c.png')) return 'frames/standard/c.png';
  return null;
}

/**
 * Enumerate the frame + mask asset paths a standard `drawFrame` pass will load,
 * for warming the cache in parallel up front (see `prefetchAssets`). Mirrors the
 * resolution logic in `drawGradientFrames`/`drawFrame`; it's best-effort, so any
 * drift just means an asset loads on demand as before rather than rendering wrong.
 * `frameDirs` is the per-segment frame-dir list passed to `drawFrame`; each code
 * array maps code i → frameDirs[i % frameDirs.length], matching `drawGradientFrames`.
 */
export function collectFrameAssetPaths(opts: {
  frameDirs: string[];
  frameCodes: string[];
  accentCodes?: string[];
  nameLineCodes: string[];
  typeLineCodes: string[];
  maskTemplate: string;
}): string[] {
  const { frameDirs, frameCodes, accentCodes, nameLineCodes, typeLineCodes, maskTemplate } = opts;
  const paths = new Set<string>();
  const addCodes = (codes: string[]) => {
    codes.forEach((code, i) => {
      const p = frameImagePath(frameDirs[i % frameDirs.length], code);
      if (p) paths.add(p);
    });
  };
  addCodes(frameCodes);
  if (accentCodes) addCodes(accentCodes);
  addCodes(nameLineCodes);
  addCodes(typeLineCodes);

  // Masks drawFrame overlays — match its conditions to avoid fetching unused ones:
  // with an accent it overlays title/type/pinline/rules/pinline-textbox + banner;
  // without one, only title/type and only when those line colors differ.
  const mt = maskTemplate === 'modalFront' || maskTemplate === 'modalBack' ? 'modal' : maskTemplate;
  const addMask = (region: string) => {
    const m = `masks/${mt}-${region}.png`;
    if (assetExists(m)) paths.add(m);
  };
  if (accentCodes) {
    for (const region of ['title', 'type', 'pinline', 'rules', 'pinline-textbox', 'banner']) addMask(region);
  } else {
    if (nameLineCodes.join() !== frameCodes.join()) addMask('title');
    if (typeLineCodes.join() !== frameCodes.join()) addMask('type');
  }
  return [...paths];
}

/**
 * Draw multiple frame colors with gradient blending.
 * colorCodes[0] is drawn as the base; each subsequent code is overlaid
 * through a sine-smoothed gradient mask.
 */
export async function drawGradientFrames(
  ctx: Ctx,
  template: string | string[],
  colorCodes: string[],
  cw: number, ch: number,
  horizontal = false,
  gradientRange?: { start: number; end: number },
): Promise<void> {
  if (colorCodes.length === 0) return;
  const rawDirs = Array.isArray(template) ? template : colorCodes.map(() => template);
  // Ensure dirs covers all colorCodes by cycling
  const dirs = colorCodes.map((_, i) => rawDirs[i % rawDirs.length]);

  // Load every frame image in parallel before the sequential draw loop below, so
  // multi-color frames issue one concurrent burst of fetches instead of N serial
  // round-trips (matters in the browser, where each is a CDN request).
  const frameImgs = await Promise.all(dirs.map((dir, i) => resolveFrameImage(dir, colorCodes[i])));

  // Draw base frame
  const baseImg = frameImgs[0];
  if (baseImg) {
    ctx.drawImage(baseImg, 0, 0, cw, ch);
  }

  const n = colorCodes.length;
  if (n === 1) return;

  // Gradient geometry along the blend axis (x for vertical, y for horizontal).
  const fullSpan = horizontal ? ch : cw;
  const rangeStart = gradientRange?.start ?? 0;
  const rangeSpan = gradientRange ? (gradientRange.end - gradientRange.start) : fullSpan;
  const transitionFraction = 0.5;
  const halfTrans = (rangeSpan / n) * transitionFraction * 0.5;
  const transStartOf = (i: number) => rangeStart + (i / n) * rangeSpan - halfTrans;
  const transEndOf = (i: number) => rangeStart + (i / n) * rangeSpan + halfTrans;

  // Overlay each subsequent frame through a gradient mask. Each overlay only
  // needs to be painted within the band where it is actually visible: from where
  // its own ramp begins, up to where the NEXT overlay becomes fully opaque (and
  // would paint over it anyway). The last overlay runs to the end. This makes the
  // work ~O(cw·ch) total instead of O(n·cw·ch) — the alpha=0 left and the
  // overwritten alpha=255 right of every strip are skipped. Output is identical.
  for (let i = 1; i < n; i++) {
    const frameImg = frameImgs[i];
    if (!frameImg) continue;

    const tStart = transStartOf(i);
    const tEnd = transEndOf(i);
    const bandStart = Math.max(0, Math.floor(tStart));
    const bandEnd = i < n - 1 ? Math.min(fullSpan, Math.ceil(transEndOf(i + 1))) : fullSpan;
    if (bandEnd <= bandStart) continue;
    const bandLen = bandEnd - bandStart;

    // Strip-sized offscreen: only the visible band along the blend axis, full
    // extent on the other axis.
    const sw = horizontal ? cw : bandLen;
    const sh = horizontal ? bandLen : ch;
    const offscreen = createCanvas(sw, sh);
    const offCtx = offscreen.getContext('2d');

    // Sine-smoothed alpha ramp, computed only over the band.
    const mask = offCtx.createImageData(sw, sh);
    const data = mask.data;
    const alphaAt = (p: number): number => {
      if (p <= tStart) return 0;
      if (p >= tEnd) return 255;
      const t = (p - tStart) / (tEnd - tStart);
      return Math.round((0.5 - 0.5 * Math.cos(t * Math.PI)) * 255);
    };
    if (horizontal) {
      for (let yy = 0; yy < sh; yy++) {
        const alpha = alphaAt(bandStart + yy);
        const rowOff = yy * sw * 4;
        for (let x = 0; x < sw; x++) data[rowOff + x * 4 + 3] = alpha;
      }
    } else {
      for (let xx = 0; xx < sw; xx++) {
        const alpha = alphaAt(bandStart + xx);
        for (let yy = 0; yy < sh; yy++) data[(yy * sw + xx) * 4 + 3] = alpha;
      }
    }
    offCtx.putImageData(mask, 0, 0);
    offCtx.globalCompositeOperation = 'source-in';
    // Draw the full frame shifted so the band aligns to the strip's origin.
    const dx = horizontal ? 0 : -bandStart;
    const dy = horizontal ? -bandStart : 0;
    offCtx.drawImage(frameImg, dx, dy, cw, ch);
    ctx.drawImage(offscreen, horizontal ? 0 : bandStart, horizontal ? bandStart : 0);
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
export async function drawFrame(
  ctx: Ctx,
  template: string | string[],
  frameCodes: string[],
  accentCodes: string[] | undefined,
  cw: number, ch: number,
  nameLineCodes?: string[],
  typeLineCodes?: string[],
  options?: { horizontal?: boolean; gradientRange?: { start: number; end: number }; maskTemplate?: string },
): Promise<void> {
  const horizontal = options?.horizontal ?? false;
  const gradientRange = options?.gradientRange;
  // Mask paths always use the base template name (e.g. 'standard'), not effect dirs
  // TODO: modal pinline mask is white instead of transparent like others — works but should be made consistent
  const MASK_TEMPLATES = new Set(['standard', 'planeswalker', 'planeswalker_tall', 'saga', 'class', 'battle', 'transformFront', 'transformBack', 'modal', 'adventure']);
  const isMaskTemplate = (t: string | undefined): boolean =>
    !!t && (MASK_TEMPLATES.has(t) || t === 'modalFront' || t === 'modalBack');
  // An effect frame (e.g. nyx/snow) produces a `template` array of effect dirs
  // with no base-template entry, so fall back to the caller-supplied base
  // template — masks live under base template names, not effect dirs.
  let rawMaskTemplate = Array.isArray(template) ? template.find(isMaskTemplate) : (isMaskTemplate(template) ? template : undefined);
  if (!rawMaskTemplate && isMaskTemplate(options?.maskTemplate)) rawMaskTemplate = options!.maskTemplate;
  const maskTemplate = rawMaskTemplate === 'modalFront' || rawMaskTemplate === 'modalBack' ? 'modal' : rawMaskTemplate;

  if (accentCodes) {
    // Draw base frame fully (gold/artifact/land fills name box, type box, PT, etc.)
    await drawGradientFrames(ctx, template, frameCodes, cw, ch, horizontal, gradientRange);

    // Pre-render accent frame for pinline/rules regions
    const accentCanvas = createCanvas(cw, ch);
    const accentCtx = accentCanvas.getContext('2d');
    await drawGradientFrames(accentCtx, template, accentCodes, cw, ch, horizontal, gradientRange);

    // Pre-render name line color canvas
    const nlCodes = nameLineCodes ?? accentCodes;
    let nameCanvas = accentCanvas;
    if (nlCodes.join() !== accentCodes.join()) {
      nameCanvas = createCanvas(cw, ch);
      await drawGradientFrames(nameCanvas.getContext('2d'), template, nlCodes, cw, ch, horizontal, gradientRange);
    }

    // Pre-render type line color canvas
    const tlCodes = typeLineCodes ?? accentCodes;
    let typeCanvas = accentCanvas;
    if (tlCodes.join() !== accentCodes.join()) {
      typeCanvas = createCanvas(cw, ch);
      await drawGradientFrames(typeCanvas.getContext('2d'), template, tlCodes, cw, ch, horizontal, gradientRange);
    } else if (tlCodes.join() === nlCodes.join()) {
      typeCanvas = nameCanvas;
    }

    // Overlay through each available mask region (only those this template ships).
    // Fetch every region mask plus the banner mask in one parallel burst, then
    // composite sequentially (draw order matters).
    const allMasks = ['title', 'type', 'pinline', 'rules', 'pinline-textbox'];
    const [maskImgs, bannerMask] = await Promise.all([
      Promise.all(allMasks.map(m => loadMask(`masks/${maskTemplate}-${m}.png`))),
      loadMask(`masks/${maskTemplate}-banner.png`),
    ]);
    for (let mi = 0; mi < allMasks.length; mi++) {
      const maskImg = maskImgs[mi];
      if (!maskImg) continue;
      const maskName = allMasks[mi];
      const source = maskName === 'title' ? nameCanvas : maskName === 'type' ? typeCanvas : accentCanvas;
      const offscreen = createCanvas(cw, ch);
      const offCtx = offscreen.getContext('2d');
      offCtx.drawImage(maskImg, 0, 0, cw, ch);
      offCtx.globalCompositeOperation = 'source-in';
      offCtx.drawImage(source, 0, 0);
      ctx.drawImage(offscreen, 0, 0);
    }

    // Overlay accent colors on banner (N-color vertical split)
    if (bannerMask) {
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
        const frameImg = await resolveFrameImage(dirs[i % dirs.length], accentCodes[i]);
        if (!frameImg) continue;

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
        sCtx.drawImage(frameImg, 0, 0, cw, ch);

        ctx.drawImage(strip, 0, 0);
      }
    }
  } else {
    // No accent — draw frame(s) with gradient blending
    await drawGradientFrames(ctx, template, frameCodes, cw, ch, horizontal, gradientRange);

    // Overlay name/type line colors if they differ from the frame
    const overlays: { mask: string; codes: string[] }[] = [];
    if (nameLineCodes && nameLineCodes.join() !== frameCodes.join()) {
      overlays.push({ mask: 'title', codes: nameLineCodes });
    }
    if (typeLineCodes && typeLineCodes.join() !== frameCodes.join()) {
      overlays.push({ mask: 'type', codes: typeLineCodes });
    }
    // Cache pre-rendered canvases by codes key to avoid duplicating work
    const canvasCache = new Map<string, Ctx>();
    for (const { codes } of overlays) {
      const key = codes.join();
      if (!canvasCache.has(key)) {
        const c = createCanvas(cw, ch);
        await drawGradientFrames(c.getContext('2d'), template, codes, cw, ch, horizontal, gradientRange);
        canvasCache.set(key, c.getContext('2d'));
      }
    }
    const overlayMasks = await Promise.all(overlays.map(o => loadMask(`masks/${maskTemplate}-${o.mask}.png`)));
    for (let oi = 0; oi < overlays.length; oi++) {
      const maskImg = overlayMasks[oi];
      if (!maskImg) continue;
      const { codes } = overlays[oi];
      const srcCtx = canvasCache.get(codes.join())!;
      const offscreen = createCanvas(cw, ch);
      const offCtx = offscreen.getContext('2d');
      offCtx.drawImage(maskImg, 0, 0, cw, ch);
      offCtx.globalCompositeOperation = 'source-in';
      offCtx.drawImage(srcCtx.canvas, 0, 0);
      ctx.drawImage(offscreen, 0, 0);
    }
  }
}

/**
 * Draw gradient-blended crown assets for legendary cards with multi-color accents.
 * Same algorithm as drawGradientFrames but for crown images.
 *
 * `baseDir` is an asset path relative to the assets root (e.g. 'crowns' or
 * 'crowns/transformFront').
 */
export async function drawGradientCrowns(
  ctx: Ctx,
  colorCodes: string[],
  x: number, y: number, w: number, h: number,
  maskImg: CanvasImage | null,
  cw: number, ch: number,
  baseDir = 'crowns',
): Promise<void> {
  if (colorCodes.length === 0) return;

  // Load all crown images in parallel before the sequential composite below.
  const crownImgs = await Promise.all(colorCodes.map(code => loadAssetImage(`${baseDir}/${code}.png`)));

  // Build composite crown on offscreen canvas
  const crownCanvas = createCanvas(cw, ch);
  const crownCtx = crownCanvas.getContext('2d');

  // Draw base crown
  const baseCrown = crownImgs[0];
  if (baseCrown) crownCtx.drawImage(baseCrown, x, y, w, h);

  // Overlay subsequent crowns through gradient masks
  for (let i = 1; i < colorCodes.length; i++) {
    const crownImg = crownImgs[i];
    if (!crownImg) continue;

    const mask = createGradientMask(cw, ch, i, colorCodes.length);
    const offscreen = createCanvas(cw, ch);
    const offCtx = offscreen.getContext('2d');
    offCtx.putImageData(mask, 0, 0);
    offCtx.globalCompositeOperation = 'source-in';
    offCtx.drawImage(crownImg, x, y, w, h);
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


const COLOR_HEX: Record<Color, string> = {
  white: '#ccced0',
  blue: '#073a6e',
  black: '#1a1918',
  red: '#c12d1f',
  green: '#0e8a3f',
};

/**
 * Draws a color indicator circle to the left of the type line.
 * Returns the horizontal offset (in pixels) the type text should shift right.
 * Returns 0 if the card has no color indicator.
 */
export function drawColorIndicator(
  ctx: Ctx,
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

import { loadManaSymbol, parseManaString } from './symbols';

let initialized = false;

async function registerFonts(): Promise<void> {
  await Promise.all([
    loadFont('Beleren Bold', 'fonts/beleren-b.ttf'),
    loadFont('Beleren Bold SmCaps', 'fonts/beleren-bsc.ttf'),
    loadFont('MPlantin', 'fonts/mplantin.ttf'),
    loadFont('MPlantin Italic', 'fonts/mplantin-i.ttf'),
  ]);
}

// One-time global setup (fonts). Symbols are warmed per-card by the renderer via
// collectSymbolKeys/preloadSymbols, so we no longer eagerly load the whole symbol
// manifest here.
export async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  await registerFonts();
  initialized = true;
}

export async function drawArt(
  ctx: Ctx, artUrl: string | Uint8Array,
  bounds: { x: number; y: number; w: number; h: number },
  cw: number, ch: number,
  options?: { rotate?: number; allowUnsafe?: boolean },
): Promise<void> {
  try {
    let img = isBytes(artUrl)
      ? await loadImageBytes(artUrl)
      : await loadArt(artUrl, options?.allowUnsafe ?? false);
    // Rotate the image if requested (90 = CW, -90 = CCW)
    if (options?.rotate) {
      const rot = createCanvas(img.height, img.width);
      const rctx = rot.getContext('2d');
      if (options.rotate > 0) {
        rctx.translate(img.height, 0);
        rctx.rotate(Math.PI / 2);
      } else {
        rctx.translate(0, img.width);
        rctx.rotate(-Math.PI / 2);
      }
      rctx.drawImage(img, 0, 0);
      img = rot as unknown as CanvasImage;
    }
    const ax = bounds.x * cw, ay = bounds.y * ch, aw = bounds.w * cw, ah = bounds.h * ch;
    const artAspect = img.width / img.height;
    const boxAspect = aw / ah;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (artAspect > boxAspect) { sw = img.height * boxAspect; sx = (img.width - sw) / 2; }
    else { sh = img.width / boxAspect; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, ax, ay, aw, ah);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const src = isBytes(artUrl) ? `<bytes ${artUrl.length}b>` : artUrl;
    console.warn(`  Failed to load art from ${src}: ${msg}`);
  }
}

function drawSmallCaps(ctx: Ctx, text: string, x: number, y: number, fontSize: number, font: string): number {
  const smallSize = fontSize * 0.82;
  let cx = x;
  for (const ch of text) {
    const isLower = ch >= 'a' && ch <= 'z';
    const sz = isLower ? smallSize : fontSize;
    const glyph = isLower ? ch.toUpperCase() : ch;
    ctx.font = `${sz}px "${font}"`;
    ctx.fillText(glyph, cx, y);
    cx += ctx.measureText(glyph).width;
  }
  return cx - x;
}

export function drawCorners(ctx: Ctx, cw: number, ch: number, format: 'png' | 'jpeg' | 'webp' = 'png'): void {
  const r = 0.048 * cw;
  const isJpeg = format === 'jpeg';
  ctx.globalCompositeOperation = isJpeg ? 'source-over' : 'destination-out';
  ctx.fillStyle = isJpeg ? 'white' : 'black';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r, 0); ctx.arc(r, r, r, -Math.PI/2, Math.PI, true); ctx.lineTo(0, 0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cw, 0); ctx.lineTo(cw-r, 0); ctx.arc(cw-r, r, r, -Math.PI/2, 0, false); ctx.lineTo(cw, 0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cw, ch); ctx.lineTo(cw, ch-r); ctx.arc(cw-r, ch-r, r, 0, Math.PI/2, false); ctx.lineTo(cw, ch); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, ch); ctx.lineTo(0, ch-r); ctx.arc(r, ch-r, r, Math.PI, Math.PI/2, true); ctx.lineTo(0, ch); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

export async function drawSetSymbol(
  ctx: Ctx, rarity: string,
  layout: { x: number; y: number; w: number; h: number },
  ch: number, cw: number,
): Promise<number> {
  const setImg = await loadAssetImage(`symbols/set/set-${rarity}.svg`);
  if (!setImg) return 0;
  const sh = layout.h * ch;
  const sw = sh * (setImg.width / setImg.height);
  const sx = layout.x * cw - sw;
  const sy = layout.y * ch - sh / 2;
  ctx.drawImage(setImg, sx, sy, sw, sh);
  return sw;
}

/** A two-line footer column: anchor (x, y = line-1 baseline) plus a line gap (h)
 *  to the second line. w is the box extent (used for right-edge anchoring). */
interface FooterColumn { x: number; y: number; w: number; h: number; }
export interface FooterLayout {
  fontSize: number;
  left: FooterColumn;
  notForSale: FooterColumn;
  right: FooterColumn;
}

/** Default footer geometry — matches the historical hardcoded positions. Used
 *  when no footer layout is supplied (and as a fallback for missing fields). */
export const DEFAULT_FOOTER: FooterLayout = {
  fontSize: 0.0143,
  left: { x: 0.0647, y: 0.965, w: 0.4, h: 0.02 },
  notForSale: { x: 0.21, y: 0.965, w: 0.14, h: 0.02 },
  right: { x: 0.535, y: 0.965, w: 0.4, h: 0.02 },
};

export async function drawBottomInfo(
  ctx: Ctx,
  card: Pick<NormalizedCardData, 'collectorNumber' | 'artist' | 'setCode' | 'language' | 'designer'>,
  cw: number,
  ch: number,
  footer: Partial<FooterLayout> = DEFAULT_FOOTER,
): Promise<void> {
  const left = footer.left ?? DEFAULT_FOOTER.left;
  const right = footer.right ?? DEFAULT_FOOTER.right;
  const nfs = footer.notForSale ?? DEFAULT_FOOTER.notForSale;
  const fontSize = (footer.fontSize ?? DEFAULT_FOOTER.fontSize) * ch;

  // Left column is left-aligned to its x; right column is right-aligned to its
  // right edge (x + w). Each column's two lines sit at y and y + h.
  const leftX = left.x * cw;
  const leftY1 = left.y * ch;
  const leftY2 = (left.y + left.h) * ch;
  const rightEdge = (right.x + right.w) * cw;
  const rightY1 = right.y * ch;
  const rightY2 = (right.y + right.h) * ch;
  const nfsX = nfs.x * cw;
  const nfsY = nfs.y * ch;

  ctx.save();
  ctx.font = `${fontSize}px "MPlantin"`;
  ctx.fillStyle = 'white';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'black'; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1; ctx.shadowBlur = 2;

  const set = `${card.setCode || 'CRU'} • ${card.language || 'EN'}`;
  const artist = card.artist || '';
  const brushPad = fontSize * 0.25;
  const setWidth = ctx.measureText(`${set} `).width;
  const brushHeight = fontSize * 0.96;
  const brushWidth = brushHeight * (202 / 118);
  const artistX = leftX + setWidth + brushPad + brushWidth + brushPad;

  // Left column, line 1: collector number
  const num = card.collectorNumber || '1 / 1';
  ctx.fillText(num, leftX, leftY1);

  // "Not For Sale"
  ctx.fillText('Not For Sale', nfsX, nfsY);

  // Right column, line 1: WotC copyright (right-aligned)
  ctx.textAlign = 'right';
  ctx.fillText(`™ & © ${new Date().getFullYear()} Wizards of the Coast`, rightEdge, rightY1);
  ctx.textAlign = 'left';

  // Left column, line 2: set • lang + artist brush + artist
  ctx.fillText(`${set} `, leftX, leftY2);
  if (artist) {
    const brushImg = await loadAssetImage('symbols/misc/artistbrush.svg');
    if (brushImg) {
      ctx.drawImage(brushImg, leftX + setWidth + brushPad, leftY2 - brushHeight * 0.85, brushWidth, brushHeight);
    }
    drawSmallCaps(ctx, artist, artistX, leftY2, fontSize, 'Beleren Bold');
    ctx.font = `${fontSize}px "MPlantin"`;
  }

  // Right column, line 2: designer (right-aligned, slightly larger)
  if (card.designer) {
    const designerFontSize = fontSize * 1.2;
    ctx.textAlign = 'right';
    ctx.font = `${designerFontSize}px "Beleren Bold"`;
    ctx.fillText(card.designer, rightEdge, rightY2);
  }

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
  ctx: Ctx, manaStr: string,
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
