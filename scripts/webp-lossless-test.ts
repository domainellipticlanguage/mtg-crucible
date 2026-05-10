import { createCanvas, loadImage } from '@napi-rs/canvas';
import { renderCard } from '../src';

(async () => {
  const r = await renderCard({
    name: 'Archangel Avacyn', manaCost: '{3}{W}{W}',
    supertypes: ['legendary'], types: ['creature'], subtypes: ['Angel'],
    abilities: 'Flash\nFlying, vigilance',
    power: '4', toughness: '4', frameColor: 'white', rarity: 'mythic',
    artist: 'James Ryman',
    artUrl: 'https://cards.scryfall.io/art_crop/front/7/f/7f4893ef-f983-418b-b7a4-5f073c844545.jpg?1673149345',
  }, { quality: 'high', format: 'png' });

  const img = await loadImage(r.frontFace);
  const c = createCanvas(img.width, img.height);
  c.getContext('2d').drawImage(img, 0, 0);

  const png = c.toBuffer('image/png').length;
  console.log('PNG:                 ', (png / 1024).toFixed(1), 'KB  (baseline)');
  console.log('WebP default:        ', (c.toBuffer('image/webp').length / 1024).toFixed(1), 'KB');
  for (const q of [50, 75, 90, 95, 100, 101]) {
    try {
      const sz = c.toBuffer('image/webp' as any, q).length;
      const pct = ((sz / png) * 100).toFixed(0);
      console.log(`WebP q=${q}:`.padEnd(21), (sz / 1024).toFixed(1), `KB  (${pct}% of PNG)`);
    } catch (e: any) { console.log('q=' + q + ' err: ' + e.message); }
  }

  // Encode timing (averaged over N iterations)
  const N = 5;
  function timeIt(label: string, fn: () => Buffer) {
    fn(); // warmup
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < N; i++) fn();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
    console.log(`  ${label.padEnd(20)} ${ms.toFixed(0)} ms/encode`);
  }
  console.log('\nEncode time (avg of 5):');
  timeIt('PNG', () => c.toBuffer('image/png'));
  timeIt('WebP default', () => c.toBuffer('image/webp'));
  timeIt('WebP q=75', () => c.toBuffer('image/webp' as any, 75));
  timeIt('WebP q=100 (lossless)', () => c.toBuffer('image/webp' as any, 100));
  timeIt('JPEG', () => c.toBuffer('image/jpeg'));

  // Lossless check: re-decode webp@100 vs png, compare pixels
  const pngBuf = c.toBuffer('image/png');
  const webp100 = c.toBuffer('image/webp' as any, 100);
  const pngImg = await loadImage(pngBuf);
  const webpImg = await loadImage(webp100);
  const a = createCanvas(pngImg.width, pngImg.height);
  a.getContext('2d').drawImage(pngImg, 0, 0);
  const b = createCanvas(webpImg.width, webpImg.height);
  b.getContext('2d').drawImage(webpImg, 0, 0);
  const ad = a.getContext('2d').getImageData(0, 0, pngImg.width, pngImg.height).data;
  const bd = b.getContext('2d').getImageData(0, 0, webpImg.width, webpImg.height).data;
  let diff = 0, maxDiff = 0;
  for (let i = 0; i < ad.length; i++) {
    const d = Math.abs(ad[i] - bd[i]);
    if (d > 0) diff++;
    if (d > maxDiff) maxDiff = d;
  }
  console.log(`\nq=100 vs PNG: ${diff} differing channel-bytes out of ${ad.length} (${(diff*100/ad.length).toFixed(2)}%), max delta ${maxDiff}`);
})();
