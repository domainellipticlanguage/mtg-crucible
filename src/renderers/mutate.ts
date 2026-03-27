import { type SKRSContext2D } from '@napi-rs/canvas';
import type { NormalizedCardData, MutateAbilities } from '../types';
import { drawWrappedText } from '../text';
import { getParsedAbilities } from '../parser';
import type { TemplateHooks, AnyLayout } from './render';

/**
 * Mutate card renderer hook.
 *
 * Reads the mutate cost from structuredAbilities and renders it in the
 * mutate cost bar between the type line and rules text. The remaining
 * abilities are rendered in the standard rules area by the main pipeline.
 */

const mutateBody: TemplateHooks['body'] = async (ctx, card, L, cw, ch) => {
  const mc = L.mutateCost;
  if (!mc) return;

  const pa = getParsedAbilities(card);
  if (pa.structuredAbilities?.kind !== 'mutate') return;

  const mutateCost = (pa.structuredAbilities as MutateAbilities).mutateCost;
  const mutateLine = `Mutate ${mutateCost}`;

  // Draw the mutate cost text in the mutate bar
  drawWrappedText(ctx, mutateLine, mc.x * cw, mc.y * ch, mc.w * cw, mc.h * ch, mc.font, mc.size * ch);
};

export const mutateHooks: TemplateHooks = { body: mutateBody };
