import * as fs from 'fs';
import * as path from 'path';
import { loadImage } from '@napi-rs/canvas';
import { drawSingleLineText, drawWrappedText } from '../text';
import { frameColorCode } from '../helpers';
import { formatTypeLine, getParsedAbilities } from '../parser';
import { ASSETS_DIR } from '../assets-dir';
import type { TemplateHooks } from './render';
import { placeElement } from './element';

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

  const n2 = L.name2;
  if (n2) {
    placeElement(ctx, n2, cw, ch, ({ wDim, hDim }) => {
      drawSingleLineText(ctx, other.name ?? '', 0, 0, n2.w * wDim, n2.h * hDim, n2.font, n2.size * ch, 'left', 'black');
    });
  }

  const t2 = L.type2;
  if (t2) {
    placeElement(ctx, t2, cw, ch, ({ wDim, hDim }) => {
      const ptInset = hasPt2 ? (L.type2PtInset ?? 0) : 0;
      const typeW = (t2.w - ptInset) * wDim;
      drawSingleLineText(ctx, formatTypeLine(other.typeLine), 0, 0, typeW, t2.h * hDim, t2.font, t2.size * ch, 'left', 'black');
    });
  }

  const r2 = L.rules2;
  if (r2) {
    const pa = getParsedAbilities(other);
    const rulesText = pa.unstructuredAbilities?.join('\n');
    if (rulesText) {
      placeElement(ctx, r2, cw, ch, ({ wDim, hDim }) => {
        drawWrappedText(ctx, rulesText, 0, 0, r2.w * wDim, r2.h * hDim, r2.font, r2.size * ch);
      });
    }
  }

  if (hasPt2) {
    const pt2 = L.pt2;
    if (pt2) {
      placeElement(ctx, pt2, cw, ch, ({ wDim, hDim }) => {
        drawSingleLineText(ctx, `${other.power}/${other.toughness}`, 0, 0, pt2.w * wDim, pt2.h * hDim, pt2.font, pt2.size * ch, 'center', 'black');
      });
    }
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
