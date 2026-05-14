/**
 * 3-up visual comparison for the title-color (name line / type line) bug investigation.
 *
 * For each test case we render:
 *   1. Scryfall's official card (ground truth)
 *   2. Current crucible output (what `deriveTitleColor` gives today)
 *   3. Proposed crucible output (same card, but with nameLineColor/typeLineColor
 *      manually overridden to whatever the fixed `deriveTitleColor` should produce)
 *
 * Usage: npx tsx scripts/title-color-compare.ts [--open]
 */

import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { renderCard, parseCard } from '../src';
import type { CardData, FrameColor, FrameEffect } from '../src/types';

const OUT = path.resolve(__dirname, '..', '.output', 'title-color-compare');

type Override = Partial<Pick<CardData, 'nameLineColor' | 'typeLineColor' | 'ptBoxColor' | 'frameEffect'>>;
type TestCase = { name: string; set?: string; bug: string; proposed: Override };

const CASES: TestCase[] = [
  { name: 'Sythis, Harvest\'s Hand', set: 'mh2',
    bug: 'fully hybrid {G/W} (MH2) — also Enchantment Creature, should auto-infer Nyx',
    proposed: {} },

  { name: 'Doomwake Giant', set: 'jou',
    bug: 'Enchantment Creature (mono-black) — should auto-infer Nyx frame effect',
    proposed: {} },

  { name: 'Whip of Erebos',
    bug: 'Legendary Enchantment Artifact (Theros) — should auto-infer Nyx (Enchantment + Artifact)',
    proposed: {} },

  { name: 'Sigil of the Empty Throne',
    bug: 'plain Enchantment (no other primary type) — should NOT get Nyx (control)',
    proposed: {} },

  { name: 'Prismari Pledgemage', set: 'stx',
    bug: 'fully hybrid {U/R} (STX) — verdict: current artifact name/type closer to Scryfall, no change',
    proposed: {} },

  { name: 'Witherbloom Pledgemage', set: 'stx',
    bug: 'fully hybrid {B/G} (STX) — verdict: current artifact name/type closer to Scryfall, no change',
    proposed: {} },

  { name: 'Reaper King', set: 'shm',
    bug: 'fully hybrid 5-color artifact — current returns artifact (debatable, but no color)',
    proposed: { nameLineColor: 'multicolor', typeLineColor: 'multicolor' } },

  { name: 'Gitaxian Probe', set: 'nph',
    bug: 'phyrexian {U/P} — hybrid bucket only, current returns artifact',
    proposed: { nameLineColor: 'blue', typeLineColor: 'blue' } },

  { name: 'Emrakul, the Aeons Torn', set: 'roe',
    bug: 'colorless creature (cost {15}) — current returns artifact instead of colorless',
    proposed: { nameLineColor: 'colorless', typeLineColor: 'colorless' } },

  { name: 'Endbringer', set: 'ogw',
    bug: 'devoid + colorless cost — name=colorless, type=colorless (no devoid frame effect)',
    proposed: { nameLineColor: 'colorless', typeLineColor: 'colorless' } },

  { name: 'Eldrazi Skyspawner', set: 'bfz',
    bug: 'devoid {2}{U} — name=blue, type=colorless (renderer may show artifact tint; separate issue)',
    proposed: { nameLineColor: 'blue', typeLineColor: 'colorless' } },

  { name: 'Brood Butcher', set: 'bfz',
    bug: 'multicolor devoid {3}{B}{G} — name=multicolor, type=colorless (new case)',
    proposed: { nameLineColor: 'multicolor', typeLineColor: 'colorless' } },

  { name: 'Plains',
    bug: 'basic land, no mana cost — current returns artifact',
    proposed: { nameLineColor: 'land', typeLineColor: 'land' } },

  { name: 'Hallowed Fountain', set: 'rvr',
    bug: 'modern shockland (W/U), no mana cost — current returns artifact',
    proposed: { nameLineColor: 'land', typeLineColor: 'land' } },

  { name: 'Thopter Spy Network', set: 'ori',
    bug: 'mono-blue artifact — current already correct (blue); included as control',
    proposed: { nameLineColor: 'blue', typeLineColor: 'blue' } },

  { name: 'Sphinx\'s Revelation', set: 'rtr',
    bug: 'three-color non-hybrid — current already correct (multicolor); control',
    proposed: { nameLineColor: 'multicolor', typeLineColor: 'multicolor' } },
];

