/**
 * Spike v3: Faithful CC rendering with all fixes.
 *
 * Fixes from v2:
 * - Card name/type line vertically centered in text box (CC's verticalAdjust)
 * - Flavor text uses MPlantin Italic font family (not CSS italic)
 * - Rounded corners via destination-out compositing
 * - Set symbol (CC's custom planeswalker shield)
 * - Bottom info / backmatter
 * - Mana symbol vertical nudge
 */

import { createCanvas, loadImage, GlobalFonts, type Image } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';

// ── Constants (from CardConjurer packM15RegularNew.js) ──────────────

const CARD_W = 2010;
const CARD_H = 2814;
const FONT_HEIGHT_RATIO = 0.7;

const LAYOUT = {
  art:   { x: 0.0767, y: 0.1129, w: 0.8476, h: 0.4429 },
  name:  { x: 168/2010, y: 145/2814, w: 0.8292, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:  {
    y: 176/2814, w: 1864/2010, h: 71/2100, size: 70.5/1638,
    align: 'right' as const,
    shadowX: -0.001, shadowY: 0.0029,
  },
  type:  { x: 168/2010, y: 1588/2814, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  rules: { x: 0.086, y: 1780/2814, w: 0.828, h: 0.2875, size: 0.0362, font: 'MPlantin' },
  pt:    { x: 0.7928, y: 0.902, w: 0.1367, h: 0.0372, size: 0.0372, font: 'Beleren Bold SmCaps', align: 'center' as const },
  ptBox: { x: 0.7573, y: 0.8848, w: 0.188, h: 0.0733 },
  // CC: card.setSymbolBounds = {x:1862/2010, y:0.5910, width:0.12, height:0.0410, vertical:'center', horizontal:'right'}
  setSymbol: { x: 1862/2010, y: 0.5910, w: 0.12, h: 0.0410 },
  // Corner radius: real MTG cards ~3mm on 63mm = ~4.76% of width
  cornerRadius: 0.048,
};

// ── Paths ───────────────────────────────────────────────────────────

const ASSETS = path.resolve(__dirname, '..', 'assets');
const OUT = '/tmp/mtg-crucible-spike';
type Ctx = ReturnType<ReturnType<typeof createCanvas>['getContext']>;

// ── Setup ───────────────────────────────────────────────────────────

function registerFonts() {
  GlobalFonts.registerFromPath(path.join(ASSETS, 'fonts', 'beleren-b.ttf'), 'Beleren Bold');
  GlobalFonts.registerFromPath(path.join(ASSETS, 'fonts', 'beleren-bsc.ttf'), 'Beleren Bold SmCaps');
  GlobalFonts.registerFromPath(path.join(ASSETS, 'fonts', 'mplantin.ttf'), 'MPlantin');
  GlobalFonts.registerFromPath(path.join(ASSETS, 'fonts', 'mplantin-i.ttf'), 'MPlantin Italic');
}

function fetchBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
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

// ── Mana symbol cache & loading ─────────────────────────────────────

const manaCache = new Map<string, Image | null>();

async function loadManaSymbol(symbol: string): Promise<Image | null> {
  const key = symbol.toLowerCase();
  if (manaCache.has(key)) return manaCache.get(key)!;
  const svgPath = path.join(ASSETS, 'symbols', `${key}.svg`);
  if (!fs.existsSync(svgPath)) {
    manaCache.set(key, null);
    return null;
  }
  const img = await loadImage(svgPath);
  manaCache.set(key, img);
  return img;
}

function parseManaString(mana: string): string[] {
  const matches = mana.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1, -1));
}

/**
 * Draw mana cost symbols, right-aligned.
 * CC: symbolSize = textSize * 0.78, spacing = textSize * 0.04
 * CC: symbolY = textSize * 0.34 - symbolSize/2 (centered on text midline)
 */
async function drawManaCost(ctx: Ctx, manaStr: string, textSize: number) {
  const symbols = parseManaString(manaStr);
  if (symbols.length === 0) return;

  const symbolSize = textSize * 0.78;
  const spacing = textSize * 0.04;
  const totalWidth = symbols.length * symbolSize + symbols.length * spacing * 2;

  const rightX = LAYOUT.mana.w * CARD_W;
  const textY = LAYOUT.mana.y * CARD_H;
  // CC: canvasMargin + textSize * 0.34 - symbolSize/2
  // Nudged up slightly (0.32 instead of 0.34) per user feedback
  const symbolCenterY = textY + textSize * 0.32;

  ctx.save();
  ctx.shadowColor = 'black';
  ctx.shadowOffsetX = LAYOUT.mana.shadowX * CARD_W;
  ctx.shadowOffsetY = LAYOUT.mana.shadowY * CARD_H;
  ctx.shadowBlur = 3;

  let x = rightX - totalWidth;
  for (const sym of symbols) {
    const img = await loadManaSymbol(sym);
    if (img) {
      ctx.drawImage(img, x + spacing, symbolCenterY - symbolSize / 2, symbolSize, symbolSize);
    }
    x += symbolSize + spacing * 2;
  }
  ctx.restore();
}

