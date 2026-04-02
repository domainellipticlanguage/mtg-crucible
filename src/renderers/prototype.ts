import * as fs from 'fs';
import * as path from 'path';
import { loadImage, type SKRSContext2D } from '@napi-rs/canvas';
import type { NormalizedCardData, PrototypeAbilities } from '../types';
import { drawSingleLineText, drawWrappedText } from '../text';
import { drawManaCost } from '../helpers';
import { ASSETS_DIR } from '../assets-dir';
import { getParsedAbilities } from '../parser';
import type { TemplateHooks, AnyLayout } from './render';

/**
 * Prototype card renderer hook.
 *
 * Draws full-card overlay images (rules box, mana cost bar, PT box) in the
 * prototype color, then renders text on top. Overlay color is derived from
 * the prototype's mana cost.
 */

/** Extract the primary color from a mana cost string like "{1}{B}{B}" → 'B' */
function protoColorFromCost(manaCost: string): string {
  const colors = manaCost.match(/\{([WUBRG])\}/gi);
  if (!colors || colors.length === 0) return 'M';
  return colors[0].slice(1, -1).toUpperCase();
}

/** Pick "short" or "long" mana cost overlay based on symbol count */
function manaCostVariant(manaCost: string): string {
  const symbols = manaCost.match(/\{[^}]+\}/g) ?? [];
  return symbols.length > 2 ? 'manaCostLong' : 'manaCost';
}

const protoBody: TemplateHooks['body'] = async (ctx, card, L, cw, ch) => {
  const pa = getParsedAbilities(card);
  if (pa.structuredAbilities?.kind !== 'prototype') return;

  const proto = (pa.structuredAbilities as PrototypeAbilities).prototype;
  const protoColor = protoColorFromCost(proto.manaCost);

  // Full-card overlay images (rules box, mana cost bar, PT box)
  const overlays = [
    `rules${protoColor}.png`,
    `${manaCostVariant(proto.manaCost)}${protoColor}.png`,
    `pt${protoColor}.png`,
  ];
  for (const file of overlays) {
    const p = path.join(ASSETS_DIR, 'frames', 'prototype', file);
    if (fs.existsSync(p)) {
      ctx.drawImage(await loadImage(p), 0, 0, cw, ch);
    }
  }

  // Prototype mana cost (right-aligned in the prototype mana bar)
  if (proto.manaCost) {
    await drawManaCost(ctx, proto.manaCost, cw, ch, L.protoMana);
  }

  // Prototype label + reminder text
  const pr = L.protoRules;
  drawWrappedText(
    ctx,
    'Prototype (You may cast this spell with different mana cost, color, and size. It keeps its abilities and types.)',
    pr.x * cw, pr.y * ch, pr.w * cw, pr.h * ch, pr.font, pr.size * ch,
    { fontFamily: 'MPlantin' },
  );

  // Prototype P/T
  const pp = L.protoPt;
  drawSingleLineText(ctx, `${proto.power}/${proto.toughness}`, pp.x * cw, pp.y * ch, pp.w * cw, pp.h * ch, pp.font, pp.size * ch, 'center', 'white');
};

export const prototypeHooks: TemplateHooks = { body: protoBody };
