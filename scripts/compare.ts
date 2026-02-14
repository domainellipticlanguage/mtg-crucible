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

function fetch(url: string): Promise<{ status: number; buffer: Buffer; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    https.get(new URL(url), { headers: { 'User-Agent': 'mtg-crucible/1.0', 'Accept': '*/*' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve, reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, buffer: Buffer.concat(chunks), headers: res.headers as any }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url);
  return JSON.parse(res.buffer.toString());
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  return res.buffer.toString();
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  return res.buffer;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Scryfall API
// ---------------------------------------------------------------------------

/** Fetch card JSON (needed for image URIs). */
async function fetchScryfallCard(name: string, set?: string): Promise<any> {
  let url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`;
  if (set) url += `&set=${encodeURIComponent(set)}`;
  const data = await fetchJSON(url);
  if (data.object === 'error') throw new Error(`Scryfall: ${data.details}`);
  return data;
}

/** Fetch card as text via Scryfall's format=text — already in parseCard format. */
async function fetchScryfallText(name: string, set?: string): Promise<string> {
  let url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=text`;
  if (set) url += `&set=${encodeURIComponent(set)}`;
  return fetchText(url);
}

// ---------------------------------------------------------------------------
// Side-by-side comparison image
// ---------------------------------------------------------------------------

async function buildComparison(scryfallPng: Buffer, ourPng: Buffer, label: string): Promise<Buffer> {
  const sfImg = await loadImage(scryfallPng);
  const ourImg = await loadImage(ourPng);

  // Detect if Scryfall image is portrait but ours is landscape (battle cards)
  // If so, rotate Scryfall 90° clockwise to match our orientation
  const sfIsPortrait = sfImg.height > sfImg.width;
  const ourIsLandscape = ourImg.width > ourImg.height;
  const needsRotation = sfIsPortrait && ourIsLandscape;

  const sfDisplayW = needsRotation ? sfImg.height : sfImg.width;
  const sfDisplayH = needsRotation ? sfImg.width : sfImg.height;

  // Scale both to same height
  const targetH = 1040;
  const sfScale = targetH / sfDisplayH;
  const ourScale = targetH / ourImg.height;
  const sfW = Math.round(sfDisplayW * sfScale);
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

  // Draw Scryfall image (rotate if needed)
  if (needsRotation) {
    ctx.save();
    ctx.translate(sfW / 2, labelH + targetH / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(sfImg, -targetH / 2, -sfW / 2, targetH, sfW);
    ctx.restore();
  } else {
    ctx.drawImage(sfImg, 0, labelH, sfW, targetH);
  }

  // Draw our image
  ctx.drawImage(ourImg, sfW + gap, labelH, ourW, targetH);

  return canvas.toBuffer('image/png');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function compareCard(name: string, set?: string): Promise<string> {
  console.log(`Fetching "${name}" from Scryfall...`);

  // Fetch text (for parseCard) and JSON (for image URIs) in parallel
  const [scryfallText, sf] = await Promise.all([
    fetchScryfallText(name, set),
    fetchScryfallCard(name, set),
  ]);

  console.log(`  Found: ${sf.name} (${sf.set.toUpperCase()} #${sf.collector_number})`);
  console.log(`  Text definition:\n${scryfallText}\n`);

  // Inject metadata that Scryfall text doesn't include (art, rarity, etc.)
  const frontFace = sf.card_faces?.[0] ?? sf;
  const imageUris = frontFace.image_uris ?? sf.image_uris;
  const metadata: string[] = [];
  if (imageUris?.art_crop) metadata.push(`Art URL: ${imageUris.art_crop}`);
  if (sf.rarity) metadata.push(`Rarity: ${sf.rarity}`);
  if (sf.artist ?? frontFace.artist) metadata.push(`Artist: ${sf.artist ?? frontFace.artist}`);
  if (sf.set) metadata.push(`Set: ${sf.set.toUpperCase()}`);
  if (sf.collector_number) metadata.push(`Collector Number: ${sf.collector_number}`);

  // Insert metadata after the first line (name + mana cost)
  const lines = scryfallText.split('\n');
  const fullText = [lines[0], ...metadata, ...lines.slice(1)].join('\n');

  console.log(`  Rendering our version...`);
  const rendered = await renderCard(fullText);

  // Fetch Scryfall's rendered PNG
  await sleep(100); // respect rate limit
  console.log(`  Fetching Scryfall PNG...`);
  const scryfallPng = await fetchBuffer(imageUris.png);

  // Build comparison
  console.log(`  Building comparison image...`);
  const comparison = await buildComparison(scryfallPng, rendered.frontFace, sf.name);

  // Write outputs
  const slug = sf.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-');
  const compPath = path.join(OUT, `${slug}.png`);
  const ourPath = path.join(OUT, `${slug}-ours.png`);
  const sfPath = path.join(OUT, `${slug}-scryfall.png`);
  fs.writeFileSync(compPath, comparison);
  fs.writeFileSync(ourPath, rendered.frontFace);
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
