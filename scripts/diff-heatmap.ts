/**
 * Locates regions where two PNGs differ.
 *
 *   npx tsx scripts/diff-heatmap.ts <baseline.png> <new.png>
 *
 * Prints a per-row summary of diff pixel counts so we can see which
 * vertical band of the card is misaligned.
 */
import * as fs from 'fs';
import { loadImage, createCanvas } from '@napi-rs/canvas';

async function main() {
  const [a, b] = process.argv.slice(2);
  if (!a || !b) { console.error('Usage: diff-heatmap.ts <a.png> <b.png>'); process.exit(2); }
  const ia = await loadImage(fs.readFileSync(a));
  const ib = await loadImage(fs.readFileSync(b));
  if (ia.width !== ib.width || ia.height !== ib.height) {
    console.error(`Size mismatch: ${ia.width}x${ia.height} vs ${ib.width}x${ib.height}`);
    process.exit(2);
  }
  const ca = createCanvas(ia.width, ia.height); ca.getContext('2d').drawImage(ia, 0, 0);
  const cb = createCanvas(ib.width, ib.height); cb.getContext('2d').drawImage(ib, 0, 0);
  const da = ca.getContext('2d').getImageData(0, 0, ia.width, ia.height).data;
  const db = cb.getContext('2d').getImageData(0, 0, ib.width, ib.height).data;

  const W = ia.width, H = ia.height;
  const rowCounts = new Array<number>(H).fill(0);
  const colCounts = new Array<number>(W).fill(0);
  const TOL = 2;
  let bbox: { x0: number; x1: number; y0: number; y1: number } | null = null;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const d = Math.max(
        Math.abs(da[i] - db[i]),
        Math.abs(da[i+1] - db[i+1]),
        Math.abs(da[i+2] - db[i+2]),
        Math.abs(da[i+3] - db[i+3]),
      );
      if (d > TOL) {
        rowCounts[y]++; colCounts[x]++;
        if (!bbox) bbox = { x0: x, x1: x, y0: y, y1: y };
        else {
          if (x < bbox.x0) bbox.x0 = x;
          if (x > bbox.x1) bbox.x1 = x;
          if (y < bbox.y0) bbox.y0 = y;
          if (y > bbox.y1) bbox.y1 = y;
        }
      }
    }
  }
  console.log(`Image: ${W}x${H}`);
  if (!bbox) { console.log('No diffs.'); return; }
  console.log(`Diff bbox: x=[${bbox.x0}..${bbox.x1}] y=[${bbox.y0}..${bbox.y1}]`);
  console.log(`Normalized: x=[${(bbox.x0/W).toFixed(4)}..${(bbox.x1/W).toFixed(4)}] y=[${(bbox.y0/H).toFixed(4)}..${(bbox.y1/H).toFixed(4)}]`);

  // Top-10 hottest rows / cols
  const topN = (arr: number[], n: number) =>
    arr.map((v, i) => [i, v] as const).sort((a, b) => b[1] - a[1]).slice(0, n);
  console.log('Top 10 rows by diff pixels:');
  for (const [y, c] of topN(rowCounts, 10)) console.log(`  y=${y}  ${c}px`);
  console.log('Top 10 cols by diff pixels:');
  for (const [x, c] of topN(colCounts, 10)) console.log(`  x=${x}  ${c}px`);
}

main().catch(e => { console.error(e); process.exit(1); });
