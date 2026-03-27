import type { SKRSContext2D } from '@napi-rs/canvas';
import type { NormalizedCardData } from '../types';
import { drawSingleLineText } from '../text';

async function body(ctx: SKRSContext2D, card: NormalizedCardData, L: Record<string, any>, cw: number, ch: number): Promise<void> {
  // Defense value
  if (L.defense) {
    drawSingleLineText(ctx, card.battleDefense ?? '0',
      L.defense.x * cw, L.defense.y * ch, L.defense.w * cw, L.defense.h * ch,
      L.defense.font, L.defense.size * ch, 'center', 'white');
  }

  // Back face P/T (shown on battle front when back transforms into a creature)
  if (L.backPt && card.linkedCard?.power && card.linkedCard?.toughness) {
    drawSingleLineText(ctx, `${card.linkedCard.power}/${card.linkedCard.toughness}`,
      L.backPt.x * cw, L.backPt.y * ch, L.backPt.w * cw, L.backPt.h * ch,
      L.backPt.font, L.backPt.size * ch, 'center', 'black');
  }
}

export const battleHooks = { body };
