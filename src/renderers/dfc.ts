import type { SKRSContext2D } from '@napi-rs/canvas';
import type { CardData } from '../types';
import { drawSingleLineText, drawWrappedText } from '../text';
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

function getFlipsideHint(card: CardData): string {
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
  if (!L.flipsideType || !card.linkedCard) return;
  const other = card.linkedCard;

  const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const isCreature = other.types?.includes('creature');
  const shortType = isCreature
    ? `${other.power}/${other.toughness} Creature`
    : titleCase(other.subtypes?.[0] ?? other.types?.[0] ?? '');
  const hint = getFlipsideHint(other);

  const hintColor = L.flipsideType.color ?? 'white';
  const R = L.flipsideReminder ?? L.flipsideType;

  if (hint) {
    // Land back face: show "Type  ability" as a single line with mana symbols rendered
    const hintText = `${shortType}  ${hint}`;
    drawWrappedText(ctx, hintText, R.x * cw, R.y * ch, R.w * cw, R.h * ch, R.font, R.size * ch, { color: hintColor });
  } else {
    // Spell face: show type on left
    drawSingleLineText(ctx, shortType, R.x * cw, R.y * ch, R.w * cw, R.h * ch, R.font, R.size * ch, 'left', hintColor);
  }

  // For spell faces (with mana cost), render mana symbols on the right
  if (other.manaCost && L.flipsideReminder) {
    await drawManaCost(ctx, other.manaCost, cw, ch, {
      y: L.flipsideReminder.y,
      w: (L.flipsideReminder.x + L.flipsideReminder.w),
      size: L.flipsideReminder.size,
      shadowX: 0,
      shadowY: 0,
    });
  }
};

export const mdfcHooks: TemplateHooks = { body: mdfcBody };
