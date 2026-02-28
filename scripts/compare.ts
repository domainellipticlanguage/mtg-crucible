/**
 * Scryfall visual comparison harness.
 *
 * Fetches a card from Scryfall, builds a text definition, renders our version
 * using parseCard + renderCard, then produces a side-by-side comparison image.
 *
 * Usage:
 *   npx tsx scripts/compare.ts "Lightning Bolt"
 *   npx tsx scripts/compare.ts "Lightning Bolt" a25
 *   npx tsx scripts/compare.ts "The Eldest Reborn"
 */

import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { renderCard } from '../src';
import type { CardData } from '../src/types';

const OUT = path.resolve(__dirname, '..', '.output', 'compare');

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'mtg-crucible/1.0', 'Accept': 'application/json;q=0.9,*/*;q=0.8' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJSON(res.headers.location).then(resolve, reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch (e) { reject(e); }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

function fetchBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'mtg-crucible/1.0', 'Accept': 'application/json;q=0.9,*/*;q=0.8' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve, reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Scryfall API
// ---------------------------------------------------------------------------

async function fetchScryfallCard(name: string, set?: string): Promise<any> {
  let url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`;
  if (set) url += `&set=${encodeURIComponent(set)}`;
  const data = await fetchJSON(url);
  if (data.object === 'error') throw new Error(`Scryfall: ${data.details}`);
  return data;
}

// ---------------------------------------------------------------------------
// Scryfall JSON → text definition (for parseCard)
// ---------------------------------------------------------------------------

const SF_COLOR_NAMES: Record<string, string> = {
  W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green',
};

function scryfallToText(sf: any): string {
  const lines: string[] = [];

  // Line 1: Name + mana cost
  if (sf.mana_cost) {
    lines.push(`${sf.name} ${sf.mana_cost}`);
  } else {
    lines.push(sf.name);
  }

  // Metadata lines
  if (sf.image_uris?.art_crop) lines.push(`Art: ${sf.image_uris.art_crop}`);
  if (sf.rarity) lines.push(`Rarity: ${sf.rarity}`);
  if (sf.artist) lines.push(`Artist: ${sf.artist}`);
  if (sf.set) lines.push(`Set: ${sf.set.toUpperCase()}`);
  if (sf.collector_number) lines.push(`Collector Number: ${sf.collector_number}`);

  // Color indicator
  if (sf.color_indicator && sf.color_indicator.length > 0) {
    const names = sf.color_indicator.map((c: string) => SF_COLOR_NAMES[c]).filter(Boolean);
    if (names.length > 0) lines.push(`Color Indicator: ${names.join(', ')}`);
  }

  // Type line
  lines.push(sf.type_line);

  // Oracle text — normalize Unicode minus (U+2212) to ASCII for PW ability parsing
  if (sf.oracle_text) {
    const normalized = sf.oracle_text.replace(/\u2212/g, '-');
    for (const line of normalized.split('\n')) {
      lines.push(line);
    }
  }

  // Flavor text (wrapped in asterisks)
  if (sf.flavor_text) {
    for (const line of sf.flavor_text.split('\n')) {
      lines.push(`*${line}*`);
    }
  }

  // P/T
  if (sf.power !== undefined && sf.toughness !== undefined) {
    lines.push(`${sf.power}/${sf.toughness}`);
  }

  // Loyalty
  if (sf.loyalty) lines.push(`Loyalty: ${sf.loyalty}`);

  // Defense (battles)
  if (sf.defense) lines.push(`Defense: ${sf.defense}`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Side-by-side comparison image
// ---------------------------------------------------------------------------

async function buildComparison(scryfallPng: Buffer, ourPng: Buffer, label: string): Promise<Buffer> {
  const sfImg = await loadImage(scryfallPng);
  const ourImg = await loadImage(ourPng);

  // Scale both to same height
  const targetH = 1040;
  const sfScale = targetH / sfImg.height;
  const ourScale = targetH / ourImg.height;
  const sfW = Math.round(sfImg.width * sfScale);
  const ourW = Math.round(ourImg.width * ourScale);

  const gap = 20;
  const labelH = 40;
  const totalW = sfW + gap + ourW;
  const totalH = targetH + labelH;

  const canvas = createCanvas(totalW, totalH);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, totalW, totalH);

  // Label
  ctx.fillStyle = 'white';
  ctx.font = '24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Scryfall`, sfW / 2, 28);
  ctx.fillText(`mtg-crucible`, sfW + gap + ourW / 2, 28);

  // Draw images
  ctx.drawImage(sfImg, 0, labelH, sfW, targetH);
  ctx.drawImage(ourImg, sfW + gap, labelH, ourW, targetH);

  return canvas.toBuffer('image/png');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function compareCard(name: string, set?: string): Promise<string> {
  console.log(`Fetching "${name}" from Scryfall...`);
  const sf = await fetchScryfallCard(name, set);

  console.log(`  Found: ${sf.name} (${sf.set.toUpperCase()} #${sf.collector_number})`);

  // Build text definition and render through the public API
  const text = scryfallToText(sf);
  console.log(`  Text definition:\n${text}\n`);

  console.log(`  Rendering our version...`);
  const { frontFace: ourPng } = await renderCard(text);

  // Fetch Scryfall's rendered PNG
  await sleep(100); // respect rate limit
  console.log(`  Fetching Scryfall PNG...`);
  const scryfallPng = await fetchBuffer(sf.image_uris.png);

  // Build comparison
  console.log(`  Building comparison image...`);
  const comparison = await buildComparison(scryfallPng, ourPng, sf.name);

  // Write outputs
  const slug = sf.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const compPath = path.join(OUT, `${slug}.png`);
  const ourPath = path.join(OUT, `${slug}-ours.png`);
  const sfPath = path.join(OUT, `${slug}-scryfall.png`);
  fs.writeFileSync(compPath, comparison);
  fs.writeFileSync(ourPath, ourPng);
  fs.writeFileSync(sfPath, scryfallPng);
  console.log(`  Wrote: ${compPath}`);
  return compPath;
}

async function compareLocal(refImagePath: string, cardDataJsonPath: string): Promise<string> {
  const refPng = fs.readFileSync(refImagePath);
  const cardData: CardData = JSON.parse(fs.readFileSync(cardDataJsonPath, 'utf-8'));

  console.log(`  Rendering our version...`);
  const { frontFace: ourPng } = await renderCard(cardData);

  console.log(`  Building comparison image...`);
  const comparison = await buildComparison(refPng, ourPng, cardData.name || 'card');

  const slug = (cardData.name || 'card').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const compPath = path.join(OUT, `${slug}.png`);
  fs.writeFileSync(compPath, comparison);
  fs.writeFileSync(path.join(OUT, `${slug}-ours.png`), ourPng);
  console.log(`  Wrote: ${compPath}`);
  return compPath;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const args = process.argv.slice(2);
  const openFlag = args.includes('--open');
  const filtered = args.filter(a => a !== '--open');

  if (filtered.length === 0) {
    console.error('Usage:');
    console.error('  npx tsx scripts/compare.ts "Card Name" [set] [--open]');
    console.error('  npx tsx scripts/compare.ts --local ref.png card.json [--open]');
    process.exit(1);
  }

  let compPath: string;
  if (filtered[0] === '--local') {
    if (filtered.length < 3) {
      console.error('Usage: npx tsx scripts/compare.ts --local <reference.png> <carddata.json> [--open]');
      process.exit(1);
    }
    compPath = await compareLocal(filtered[1], filtered[2]);
  } else {
    compPath = await compareCard(filtered[0], filtered[1]);
  }

  if (openFlag) {
    execSync(`open "${compPath}"`);
  }
}

main().catch(console.error);
