#!/usr/bin/env tsx
/**
 * Generate logo assets from the source SVG.
 *
 * Outputs:
 *   assets/symbols/set-{common,uncommon,rare,mythic}.svg  – set symbols for card rendering
 *   logo/logo.png                                         – 512px white-on-transparent logo
 *   logo/logo-256.png                                     – 256px white-on-transparent logo
 *   logo/logo-dark.png                                    – 512px white-on-dark logo (for READMEs)
 *
 * Usage:
 *   npx tsx logo/generate-assets.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const LOGO_DIR = path.resolve(__dirname);
const ASSETS_DIR = path.resolve(__dirname, '..', 'assets', 'symbols');
const SOURCE_SVG = path.join(LOGO_DIR, 'logo-transparent.svg');

// ---------------------------------------------------------------------------
// Extract path data from source SVG
// ---------------------------------------------------------------------------
function extractPaths(svgContent: string): string[] {
  const pathRegex = /<path\s+d="([^"]+)"/g;
  const paths: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pathRegex.exec(svgContent)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

/**
 * Approximate bounding box of all paths by scanning M/m (moveto) commands
 * and bare coordinate pairs. Good enough for gradient placement.
 */
function estimateBounds(paths: string[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const d of paths) {
    // Match the starting "M x y" and any subsequent absolute coordinates
    const moveRe = /M\s*(-?\d+)\s+(-?\d+)/gi;
    let m: RegExpExecArray | null;
    while ((m = moveRe.exec(d)) !== null) {
      const x = Number(m[1]), y = Number(m[2]);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, maxX, minY, maxY };
}

// ---------------------------------------------------------------------------
// Rarity color definitions (matching MTG conventions)
// ---------------------------------------------------------------------------
interface GradientStop { offset: string; color: string }

interface RarityStyle {
  fill: string;          // fill for the main shape
  detailFill: string;    // fill for the outline/detail stroke
  gradient?: { id: string; stops: GradientStop[] };
}

const RARITIES: Record<string, RarityStyle> = {
  common: {
    fill: '#1a1a1a',
    detailFill: '#000000',
  },
  uncommon: {
    fill: 'url(#grad)',
    detailFill: '#000000',
    gradient: {
      id: 'grad',
      stops: [
        { offset: '0', color: 'rgb(83,116,128)' },
        { offset: '0.5', color: 'rgb(187,226,239)' },
        { offset: '1', color: 'rgb(83,116,128)' },
      ],
    },
  },
  rare: {
    fill: 'url(#grad)',
    detailFill: '#000000',
    gradient: {
      id: 'grad',
      stops: [
        { offset: '0', color: 'rgb(134,113,63)' },
        { offset: '0.5', color: 'rgb(223,194,128)' },
        { offset: '1', color: 'rgb(134,113,63)' },
      ],
    },
  },
  mythic: {
    fill: 'url(#grad)',
    detailFill: '#000000',
    gradient: {
      id: 'grad',
      stops: [
        { offset: '0', color: 'rgb(197,70,38)' },
        { offset: '0.5', color: 'rgb(246,150,29)' },
        { offset: '1', color: 'rgb(197,70,38)' },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Generate a set-symbol SVG for a given rarity
// ---------------------------------------------------------------------------
function buildSetSymbolSvg(
  paths: string[],
  style: RarityStyle,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): string {
  // The source SVG paths are in raw coordinate space (0-20000 range) and
  // rendered via transform="translate(0,2000) scale(0.1,-0.1)".
  //
  // gradientUnits="userSpaceOnUse" resolves in the coordinate system of
  // the *element referencing the gradient*. Since fill is on the <g>,
  // and the <g> has the transform, the gradient coords are in the
  // pre-transform space (the 0-20000 raw coords).
  const gWidth = bounds.maxX - bounds.minX;
  const gCenterY = (bounds.minY + bounds.maxY) / 2;

  const gradientDef = style.gradient
    ? `  <defs>
    <linearGradient id="${style.gradient.id}" x1="0" y1="0" x2="1" y2="0"
      gradientUnits="userSpaceOnUse"
      gradientTransform="matrix(${gWidth},0,0,${gWidth},${bounds.minX},${gCenterY})">
      ${style.gradient.stops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('\n      ')}
    </linearGradient>
  </defs>\n`
    : '';

  const pathElements = paths
    .map((d) => `    <path d="${d}"/>`)
    .join('\n');

  // Two layers like real MTG set symbols:
  // 1) Filled shape with rarity color (slightly thicker stroke for outline)
  // 2) Detail outlines in black on top
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 2000 2000">
${gradientDef}  <g transform="translate(0.000000,2000.000000) scale(0.100000,-0.100000)"
     fill="${style.fill}" stroke="${style.detailFill}" stroke-width="200"
     paint-order="stroke fill" stroke-linejoin="round">
${pathElements}
  </g>
</svg>
`;
}

// ---------------------------------------------------------------------------
// Render SVG to PNG using @napi-rs/canvas (with supersampling)
// ---------------------------------------------------------------------------
async function svgToPng(
  svgSource: string | Buffer,
  size: number,
  background?: string,
): Promise<Buffer> {
  // Supersample: rasterize SVG at 4x then scale down for anti-aliasing
  const ssScale = 4;
  const ssSize = size * ssScale;

  // If source is a file path, read and patch dimensions for hi-res rasterization
  let svgData: Buffer;
  if (typeof svgSource === 'string') {
    let svgStr = fs.readFileSync(svgSource, 'utf-8');
    // Replace width/height for hi-res rasterization
    svgStr = svgStr
      .replace(/width="[^"]*"/, `width="${ssSize}"`)
      .replace(/height="[^"]*"/, `height="${ssSize}"`);
    svgData = Buffer.from(svgStr);
  } else {
    svgData = svgSource;
  }

  const img = await loadImage(svgData);

  // Draw at supersampled size
  const bigCanvas = createCanvas(ssSize, ssSize);
  const bigCtx = bigCanvas.getContext('2d');
  if (background) {
    bigCtx.fillStyle = background;
    bigCtx.fillRect(0, 0, ssSize, ssSize);
  }
  bigCtx.drawImage(img, 0, 0, ssSize, ssSize);

  // Scale down to target size
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bigCanvas, 0, 0, size, size);

  return canvas.toBuffer('image/png');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const svgContent = fs.readFileSync(SOURCE_SVG, 'utf-8');
  const paths = extractPaths(svgContent);

  if (paths.length === 0) {
    console.error('No paths found in source SVG');
    process.exit(1);
  }

  console.log(`Found ${paths.length} paths in source SVG`);

  // Compute bounding box for gradient placement (in raw path coordinate space)
  const bounds = estimateBounds(paths);
  console.log(`  bounds: x ${bounds.minX}-${bounds.maxX}, y ${bounds.minY}-${bounds.maxY}`);

  // Ensure output dirs exist
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  // --- Set symbol SVGs ---
  for (const [rarity, style] of Object.entries(RARITIES)) {
    const svg = buildSetSymbolSvg(paths, style, bounds);
    const outPath = path.join(ASSETS_DIR, `set-${rarity}.svg`);
    fs.writeFileSync(outPath, svg, 'utf-8');
    console.log(`  wrote ${path.relative(process.cwd(), outPath)}`);
  }

  // --- PNG logos from source SVG (supersampled) ---
  const logos: { name: string; size: number; bg?: string }[] = [
    { name: 'logo.png', size: 512 },
    { name: 'logo-256.png', size: 256 },
    { name: 'logo-dark.png', size: 512, bg: '#1a1a1a' },
  ];

  for (const { name, size, bg } of logos) {
    const outPath = path.join(LOGO_DIR, name);
    const pngBuffer = await svgToPng(SOURCE_SVG, size, bg);
    fs.writeFileSync(outPath, pngBuffer);
    console.log(`  wrote ${path.relative(process.cwd(), outPath)}`);
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
