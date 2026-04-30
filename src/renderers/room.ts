import { type SKRSContext2D } from '@napi-rs/canvas';
import type { NormalizedCardData } from '../types';
import { drawSingleLineText, drawWrappedText } from '../text';
import { drawManaCost, measureManaCostWidth } from '../helpers';
import { formatTypeLine, getParsedAbilities } from '../parser';

/**
 * Room renderer. The primary card's text (door 1) is drawn by the standard pipeline
 * via the layout's name/mana/type/rules entries. This body hook draws door 2 only.
 */
async function body(ctx: SKRSContext2D, card: NormalizedCardData, L: Record<string, any>, cw: number, ch: number): Promise<void> {
  const door2 = card.linkedCard;
  if (!door2) return;

  const door2ManaW = door2.manaCost ? measureManaCostWidth(door2.manaCost, ch, L.door2Mana.size) : 0;
  const door2NameW = L.door2Name.w * cw - door2ManaW;
  drawSingleLineText(ctx, door2.name ?? '', L.door2Name.x * cw, L.door2Name.y * ch, door2NameW, L.door2Name.h * ch, L.door2Name.font, L.door2Name.size * ch, 'left', 'black');

  if (door2.manaCost) {
    await drawManaCost(ctx, door2.manaCost, cw, ch, L.door2Mana);
  }

  drawSingleLineText(ctx, formatTypeLine(door2.typeLine), L.door2Type.x * cw, L.door2Type.y * ch, L.door2Type.w * cw, L.door2Type.h * ch, L.door2Type.font, L.door2Type.size * ch, 'left', 'black');

  const pa = getParsedAbilities(door2);
  const rulesText = pa.unstructuredAbilities?.join('\n');
  if (rulesText) {
    drawWrappedText(ctx, rulesText, L.door2Rules.x * cw, L.door2Rules.y * ch, L.door2Rules.w * cw, L.door2Rules.h * ch, L.door2Rules.font, L.door2Rules.size * ch);
  }
}

export const roomHooks = { body };
