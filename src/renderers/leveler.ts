import * as fs from 'fs';
import * as path from 'path';
import { loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import type { NormalizedCardData, LevelerAbilities } from '../types';
import { drawSingleLineText, drawWrappedText } from '../text';
import { frameColorCode } from '../helpers';
import { ASSETS_DIR } from '../layout';
import { getParsedAbilities } from '../parser';
import type { TemplateHooks, AnyLayout } from './render';

/**
 * Leveler card renderer hook.
 *
 * Draws three stacked level sections:
 * 1. Level Up cost + base rules/PT
 * 2. Level X-Y with rules/PT and level label
 * 3. Level Z+ with rules/PT and level label
 *
 * The leveler frame assets already include PT box graphics,
 * so this hook only draws text.
 */

/** Draw text at an exact font size, centered in a box. No auto-shrinking. Optional vertical squash. */
function drawFixedText(ctx: SKRSContext2D, text: string, x: number, y: number, w: number, h: number, font: string, size: number, color = 'black', scaleY = 1) {
  ctx.font = `${size}px "${font}"`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  const tw = ctx.measureText(text).width;
  const drawX = x + (w - tw) / 2;
  const drawY = y + (h + size * 0.7 * scaleY) / 2;
  if (scaleY !== 1) {
    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.scale(1, scaleY);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  } else {
    ctx.fillText(text, drawX, drawY);
  }
}

const levelerBody: TemplateHooks['body'] = async (ctx, card, L, cw, ch) => {
  const pa = getParsedAbilities(card);
  if (pa.structuredAbilities?.kind !== 'leveler') return;

  const levels = (pa.structuredAbilities as LevelerAbilities).creatureLevels;

  // PT box image (single image containing all 3 PT boxes)
  const fc = frameColorCode(card.frameColor[0]);
  const ptPath = path.join(ASSETS_DIR, 'frames', 'leveler', 'pt', `${fc}.png`);
  if (fs.existsSync(ptPath)) {
    const ptBounds = { x: 0.7574, y: 0.6415, w: 0.188, h: 0.2667 };
    ctx.drawImage(await loadImage(ptPath), ptBounds.x * cw, ptBounds.y * ch, ptBounds.w * cw, ptBounds.h * ch);
  }

  // Section 1: Level Up cost + rules
  const levelUpText = pa.unstructuredAbilities?.join('\n') ?? '';
  if (levelUpText) {
    const r1 = L.rules1;
    drawWrappedText(ctx, levelUpText, r1.x * cw, r1.y * ch, r1.w * cw, r1.h * ch, r1.font, r1.size * ch);
  }

  // Base P/T (from the card itself)
  if (card.power && card.toughness) {
    const p1 = L.pt1;
    drawSingleLineText(ctx, `${card.power}/${card.toughness}`, p1.x * cw, p1.y * ch, p1.w * cw, p1.h * ch, p1.font, p1.size * ch, 'center', 'black');
  }

  // Fixed sizes for level labels (shared across sections)
  const levelWordSize = 0.0153 * ch;
  const levelNumSize = 0.033 * ch;
  const levelGap = 0.003 * ch;

  // Section 2: First level range
  if (levels.length >= 1) {
    const lv = levels[0];
    const r2 = L.rules2;
    if (lv.rulesText) {
      drawWrappedText(ctx, lv.rulesText, r2.x * cw, r2.y * ch, r2.w * cw, r2.h * ch, r2.font, r2.size * ch);
    }
    const p2 = L.pt2;
    drawSingleLineText(ctx, `${lv.power}/${lv.toughness}`, p2.x * cw, p2.y * ch, p2.w * cw, p2.h * ch, p2.font, p2.size * ch, 'center', 'black');

    // Level label — "LEVEL" then number, tight vertical gap
    const ll2 = L.levelLabel2;

    const wordY = ll2.y * ch;
    const numY = wordY + levelWordSize + levelGap;
    drawFixedText(ctx, 'LEVEL', ll2.x * cw, wordY, ll2.w * cw, levelWordSize, ll2.font, levelWordSize, 'black', 0.9);
    drawFixedText(ctx, `${lv.level[0]}-${lv.level[1]}`, ll2.x * cw, numY, ll2.w * cw, levelNumSize, ll2.font, levelNumSize);
  }

  // Section 3: Second level range
  if (levels.length >= 2) {
    const lv = levels[1];
    const r3 = L.rules3;
    if (lv.rulesText) {
      drawWrappedText(ctx, lv.rulesText, r3.x * cw, r3.y * ch, r3.w * cw, r3.h * ch, r3.font, r3.size * ch);
    }
    const p3 = L.pt3;
    drawSingleLineText(ctx, `${lv.power}/${lv.toughness}`, p3.x * cw, p3.y * ch, p3.w * cw, p3.h * ch, p3.font, p3.size * ch, 'center', 'black');

    // Level label — "LEVEL" then number, tight vertical gap
    const ll3 = L.levelLabel3;
    const wordY3 = ll3.y * ch;
    const numY3 = wordY3 + levelWordSize + levelGap;
    drawFixedText(ctx, 'LEVEL', ll3.x * cw, wordY3, ll3.w * cw, levelWordSize, ll3.font, levelWordSize, 'black', 0.9);
    drawFixedText(ctx, `${lv.level[0]}+`, ll3.x * cw, numY3, ll3.w * cw, levelNumSize, ll3.font, levelNumSize);
  }
};

export const levelerHooks: TemplateHooks = { body: levelerBody };
