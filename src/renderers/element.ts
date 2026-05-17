import type { SKRSContext2D } from '@napi-rs/canvas';
import { drawSingleLineText, drawWrappedText, drawRulesAndFlavor, type ExclusionRect } from '../text';
import { drawManaCost, drawSetSymbol } from '../helpers';

/**
 * Layout-element convention.
 *
 * Every element in a layout JSON has `{ x, y, angle? }` plus any element-specific
 * fields (w, h, size, font, ...). The renderer interprets these uniformly:
 *
 *   (x, y)   — canvas position of the element's local upper-left,
 *              normalized to the tall-mode canvas dimensions (x → cw, y → ch).
 *   angle    — degrees, rotation about (x*cw, y*ch). Default 0.
 *   (w, h)   — element extents in its LOCAL frame (post-rotation). They are
 *              normalized to whichever canvas axis the local axis maps to:
 *                angle ≡ 0   (mod 180): w → cw, h → ch
 *                angle ≡ ±90 (mod 180): w → ch, h → cw
 *              i.e. the "width" axis is always the dimension the local-x axis
 *              points along in canvas space. Font `size` stays normalized to ch
 *              for all angles (font size is unaffected by orientation).
 *
 * Renderers call the element-aware wrappers below (`drawSingleLineAt`,
 * `drawWrappedAt`, etc.) — one call per layout element. The wrappers translate
 * to the anchor, rotate, and invoke the underlying pixel primitive. The
 * `placeElement` callback form is exported but should be used only when a draw
 * doesn't fit one of the wrappers.
 */

export interface LayoutElement {
  x: number;
  y: number;
  angle?: number;
}

export interface RectElement extends LayoutElement {
  w: number;
  h: number;
  size: number;
  font: string;
}

export interface ManaElement extends LayoutElement {
  size: number;
  shadowX: number;
  shadowY: number;
}

export interface SetSymbolElement extends LayoutElement {
  h: number;
}

/** Normalization multipliers for the LOCAL-frame extents of an element. */
export function localDims(angle: number, cw: number, ch: number): { wDim: number; hDim: number } {
  const a = ((angle % 360) + 360) % 360;
  // Quarter-turn rotations swap the dimension a w/h fraction is measured against.
  if (a === 90 || a === 270) return { wDim: ch, hDim: cw };
  return { wDim: cw, hDim: ch };
}

/**
 * Place the canvas at an element's anchor (translate to its (x, y) and rotate
 * by its angle) and run `draw` inside that local frame. The draw callback
 * receives the local-frame normalization multipliers so it can size its content.
 *
 * If `draw` returns a Promise, the restore is deferred until it resolves —
 * callers can `await placeElement(...)`. Most callers should use the wrappers
 * below instead of touching `placeElement` directly.
 */
export function placeElement(
  ctx: SKRSContext2D,
  el: LayoutElement,
  cw: number,
  ch: number,
  draw: (dims: { wDim: number; hDim: number }) => unknown,
): void | Promise<void> {
  const angle = el.angle ?? 0;
  ctx.save();
  ctx.translate(el.x * cw, el.y * ch);
  if (angle !== 0) ctx.rotate((angle * Math.PI) / 180);
  const result = draw(localDims(angle, cw, ch));
  if (result && typeof (result as Promise<unknown>).then === 'function') {
    return (result as Promise<unknown>).then(() => undefined).finally(() => ctx.restore());
  }
  ctx.restore();
}

// ─── Element-aware drawing wrappers ──────────────────────────────────────────
//
// Each wrapper takes (ctx, el, cw, ch, content, opts?) and handles the
// translate/rotate dance internally. Call sites become a single line per
// element with no callback or destructure ceremony.

/** Single-line text inside an element box. `shrinkBy` (pixels) trims the right
 *  side of the available width — used by name fields that share their bar with
 *  the mana cost. */
export function drawSingleLineAt(
  ctx: SKRSContext2D,
  el: RectElement,
  cw: number,
  ch: number,
  text: string,
  opts: {
    align?: 'left' | 'center' | 'right';
    color?: string;
    shrinkBy?: number;
  } = {},
): void {
  placeElement(ctx, el, cw, ch, ({ wDim, hDim }) => {
    const w = el.w * wDim - (opts.shrinkBy ?? 0);
    drawSingleLineText(ctx, text, 0, 0, w, el.h * hDim,
      el.font, el.size * ch,
      opts.align ?? 'left', opts.color ?? 'black');
  });
}

/** Wrapped text inside an element box. `italic` switches to MPlantin Italic
 *  (used for flavor-only text). */
export function drawWrappedAt(
  ctx: SKRSContext2D,
  el: RectElement,
  cw: number,
  ch: number,
  text: string,
  opts: {
    italic?: boolean;
    exclusionRects?: ExclusionRect[];
  } = {},
): void {
  placeElement(ctx, el, cw, ch, ({ wDim, hDim }) => {
    drawWrappedText(ctx, text, 0, 0, el.w * wDim, el.h * hDim,
      el.font, el.size * ch,
      {
        fontFamily: opts.italic ? 'MPlantin Italic' : undefined,
        exclusionRects: opts.exclusionRects,
      });
  });
}

/** Rules text with a flavor divider below. */
export function drawRulesAndFlavorAt(
  ctx: SKRSContext2D,
  el: RectElement,
  cw: number,
  ch: number,
  rules: string,
  flavor: string,
  exclusionRects: ExclusionRect[] = [],
): void {
  placeElement(ctx, el, cw, ch, ({ wDim, hDim }) => {
    drawRulesAndFlavor(ctx, rules, flavor, 0, 0, el.w * wDim, el.h * hDim,
      el.font, el.size * ch, exclusionRects);
  });
}

/** Right-aligned mana cost at an anchor. */
export async function drawManaCostAt(
  ctx: SKRSContext2D,
  el: ManaElement,
  cw: number,
  ch: number,
  manaStr: string,
): Promise<void> {
  await placeElement(ctx, el, cw, ch, () =>
    drawManaCost(ctx, manaStr, cw, ch, {
      y: 0, w: 0,
      size: el.size, shadowX: el.shadowX, shadowY: el.shadowY,
    }));
}

/** Set symbol image at an anchor (right-edge x, vertical-center y). */
export async function drawSetSymbolAt(
  ctx: SKRSContext2D,
  el: SetSymbolElement,
  cw: number,
  ch: number,
  rarity: string,
): Promise<void> {
  // drawSetSymbol's signature is (ctx, rarity, layout, ch, cw); pass ch then cw.
  await placeElement(ctx, el, cw, ch, () =>
    drawSetSymbol(ctx, rarity, { x: 0, y: 0, w: 0, h: el.h }, ch, cw));
}
