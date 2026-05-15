/**
 * One-shot migration: rewrites every rotated layout JSON to the new
 * `{ x, y, angle }` convention.
 *
 *   npx tsx scripts/migrate-layouts.ts
 *
 * Convention (see src/renderers/element.ts for the runtime contract):
 *   - Every element has (x, y, angle?). (x, y) is the element's local anchor
 *     point on the tall canvas, normalized to (cw, ch). `angle` defaults to 0.
 *   - For rectangular elements (name, type, rules, pt, ability, art, ...),
 *     the anchor is the local upper-left. (w, h) are extents in the local
 *     frame; under ±90° rotations the local-x axis points along canvas-y, so
 *     w → ch and h → cw (the helper `placeElement` exposes the right factor).
 *   - For right-aligned anchor elements (mana cost, set symbol), (x, y) is
 *     the canvas position of the right-edge / vertical-center anchor.
 *
 * This script rewrites:
 *   - split_left.json, split_right.json  (was _rotated, -90°)
 *   - fuse.json                          (already migrated by hand)
 *   - room.json (door1, door2)           (was _rotated, -90°)
 *   - aftermath_bottom.json              (renderer rotates +90°)
 *   - flip.json (name2/type2/rules2/pt2) (renderer rotates +180°)
 *
 * Unrotated layouts get no edits — `angle` defaults to 0 for those elements.
 */

import * as fs from 'fs';
import * as path from 'path';

const LAYOUT_DIR = path.resolve(__dirname, '..', 'src', 'layouts');

// Card dimensions for the rotated layouts (all are PW_W × PW_H).
const CW = 1500;
const CH = 2100;
// Multiplication order matters for FP exactness: prefer `v * CW / CH` over
// `v * (CW / CH)`, since the latter pre-computes a rounded ratio.
const scaleWH = (v: number) => (v * CW) / CH;
const scaleHW = (v: number) => (v * CH) / CW;

type AnyEl = Record<string, unknown>;

function isObject(v: unknown): v is AnyEl {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function readJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p: string, obj: any) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}

/** Keep full float precision — JSON.stringify on a JS number emits the
 *  shortest decimal that round-trips, so we don't need (and shouldn't add)
 *  manual rounding here. `.toFixed(16)` previously dropped the 17th digit,
 *  which broke exact multiplication back to canvas pixels. */
function round(n: number): number {
  return n;
}

// ---------- Helpers per element kind, parameterized by the OLD rotation ----------

/** Rect element (name, type, rules, pt, ability, ...) inside a -90° outer
 *  rotation about (0, origin*ch). Was placed at local ((y - origin)*ch, x*cw);
 *  canvas UL = (x*cw, (2*origin - y)*ch). */
function migrateMinus90Rect(el: AnyEl, origin: number): AnyEl {
  const out: AnyEl = { ...el };
  if (typeof el.y === 'number') out.y = round(2 * origin - el.y);
  out.angle = -90;
  return out;
}

/** Mana element inside a -90° outer rotation. OLD had (y, w) where w was the
 *  right-edge along local-x (= ch axis) and y was the local-y position
 *  (= cw axis). In the new no-swap renderer, (x, y) is the canvas anchor and
 *  size / shadows are pixel-equivalents. */
function migrateMinus90Mana(el: AnyEl, origin: number): AnyEl {
  const out: AnyEl = { ...el };
  if (typeof el.y === 'number' && typeof el.w === 'number') {
    out.x = round(el.y as number);
    out.y = round(origin - (el.w as number));
    delete out.w;
  }
  if (typeof el.size === 'number') out.size = round(scaleWH(el.size as number));
  if (typeof el.shadowX === 'number') out.shadowX = round(scaleHW(el.shadowX as number));
  if (typeof el.shadowY === 'number') out.shadowY = round(scaleWH(el.shadowY as number));
  out.angle = -90;
  return out;
}

/** SetSymbol inside a -90° outer rotation. OLD called drawSetSymbol with
 *  swapped (cw, ch); x was the local right edge (along ch), y was the local
 *  vertical center (along cw), h was normalized to local height (cw).
 *  Canvas anchor = (y_old, origin - x_old). h_new = h_old * cw/ch. */
