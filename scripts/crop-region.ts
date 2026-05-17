/**
 * Crop a horizontal band out of a card image to make small visual details
 * legible (e.g. inspecting a single type bar).
 *
 *   npx tsx scripts/crop-region.ts <input.png> <output.png> <y0> <y1>
 *
 * y0/y1 are normalized [0..1] fractions of the image height.
 */

import * as fs from 'fs';
import { loadImage, createCanvas } from '@napi-rs/canvas';

async function main() {
  const [input, output, y0Str, y1Str] = process.argv.slice(2);
  if (!input || !output || !y0Str || !y1Str) {
    console.error('Usage: crop-region.ts <input.png> <output.png> <y0> <y1>');
    process.exit(2);
  }
  const y0 = parseFloat(y0Str), y1 = parseFloat(y1Str);
  const img = await loadImage(fs.readFileSync(input));
  const cropY = Math.floor(img.height * y0);
  const cropH = Math.floor(img.height * (y1 - y0));
  const canvas = createCanvas(img.width, cropH);
  canvas.getContext('2d').drawImage(img, 0, -cropY);
  fs.writeFileSync(output, canvas.toBuffer('image/png'));
  console.log(`Cropped ${input} y=[${cropY}..${cropY + cropH}] → ${output}`);
}

main().catch(e => { console.error(e); process.exit(1); });
