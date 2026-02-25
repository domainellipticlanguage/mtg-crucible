/**
 * Scryfall visual comparison harness.
 *
 * Fetches a card from Scryfall, renders our version using the Scryfall art crop,
 * then produces a side-by-side comparison image.
 *
 * Usage:
 *   npx tsx scripts/compare.ts "Lightning Bolt"
 *   npx tsx scripts/compare.ts "Lightning Bolt" a25
 *   npx tsx scripts/compare.ts "The Eldest Reborn"
 */

import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { renderCard } from '../src';
import type { CardData, Color, FrameColor, Supertype, Type } from '../src/types';

const OUT = '/tmp/mtg-crucible-compare';

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
// Scryfall JSON → CardData conversion
// ---------------------------------------------------------------------------

const SUPERTYPES = new Set(['legendary', 'basic', 'snow', 'world']);
const CARD_TYPES = new Set(['creature', 'instant', 'sorcery', 'enchantment', 'artifact', 'planeswalker', 'land', 'battle']);

function parseTypeLine(typeLine: string): { supertypes: Supertype[]; types: Type[]; subtypes: string[] } {
  const [left, right] = typeLine.split(/\s+[—–-]\s+|\s*[—–]\s*/);
  const subtypes = right ? right.split(/\s+/) : [];
  const supertypes: Supertype[] = [];
  const types: Type[] = [];
  for (const word of left.split(/\s+/)) {
    const lower = word.toLowerCase();
    if (SUPERTYPES.has(lower)) supertypes.push(lower as Supertype);
    else if (CARD_TYPES.has(lower)) types.push(lower as Type);
  }
  return { supertypes, types, subtypes };
}

const SF_COLOR_MAP: Record<string, Color> = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green' };

function sfFrameAndAccent(sf: any): { frameColor: FrameColor; accentColor?: Color | 'multicolor' } {
  const tl = sf.type_line.toLowerCase();
  if (tl.includes('vehicle')) return { frameColor: 'vehicle' };

  const colors: string[] = sf.colors || [];

  // Land with no mana cost — land frame always wins, colors become accent
  if (tl.includes('land') && !sf.mana_cost) {
    // Colored land creatures (Dryad Arbor) — colors become accent
    if (colors.length === 1) return { frameColor: 'land', accentColor: SF_COLOR_MAP[colors[0]] };
    if (colors.length > 1) return { frameColor: 'land', accentColor: 'multicolor' };

    // Colorless land — derive accent from produced_mana or color_identity
    const produced: string[] = sf.produced_mana || [];
    const colorProduced = produced.filter((c: string) => SF_COLOR_MAP[c]);
    if (colorProduced.length === 0) return { frameColor: 'land' };
    if (colorProduced.length === 1) return { frameColor: 'land', accentColor: SF_COLOR_MAP[colorProduced[0]] };
    return { frameColor: 'land', accentColor: 'multicolor' };
  }

  // Artifact type
  if (tl.includes('artifact') && !tl.includes('creature')) {
    if (colors.length === 0) return { frameColor: 'artifact' };
    if (colors.length === 1) return { frameColor: 'artifact', accentColor: SF_COLOR_MAP[colors[0]] };
    return { frameColor: 'artifact', accentColor: 'multicolor' };
  }

  // Normal cards
  if (colors.length === 0) return { frameColor: 'artifact' };
  if (colors.length === 1) return { frameColor: SF_COLOR_MAP[colors[0]] || 'artifact' };
  return { frameColor: 'multicolor' };
}

// Planeswalker: parse "+1: ...\n−2: ...\n−6: ..." from oracle_text
// Scryfall uses Unicode minus U+2212 (−) not ASCII hyphen
const SF_PW_ABILITY = /^([+\u2212-]?\d+):\s*(.+)$/;

function parsePwAbilities(oracleText: string): CardData['structuredAbilities'] {
  const loyaltyAbilities: { cost: string; text: string }[] = [];
  for (const line of oracleText.split('\n')) {
    const m = line.match(SF_PW_ABILITY);
    if (m) {
      // Normalize Unicode minus to ASCII
      const cost = m[1].replace('\u2212', '-');
      loyaltyAbilities.push({ cost, text: m[2] });
    } else if (line.trim()) {
      loyaltyAbilities.push({ cost: '', text: line.trim() });
    }
  }
  return { kind: 'planeswalker', loyaltyAbilities };
}

