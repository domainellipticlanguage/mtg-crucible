import * as fs from 'fs';
import * as path from 'path';
import { loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import type { NormalizedCardData } from '../types';
import { drawSingleLineText, drawWrappedText } from '../text';
import { frameColorCode } from '../helpers';
import { formatTypeLine } from '../parser';
import { ASSETS_DIR } from '../assets-dir';
import { getParsedAbilities } from '../parser';
import type { TemplateHooks, AnyLayout } from './render';

/**
 * Flip card renderer (Kamigawa-style).
 * Top half is drawn normally by the main render pipeline.
 * This hook draws the flip PT image and all bottom-half text rotated 180°.
 */

const flipBody: TemplateHooks['body'] = async (ctx, card, L, cw, ch) => {
  const other = card.linkedCard;
  if (!other) return;

  const hasPt1 = !!(card.power && card.toughness);
  const hasPt2 = !!(other.power && other.toughness);

  // Draw flip PT image, clipping to only show boxes for sides that have P/T
  if ((hasPt1 || hasPt2) && L.flipPtBounds) {
    const fc = frameColorCode(card.frameColor[0]);
    const ptImg = path.join(ASSETS_DIR, 'frames', 'flip', `${fc}pt.png`);
    if (fs.existsSync(ptImg)) {
      const b = L.flipPtBounds;
      const midY = (b.y + b.h / 2) * ch;
      ctx.save();
      ctx.beginPath();
      if (hasPt1 && hasPt2) {
        ctx.rect(b.x * cw, b.y * ch, b.w * cw, b.h * ch);
      } else if (hasPt1) {
        // Top half only
        ctx.rect(b.x * cw, b.y * ch, b.w * cw, midY - b.y * ch);
      } else {
        // Bottom half only
        ctx.rect(b.x * cw, midY, b.w * cw, (b.y + b.h) * ch - midY);
      }
      ctx.clip();
      ctx.drawImage(await loadImage(ptImg), b.x * cw, b.y * ch, b.w * cw, b.h * ch);
      ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(cw, ch);
  ctx.rotate(Math.PI);

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
    const ptInset = hasPt2 ? (L.type2PtInset ?? 0) : 0;
    const typeW = (t2.w - ptInset) * cw;
    drawSingleLineText(ctx, formatTypeLine(other.typeLine), x, y, typeW, t2.h * ch, t2.font, t2.size * ch, 'left', 'black');
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

  if (hasPt2) {
    const pt2 = L.pt2;
    if (pt2) {
      const x = (1 - pt2.x) * cw;
      const y = (1 - pt2.y) * ch;
      drawSingleLineText(ctx, `${other.power}/${other.toughness}`, x, y, pt2.w * cw, pt2.h * ch, pt2.font, pt2.size * ch, 'center', 'black');
    }
  }

  ctx.restore();
};

// The top-half type line width is adjusted by the standard pipeline.
// We use a preFrame hook to dynamically shrink L.type.w when the top side has P/T.
const flipPreFrame: TemplateHooks['preFrame'] = async (_ctx, card, L, _cw, _ch) => {
  const hasPt1 = !!(card.power && card.toughness);
  if (hasPt1 && L.typePtInset) {
    L.type = { ...L.type, w: L.type.w - L.typePtInset };
  }
};

export const flipHooks: TemplateHooks = { preFrame: flipPreFrame, body: flipBody };
