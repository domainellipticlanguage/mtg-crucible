/**
 * Quality test: Renders sample cards at high/medium/low quality.
 * Usage: npx tsx scripts/quality-test.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { renderCard } from '../src';
import type { CardData, RenderQuality, RenderFormat } from '../src';

const OUT = path.resolve(__dirname, '..', '.output', 'quality');
fs.mkdirSync(OUT, { recursive: true });

const cards: { name: string; card: CardData }[] = [
  {
    name: 'standard',
    card: {
      name: 'Quality Test', manaCost: '{2}{R}',
      types: ['creature'], subtypes: ['elemental'],
      artUrl: 'https://thismagiccarddoesnotexist3-production-cardassetsbucket-xvrkcsvr.s3.amazonaws.com/art/d574c336-f7d0-4205-a955-5073bc15908b.png',
      frameColor: 'red',
      rarity: 'uncommon',
      abilities: 'Haste\nWhen Quality Test enters, it deals 2 damage to any target.',
      power: '3', toughness: '1',
    },
  },
  {
    name: 'planeswalker',
    card: {
      name: 'Chandra, Quality Tester', manaCost: '{2}{R}{R}',
      types: ['planeswalker'], subtypes: ['chandra'],
      frameColor: 'red',
      rarity: 'mythic',
      artUrl: 'https://thismagiccarddoesnotexist3-production-cardassetsbucket-xvrkcsvr.s3.amazonaws.com/art/d574c336-f7d0-4205-a955-5073bc15908b.png',
      loyalty: '4',
      abilities: {
        structuredAbilities: {
          kind: 'planeswalker',
          loyaltyAbilities: [
            { cost: '+1', text: 'Chandra, Quality Tester deals 2 damage to any target.' },
            { cost: '-3', text: 'Draw two cards.' },
            { cost: '-7', text: 'Chandra, Quality Tester deals 10 damage to each opponent and each creature they control.' },
          ],
        },
      },
    },
  },
];


async function main() {
  for (const { name, card } of cards) {
    for (const q of ['high', 'medium', 'low'] as RenderQuality[]) {
      for (const fmt of ['png', 'jpeg'] as RenderFormat[]) {
        const result = await renderCard(card, { quality: q, format: fmt });
        const ext = fmt === 'jpeg' ? 'jpg' : 'png';
        const outPath = path.join(OUT, `${name}-${q}.${ext}`);
        fs.writeFileSync(outPath, result.frontFace);
        const kb = (result.frontFace.length / 1024).toFixed(0);
        console.log(`${name}-${q}.${ext}: ${kb} KB`);
      }
    }
  }
  console.log(`\nRendered to ${OUT}`);
}

main().catch(console.error);