// Saga: strip reminder text, parse "I — ...", "II, III — ..." etc.
const SF_SAGA_CHAPTER = /^((?:I{1,3}|IV|V|VI)(?:\s*,\s*(?:I{1,3}|IV|V|VI))*)\s*[—–-]\s*(.+)$/;

function romanToNumber(r: string): number {
  switch (r.trim()) {
    case 'I': return 1; case 'II': return 2; case 'III': return 3;
    case 'IV': return 4; case 'V': return 5; case 'VI': return 6;
    default: return parseInt(r) || 0;
  }
}

function parseSagaText(oracleText: string): { abilities: CardData['structuredAbilities']; reminder?: string } {
  const chapters: { chapterNumbers: number[]; text: string }[] = [];
  const reminderLines: string[] = [];
  for (const line of oracleText.split('\n')) {
    // Collect reminder text (lines in parens, before any chapters)
    if (chapters.length === 0 && /^\(.*\)$/.test(line.trim())) {
      reminderLines.push(line.trim());
      continue;
    }
    const m = line.match(SF_SAGA_CHAPTER);
    if (m) {
      const chapterNumbers = m[1].split(',').map(r => romanToNumber(r.trim()));
      chapters.push({ chapterNumbers, text: m[2].trim() });
    }
  }
  return {
    abilities: { kind: 'saga', chapters },
    reminder: reminderLines.length > 0 ? reminderLines.join('\n') : undefined,
  };
}

function scryfallToCardData(sf: any): CardData {
  const card: CardData = {};
  card.name = sf.name;
  if (sf.mana_cost) card.manaCost = sf.mana_cost;

  const { supertypes, types, subtypes } = parseTypeLine(sf.type_line);
  if (supertypes.length > 0) card.supertypes = supertypes;
  if (types.length > 0) card.types = types;
  if (subtypes.length > 0) card.subtypes = subtypes;

  const { frameColor, accentColor } = sfFrameAndAccent(sf);
  card.frameColor = frameColor;
  if (accentColor) card.accentColor = accentColor;

  // Color indicator (Scryfall uses single-letter codes: W, U, B, R, G)
  if (sf.color_indicator && sf.color_indicator.length > 0) {
    card.colorIndicator = sf.color_indicator.map((c: string) => SF_COLOR_MAP[c]).filter(Boolean);
  }

  // Use art_crop for rendering
  if (sf.image_uris?.art_crop) card.artUrl = sf.image_uris.art_crop;

  card.rarity = sf.rarity;
  if (sf.artist) card.artist = sf.artist;
  if (sf.collector_number) card.collectorNumber = sf.collector_number;
  if (sf.set) card.setCode = sf.set.toUpperCase();

  const tl = sf.type_line.toLowerCase();

  if (tl.includes('planeswalker')) {
    card.startingLoyalty = sf.loyalty;
    card.structuredAbilities = parsePwAbilities(sf.oracle_text);
  } else if (sf.layout === 'saga' || tl.includes('saga')) {
    const { abilities, reminder } = parseSagaText(sf.oracle_text);
    card.structuredAbilities = abilities;
    if (reminder) card.unstructuredAbilities = reminder;
  } else if (tl.includes('battle')) {
    card.battleDefense = sf.defense;
    if (sf.oracle_text) card.oracleText = sf.oracle_text;
  } else {
    // Standard card
    if (sf.oracle_text) card.oracleText = sf.oracle_text;
    if (sf.flavor_text) card.flavorText = sf.flavor_text;
    if (sf.power) card.power = sf.power;
    if (sf.toughness) card.toughness = sf.toughness;
  }

  return card;
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

  // Convert to our CardData
  const cardData = scryfallToCardData(sf);
  console.log(`  CardData:`, JSON.stringify(cardData, null, 2).slice(0, 200) + '...');

  // Render our version
  console.log(`  Rendering our version...`);
  const { frontFace: ourPng } = await renderCard(cardData);

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
  if (args.length === 0) {
    console.error('Usage:');
    console.error('  npx tsx scripts/compare.ts "Card Name" [set]        # fetch from Scryfall');
    console.error('  npx tsx scripts/compare.ts --local ref.png card.json # compare local files');
    process.exit(1);
  }

  if (args[0] === '--local') {
    if (args.length < 3) {
      console.error('Usage: npx tsx scripts/compare.ts --local <reference.png> <carddata.json>');
      process.exit(1);
    }
    await compareLocal(args[1], args[2]);
  } else {
    const name = args[0];
    const set = args[1];
    await compareCard(name, set);
  }
}

main().catch(console.error);
