import type { Ctx } from '../platform';
import { createCanvas, loadAssetImage } from '../platform';
import type { NormalizedCardData } from '../types';
import { drawSingleLineText, drawWrappedText, drawRulesAndFlavor } from '../text';
import { frameColorCode, drawGradientFrames } from '../helpers';
import { formatTypeLine } from '../parser';
import { drawNameAndMana } from './element';

/** Draw a prepare-dir frame in the given colors, clipped through a mask file, onto ctx. */
async function drawMaskedPrepareFrame(
  ctx: Ctx, colorCodes: string[], maskFilename: string, cw: number, ch: number,
): Promise<void> {
  if (colorCodes.length === 0) return;
  const maskImg = await loadAssetImage(`masks/${maskFilename}`);
  if (!maskImg) return;

  const frameCanvas = createCanvas(cw, ch);
  await drawGradientFrames(frameCanvas.getContext('2d'), 'prepare', colorCodes, cw, ch);

  const clipped = createCanvas(cw, ch);
  const clipCtx = clipped.getContext('2d');
  clipCtx.drawImage(maskImg, 0, 0, cw, ch);
  clipCtx.globalCompositeOperation = 'source-in';
  clipCtx.drawImage(frameCanvas, 0, 0);
  ctx.drawImage(clipped, 0, 0);
}

async function body(ctx: Ctx, card: NormalizedCardData, L: Record<string, any>, cw: number, ch: number): Promise<void> {
  const prep = card.linkedCard;
  if (!prep) return;

  // Main card's accent color through the prepare-main pinline mask
  if (card.accentColor.length > 0) {
    const accentCodes = card.accentColor.map(c => frameColorCode(c));
    await drawMaskedPrepareFrame(ctx, accentCodes, 'prepare-main-pinline.png', cw, ch);
  }

  // Prepare spell's frame color(s) in the prepare region
  const prepCodes = prep.frameColor.map(c => frameColorCode(c));
  await drawMaskedPrepareFrame(ctx, prepCodes, 'prepare-mask.png', cw, ch);

  await drawNameAndMana(ctx, L.prepName, L.prepMana, cw, ch, prep.name ?? '', prep.manaCost, { color: 'white' });

  const prepTypeLine = formatTypeLine(prep.typeLine);
  drawSingleLineText(ctx, prepTypeLine, L.prepType.x * cw, L.prepType.y * ch, L.prepType.w * cw, L.prepType.h * ch, L.prepType.font, L.prepType.size * ch, 'left', 'white');

  let prepRulesText: string | undefined;
  if (typeof prep.abilities === 'string') {
    prepRulesText = prep.abilities;
  } else if (prep.abilities && typeof prep.abilities === 'object') {
    prepRulesText = prep.abilities.unstructuredAbilities?.join('\n');
  }

  const rx = L.prepRules.x * cw;
  const ry = L.prepRules.y * ch;
  const rw = L.prepRules.w * cw;
  const rh = L.prepRules.h * ch;
  const rs = L.prepRules.size * ch;
  if (prepRulesText && prep.flavorText) {
    drawRulesAndFlavor(ctx, prepRulesText, prep.flavorText, rx, ry, rw, rh, L.prepRules.font, rs);
  } else if (prepRulesText) {
    drawWrappedText(ctx, prepRulesText, rx, ry, rw, rh, L.prepRules.font, rs);
  } else if (prep.flavorText) {
    drawWrappedText(ctx, prep.flavorText, rx, ry, rw, rh, L.prepRules.font, rs, { fontFamily: 'MPlantin Italic' });
  }
}

export const prepareHooks = { body };
