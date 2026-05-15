/**
 * Pixel-perfect baseline + diff for the layout-convention refactor.
 *
 *   npx tsx scripts/layout-pixel-diff.ts baseline   # snapshot all cases under .output/layout-baseline/
 *   npx tsx scripts/layout-pixel-diff.ts diff       # render again, compare byte-identical, print mismatches
 *
 * Covers every layout that has rotated content (split, fuse, room, aftermath,
 * flip) plus a representative non-rotated card so we notice unintended drift.
 */

import * as fs from 'fs';
import * as path from 'path';
import { renderCard } from '../src';
import type { CardData } from '../src';

const ROOT = path.resolve(__dirname, '..', '.output', 'layout-baseline');

interface Case { name: string; card: CardData; back?: boolean; }

const CASES: Case[] = [
  { name: 'standard', card: {
    name: 'Lightning Bolt', manaCost: '{R}',
    typeLine: { supertypes: [], types: ['instant'], subtypes: [] },
    abilities: 'Lightning Bolt deals 3 damage to any target.',
    flavorText: '"Stop, drop, and roll."',
    frameColor: 'red', rarity: 'uncommon',
  }},
  { name: 'creature-legendary', card: {
    name: 'Questing Beast', manaCost: '{2}{G}{G}',
    typeLine: { supertypes: ['legendary'], types: ['creature'], subtypes: ['Beast'] },
    abilities: 'Vigilance, deathtouch, haste',
    power: '4', toughness: '4', frameColor: 'green', rarity: 'mythic',
  }},
  { name: 'split', card: {
    name: 'Fire', manaCost: '{1}{R}',
    typeLine: { supertypes: [], types: ['instant'], subtypes: [] },
    frameColor: 'red', rarity: 'uncommon',
    abilities: 'Fire deals 2 damage divided as you choose among one or two targets.',
    linkType: 'split',
    linkedCard: {
      name: 'Ice', manaCost: '{1}{U}',
      typeLine: { supertypes: [], types: ['instant'], subtypes: [] },
      frameColor: 'blue',
      abilities: 'Tap target permanent.\nDraw a card.',
    },
  }},
  { name: 'fuse', card: {
    name: 'Turn', manaCost: '{2}{U}',
    typeLine: { supertypes: [], types: ['instant'], subtypes: [] },
    frameColor: 'blue', rarity: 'uncommon',
    abilities: 'Until end of turn, target creature loses all abilities and becomes a red Weird with base power and toughness 0/1.',
    linkType: 'fuse',
    linkedCard: {
      name: 'Burn', manaCost: '{1}{R}',
      typeLine: { supertypes: [], types: ['instant'], subtypes: [] },
      frameColor: 'red',
      abilities: 'Burn deals 2 damage to any target.',
    },
  }},
  { name: 'aftermath', card: {
    name: 'Dusk', manaCost: '{2}{W}{W}',
    typeLine: { supertypes: [], types: ['sorcery'], subtypes: [] },
    frameColor: 'white', rarity: 'rare',
    abilities: 'Destroy all creatures with power 3 or greater.',
    linkType: 'aftermath',
    linkedCard: {
      name: 'Dawn', manaCost: '{3}{W}{W}',
      typeLine: { supertypes: [], types: ['sorcery'], subtypes: [] },
      frameColor: 'white',
      abilities: 'Aftermath (Cast this spell only from your graveyard. Then exile it.)\nReturn all creature cards with power 2 or less from your graveyard to your hand.',
    },
  }},
  { name: 'flip', card: {
    name: 'Bushi Tenderfoot', manaCost: '{W}',
    typeLine: { supertypes: [], types: ['creature'], subtypes: ['Human', 'Soldier'] },
    frameColor: 'white', rarity: 'uncommon',
    abilities: 'When a creature dealt damage by Bushi Tenderfoot this turn dies, flip Bushi Tenderfoot.',
    power: '1', toughness: '1',
    linkType: 'flip',
    linkedCard: {
      name: 'Kenzo the Hardhearted',
      typeLine: { supertypes: ['legendary'], types: ['creature'], subtypes: ['Human', 'Samurai'] },
      frameColor: 'white',
      abilities: 'Double strike; bushido 2',
      power: '3', toughness: '4',
    },
  }},
  { name: 'room', card: {
    name: 'Bottomless Pool', manaCost: '{U}',
    typeLine: { supertypes: [], types: ['enchantment'], subtypes: ['Room'] },
    frameColor: 'blue', rarity: 'uncommon',
    abilities: "When you unlock this door, return up to one target creature to its owner's hand.",
    linkedCard: {
      name: 'Locker Room', manaCost: '{4}{U}',
      typeLine: { supertypes: [], types: ['enchantment'], subtypes: ['Room'] },
      frameColor: 'blue',
      abilities: 'Whenever one or more creatures you control deal combat damage to a player, draw a card.',
    },
  }},
  { name: 'battle', card: {
    name: 'Invasion of Gobakhan', manaCost: '{1}{W}',
    typeLine: { supertypes: [], types: ['battle'], subtypes: ['Siege'] },
    abilities: "When Invasion of Gobakhan enters, look at target opponent's hand. Exile a nonland card from it.",
    frameColor: 'white', rarity: 'rare',
    battleDefense: '3',
  }},
  { name: 'planeswalker', card: {
    name: 'Liliana of the Veil', manaCost: '{1}{B}{B}',
    typeLine: { supertypes: ['legendary'], types: ['planeswalker'], subtypes: ['Liliana'] },
    frameColor: 'black', rarity: 'mythic',
    startingLoyalty: '3',
    abilities: { structuredAbilities: {
      kind: 'planeswalker' as const,
      loyaltyAbilities: [
        { cost: '+1', text: 'Each player discards a card.' },
        { cost: '-2', text: 'Target player sacrifices a creature.' },
        { cost: '-6', text: 'Separate all permanents target player controls into two piles. That player sacrifices all permanents in the pile of their choice.' },
      ],
    } },
  }},
  { name: 'saga', card: {
    name: 'The Eldest Reborn', manaCost: '{4}{B}',
    typeLine: { supertypes: [], types: ['enchantment'], subtypes: ['Saga'] },
    frameColor: 'black', rarity: 'uncommon',
    abilities: { structuredAbilities: {
      kind: 'saga' as const,
      chapters: [
        { chapterNumbers: [1], text: 'Each opponent sacrifices a creature or planeswalker.' },
        { chapterNumbers: [2], text: 'Each opponent discards a card.' },
        { chapterNumbers: [3], text: 'Put target creature or planeswalker card from a graveyard onto the battlefield under your control.' },
      ],
    } },
  }},
];

