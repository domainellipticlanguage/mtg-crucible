import { renderCard } from '../src';

// Benchmark: latency of rendering a card with a large frameColor array.
// Stresses every gradient layer (frame, accent, name line, type line, PT box).
const COLORS = ['white', 'blue', 'black', 'red', 'green'];
const N = Number(process.argv[2] ?? 15);      // number of frame colors
const ITERS = Number(process.argv[3] ?? 8);   // timed iterations

function manyColors(n: number): string[] {
  return Array.from({ length: n }, (_, i) => COLORS[i % COLORS.length]);
}

async function main() {
  const colors = manyColors(N);
  const card = {
    name: 'Rainbow Stress Test',
    manaCost: '{W}{U}{B}{R}{G}',
    typeLine: 'Legendary Creature — Avatar',
    abilities: 'Whenever this attacks, it deals damage equal to its power to any target.',
    power: '7', toughness: '7',
    rarity: 'mythic',
    frameColor: colors,
    accentColor: colors,
    nameLineColor: colors,
    typeLineColor: colors,
    ptBoxColor: colors,
  } as any;

  // Warm up (asset load + font registration are one-time and shouldn't be timed).
  await renderCard(card, { quality: 'high' });

  const times: number[] = [];
  for (let i = 0; i < ITERS; i++) {
    const t0 = performance.now();
    await renderCard(card, { quality: 'high' });
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const median = times[Math.floor(times.length / 2)];
  console.log(`frameColors=${N} iters=${ITERS} quality=high`);
  console.log(`  mean=${mean.toFixed(1)}ms median=${median.toFixed(1)}ms min=${times[0].toFixed(1)}ms max=${times[times.length - 1].toFixed(1)}ms`);
}

main().catch(console.error);
