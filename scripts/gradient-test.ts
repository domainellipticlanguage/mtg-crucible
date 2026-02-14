import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import { renderCard } from '../src';
import type { CardData } from '../src/types';

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

async function main() {
  const card: CardData = {
    name: 'Lightning Bolt', manaCost: '{R}', types: ['instant'],
    abilities: 'Lightning Bolt deals 3 damage to any target.',
    flavorText: '"The sparkmage shrieked, calling on the rage of the storms of his youth."',
    frameColor: 'blue', rarity: 'uncommon',
  };
  const { frontFace } = await renderCard(card);

  // Load rendered card and overlay blue frame with gradient
  const baseImg = await loadImage(frontFace);
  const cw = baseImg.width, ch = baseImg.height;
  const canvas = createCanvas(cw, ch);
  const ctx = canvas.getContext('2d');

  // Draw the base (red) card
  ctx.drawImage(baseImg, 0, 0);

  // Load the red frame (overlaid on right side)
  const redFrame = await loadImage(path.join(ASSETS_DIR, 'frames', 'standard', 'r.png'));

  // Offscreen: gradient mask + blue frame
  const offscreen = createCanvas(cw, ch);
  const offCtx = offscreen.getContext('2d');

  // Sine-smoothed step function via ImageData (much faster than per-column fillRect)
  // Transition zone: middle 30% of card width
  const transStart = cw * 0.25;
  const transEnd = cw * 0.75;
  const imgData = offCtx.createImageData(cw, ch);
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
      data[i + 3] = alpha; // only set alpha channel
    }
  }
  offCtx.putImageData(imgData, 0, 0);

  // source-in: keep blue frame only where gradient has alpha
  offCtx.globalCompositeOperation = 'source-in';
  offCtx.drawImage(redFrame, 0, 0, cw, ch);

  // Composite onto main canvas
  ctx.drawImage(offscreen, 0, 0);

  const outDir = path.resolve(__dirname, '..', '.output');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'gradient-test.png');
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'));
  console.log(`Wrote ${outPath}`);
}

main().catch(console.error);
