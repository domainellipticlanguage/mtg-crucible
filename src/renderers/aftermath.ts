import { type SKRSContext2D } from '@napi-rs/canvas';
import type { NormalizedCardData } from '../types';
import { drawSingleLineText, drawWrappedText, drawRulesAndFlavor } from '../text';
import { drawArt, drawManaCost, measureManaCostWidth, drawFrame, frameColorCode } from '../helpers';
import { getParsedAbilities, formatTypeLine } from '../parser';
import { AFTERMATH_BOTTOM_LAYOUT } from '../layout';
import type { TemplateHooks } from './render';
import { placeElement } from './element';

/**
 * Aftermath card renderer.
 *
 * Top half is rendered by the standard pipeline (normal orientation).
 * Bottom half (linkedCard) is rendered here, with each text element carrying
 * `angle: 90` in its layout entry.
 */

async function renderBottomText(
  ctx: SKRSContext2D,
  card: NormalizedCardData,
  cw: number, ch: number,
) {
  const L = AFTERMATH_BOTTOM_LAYOUT;

  const manaW = card.manaCost ? measureManaCostWidth(card.manaCost, ch, L.mana.size) : 0;

  // Mana cost — right-aligned at its anchor.
  if (card.manaCost) {
    await placeElement(ctx, L.mana, cw, ch, () => {
      return drawManaCost(ctx, card.manaCost!, cw, ch, {
        y: 0, w: 0,
        size: L.mana.size, shadowX: L.mana.shadowX, shadowY: L.mana.shadowY,
      });
    });
  }

  // Name — left-aligned, shrunk to avoid mana cost overlap.
  placeElement(ctx, L.name, cw, ch, ({ wDim, hDim }) => {
    const localBoxW = L.name.w * wDim - manaW;
    drawSingleLineText(ctx, card.name ?? '', 0, 0, localBoxW, L.name.h * hDim,
      L.name.font, L.name.size * ch, 'left', 'black');
  });

  // Type line.
  placeElement(ctx, L.type, cw, ch, ({ wDim, hDim }) => {
    drawSingleLineText(ctx, formatTypeLine(card.typeLine), 0, 0,
      L.type.w * wDim, L.type.h * hDim,
      L.type.font, L.type.size * ch, 'left', 'black');
  });

  // Rules text.
  const pa = getParsedAbilities(card);
  const rulesText = pa.unstructuredAbilities?.join('\n');
  placeElement(ctx, L.rules, cw, ch, ({ wDim, hDim }) => {
    const rw = L.rules.w * wDim;
    const rh = L.rules.h * hDim;
    if (rulesText && card.flavorText) {
      drawRulesAndFlavor(ctx, rulesText, card.flavorText, 0, 0, rw, rh, L.rules.font, L.rules.size * ch, []);
    } else if (rulesText) {
      drawWrappedText(ctx, rulesText, 0, 0, rw, rh, L.rules.font, L.rules.size * ch);
    } else if (card.flavorText) {
      drawWrappedText(ctx, card.flavorText, 0, 0, rw, rh, L.rules.font, L.rules.size * ch, { fontFamily: 'MPlantin Italic' });
    }
  });
}

const aftermathBody: TemplateHooks['body'] = async (ctx, card, L, cw, ch) => {
  const other = card.linkedCard;
  const frameDir = L._frame ?? 'aftermath';

  // Overdraw the bottom half frame with the linked card's color.
  if (other && other.frameColor.length > 0) {
    ctx.save();
    ctx.beginPath();
    // Bottom half starts roughly at y = 0.54 of the card
    const splitY = 0.54 * ch;
    ctx.rect(0, splitY, cw, ch - splitY);
    ctx.clip();
    const otherFrameCodes = other.frameColor.map(c => frameColorCode(c));
    const otherAccentCodes = other.accentColor.length > 0 ? other.accentColor.map(c => frameColorCode(c)) : undefined;
    await drawFrame(ctx, frameDir, otherFrameCodes, otherAccentCodes, cw, ch);
    ctx.restore();
  }

  // Bottom half art + text (rotated 90°)
  if (other) {
    if (other.artUrl) await drawArt(ctx, other.artUrl, AFTERMATH_BOTTOM_LAYOUT.art, cw, ch, { rotate: 90, allowUnsafe: (L as any)._allowUnsafeArtUrls });
    await renderBottomText(ctx, other, cw, ch);
  }
};

export const aftermathHooks: TemplateHooks = { body: aftermathBody };
