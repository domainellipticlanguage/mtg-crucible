import type { SKRSContext2D } from '@napi-rs/canvas';
import type { CardData } from '../types';
import { drawSingleLineText } from '../text';

async function body(ctx: SKRSContext2D, card: CardData, L: Record<string, any>, cw: number, ch: number): Promise<void> {
  // Defense value
  if (L.defense) {
    drawSingleLineText(ctx, card.battleDefense ?? '0',
      L.defense.x * cw, L.defense.y * ch, L.defense.w * cw, L.defense.h * ch,
      L.defense.font, L.defense.size * ch, 'center', 'white');
  }
}

export const battleHooks = { body };
