import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { CardData } from '../types';
import { drawSingleLineText, drawWrappedText } from '../text';
import { getTypeLine, normalizeFrameColors } from '../helpers';
import { ASSETS_DIR } from '../layout';
import { getParsedAbilities } from '../parser';
import type { TemplateHooks, AnyLayout } from './render';

/**
 * Flip card renderer (Kamigawa-style).
 * Top half is drawn normally by the main render pipeline.
 * This hook draws the bottom half rotated 180° (upside-down).
 *
 * CC coordinates for the bottom half use rotation=180, where (x, y) is the
 * text anchor in card space. After translate(cw, ch) + rotate(PI),
 * drawing at local (1-x, 1-y) places text at card position (x, y) rotated.
 */

const flipBody: TemplateHooks['body'] = async (ctx, card, L, cw, ch) => {
  const other = card.linkedCard;
  if (!other) return;

  ctx.save();
  ctx.translate(cw, ch);
  ctx.rotate(Math.PI);

  // In the 180° rotated local space, the CC coordinates map directly:
  // CC says name2 anchor is at (0.9147, 0.8848) — this is where text begins
  // in the upside-down reading direction. In the rotated local space,
  // this corresponds to (1-0.9147, 1-0.8848) = (0.0853, 0.1152).
  // But CC's x for rotated elements is the LEFT edge of the text box in the
  // rotated view, and the text width extends rightward in the rotated view.

  const n2 = L.name2;
  if (n2) {
    const x = (1 - n2.x) * cw;
    const y = (1 - n2.y) * ch;
    drawSingleLineText(ctx, other.name ?? '', x, y, n2.w * cw, n2.h * ch, n2.font, n2.size * ch, 'left', 'black');
  }

  const t2 = L.type2;
  if (t2) {
    const x = (1 - t2.x) * cw;
    const y = (1 - t2.y) * ch;
    drawSingleLineText(ctx, getTypeLine(other), x, y, t2.w * cw, t2.h * ch, t2.font, t2.size * ch, 'left', 'black');
  }

  const r2 = L.rules2;
  if (r2) {
    const pa = getParsedAbilities(other);
    const rulesText = pa.unstructuredAbilities?.join('\n');
    if (rulesText) {
      const x = (1 - r2.x) * cw;
      const y = (1 - r2.y) * ch;
      drawWrappedText(ctx, rulesText, x, y, r2.w * cw, r2.h * ch, r2.font, r2.size * ch);
    }
  }

  const pt2 = L.pt2;
  if (pt2 && other.power && other.toughness) {
    const x = (1 - pt2.x) * cw;
    const y = (1 - pt2.y) * ch;
    drawSingleLineText(ctx, `${other.power}/${other.toughness}`, x, y, pt2.w * cw, pt2.h * ch, pt2.font, pt2.size * ch, 'center', 'black');
  }

  ctx.restore();

  // Draw flip PT box overlay (single image containing both top and bottom PT boxes)
  const frameCodes = normalizeFrameColors(card.frameColor);
  const ptColor = frameCodes[0];
  const ptPath = path.join(ASSETS_DIR, 'frames', 'flip', `${ptColor}pt.png`);
  if (fs.existsSync(ptPath) && L.flipPtBounds) {
    const b = L.flipPtBounds;
    ctx.drawImage(await loadImage(ptPath), b.x * cw, b.y * ch, b.w * cw, b.h * ch);
  }
};

export const flipHooks: TemplateHooks = { body: flipBody };
