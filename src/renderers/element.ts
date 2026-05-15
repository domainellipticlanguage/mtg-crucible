import type { SKRSContext2D } from '@napi-rs/canvas';

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
 * This removes the layout-level `_rotated` / `_rotationOriginY` system: every
 * element declares its own rotation, and pre-rotation `(x, y)` is a coordinate
 * on the tall canvas regardless of orientation.
 */

export interface LayoutElement {
  x: number;
  y: number;
  angle?: number;
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
 * callers can `await placeElement(...)`.
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