function migrateMinus90SetSymbol(el: AnyEl, origin: number): AnyEl {
  const out: AnyEl = { ...el };
  if (typeof el.y === 'number') out.x = round(el.y as number);
  if (typeof el.x === 'number') out.y = round(origin - (el.x as number));
  if (typeof el.h === 'number') out.h = round(scaleWH(el.h as number));
  out.angle = -90;
  return out;
}

function migrateMinus90Half(layout: any) {
  const origin = layout._rotationOriginY as number;
  delete layout._rotated;
  delete layout._rotationOriginY;
  for (const key of Object.keys(layout)) {
    const el = layout[key];
    if (!isObject(el)) continue;
    // `art` is always laid out in unrotated canvas coords — drawArt handles
    // image rotation via its `rotate` option. Skip it.
    if (key === 'art') continue;
    if (key === 'mana') layout[key] = migrateMinus90Mana(el, origin);
    else if (key === 'setSymbol') layout[key] = migrateMinus90SetSymbol(el, origin);
    else layout[key] = migrateMinus90Rect(el, origin);
  }
}

// ---------- aftermath_bottom (+90° about name anchor) ----------

/** aftermath_bottom mana: OLD swap convention with anchor relative to the
 *  bottom-half's name anchor (name.x, name.y). Canvas anchor =
 *  (name.x - mana.y, name.y + mana.w). */
function migrateAftermathBottomMana(el: AnyEl, name: AnyEl): AnyEl {
  const out: AnyEl = { ...el };
  if (typeof el.y === 'number' && typeof el.w === 'number'
      && typeof name.x === 'number' && typeof name.y === 'number') {
    out.x = round((name.x as number) - (el.y as number));
    out.y = round((name.y as number) + (el.w as number));
    delete out.w;
  }
  if (typeof el.size === 'number') out.size = round(scaleWH(el.size as number));
  if (typeof el.shadowX === 'number') out.shadowX = round(scaleHW(el.shadowX as number));
  if (typeof el.shadowY === 'number') out.shadowY = round(scaleWH(el.shadowY as number));
  out.angle = 90;
  return out;
}

function migrateAftermathBottom() {
  const file = path.join(LAYOUT_DIR, 'aftermath_bottom.json');
  const layout = readJson(file);
  const name = layout.name;
  for (const key of Object.keys(layout)) {
    const el = layout[key];
    if (!isObject(el)) continue;
    if (key === 'art') continue; // unrotated (drawn by standard pipeline)
    if (key === 'mana') {
      layout[key] = migrateAftermathBottomMana(el, name);
    } else {
      el.angle = 90;
    }
  }
  writeJson(file, layout);
  console.log(`✓ ${path.basename(file)}`);
}

// ---------- flip face-2 (180° about (cw, ch)) ----------

function migrateFlip() {
  const file = path.join(LAYOUT_DIR, 'flip.json');
  const layout = readJson(file);
  for (const key of ['name2', 'type2', 'rules2', 'pt2']) {
    const el = layout[key];
    if (isObject(el)) el.angle = 180;
  }
  writeJson(file, layout);
  console.log(`✓ ${path.basename(file)}`);
}

// ---------- room (each door is a sub-layout with its own -90° rotation) ----------

function migrateRoom() {
  const file = path.join(LAYOUT_DIR, 'room.json');
  const layout = readJson(file);
  for (const doorKey of ['door1', 'door2']) {
    const door = layout[doorKey];
    if (!isObject(door) || !door._rotated) continue;
    migrateMinus90Half(door);
  }
  writeJson(file, layout);
  console.log(`✓ ${path.basename(file)}`);
}

// ---------- top-level rotated layouts (split_left, split_right) ----------

function migrateTopLevelRotated(name: string) {
  const file = path.join(LAYOUT_DIR, name);
  const layout = readJson(file);
  if (!layout._rotated) {
    console.log(`–  ${name}  (already migrated)`);
    return;
  }
  migrateMinus90Half(layout);
  writeJson(file, layout);
  console.log(`✓ ${name}`);
}

function main() {
  migrateTopLevelRotated('split_left.json');
  migrateTopLevelRotated('split_right.json');
  migrateTopLevelRotated('fuse.json');
  migrateRoom();
  migrateAftermathBottom();
  migrateFlip();
}

main();
