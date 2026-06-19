import { type SKRSContext2D } from '@napi-rs/canvas';
import type { NormalizedCardData } from '../types';
import { drawSingleLineText, drawWrappedText } from '../text';
import { formatTypeLine } from '../parser';
import { drawNameAndMana } from './element';

async function body(ctx: SKRSContext2D, card: NormalizedCardData, L: Record<string, any>, cw: number, ch: number): Promise<void> {
  const adv = card.linkedCard;
  if (!adv) return;

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

export const adventureHooks = { body };
