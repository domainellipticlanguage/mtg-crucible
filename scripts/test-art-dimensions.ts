/**
 * Tests getArtDimensions for every template by generating a diagnostic
 * test image at the exact returned dimensions, rendering a card with it,
 * and saving the result for visual inspection.
 *
 * The test image has: a centered circle (detects distortion), corner
 * triangles (detects cropping), crosshairs, and dimension text.
 *
 * Usage: npx tsx scripts/test-art-dimensions.ts [--open]
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { createCanvas } from '@napi-rs/canvas';
import { renderCard, getArtDimensions } from '../src';
import type { CardData, TemplateName } from '../src/types';

const OUT = path.resolve(__dirname, '..', '.output', 'art-dimensions');

function generateTestImage(w: number, h: number, label: string): Buffer {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#2a5a2a';
  ctx.fillRect(0, 0, w, h);

  // Checkerboard border (8px squares along edges)
  const sq = 8;
  for (let y = 0; y < h; y += sq) {
    for (let x = 0; x < w; x += sq) {
      if ((x < sq * 3 || x >= w - sq * 3 || y < sq * 3 || y >= h - sq * 3)) {
        ctx.fillStyle = ((x / sq + y / sq) % 2 === 0) ? '#ff0000' : '#ffffff';
        ctx.fillRect(x, y, sq, sq);
      }
    }
  }

  // 1px alternating black/white outline at the very edge
  for (let x = 0; x < w; x++) {
    ctx.fillStyle = (x % 2 === 0) ? '#000000' : '#ffffff';
    ctx.fillRect(x, 0, 1, 1);
    ctx.fillRect(x, h - 1, 1, 1);
  }
  for (let y = 0; y < h; y++) {
    ctx.fillStyle = (y % 2 === 0) ? '#000000' : '#ffffff';
    ctx.fillRect(0, y, 1, 1);
    ctx.fillRect(w - 1, y, 1, 1);
  }

  // Centered circle — largest that fits
  const radius = Math.min(w, h) * 0.4;
  ctx.strokeStyle = '#ffff00';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshairs
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
  ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
  ctx.stroke();

  // Corner triangles (different color each corner to detect flipping)
  const tri = Math.min(w, h) * 0.1;
  // Top-left: red
  ctx.fillStyle = '#ff0000';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(tri, 0); ctx.lineTo(0, tri); ctx.fill();
  // Top-right: blue
  ctx.fillStyle = '#0000ff';
  ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(w - tri, 0); ctx.lineTo(w, tri); ctx.fill();
  // Bottom-left: green
  ctx.fillStyle = '#00ff00';
  ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(tri, h); ctx.lineTo(0, h - tri); ctx.fill();
  // Bottom-right: yellow
  ctx.fillStyle = '#ffff00';
  ctx.beginPath(); ctx.moveTo(w, h); ctx.lineTo(w - tri, h); ctx.lineTo(w, h - tri); ctx.fill();

  // Dimension text
  ctx.fillStyle = 'white';
  ctx.font = `bold ${Math.max(14, Math.min(w, h) * 0.06)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${w} x ${h}`, w / 2, h / 2 - 20);
  ctx.fillText(label, w / 2, h / 2 + 20);

  return canvas.toBuffer('image/png');
}

// Minimal card data for each template
const TEST_CARDS: { template: TemplateName; label?: string; card: CardData }[] = [
  {
    template: 'standard',
    card: { name: 'Test Standard', manaCost: '{2}{R}', types: ['creature'], subtypes: ['Goblin'], frameColor: 'red', power: '2', toughness: '2', abilities: 'Haste' },
  },
  {
    template: 'standard' as TemplateName,
    label: 'colorless',
    card: { name: 'Test Colorless', manaCost: '{4}', types: ['creature'], subtypes: ['Eldrazi'], frameColor: 'colorless', power: '4', toughness: '4', abilities: 'Trample' },
  },
  {
    template: 'standard' as TemplateName,
    label: 'devoid',
    card: { name: 'Test Devoid', manaCost: '{2}{B}{G}', types: ['creature'], subtypes: ['Eldrazi', 'Drone'], frameEffect: 'devoid', power: '3', toughness: '3', abilities: 'Devoid\nWhen this enters, each opponent loses 2 life.' },
  },
  {
    template: 'planeswalker',
    card: { name: 'Test Planeswalker', manaCost: '{3}{U}', types: ['planeswalker'], subtypes: ['Jace'], frameColor: 'blue', startingLoyalty: '4', abilities: { structuredAbilities: { kind: 'planeswalker', loyaltyAbilities: [{ cost: '+1', text: 'Draw a card.' }, { cost: '-2', text: 'Return target creature.' }, { cost: '-6', text: 'You win.' }] } } },
  },
  {
    template: 'saga',
    card: { name: 'Test Saga', manaCost: '{2}{B}', types: ['enchantment'], subtypes: ['Saga'], frameColor: 'black', abilities: { structuredAbilities: { kind: 'saga', chapters: [{ chapterNumbers: [1], text: 'Each player discards a card.' }, { chapterNumbers: [2], text: 'Return a creature card from your graveyard.' }, { chapterNumbers: [3], text: 'Destroy target creature.' }] } } },
  },
  {
    template: 'class',
    card: { name: 'Test Class', manaCost: '{G}', types: ['enchantment'], subtypes: ['Class'], frameColor: 'green', abilities: { structuredAbilities: { kind: 'class', classLevels: [{ level: 1, cost: '', text: 'You gain 1 life each turn.' }, { level: 2, cost: '{1}{G}', text: 'Put a +1/+1 counter on a creature.' }, { level: 3, cost: '{3}{G}', text: 'Creatures you control get +1/+1.' }] } } },
  },
  {
    template: 'battle',
    card: { name: 'Test Battle', manaCost: '{3}{W}', types: ['battle'], subtypes: ['Siege'], frameColor: 'white', battleDefense: '5', abilities: 'When this enters, create two 1/1 tokens.' },
  },
  {
    template: 'adventure',
    card: { name: 'Test Adventurer', manaCost: '{3}{G}', types: ['creature'], subtypes: ['Elf', 'Knight'], frameColor: 'green', power: '3', toughness: '3', abilities: 'Trample', linkType: 'adventure', linkedCard: { name: 'Wild Journey', manaCost: '{1}{G}', types: ['sorcery'], abilities: 'Search for a basic land card.' } },
  },
  {
    template: 'transform_front',
    card: { name: 'Test Transform', manaCost: '{1}{R}', types: ['creature'], subtypes: ['Human', 'Werewolf'], frameColor: 'red', power: '2', toughness: '1', abilities: 'At the beginning of each upkeep, transform this.', linkType: 'transform', linkedCard: { name: 'Test Transformed', types: ['creature'], subtypes: ['Werewolf'], frameColor: 'red', power: '4', toughness: '3' } },
  },
  {
    template: 'mdfc_front',
    card: { name: 'Test MDFC', manaCost: '{2}{B}', types: ['creature'], subtypes: ['Vampire'], frameColor: 'black', power: '3', toughness: '2', abilities: 'Lifelink', linkType: 'modal_dfc', linkedCard: { name: 'Test MDFC Back', manaCost: '{B}', types: ['land'], frameColor: 'land', abilities: '{T}: Add {B}.' } },
  },
  {
    template: 'split',
    card: { name: 'Test Left', manaCost: '{R}', types: ['instant'], frameColor: 'red', abilities: 'Deal 2 damage.', linkType: 'split', linkedCard: { name: 'Test Right', manaCost: '{G}', types: ['sorcery'], frameColor: 'green', abilities: 'Create a 3/3 token.' } },
  },
  {
    template: 'fuse',
    card: { name: 'Test Turn', manaCost: '{2}{U}', types: ['instant'], frameColor: 'blue', abilities: 'Target creature becomes 0/1.\nFuse', linkType: 'fuse', linkedCard: { name: 'Test Burn', manaCost: '{1}{R}', types: ['instant'], frameColor: 'red', abilities: 'Deal 2 damage to any target.\nFuse' } },
  },
  {
    template: 'flip',
    card: { name: 'Test Flip', manaCost: '{1}{W}', types: ['creature'], subtypes: ['Human'], frameColor: 'white', power: '1', toughness: '1', abilities: 'When this deals damage, flip it.', linkType: 'flip', linkedCard: { name: 'Test Flipped', types: ['creature'], subtypes: ['Spirit'], power: '3', toughness: '3', abilities: 'Flying' } },
  },
  {
    template: 'aftermath',
    card: { name: 'Test Appeal', manaCost: '{G}', types: ['sorcery'], frameColor: 'green', abilities: 'Target creature gets +X/+X.', linkType: 'aftermath', linkedCard: { name: 'Test Authority', manaCost: '{1}{W}', types: ['sorcery'], frameColor: 'white', abilities: 'Aftermath\nTap up to two target creatures.' } },
  },
  {
    template: 'mutate',
    card: { name: 'Test Mutate', manaCost: '{3}{G}{G}', types: ['creature'], subtypes: ['Beast'], frameColor: 'green', power: '5', toughness: '4', abilities: 'Mutate {2}{G}{G}\nTrample\nWhenever this mutates, put two +1/+1 counters on it.' },
  },
  {
    template: 'prototype',
    card: { name: 'Test Prototype', manaCost: '{7}', types: ['artifact', 'creature'], subtypes: ['Golem'], frameColor: 'artifact', power: '6', toughness: '6', abilities: 'Prototype {2}{R} — 3/3\nTrample' },
  },
  {
    template: 'leveler',
    card: { name: 'Test Leveler', manaCost: '{1}{U}', types: ['creature'], subtypes: ['Human', 'Wizard'], frameColor: 'blue', power: '1', toughness: '1', abilities: 'LEVEL 2-5\n2/3\nFlying\nLEVEL 6+\n4/5\nFlying, shroud' },
  },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const openFlag = process.argv.includes('--open');

  for (const { template, label, card } of TEST_CARDS) {
    const fileKey = label ?? template;
    const dims = getArtDimensions(card, template);
    console.log(`${fileKey}: ${dims.width}x${dims.height}`);

    // Generate and save the test art image
    const testArt = generateTestImage(dims.width, dims.height, fileKey);
    const artPath = path.join(OUT, `${fileKey}-art.png`);
    fs.writeFileSync(artPath, testArt);

    // Render the card with the test art as a file path
    const cardWithArt = { ...card, artUrl: artPath };

    // Also generate art for linked card if present
    if (cardWithArt.linkedCard) {
      const linkedDims = getArtDimensions(card, template, true);
      const linkedArt = generateTestImage(linkedDims.width, linkedDims.height, `${fileKey}-linked`);
      const linkedArtPath = path.join(OUT, `${fileKey}-linked-art.png`);
      fs.writeFileSync(linkedArtPath, linkedArt);
      cardWithArt.linkedCard = { ...cardWithArt.linkedCard, artUrl: linkedArtPath };
      console.log(`  linked: ${linkedDims.width}x${linkedDims.height}`);
    }

    const result = await renderCard(cardWithArt);

    const outPath = path.join(OUT, `${fileKey}.png`);
    fs.writeFileSync(outPath, result.frontFace);
    console.log(`  → ${outPath}`);
  }

  if (openFlag) {
    execSync(`open "${OUT}"`);
  }
}

main().catch(console.error);