async function snapshot(outDir: string) {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  for (const c of CASES) {
    const r = await renderCard(c.card);
    fs.writeFileSync(path.join(outDir, `${c.name}.png`), r.frontFace);
    if (r.backFace) fs.writeFileSync(path.join(outDir, `${c.name}-back.png`), r.backFace);
    console.log(`  ${c.name}`);
  }
}

import { loadImage, createCanvas } from '@napi-rs/canvas';

/** Per-pixel comparison. Returns { diffPixels, maxChannelDelta } where a pixel
 * counts as different if any channel differs by > tolerance. */
async function pixelDiff(oldBuf: Buffer, newBuf: Buffer, tolerance: number) {
  const a = await loadImage(oldBuf);
  const b = await loadImage(newBuf);
  if (a.width !== b.width || a.height !== b.height) {
    return { diffPixels: -1, maxChannelDelta: 255, w: a.width, h: a.height };
  }
  const ca = createCanvas(a.width, a.height); ca.getContext('2d').drawImage(a, 0, 0);
  const cb = createCanvas(b.width, b.height); cb.getContext('2d').drawImage(b, 0, 0);
  const da = ca.getContext('2d').getImageData(0, 0, a.width, a.height).data;
  const db = cb.getContext('2d').getImageData(0, 0, b.width, b.height).data;
  let diffPixels = 0;
  let maxDelta = 0;
  for (let i = 0; i < da.length; i += 4) {
    const dr = Math.abs(da[i] - db[i]);
    const dg = Math.abs(da[i+1] - db[i+1]);
    const db_ = Math.abs(da[i+2] - db[i+2]);
    const da_ = Math.abs(da[i+3] - db[i+3]);
    const d = Math.max(dr, dg, db_, da_);
    if (d > tolerance) diffPixels++;
    if (d > maxDelta) maxDelta = d;
  }
  return { diffPixels, maxChannelDelta: maxDelta, w: a.width, h: a.height };
}

async function compareOne(name: string, oldBuf: Buffer, newBuf: Buffer): Promise<boolean> {
  if (Buffer.compare(oldBuf, newBuf) === 0) {
    console.log(`ok      ${name}  (byte-identical)`);
    return true;
  }
  const TOLERANCE = 2; // small FP-rounding wiggle is acceptable
  const { diffPixels, maxChannelDelta, w, h } = await pixelDiff(oldBuf, newBuf, TOLERANCE);
  if (diffPixels < 0) {
    console.log(`SIZE    ${name}  (dimension mismatch)`);
    return false;
  }
  const total = (w ?? 0) * (h ?? 0);
  const pct = total > 0 ? (diffPixels / total * 100).toFixed(3) : '?';
  if (diffPixels === 0) {
    console.log(`ok-fp   ${name}  (within ±${TOLERANCE}; max Δ=${maxChannelDelta})`);
    return true;
  }
  console.log(`DIFF    ${name}  ${diffPixels}/${total} (${pct}%) px > ±${TOLERANCE}; max Δ=${maxChannelDelta}`);
  return false;
}

async function diff() {
  let bad = 0;
  for (const c of CASES) {
    const r = await renderCard(c.card);
    const baseline = path.join(ROOT, `${c.name}.png`);
    if (!fs.existsSync(baseline)) {
      console.log(`MISSING ${c.name}`);
      bad++;
      continue;
    }
    const old = fs.readFileSync(baseline);
    if (!(await compareOne(c.name, old, r.frontFace))) {
      fs.writeFileSync(path.join(ROOT, `${c.name}.new.png`), r.frontFace);
      bad++;
    }
    if (r.backFace) {
      const bbase = path.join(ROOT, `${c.name}-back.png`);
      if (fs.existsSync(bbase)) {
        const oldBack = fs.readFileSync(bbase);
        if (!(await compareOne(`${c.name}-back`, oldBack, r.backFace))) {
          fs.writeFileSync(path.join(ROOT, `${c.name}-back.new.png`), r.backFace);
          bad++;
        }
      }
    }
  }
  if (bad === 0) console.log('\nAll within tolerance.');
  else console.log(`\n${bad} mismatches above tolerance.`);
  process.exit(bad === 0 ? 0 : 1);
}

const mode = process.argv[2];
(async () => {
  if (mode === 'baseline') await snapshot(ROOT);
  else if (mode === 'diff') await diff();
  else { console.error('Usage: layout-pixel-diff.ts baseline|diff'); process.exit(2); }
})().catch(e => { console.error(e); process.exit(1); });
