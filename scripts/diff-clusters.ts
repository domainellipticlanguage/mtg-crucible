/**
 * Groups diff pixels into rectangular clusters so we can see which regions
 * of a card differ between two PNGs.
 *
 *   npx tsx scripts/diff-clusters.ts <a.png> <b.png>
 */
import * as fs from 'fs';
import { loadImage, createCanvas } from '@napi-rs/canvas';

interface Cluster { minX: number; maxX: number; minY: number; maxY: number; count: number; }

function addPx(clusters: Cluster[], x: number, y: number, gap: number) {
  // Merge into an existing cluster if x,y is within `gap` of its bbox
  for (const c of clusters) {
    if (x >= c.minX - gap && x <= c.maxX + gap && y >= c.minY - gap && y <= c.maxY + gap) {
      if (x < c.minX) c.minX = x;
      if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y;
      if (y > c.maxY) c.maxY = y;
      c.count++;
      return;
    }
  }
  clusters.push({ minX: x, maxX: x, minY: y, maxY: y, count: 1 });
}

async function main() {
  const [a, b] = process.argv.slice(2);
  const ia = await loadImage(fs.readFileSync(a));
  const ib = await loadImage(fs.readFileSync(b));
  const ca = createCanvas(ia.width, ia.height); ca.getContext('2d').drawImage(ia, 0, 0);
  const cb = createCanvas(ib.width, ib.height); cb.getContext('2d').drawImage(ib, 0, 0);
  const da = ca.getContext('2d').getImageData(0, 0, ia.width, ia.height).data;
  const db = cb.getContext('2d').getImageData(0, 0, ib.width, ib.height).data;
  const W = ia.width, H = ia.height;
  const TOL = 2;
  const GAP = 60; // px gap for merging into one cluster
  const clusters: Cluster[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const d = Math.max(
        Math.abs(da[i] - db[i]),
        Math.abs(da[i+1] - db[i+1]),
        Math.abs(da[i+2] - db[i+2]),
        Math.abs(da[i+3] - db[i+3]),
      );
      if (d > TOL) addPx(clusters, x, y, GAP);
    }
  }
  clusters.sort((a, b) => b.count - a.count);
  console.log(`Image: ${W}x${H},  ${clusters.length} clusters, gap=${GAP}px`);
  for (const c of clusters.slice(0, 12)) {
    const w = c.maxX - c.minX + 1, h = c.maxY - c.minY + 1;
    console.log(`  count=${c.count}  bbox=[${c.minX}..${c.maxX}, ${c.minY}..${c.maxY}]  ${w}x${h}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
