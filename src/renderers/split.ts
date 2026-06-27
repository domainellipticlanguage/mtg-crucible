import type { Ctx } from '../platform';
import { createCanvas, loadAssetImage } from '../platform';
import type { NormalizedCardData } from '../types';
import { drawArt, drawFrame, frameColorCode } from '../helpers';
import { assetExists } from '../asset-manifest';
import { getParsedAbilities, formatTypeLine } from '../parser';
import { SPLIT_RIGHT_LAYOUT, SPLIT_LEFT_LAYOUT } from '../layout';
import type { TemplateHooks } from './render';
import { drawSingleLineAt, drawWrappedAt, drawRulesAndFlavorAt, drawNameAndMana, drawSetSymbolAt } from './element';

/**
 * Split card renderer.
 *
 * Each half's text reads sideways. In the new convention every element carries
 * its own `angle: -90` and (x, y) is the local upper-left on the tall canvas.
 * The element-aware wrappers translate + rotate per element, so each call site
 * names exactly one layout entry and the primitive it draws.
 */

async function renderSplitText(
  ctx: Ctx,
  card: NormalizedCardData,
  L: typeof SPLIT_RIGHT_LAYOUT,
  cw: number, ch: number,
  clipYMin: number, clipYMax: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, clipYMin, cw, clipYMax - clipYMin);
  ctx.clip();

  await drawNameAndMana(ctx, L.name, L.mana, cw, ch, card.name ?? '', card.manaCost);
  drawSingleLineAt(ctx, L.type, cw, ch, formatTypeLine(card.typeLine));
  await drawSetSymbolAt(ctx, L.setSymbol, cw, ch, card.rarity || 'common');

  const rulesText = getParsedAbilities(card).unstructuredAbilities?.join('\n');
  if (rulesText && card.flavorText) drawRulesAndFlavorAt(ctx, L.rules, cw, ch, rulesText, card.flavorText);
  else if (rulesText) drawWrappedAt(ctx, L.rules, cw, ch, rulesText);
  else if (card.flavorText) drawWrappedAt(ctx, L.rules, cw, ch, card.flavorText, { italic: true });

  ctx.restore();
}

const splitBody: TemplateHooks['body'] = async (ctx, card, L, cw, ch) => {
  const other = card.linkedCard;
  const frameDir = L._frame ?? 'split';
  const splitY = (1000 / 2100) * ch;

  // Draw each half's frame clipped to its region.
  // Each half may itself be multi-color (hybrid) — use horizontal gradient within that half.
  // Top half = other (right card), bottom half = card (left card).
  const frontCodes = card.frameColor.map(c => frameColorCode(c));
  const backCodes = other ? other.frameColor.map(c => frameColorCode(c)) : frontCodes;
  const frontAccent = card.accentColor.length > 0 ? card.accentColor.map(c => frameColorCode(c)) : undefined;
  const backAccent = other && other.accentColor.length > 0 ? other.accentColor.map(c => frameColorCode(c)) : frontAccent;

  // Draw each half's frame. For fuse, use Card Conjurer's top alpha mask so the
  // fuse strip stays attached to the correct half and the seam gets a soft fade.
  // Bottom half is drawn first as the base; top half is layered through the mask.
  // For non-fuse split, rect-clip is fine — the frame art has its own pinline at topH.
  const topH = Math.round(splitY);
  const isFuse = frameDir === 'fuse';
  const fuseTopMask = isFuse ? await loadAssetImage('masks/fuse-top.png') : null;

  if (fuseTopMask) {
    // Bottom half (card/left card) as full-canvas base
    const bottomCanvas = createCanvas(cw, ch);
    await drawFrame(bottomCanvas.getContext('2d'), frameDir, frontCodes, frontAccent, cw, ch, undefined, undefined,
      { horizontal: true, gradientRange: { start: topH, end: ch } });
    ctx.drawImage(bottomCanvas, 0, 0);

    // Top half (other/right card) masked over the base
    const topCanvas = createCanvas(cw, ch);
    await drawFrame(topCanvas.getContext('2d'), frameDir, backCodes, backAccent, cw, ch, undefined, undefined,
      { horizontal: true, gradientRange: { start: 0, end: topH } });
    const masked = createCanvas(cw, ch);
    const mCtx = masked.getContext('2d');
    mCtx.drawImage(fuseTopMask, 0, 0, cw, ch);
    mCtx.globalCompositeOperation = 'source-in';
    mCtx.drawImage(topCanvas, 0, 0);
    ctx.drawImage(masked, 0, 0);
  } else {
    // Top half (other/right card)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, topH);
    ctx.clip();
    await drawFrame(ctx, frameDir, backCodes, backAccent, cw, ch, undefined, undefined,
      { horizontal: true, gradientRange: { start: 0, end: topH } });
    ctx.restore();

    // Bottom half (card/left card)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, topH, cw, ch - topH);
    ctx.clip();
    await drawFrame(ctx, frameDir, frontCodes, frontAccent, cw, ch, undefined, undefined,
      { horizontal: true, gradientRange: { start: topH, end: ch } });
    ctx.restore();
  }

  // Draw art for both halves — user supplies landscape, we rotate -90° into portrait boxes
  const allowUnsafe = (L as any)._allowUnsafeArtUrls;
  if (card.artUrl) await drawArt(ctx, card.artUrl, SPLIT_LEFT_LAYOUT.art, cw, ch, { rotate: -90, allowUnsafe });
  if (other?.artUrl) await drawArt(ctx, other.artUrl, SPLIT_RIGHT_LAYOUT.art, cw, ch, { rotate: -90, allowUnsafe });

  // Render text for both halves, clipping each to its half
  await renderSplitText(ctx, card, SPLIT_LEFT_LAYOUT, cw, ch, splitY, ch);
  if (other) {
    await renderSplitText(ctx, other, SPLIT_RIGHT_LAYOUT, cw, ch, 0, splitY);
  }

  // Fuse reminder strip — spans across both halves along the read-bottom of the card.
  // Parser strips this line from abilities, so we re-render it from the canonical text here.
  if (isFuse && (L as any).fuseText) {
    drawWrappedAt(ctx, (L as any).fuseText, cw, ch,
      'Fuse (You may cast one or both halves of this card from your hand.)');
  }
};

export const splitHooks: TemplateHooks = {
  body: splitBody,
  skipStandardText: true,
  skipStandardFrame: true,
  prefetch: (card, _L, frame) => {
    const codes = new Set<string>(card.frameColor.map(c => frameColorCode(c)));
    card.accentColor.forEach(c => codes.add(frameColorCode(c)));
    const other = card.linkedCard;
    if (other) {
      other.frameColor.forEach(c => codes.add(frameColorCode(c)));
      other.accentColor.forEach(c => codes.add(frameColorCode(c)));
    }
    const paths: string[] = [];
    if (frame === 'fuse') paths.push('masks/fuse-top.png');
    for (const code of codes) {
      if (assetExists(`frames/${frame}/${code}.png`)) paths.push(`frames/${frame}/${code}.png`);
    }
    return paths;
  },
};
