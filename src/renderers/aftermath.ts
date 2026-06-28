import type { Ctx } from '../platform';
import type { NormalizedCardData } from '../types';
import { drawArt, drawFrame, frameColorCode } from '../helpers';
import { assetExists } from '../asset-manifest';
import { getParsedAbilities, formatTypeLine } from '../parser';
import type { TemplateHooks, AnyLayout } from './render';
import { drawSingleLineAt, drawWrappedAt, drawRulesAndFlavorAt, drawNameAndMana } from './element';

/**
 * Aftermath card renderer. The top half rides the standard pipeline; the
 * bottom (linked) half is rendered here with each text element carrying
 * `angle: 90` in its layout entry.
 */

async function renderBottomText(
  ctx: Ctx,
  card: NormalizedCardData,
  L: AnyLayout,
  cw: number, ch: number,
) {
  await drawNameAndMana(ctx, L.name, L.mana, cw, ch, card.name ?? '', card.manaCost);
  drawSingleLineAt(ctx, L.type, cw, ch, formatTypeLine(card.typeLine));

  const rulesText = getParsedAbilities(card).unstructuredAbilities?.join('\n');
  if (rulesText && card.flavorText) drawRulesAndFlavorAt(ctx, L.rules, cw, ch, rulesText, card.flavorText);
  else if (rulesText) drawWrappedAt(ctx, L.rules, cw, ch, rulesText);
  else if (card.flavorText) drawWrappedAt(ctx, L.rules, cw, ch, card.flavorText, { italic: true });
}

const aftermathBody: TemplateHooks['body'] = async (ctx, card, L, cw, ch) => {
  const other = card.linkedCard;
  const frameDir = L._frame ?? 'aftermath';
  const bottom = L.bottom;

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

  if (other) {
    if (other.artUrl) await drawArt(ctx, other.artUrl, bottom.art, cw, ch, { rotate: 90, allowUnsafe: (L as any)._allowUnsafeArtUrls });
    await renderBottomText(ctx, other, bottom, cw, ch);
  }
};

export const aftermathHooks: TemplateHooks = {
  body: aftermathBody,
  prefetch: (card, _L, frame) => {
    const other = card.linkedCard;
    if (!other) return [];
    const codes = new Set<string>(other.frameColor.map(c => frameColorCode(c)));
    other.accentColor.forEach(c => codes.add(frameColorCode(c)));
    const paths: string[] = [];
    for (const code of codes) {
      if (assetExists(`frames/${frame}/${code}.webp`)) paths.push(`frames/${frame}/${code}.webp`);
    }
    return paths;
  },
};
