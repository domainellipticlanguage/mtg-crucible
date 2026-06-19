import { createCanvas, loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import type { NormalizedCardData } from '../types';
import { drawSingleLineText, drawWrappedText, drawRulesAndFlavor } from '../text';
import { drawManaCost, frameColorCode, drawGradientFrames } from '../helpers';
import { formatTypeLine } from '../parser';
import { ASSETS_DIR } from '../assets-dir';

/** Draw a prepare-dir frame in the given colors, clipped through a mask file, onto ctx. */
async function drawMaskedPrepareFrame(
  ctx: SKRSContext2D, colorCodes: string[], maskFilename: string, cw: number, ch: number,
): Promise<void> {
  if (colorCodes.length === 0) return;
  const maskPath = path.join(ASSETS_DIR, 'masks', maskFilename);
  if (!fs.existsSync(maskPath)) return;

  const frameCanvas = createCanvas(cw, ch);
  await drawGradientFrames(frameCanvas.getContext('2d'), 'prepare', colorCodes, cw, ch);

  const clipped = createCanvas(cw, ch);
  const clipCtx = clipped.getContext('2d');
  clipCtx.drawImage(await loadImage(maskPath), 0, 0, cw, ch);
  clipCtx.globalCompositeOperation = 'source-in';
  clipCtx.drawImage(frameCanvas, 0, 0);
  ctx.drawImage(clipped, 0, 0);
}

async function body(ctx: SKRSContext2D, card: NormalizedCardData, L: Record<string, any>, cw: number, ch: number): Promise<void> {
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

  // The prep name field ends well left of the right-justified mana cost, so they
  // don't share space — no need to shrink the name to make room for the mana.
  drawSingleLineText(ctx, prep.name ?? '', L.prepName.x * cw, L.prepName.y * ch, L.prepName.w * cw, L.prepName.h * ch, L.prepName.font, L.prepName.size * ch, 'left', 'white');

  if (prep.manaCost) {
    await drawManaCost(ctx, prep.manaCost, cw, ch, L.prepMana);
  }

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