function fetchOnce(url: string): Promise<{ status: number; buffer: Buffer; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    https.get(new URL(url), { headers: { 'User-Agent': 'mtg-crucible/1.0', 'Accept': '*/*' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchOnce(res.headers.location).then(resolve, reject);
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, buffer: Buffer.concat(chunks), headers: res.headers as any }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchJSON(url: string): Promise<any> {
  const r = await fetchOnce(url);
  return JSON.parse(r.buffer.toString());
}
async function fetchText(url: string): Promise<string> {
  return (await fetchOnce(url)).buffer.toString();
}
async function fetchBuffer(url: string): Promise<Buffer> {
  return (await fetchOnce(url)).buffer;
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchScryfallCard(name: string, set?: string) {
  let url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`;
  if (set) url += `&set=${encodeURIComponent(set)}`;
  const data = await fetchJSON(url);
  if (data.object === 'error') throw new Error(`Scryfall: ${data.details}`);
  return data;
}
async function fetchScryfallText(name: string, set?: string) {
  let url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=text`;
  if (set) url += `&set=${encodeURIComponent(set)}`;
  return fetchText(url);
}

/** Build CardData from Scryfall text + injected metadata (art URL, etc.) */
async function buildCardData(name: string, set?: string): Promise<{ card: CardData; png: Buffer; displayName: string }> {
  const [scryfallText, sf] = await Promise.all([
    fetchScryfallText(name, set),
    fetchScryfallCard(name, set),
  ]);
  const frontFace = sf.card_faces?.[0] ?? sf;
  const imageUris = frontFace.image_uris ?? sf.image_uris;
  const metadata: string[] = [];
  if (imageUris?.art_crop) metadata.push(`Art URL: ${imageUris.art_crop}`);
  if (sf.rarity) metadata.push(`Rarity: ${sf.rarity}`);
  if (sf.artist ?? frontFace.artist) metadata.push(`Artist: ${sf.artist ?? frontFace.artist}`);
  if (sf.set) metadata.push(`Set: ${sf.set.toUpperCase()}`);
  if (sf.collector_number) metadata.push(`Collector Number: ${sf.collector_number}`);

  const lines = scryfallText.split('\n');
  const fullText = [lines[0], ...metadata, ...lines.slice(1)].join('\n');
  const card = parseCard(fullText);
  const png = await fetchBuffer(imageUris.png);
  return { card, png, displayName: sf.name };
}

async function buildComparison(scryfallPng: Buffer, currentPng: Buffer, label: string, sub: string): Promise<Buffer> {
  const sfImg = await loadImage(scryfallPng);
  const curImg = await loadImage(currentPng);

  const targetH = 1040;
  const sfW = Math.round(sfImg.width * (targetH / sfImg.height));
  const curW = Math.round(curImg.width * (targetH / curImg.height));

  const gap = 20;
  const labelH = 80;
  const totalW = sfW + curW + gap;
  const totalH = targetH + labelH;

  const canvas = createCanvas(totalW, totalH);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(0, 0, totalW, totalH);

  ctx.fillStyle = 'white';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Scryfall (truth)', sfW / 2, 28);
  ctx.fillText('Crucible', sfW + gap + curW / 2, 28);

  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#bbbbbb';
  ctx.fillText(label, totalW / 2, 52);
  ctx.font = 'italic 13px sans-serif';
  ctx.fillStyle = '#888888';
  const maxSubChars = Math.floor(totalW / 8);
  const subTruncated = sub.length > maxSubChars ? sub.slice(0, maxSubChars - 3) + '...' : sub;
  ctx.fillText(subTruncated, totalW / 2, 70);

  ctx.drawImage(sfImg, 0, labelH, sfW, targetH);
  ctx.drawImage(curImg, sfW + gap, labelH, curW, targetH);

  return canvas.toBuffer('image/png');
}

async function processCase(c: TestCase): Promise<{ slug: string; compPath: string }> {
  console.log(`\n=== ${c.name}${c.set ? ` (${c.set})` : ''} ===`);
  console.log(`  ${c.bug}`);

  const { card, png: scryfallPng, displayName } = await buildCardData(c.name, c.set);
  // Apply any proposed overrides (kept for ad-hoc experimentation; usually empty now
  // that the engine handles inference).
  const current = await renderCard({ ...card, ...c.proposed });

  const comp = await buildComparison(scryfallPng, current.frontFace, displayName, c.bug);

  const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const compPath = path.join(OUT, `${slug}.png`);
  fs.writeFileSync(compPath, comp);
  console.log(`  wrote: ${compPath}`);
  return { slug, compPath };
}

async function buildContactSheet(rows: Buffer[]): Promise<Buffer> {
  const images = await Promise.all(rows.map(b => loadImage(b)));
  const sheetW = Math.max(...images.map(i => i.width));
  const sheetH = images.reduce((s, i) => s + i.height, 0);
  const canvas = createCanvas(sheetW, sheetH);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(0, 0, sheetW, sheetH);
  let y = 0;
  for (const img of images) {
    ctx.drawImage(img, Math.floor((sheetW - img.width) / 2), y);
    y += img.height;
  }
  return canvas.toBuffer('image/png');
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const openFlag = process.argv.includes('--open');

  const rowBuffers: Buffer[] = [];
  for (const c of CASES) {
    try {
      const { compPath } = await processCase(c);
      rowBuffers.push(fs.readFileSync(compPath));
      await sleep(120); // Scryfall rate limit courtesy
    } catch (e: any) {
      console.error(`  FAILED on ${c.name}: ${e.message}`);
    }
  }

  if (rowBuffers.length > 0) {
    console.log(`\nBuilding contact sheet of ${rowBuffers.length} rows...`);
    const sheet = await buildContactSheet(rowBuffers);
    const sheetPath = path.join(OUT, '_contact-sheet.png');
    fs.writeFileSync(sheetPath, sheet);
    console.log(`Wrote: ${sheetPath}`);
    if (openFlag) execSync(`open "${sheetPath}"`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
