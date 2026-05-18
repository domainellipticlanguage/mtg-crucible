/**
 * Composes before/after PNG pairs from .output/bug-snapshots/{before,after}
 * into side-by-side comparison images under .output/bug-snapshots/compare/.
 *
 *   npx tsx scripts/bug-side-by-side.ts
 *
 * Each composite is `before | after` with a thin label bar at the top.
 * Cases where before == after byte-for-byte are skipped (nothing to compare).
 */

import * as fs from 'fs';
import * as path from 'path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const BEFORE = path.resolve(__dirname, '..', '.output', 'bug-snapshots', 'before');
const AFTER = path.resolve(__dirname, '..', '.output', 'bug-snapshots', 'after');
const OUT = path.resolve(__dirname, '..', '.output', 'bug-snapshots', 'compare');

async function compose(name: string) {
  const beforePath = path.join(BEFORE, name);
  const afterPath = path.join(AFTER, name);
  const beforeExists = fs.existsSync(beforePath);
  const afterExists = fs.existsSync(afterPath);
  if (!beforeExists && !afterExists) return false;

  const beforeBuf = beforeExists ? fs.readFileSync(beforePath) : null;
  const afterBuf = afterExists ? fs.readFileSync(afterPath) : null;
  const changed = !beforeBuf || !afterBuf || Buffer.compare(beforeBuf, afterBuf) !== 0;

  const a = beforeBuf ? await loadImage(beforeBuf) : null;
  const b = afterBuf ? await loadImage(afterBuf) : null;
  const ref = a ?? b!;
  if (a && b && (a.width !== b.width || a.height !== b.height)) {
    console.log(`  size mismatch on ${name} — skipping`);
    return false;
  }

  // Scale each image down so the composite isn't enormous.
  const targetH = 900;
  const scale = targetH / ref.height;
  const cardW = Math.round(ref.width * scale);
  const cardH = Math.round(ref.height * scale);

  const gap = 30;
  const labelH = 50;
  const W = cardW * 2 + gap * 3;
  const H = labelH + cardH + gap * 2;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, W, H);

  // Title bar
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(`${name}${changed ? '' : '  (unchanged)'}`, gap, labelH / 2);

  // Column labels
  ctx.textAlign = 'center';
  ctx.fillStyle = '#bbb';
  ctx.font = '16px sans-serif';
  ctx.fillText('BEFORE', gap + cardW / 2, labelH - 10);
  ctx.fillText('AFTER', gap * 2 + cardW + cardW / 2, labelH - 10);

  // Cards
  if (a) ctx.drawImage(a, gap, labelH + gap, cardW, cardH);
  else {
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(gap, labelH + gap, cardW, cardH);
    ctx.fillStyle = '#888';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('(no before)', gap + cardW / 2, labelH + gap + cardH / 2);
  }
  if (b) ctx.drawImage(b, gap * 2 + cardW, labelH + gap, cardW, cardH);
  else {
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(gap * 2 + cardW, labelH + gap, cardW, cardH);
    ctx.fillStyle = '#888';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('(no after)', gap * 2 + cardW + cardW / 2, labelH + gap + cardH / 2);
  }

  fs.writeFileSync(path.join(OUT, name), canvas.toBuffer('image/png'));
  return changed;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const fromBefore = fs.existsSync(BEFORE) ? fs.readdirSync(BEFORE).filter(f => f.endsWith('.png')) : [];
  const fromAfter = fs.existsSync(AFTER) ? fs.readdirSync(AFTER).filter(f => f.endsWith('.png')) : [];
  const files = Array.from(new Set([...fromBefore, ...fromAfter])).sort();
  let changed = 0;
  for (const f of files) {
    const did = await compose(f);
    console.log(`  ${did ? '✓ changed' : '   same    '}  ${f}`);
    if (did) changed++;
  }
  console.log(`\n${changed}/${files.length} cases differ. Composites in: ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