// ── Text rendering ──────────────────────────────────────────────────

/**
 * Draw a single-line text field with CC's vertical centering.
 *
 * CC formula: verticalAdjust = (textHeight - currentY + textSize * 0.15) / 2
 * For single line: currentY = textSize, so:
 *   verticalAdjust = (textHeight - textSize + textSize * 0.15) / 2
 *                  = (textHeight - textSize * 0.85) / 2
 */
function drawSingleLineText(
  ctx: Ctx,
  text: string,
  x: number, y: number, w: number, h: number,
  font: string, size: number,
  align: 'left' | 'center' | 'right' = 'left',
  color: string = 'black',
) {
  let textSize = size;

  // Auto-shrink (CC: textOneLine, shrink by 1px)
  while (textSize > 1) {
    ctx.font = `${textSize}px "${font}"`;
    if (ctx.measureText(text).width <= w) break;
    textSize -= 1;
  }

  ctx.font = `${textSize}px "${font}"`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';

  // CC vertical centering for single-line
  const verticalAdjust = (h - textSize * 0.85) / 2;

  let drawX = x;
  if (align === 'center') {
    drawX = x + (w - ctx.measureText(text).width) / 2;
  } else if (align === 'right') {
    drawX = x + w - ctx.measureText(text).width;
  }

  ctx.fillText(text, drawX, y + verticalAdjust + textSize * FONT_HEIGHT_RATIO);
}

/**
 * Draw text with a subtle stroke for slightly heavier weight.
 * Real MTG cards have rules text that appears slightly heavier than what
 * a plain fill gives us with MPlantin.
 */
function fillTextHeavy(ctx: Ctx, text: string, x: number, y: number, strokeWidth = 0.4) {
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle as string;
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = 'round';
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Word-wrap paragraphs, tracking paragraph boundaries */
function wrapParagraphs(ctx: Ctx, paragraphs: string[], maxWidth: number): { text: string; paraStart: boolean }[] {
  const lines: { text: string; paraStart: boolean }[] = [];
  for (let p = 0; p < paragraphs.length; p++) {
    const words = paragraphs[p].split(' ');
    let cur = '';
    let first = true;
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && cur) {
        lines.push({ text: cur, paraStart: first && p > 0 });
        cur = word;
        first = false;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push({ text: cur, paraStart: first && p > 0 });
  }
  return lines;
}

/** Compute total height for a set of lines at a given textSize */
function computeHeight(lines: { paraStart: boolean }[], textSize: number, paraSpacing: number): number {
  let h = textSize; // first line
  for (let i = 1; i < lines.length; i++) {
    h += textSize;
    if (lines[i].paraStart) h += paraSpacing;
  }
  return h;
}

/**
 * Draw multi-line wrapped text with CC's auto-shrink and vertical centering.
 */
function drawWrappedText(
  ctx: Ctx,
  text: string,
  boxX: number, boxY: number, boxW: number, boxH: number,
  font: string, startingSize: number,
  options: { fontFamily?: string; color?: string } = {},
): { usedSize: number; usedHeight: number } {
  const color = options.color || 'black';
  const fontFamily = options.fontFamily || font;
  let textSize = startingSize;
  const paragraphs = text.split('\n').filter(p => p.trim());

  while (textSize > 20) {
    ctx.font = `${textSize}px "${fontFamily}"`;
    const lines = wrapParagraphs(ctx, paragraphs, boxW);
    const paraSpacing = textSize * 0.35;
    const totalH = computeHeight(lines, textSize, paraSpacing);

    if (totalH <= boxH) {
      const vertAdj = (boxH - totalH + textSize * 0.15) / 2;
      ctx.fillStyle = color;
      let curY = 0;
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          curY += textSize;
          if (lines[i].paraStart) curY += paraSpacing;
        }
        fillTextHeavy(ctx, lines[i].text, boxX, boxY + vertAdj + curY + textSize * FONT_HEIGHT_RATIO);
      }
      return { usedSize: textSize, usedHeight: totalH };
    }
    textSize -= 1;
  }
  return { usedSize: textSize, usedHeight: 0 };
}

