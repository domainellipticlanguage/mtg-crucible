import * as fs from 'fs';
import * as path from 'path';
import { loadImage } from '@napi-rs/canvas';
import { frameColorCode } from '../helpers';
import { formatTypeLine, getParsedAbilities } from '../parser';
import { ASSETS_DIR } from '../assets-dir';
import type { TemplateHooks } from './render';
import { drawSingleLineAt, drawWrappedAt } from './element';

/**
 * Flip card renderer (Kamigawa-style).
 * Top half is drawn normally by the main render pipeline.
 * This hook draws the flip PT image and all bottom-half text via the
 * `angle: 180` convention on each element.
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
        ctx.rect(b.x * cw, b.y * ch, b.w * cw, midY - b.y * ch);
      } else {
        ctx.rect(b.x * cw, midY, b.w * cw, (b.y + b.h) * ch - midY);
      }
      ctx.clip();
      ctx.drawImage(await loadImage(ptImg), b.x * cw, b.y * ch, b.w * cw, b.h * ch);
      ctx.restore();
    }
  }

  if (L.name2) drawSingleLineAt(ctx, L.name2, cw, ch, other.name ?? '');

  if (L.type2) {
    // Pre-shrink the type box when there's a P/T to avoid overlap.
    const t2 = hasPt2 && L.type2PtInset
      ? { ...L.type2, w: L.type2.w - L.type2PtInset }
      : L.type2;
    drawSingleLineAt(ctx, t2, cw, ch, formatTypeLine(other.typeLine));
  }

  if (L.rules2) {
    const rulesText = getParsedAbilities(other).unstructuredAbilities?.join('\n');
    if (rulesText) drawWrappedAt(ctx, L.rules2, cw, ch, rulesText);
  }

  if (hasPt2 && L.pt2) {
    drawSingleLineAt(ctx, L.pt2, cw, ch, `${other.power}/${other.toughness}`, { align: 'center' });
  }
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
