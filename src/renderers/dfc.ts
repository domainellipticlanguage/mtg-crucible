import type { SKRSContext2D } from '@napi-rs/canvas';
import type { NormalizedCardData } from '../types';
import { drawSingleLineText, measureRichText, drawRichLine } from '../text';
import { drawManaCost } from '../helpers';
import { getParsedAbilities } from '../parser';
import type { TemplateHooks } from './render';

// ── Transform front ──────────────────────────────────────────────────
// Shows the back face's P/T as a small gray hint at the bottom-right of the rules area.

const transformFrontBody: TemplateHooks['body'] = async (ctx, card, L, cw, ch) => {
  if (!L.reversePt || !card.linkedCard) return;
  const back = card.linkedCard;
  if (!back.power && !back.toughness) return;
  const ptText = `${back.power}/${back.toughness}`;
  drawSingleLineText(ctx, ptText, L.reversePt.x * cw, L.reversePt.y * ch, L.reversePt.w * cw, L.reversePt.h * ch, L.reversePt.font, L.reversePt.size * ch, 'right', '#666');
};

export const transformFrontHooks: TemplateHooks = { body: transformFrontBody };

// ── Transform back ───────────────────────────────────────────────────

export const transformBackHooks: TemplateHooks = {};

// ── Modal DFC (both faces) ───────────────────────────────────────────
// Shows the other face's type line and mana cost or ability hint at the bottom.

function getFlipsideHint(card: NormalizedCardData): string {
  // For lands (no mana cost), show the tap/mana ability as a compact hint
  if (!card.manaCost) {
    const pa = getParsedAbilities(card);
    const abilities = pa.unstructuredAbilities;
    if (abilities && abilities.length > 0) {
      // Prefer the shortest mana-producing ability (e.g. "{T}: Add {W}.")
      const tapAbility = abilities.find(a => a.includes('{T}'));
      return tapAbility ?? abilities[abilities.length - 1];
    }
  }
  return '';
}

const mdfcBody: TemplateHooks['body'] = async (ctx, card, L, cw, ch) => {
  if (!L.flipside || !card.linkedCard) return;
  const other = card.linkedCard;
  const F = L.flipside;

  const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const isCreature = other.typeLine.types.includes('creature');
  const shortType = isCreature
    ? `${other.power}/${other.toughness} Creature`
    : titleCase(other.typeLine.subtypes[0] ?? other.typeLine.types[0] ?? '');
  const hint = getFlipsideHint(other);

  const hintColor = F.color ?? 'white';
  const rightText = other.manaCost || hint;
  const boxX = F.x * cw, boxY = F.y * ch, boxW = F.w * cw, boxH = F.h * ch;
  const gap = boxW * 0.05;

  // Shrink text size until both sides fit
  let textSize = F.size * ch;
  while (textSize > 1) {
    ctx.font = `${textSize}px "${F.font}"`;
    const leftW = ctx.measureText(shortType).width;
    const rightW = rightText ? measureRichText(ctx, rightText, textSize) : 0;
    if (leftW + rightW + gap <= boxW) break;
    textSize -= 1;
  }

  const baselineY = boxY + (boxH - textSize * 0.85) / 2 + textSize * 0.7;

  // Type on the left
  ctx.font = `${textSize}px "${F.font}"`;
  ctx.fillStyle = hintColor;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(shortType, boxX, baselineY);

  // Mana cost or land ability on the right (with mana symbols)
  if (rightText) {
    const rightW = measureRichText(ctx, rightText, textSize);
    drawRichLine(ctx, rightText, boxX + boxW - rightW, baselineY, textSize);
  }
};

export const mdfcHooks: TemplateHooks = { body: mdfcBody };