/**
 * Render rules + flavor bar + flavor as a single flow.
 * CC: {flavor} → {lns}{bar}{lns}{i}
 * Flavor uses 'mplantini' font family (not CSS italic).
 */
function drawRulesAndFlavor(
  ctx: Ctx,
  rulesText: string, flavorText: string,
  boxX: number, boxY: number, boxW: number, boxH: number,
  font: string, startingSize: number,
) {
  let textSize = startingSize;
  const ruleParas = rulesText.split('\n').filter(p => p.trim());
  const flavorParas = flavorText.split('\n').filter(p => p.trim());

  while (textSize > 20) {
    ctx.font = `${textSize}px "${font}"`;
    const rulesLines = wrapParagraphs(ctx, ruleParas, boxW);

    // CC: flavor uses font family 'mplantini', not CSS italic on 'mplantin'
    const flavorSize = textSize;
    ctx.font = `${flavorSize}px "MPlantin Italic"`;
    const flavorLines = wrapParagraphs(ctx, flavorParas, boxW);

    const paraSpacing = textSize * 0.35;

    // Rules height
    let totalH = computeHeight(rulesLines, textSize, paraSpacing);

    // Bar: {lns} + bar + {lns} = two newlines (no extra spacing) + bar height
    const barHeight = CARD_H * 0.003; // thin bar line
    totalH += textSize; // line break before bar
    totalH += barHeight;
    totalH += textSize; // line break after bar

    // Flavor height
    totalH += computeHeight(flavorLines, flavorSize, flavorSize * 0.35);

    if (totalH <= boxH) {
      const vertAdj = (boxH - totalH + textSize * 0.15) / 2;
      let curY = 0;

      // Draw rules
      ctx.font = `${textSize}px "${font}"`;
      ctx.fillStyle = 'black';
      for (let i = 0; i < rulesLines.length; i++) {
        if (i > 0) {
          curY += textSize;
          if (rulesLines[i].paraStart) curY += paraSpacing;
        }
        fillTextHeavy(ctx, rulesLines[i].text, boxX, boxY + vertAdj + curY + textSize * FONT_HEIGHT_RATIO);
      }
      curY += textSize;

      // Bar
      curY += textSize * 0.5;
      const barY = boxY + vertAdj + curY;
      const barW = boxW * 0.85;
      const barX = boxX + (boxW - barW) / 2;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(barX, barY);
      ctx.lineTo(barX + barW, barY);
      ctx.stroke();
      ctx.restore();
      curY += barHeight + textSize * 0.5;

      // Flavor
      ctx.font = `${flavorSize}px "MPlantin Italic"`;
      ctx.fillStyle = 'black';
      for (let i = 0; i < flavorLines.length; i++) {
        if (i > 0) {
          curY += flavorSize;
          if (flavorLines[i].paraStart) curY += flavorSize * 0.35;
        }
        fillTextHeavy(ctx, flavorLines[i].text, boxX, boxY + vertAdj + curY + flavorSize * FONT_HEIGHT_RATIO);
      }
      return;
    }
    textSize -= 1;
  }
}

// ── Card rendering ──────────────────────────────────────────────────

interface CardData {
  name: string;
  manaCost?: string;
  typeLine: string;
  rulesText?: string;
  flavorText?: string;
  power?: string;
  toughness?: string;
  frameColor: string;
  artUrl?: string;
  rarity?: 'common' | 'uncommon' | 'rare' | 'mythic';
  artist?: string;
  collectorNumber?: string;
  setCode?: string;
}

