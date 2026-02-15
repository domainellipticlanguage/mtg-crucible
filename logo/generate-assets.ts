#!/usr/bin/env tsx
/**
 * Generate logo assets from the source SVG.
 *
 * Outputs:
 *   assets/symbols/set-{common,uncommon,rare,mythic}.svg  – set symbols for card rendering
 *   logo/logo.png                                         – 1024px white-on-transparent logo
 *   logo/logo-256.png                                     – 512px white-on-transparent logo
 *   logo/logo-dark.png                                    – 1024px white-on-dark logo (for READMEs)
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
// Path extraction & manipulation
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
 * Prepare paths for set-symbol use:
 *  - Keep only the two main shapes (flame body + bowl) for a clean read at
 *    small sizes. Drops stones and detached flame wisps.
 *  - Strip sub-paths (relative `m` after `z`) to make the bowl solid.
 */
function prepareSetSymbolPaths(paths: string[]): string[] {
  // Only keep large, significant paths (>500 chars). This selects the main
  // flame body and the bowl, dropping small flame wisps and stones.
  const MIN_PATH_LENGTH = 500;

  return paths
    .filter((d) => d.length >= MIN_PATH_LENGTH)
    .map((d) => {
      // Strip sub-paths so compound shapes (bowl) fill solid
      const subPathIdx = d.search(/z\s+m/i);
      return subPathIdx >= 0 ? d.substring(0, subPathIdx + 1) : d;
    });
}

/**
 * Approximate bounding box by scanning absolute M (moveto) commands only.
 * Lowercase m is relative and would give wrong values.
 */
function estimateBounds(paths: string[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const d of paths) {
    const moveRe = /M\s*(-?\d+)\s+(-?\d+)/g; // uppercase M only
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
  fill: string;
  stroke: string;
  gradient?: { id: string; stops: GradientStop[] };
}

const RARITIES: Record<string, RarityStyle> = {
  common: {
    fill: '#1a1a1a',
    stroke: '#ffffff',
  },
  uncommon: {
    fill: 'url(#grad)',
    stroke: '#000000',
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
    stroke: '#000000',
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
    stroke: '#000000',
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

// Stroke width in the raw path coordinate space (0–20000).
// 700 gives the heavy, chunky outlines real MTG set symbols are known for.
const SET_SYMBOL_STROKE_WIDTH = 700;

// ---------------------------------------------------------------------------
// Generate a set-symbol SVG for a given rarity
// ---------------------------------------------------------------------------
function buildSetSymbolSvg(
  paths: string[],
  style: RarityStyle,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): string {
  // Gradient spans the full width of the design in the raw (pre-transform)
  // coordinate space. gradientUnits="userSpaceOnUse" resolves inside the <g>'s
  // local coordinate system (after the group's transform establishes it).
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

  // Use the full original viewBox. Computing tight bounds from path data is
  // unreliable without a full SVG parser (curves extend beyond M coordinates).
  // The card renderer controls on-card size via its layout constants.

  // paint-order="stroke fill" draws the thick black stroke behind the
  // colored fill, producing the heavy outline MTG set symbols are known for.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 2000 2000">
${gradientDef}  <g transform="translate(0.000000,2000.000000) scale(0.100000,-0.100000)"
     fill="${style.fill}" stroke="${style.stroke}" stroke-width="${SET_SYMBOL_STROKE_WIDTH}"
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
  const ssScale = 4;
  const ssSize = size * ssScale;

  let svgData: Buffer;
  if (typeof svgSource === 'string') {
    let svgStr = fs.readFileSync(svgSource, 'utf-8');
    svgStr = svgStr
      .replace(/width="[^"]*"/, `width="${ssSize}"`)
      .replace(/height="[^"]*"/, `height="${ssSize}"`);
    svgData = Buffer.from(svgStr);
  } else {
    svgData = svgSource;
  }

  const img = await loadImage(svgData);

  const bigCanvas = createCanvas(ssSize, ssSize);
  const bigCtx = bigCanvas.getContext('2d');
  if (background) {
    bigCtx.fillStyle = background;
    bigCtx.fillRect(0, 0, ssSize, ssSize);
  }
  bigCtx.drawImage(img, 0, 0, ssSize, ssSize);

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
  const rawPaths = extractPaths(svgContent);

  if (rawPaths.length === 0) {
    console.error('No paths found in source SVG');
    process.exit(1);
  }

  console.log(`Found ${rawPaths.length} paths in source SVG`);

  // Prepare paths for set symbol use (strip sub-paths to make bowl solid)
  const setPaths = prepareSetSymbolPaths(rawPaths);

  // Compute bounding box for gradient placement (raw coordinate space)
  const bounds = estimateBounds(setPaths);
  console.log(`  bounds: x ${bounds.minX}–${bounds.maxX}, y ${bounds.minY}–${bounds.maxY}`);

  // Ensure output dirs exist
  fs.mkdirSync(ASSETS_DIR, { recursive: true });

  // --- Set symbol SVGs ---
  for (const [rarity, style] of Object.entries(RARITIES)) {
    const svg = buildSetSymbolSvg(setPaths, style, bounds);
    const outPath = path.join(ASSETS_DIR, `set-${rarity}.svg`);
    fs.writeFileSync(outPath, svg, 'utf-8');
    console.log(`  wrote ${path.relative(process.cwd(), outPath)}`);
  }

  // --- PNG logos from source SVG (supersampled, unchanged) ---
  const logos: { name: string; size: number; bg?: string }[] = [
    { name: 'logo.png', size: 1024 },
    { name: 'logo-256.png', size: 512 },
    { name: 'logo-dark.png', size: 1024, bg: '#1a1a1a' },
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
