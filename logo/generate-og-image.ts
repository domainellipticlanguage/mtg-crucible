#!/usr/bin/env tsx
/**
 * Generate the Open Graph / social-preview card.
 *
 * Outputs:
 *   logo/og-image.png — 1200×630 link-preview card: wordmark + tagline on the
 *   left, a fanned spread of rendered cards on the right (shows the product).
 *
 * This is the image surfaced when a Crucible link is unfurled (Slack, Discord,
 * iMessage, Twitter/X, LinkedIn, …). It's referenced by the og:image /
 * twitter:image meta tags on the served HTML pages, and is the file to upload
 * under GitHub → repo Settings → Social preview.
 *
 * Usage:
 *   npx tsx logo/generate-og-image.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';

const LOGO_DIR = path.resolve(__dirname);
const ROOT = path.resolve(__dirname, '..');
const FONTS_DIR = path.join(ROOT, 'assets', 'fonts');
const EXAMPLES = path.join(ROOT, 'examples');
const SOURCE_SVG = path.join(LOGO_DIR, 'logo-transparent.svg');
const OUT_PATH = path.join(LOGO_DIR, 'og-image.png');

const W = 1200;
const H = 630;
const SS = 2; // supersample for crisp text/edges

const BG_TOP = '#1a1a2e';
const BG_BOTTOM = '#101019';
const GOLD = '#c4a35a';
const TEXT = '#e6e6ef';
const MUTED = '#9a9ab0';

GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'beleren-b.ttf'), 'Beleren');
GlobalFonts.registerFromPath(path.join(FONTS_DIR, 'mplantin.ttf'), 'MPlantin');

// Cards fanned on the right, back-to-front. Angles in degrees.
const FAN = [
  { file: 'wine-dine.png', cx: 770, cy: 355, angle: -15 },
  { file: 'the-candy-striper2.png', cx: 1000, cy: 355, angle: 15 },
  { file: 'crucible-of-legends.png', cx: 885, cy: 330, angle: 0 }, // front, centered
];

const CARD_H = 500;

async function main() {
  const canvas = createCanvas(W * SS, H * SS);
  const ctx = canvas.getContext('2d');
  ctx.scale(SS, SS);

  // --- Background gradient ---
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, BG_TOP);
  bg.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // --- Soft warm glow behind the card fan ---
  const glow = ctx.createRadialGradient(870, 330, 40, 870, 330, 460);
  glow.addColorStop(0, 'rgba(246,150,29,0.20)');
  glow.addColorStop(0.55, 'rgba(197,70,38,0.08)');
  glow.addColorStop(1, 'rgba(197,70,38,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // --- Card fan ---
  for (const c of FAN) {
    const img = await loadImage(path.join(EXAMPLES, c.file));
    const w = CARD_H * (img.width / img.height);
    ctx.save();
    ctx.translate(c.cx, c.cy);
    ctx.rotate((c.angle * Math.PI) / 180);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 45;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 20;
    ctx.drawImage(img, -w / 2, -CARD_H / 2, w, CARD_H);
    ctx.restore();
  }

  // --- Left text block (drawn last so nothing overlaps it) ---
  const tx = 70;

  // Logo mark above the wordmark
  const markSize = 215;
  const logoSvg = fs
    .readFileSync(SOURCE_SVG, 'utf-8')
    .replace(/width="[^"]*"/, `width="${markSize * SS}"`)
    .replace(/height="[^"]*"/, `height="${markSize * SS}"`);
  const mark = await loadImage(Buffer.from(logoSvg));
  ctx.drawImage(mark, tx - 30, 12, markSize, markSize);

  // Wordmark
  ctx.fillStyle = GOLD;
  ctx.font = '78px Beleren';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('MTG Crucible', tx, 300);

  // Tagline
  ctx.fillStyle = TEXT;
  ctx.font = '34px MPlantin';
  ctx.fillText('Render custom Magic: The', tx, 358);
  ctx.fillText('Gathering cards from text.', tx, 400);

  // Context line
  ctx.fillStyle = MUTED;
  ctx.font = '27px MPlantin';
  ctx.fillText('Node & browser · npm i mtg-crucible', tx, 460);

  const out = createCanvas(W, H);
  out.getContext('2d').drawImage(canvas, 0, 0, W, H);
  fs.writeFileSync(OUT_PATH, out.toBuffer('image/png'));
  console.log(`wrote ${path.relative(process.cwd(), OUT_PATH)} (${W}×${H})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