async function renderCard(card: CardData): Promise<Buffer> {
  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx = canvas.getContext('2d');

  // 1. Background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // 2. Art
  if (card.artUrl) {
    try {
      const artBuffer = await fetchBuffer(card.artUrl);
      const artImg = await loadImage(artBuffer);
      const ax = LAYOUT.art.x * CARD_W;
      const ay = LAYOUT.art.y * CARD_H;
      const aw = LAYOUT.art.w * CARD_W;
      const ah = LAYOUT.art.h * CARD_H;
      const artAspect = artImg.width / artImg.height;
      const boxAspect = aw / ah;
      let sx = 0, sy = 0, sw = artImg.width, sh = artImg.height;
      if (artAspect > boxAspect) {
        sw = artImg.height * boxAspect; sx = (artImg.width - sw) / 2;
      } else {
        sh = artImg.width / boxAspect; sy = (artImg.height - sh) / 2;
      }
      ctx.drawImage(artImg, sx, sy, sw, sh, ax, ay, aw, ah);
    } catch (e) {
      console.warn(`  Failed to load art: ${e}`);
    }
  }

  // 3. Frame
  const framePath = path.join(ASSETS, 'frames', 'standard', `${card.frameColor}.png`);
  if (fs.existsSync(framePath)) {
    ctx.drawImage(await loadImage(framePath), 0, 0, CARD_W, CARD_H);
  }

  // 4. P/T box
  if (card.power !== undefined && card.toughness !== undefined) {
    const ptPath = path.join(ASSETS, 'pt', `${card.frameColor}.png`);
    if (fs.existsSync(ptPath)) {
      ctx.drawImage(
        await loadImage(ptPath),
        LAYOUT.ptBox.x * CARD_W, LAYOUT.ptBox.y * CARD_H,
        LAYOUT.ptBox.w * CARD_W, LAYOUT.ptBox.h * CARD_H,
      );
    }
  }

  // 5. Set symbol (right-aligned in type line area)
  const rarity = card.rarity || 'common';
  const setSymPath = path.join(ASSETS, 'symbols', `set-${rarity}.svg`);
  if (fs.existsSync(setSymPath)) {
    const setImg = await loadImage(setSymPath);
    const sh = LAYOUT.setSymbol.h * CARD_H;
    const sw = sh * (setImg.width / setImg.height); // maintain aspect
    const sx = LAYOUT.setSymbol.x * CARD_W - sw; // right-aligned
    const sy = LAYOUT.setSymbol.y * CARD_H - sh / 2; // vertically centered
    ctx.drawImage(setImg, sx, sy, sw, sh);
  }

  // 6. Card name
  drawSingleLineText(
    ctx, card.name,
    LAYOUT.name.x * CARD_W, LAYOUT.name.y * CARD_H,
    LAYOUT.name.w * CARD_W, LAYOUT.name.h * CARD_H,
    LAYOUT.name.font, LAYOUT.name.size * CARD_H,
  );

  // 7. Mana cost
  if (card.manaCost) {
    await drawManaCost(ctx, card.manaCost, LAYOUT.mana.size * CARD_H);
  }

  // 8. Type line
  drawSingleLineText(
    ctx, card.typeLine,
    LAYOUT.type.x * CARD_W, LAYOUT.type.y * CARD_H,
    LAYOUT.type.w * CARD_W, LAYOUT.type.h * CARD_H,
    LAYOUT.type.font, LAYOUT.type.size * CARD_H,
  );

  // 9. Rules text + flavor text
  const rx = LAYOUT.rules.x * CARD_W;
  const ry = LAYOUT.rules.y * CARD_H;
  const rw = LAYOUT.rules.w * CARD_W;
  const rh = LAYOUT.rules.h * CARD_H;
  const rs = LAYOUT.rules.size * CARD_H;

  if (card.rulesText && card.flavorText) {
    drawRulesAndFlavor(ctx, card.rulesText, card.flavorText, rx, ry, rw, rh, LAYOUT.rules.font, rs);
  } else if (card.rulesText) {
    drawWrappedText(ctx, card.rulesText, rx, ry, rw, rh, LAYOUT.rules.font, rs);
  } else if (card.flavorText) {
    drawWrappedText(ctx, card.flavorText, rx, ry, rw, rh, LAYOUT.rules.font, rs, { fontFamily: 'MPlantin Italic' });
  }

  // 10. P/T text
  if (card.power !== undefined && card.toughness !== undefined) {
    drawSingleLineText(
      ctx, `${card.power}/${card.toughness}`,
      LAYOUT.pt.x * CARD_W, LAYOUT.pt.y * CARD_H,
      LAYOUT.pt.w * CARD_W, LAYOUT.pt.h * CARD_H,
      LAYOUT.pt.font, LAYOUT.pt.size * CARD_H,
      'center',
    );
  }

  // 11. Bottom info / backmatter
  drawBottomInfo(ctx, card);

  // 12. Corner cutout — programmatic rounded corners (real MTG ~3mm on 63mm card)
  const r = LAYOUT.cornerRadius * CARD_W;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'black';
  // Top-left
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(r, 0); ctx.arc(r, r, r, -Math.PI / 2, Math.PI, true); ctx.lineTo(0, 0);
  ctx.fill();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(CARD_W, 0); ctx.lineTo(CARD_W - r, 0); ctx.arc(CARD_W - r, r, r, -Math.PI / 2, 0, false); ctx.lineTo(CARD_W, 0);
  ctx.fill();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(CARD_W, CARD_H); ctx.lineTo(CARD_W, CARD_H - r); ctx.arc(CARD_W - r, CARD_H - r, r, 0, Math.PI / 2, false); ctx.lineTo(CARD_W, CARD_H);
  ctx.fill();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(0, CARD_H); ctx.lineTo(0, CARD_H - r); ctx.arc(r, CARD_H - r, r, Math.PI, Math.PI / 2, true); ctx.lineTo(0, CARD_H);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  return canvas.toBuffer('image/png');
}

