import type { Ctx } from '../platform';
import { createCanvas, loadAssetImage } from '../platform';
import type { NormalizedCardData } from '../types';
import { drawSingleLineText, drawWrappedText } from '../text';
import { frameColorCode, drawGradientFrames } from '../helpers';
import { formatTypeLine } from '../parser';
import { drawNameAndMana } from './element';

/** Draw an omen-dir frame in the given colors, clipped through a mask file, onto ctx. */
async function drawMaskedOmenFrame(
  ctx: Ctx, colorCodes: string[], maskFilename: string, cw: number, ch: number,
): Promise<void> {
  if (colorCodes.length === 0) return;
  const maskImg = await loadAssetImage(`masks/${maskFilename}`);
  if (!maskImg) return;

  const frameCanvas = createCanvas(cw, ch);
  await drawGradientFrames(frameCanvas.getContext('2d'), 'omen', colorCodes, cw, ch);

  const clipped = createCanvas(cw, ch);
  const clipCtx = clipped.getContext('2d');
  clipCtx.drawImage(maskImg, 0, 0, cw, ch);
  clipCtx.globalCompositeOperation = 'source-in';
  clipCtx.drawImage(frameCanvas, 0, 0);
  ctx.drawImage(clipped, 0, 0);
}

async function body(ctx: Ctx, card: NormalizedCardData, L: Record<string, any>, cw: number, ch: number): Promise<void> {
  const omen = card.linkedCard;
  if (!omen) return;

  // Main card's accent color through the omen-main pinline mask
  if (card.accentColor.length > 0) {
    const accentCodes = card.accentColor.map(c => frameColorCode(c));
    await drawMaskedOmenFrame(ctx, accentCodes, 'omen-main-pinline.png', cw, ch);
  }

  // Omen spell's frame color(s) in the omen region
  const omenCodes = omen.frameColor.map(c => frameColorCode(c));
  await drawMaskedOmenFrame(ctx, omenCodes, 'omen-mask.png', cw, ch);

  await drawNameAndMana(ctx, L.omenName, L.omenMana, cw, ch, omen.name ?? '', omen.manaCost, { color: 'white' });

  const omenTypeLine = formatTypeLine(omen.typeLine);
  drawSingleLineText(ctx, omenTypeLine, L.omenType.x * cw, L.omenType.y * ch, L.omenType.w * cw, L.omenType.h * ch, L.omenType.font, L.omenType.size * ch, 'left', 'white');

  let omenRulesText: string | undefined;
  if (typeof omen.abilities === 'string') {
    omenRulesText = omen.abilities;
  } else if (omen.abilities && typeof omen.abilities === 'object') {
    omenRulesText = omen.abilities.unstructuredAbilities?.join('\n');
  }

  if (omenRulesText) {
    const rx = L.omenRules.x * cw;
    const ry = L.omenRules.y * ch;
    const rw = L.omenRules.w * cw;
    const rh = L.omenRules.h * ch;
    const rs = L.omenRules.size * ch;
    drawWrappedText(ctx, omenRulesText, rx, ry, rw, rh, L.omenRules.font, rs);
  }
}

export const omenHooks = {
  body,
  prefetch: () => ['masks/omen-main-pinline.png', 'masks/omen-mask.png'],
};
