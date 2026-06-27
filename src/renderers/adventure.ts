import type { Ctx, CanvasImage } from '../platform';
import { createCanvas, loadAssetImage } from '../platform';
import type { NormalizedCardData } from '../types';
import { drawSingleLineText, drawWrappedText } from '../text';
import { frameColorCode, drawGradientFrames } from '../helpers';
import { formatTypeLine } from '../parser';
import { drawNameAndMana } from './element';

/**
 * Horizontal extent of the bookLeft mask's alpha, as fractions of image width,
 * cached after the first scan (the mask never changes).
 */
let bookXFractionCache: { start: number; end: number } | null = null;

function bookXFraction(img: CanvasImage): { start: number; end: number } {
  if (bookXFractionCache) return bookXFractionCache;
  const c = createCanvas(img.width, img.height);
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const data = x.getImageData(0, 0, img.width, img.height).data;
  let minX = img.width, maxX = -1;
  for (let yy = 0; yy < img.height; yy++) {
    for (let xx = 0; xx < img.width; xx++) {
      if (data[(yy * img.width + xx) * 4 + 3] > 10) {
        if (xx < minX) minX = xx;
        if (xx > maxX) maxX = xx;
      }
    }
  }
  bookXFractionCache = maxX < 0 ? { start: 0, end: 1 } : { start: minX / img.width, end: (maxX + 1) / img.width };
  return bookXFractionCache;
}

/**
 * Recolor the adventure (lower-left book) region in the adventure spell's own
 * color(s). The standard pass already painted the whole frame — including both
 * books — in the creature's color; here we overdraw just the left book through
 * the bookLeft mask so the adventure half can differ from the creature.
 *
 * The mask is Card Conjurer's `bookLeft.png` (alpha covers x≈0.05–0.50,
 * y≈0.63–0.92). When the adventure color matches the creature this redraws the
 * identical book and is a no-op visually. For a multi-color adventure spell the
 * gradient is confined to the book's own x-extent (measured from the mask) so a
 * hybrid blends left→right *within* the book instead of across the whole card.
 */
async function drawAdventureBookFrame(
  ctx: Ctx, colorCodes: string[], cw: number, ch: number,
): Promise<void> {
  if (colorCodes.length === 0) return;
  const maskImg = await loadAssetImage('frames/adventure/bookLeft.png');
  if (!maskImg) return;

  // Confine a multi-color blend to the book's horizontal span.
  let gradientRange: { start: number; end: number } | undefined;
  if (colorCodes.length > 1) {
    const f = bookXFraction(maskImg);
    gradientRange = { start: f.start * cw, end: f.end * cw };
  }

  const frameCanvas = createCanvas(cw, ch);
  await drawGradientFrames(frameCanvas.getContext('2d'), 'adventure', colorCodes, cw, ch, false, gradientRange);

  const clipped = createCanvas(cw, ch);
  const clipCtx = clipped.getContext('2d');
  clipCtx.drawImage(maskImg, 0, 0, cw, ch);
  clipCtx.globalCompositeOperation = 'source-in';
  clipCtx.drawImage(frameCanvas, 0, 0);
  ctx.drawImage(clipped, 0, 0);
}

async function body(ctx: Ctx, card: NormalizedCardData, L: Record<string, any>, cw: number, ch: number): Promise<void> {
  const adv = card.linkedCard;
  if (!adv) return;

  // Adventure spell's frame color(s) in the left book region.
  await drawAdventureBookFrame(ctx, adv.frameColor.map(c => frameColorCode(c)), cw, ch);

  // Adventure name + mana cost (name width derived from the mana geometry)
  await drawNameAndMana(ctx, L.advName, L.advMana, cw, ch, adv.name ?? '', adv.manaCost, { color: 'white' });

  // Adventure type line
  const advTypeLine = formatTypeLine(adv.typeLine);
  drawSingleLineText(ctx, advTypeLine, L.advType.x * cw, L.advType.y * ch, L.advType.w * cw, L.advType.h * ch, L.advType.font, L.advType.size * ch, 'left', 'white');

  // Adventure rules text (left book area)
  let advRulesText: string | undefined;
  if (typeof adv.abilities === 'string') {
    advRulesText = adv.abilities;
  } else if (adv.abilities && typeof adv.abilities === 'object') {
    advRulesText = adv.abilities.unstructuredAbilities?.join('\n');
  }

  if (advRulesText) {
    const rx = L.advRules.x * cw;
    const ry = L.advRules.y * ch;
    const rw = L.advRules.w * cw;
    const rh = L.advRules.h * ch;
    const rs = L.advRules.size * ch;
    drawWrappedText(ctx, advRulesText, rx, ry, rw, rh, L.advRules.font, rs);
  }
}

export const adventureHooks = {
  body,
  prefetch: () => ['frames/adventure/bookLeft.png'],
};