function drawBottomInfo(ctx: Ctx, card: CardData) {
  const fontSize = CARD_H * 0.0143;
  const y = CARD_H * 0.955;
  const leftX = CARD_W * 0.0647;
  const rightX = CARD_W * 0.935;

  ctx.save();
  // CC uses gotham-medium for collector info, but we'll use MPlantin
  ctx.font = `${fontSize}px "MPlantin"`;
  ctx.fillStyle = 'white';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'black';
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.shadowBlur = 2;

  // Left side: collector number + set
  const num = card.collectorNumber || '000';
  const set = card.setCode || 'CRU';
  ctx.fillText(`${num} \u2022 ${set}`, leftX, y);

  // Second line: artist + branding
  const artist = card.artist || '';
  const artistLine = artist ? `\u{1F58C}\uFE0E ${artist}` : '';
  ctx.fillText(artistLine, leftX, y + fontSize * 1.4);

  // Right side: branding
  ctx.textAlign = 'right';
  ctx.fillText('mtg-crucible', rightX, y + fontSize * 1.4);
  ctx.textAlign = 'left';

  ctx.restore();
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  registerFonts();
  fs.mkdirSync(OUT, { recursive: true });

  console.log('Rendering Lightning Bolt...');
  const bolt = await renderCard({
    name: 'Lightning Bolt',
    manaCost: '{R}',
    typeLine: 'Instant',
    rulesText: 'Lightning Bolt deals 3 damage to any target.',
    flavorText: '"The sparkmage shrieked, calling on the rage of the storms of his youth. To his surprise, the sky responded with a fierce energy he had never thought to see again."',
    frameColor: 'r',
    rarity: 'uncommon',
    artist: 'Christopher Moeller',
    collectorNumber: '141',
  });
  fs.writeFileSync(path.join(OUT, '01-lightning-bolt.png'), bolt);
  console.log(`  → ${path.join(OUT, '01-lightning-bolt.png')}`);

  console.log('Rendering Questing Beast...');
  const qb = await renderCard({
    name: 'Questing Beast',
    manaCost: '{2}{G}{G}',
    typeLine: 'Legendary Creature \u2014 Beast',
    rulesText: 'Vigilance, deathtouch, haste\nQuesting Beast can\'t be blocked by creatures with power 2 or less.\nCombat damage that would be dealt by creatures you control can\'t be prevented.\nWhenever Questing Beast deals combat damage to an opponent, it deals that much damage to target planeswalker that player controls.',
    power: '4',
    toughness: '4',
    frameColor: 'g',
    rarity: 'mythic',
    artist: 'Igor Kieryluk',
    collectorNumber: '171',
  });
  fs.writeFileSync(path.join(OUT, '02-questing-beast.png'), qb);
  console.log(`  → ${path.join(OUT, '02-questing-beast.png')}`);

  console.log('Rendering Archangel Avacyn...');
  const avacyn = await renderCard({
    name: 'Archangel Avacyn',
    manaCost: '{3}{W}{W}',
    typeLine: 'Legendary Creature \u2014 Angel',
    rulesText: 'Flash\nFlying, vigilance\nWhen Archangel Avacyn enters the battlefield, creatures you control gain indestructible until end of turn.\nWhen a non-Angel creature you control dies, transform Archangel Avacyn at the beginning of the next upkeep.',
    power: '4',
    toughness: '4',
    frameColor: 'w',
    rarity: 'mythic',
    artist: 'James Ryman',
    collectorNumber: '005',
    artUrl: 'https://cards.scryfall.io/art_crop/front/7/f/7f4893ef-f983-418b-b7a4-5f073c844545.jpg?1673149345',
  });
  fs.writeFileSync(path.join(OUT, '03-avacyn-art.png'), avacyn);
  console.log(`  → ${path.join(OUT, '03-avacyn-art.png')}`);

  console.log('\nDone! Check output in', OUT);
}

main().catch(console.error);
