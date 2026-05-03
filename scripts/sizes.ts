/**
 * Benchmark output sizes across (quality × format) combinations.
 * Usage: npx tsx scripts/sizes.ts
 */
import { renderCard } from '../src';
import type { RenderQuality, RenderFormat, CardData } from '../src';

const SAMPLES: { name: string; card: CardData }[] = [
  {
    name: 'Lightning Bolt (no art)',
    card: {
      name: 'Lightning Bolt', manaCost: '{R}', types: ['instant'],
      abilities: 'Lightning Bolt deals 3 damage to any target.',
      flavorText: '"The sparkmage shrieked."',
      frameColor: 'red', rarity: 'uncommon', artist: 'Christopher Moeller',
    },
  },
  {
    name: 'Archangel Avacyn (with art)',
    card: {
      name: 'Archangel Avacyn', manaCost: '{3}{W}{W}',
      supertypes: ['legendary'], types: ['creature'], subtypes: ['Angel'],
      abilities: 'Flash\nFlying, vigilance\nWhen Archangel Avacyn enters the battlefield, creatures you control gain indestructible until end of turn.',
      power: '4', toughness: '4', frameColor: 'white', rarity: 'mythic',
      artist: 'James Ryman',
      artUrl: 'https://cards.scryfall.io/art_crop/front/7/f/7f4893ef-f983-418b-b7a4-5f073c844545.jpg?1673149345',
    },
  },
];

const QUALITIES: RenderQuality[] = ['low', 'medium', 'high'];
const FORMATS: RenderFormat[] = ['png', 'jpeg', 'webp'];

function fmtKB(n: number): string {
  return `${(n / 1024).toFixed(1)} KB`;
}

async function main() {
  const rows: Array<{ sample: string; q: RenderQuality; f: RenderFormat; bytes: number }> = [];
  for (const s of SAMPLES) {
    for (const q of QUALITIES) {
      for (const f of FORMATS) {
        const r = await renderCard(s.card, { quality: q, format: f });
        rows.push({ sample: s.name, q, f, bytes: r.frontFace.length });
      }
    }
  }

  // Print per-sample tables
  for (const s of SAMPLES) {
    console.log(`\n=== ${s.name} ===`);
    console.log(`| quality | png | jpeg | webp |`);
    console.log(`|---------|-----|------|------|`);
    for (const q of QUALITIES) {
      const cells = FORMATS.map(f => {
        const row = rows.find(r => r.sample === s.name && r.q === q && r.f === f);
        return row ? fmtKB(row.bytes) : '-';
      });
      console.log(`| ${q} | ${cells.join(' | ')} |`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
