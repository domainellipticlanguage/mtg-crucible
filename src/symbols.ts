import type { CanvasImage } from './platform';
import { loadAssetImage } from './platform';
import { SYMBOL_MANIFEST, SYMBOL_PATHS } from './symbol-manifest';

const manaCache = new Map<string, CanvasImage | null>();

/** Resolve a normalized symbol key to its asset path via the static manifest. */
function symbolPath(key: string): string | null {
  return SYMBOL_MANIFEST[key] ?? null;
}

function normalizeKey(symbol: string): string {
  return symbol.toLowerCase().replace(/\//g, '').replace(/∞|infinity/g, 'inf');
}

export async function loadManaSymbol(symbol: string): Promise<CanvasImage | null> {
  const key = normalizeKey(symbol);
  if (manaCache.has(key)) return manaCache.get(key)!;
  const rel = symbolPath(key);
  if (!rel) { manaCache.set(key, null); return null; }
  const img = await loadAssetImage(rel);
  manaCache.set(key, img);
  return img;
}

export function getManaSymbolSync(symbol: string): CanvasImage | null {
  return manaCache.get(normalizeKey(symbol)) ?? null;
}

/**
 * Warm the symbol cache so `getManaSymbolSync` (used while laying out rules text)
 * can resolve inline mana symbols. There are only a few dozen small SVGs; they
 * load in parallel and the browser's HTTP cache makes repeats free.
 */
export async function preloadAllSymbols(): Promise<void> {
  await Promise.all(
    Object.entries(SYMBOL_MANIFEST).map(async ([key, rel]) => {
      if (manaCache.has(key)) return;
      manaCache.set(key, await loadAssetImage(rel));
    }),
  );
  void SYMBOL_PATHS; // (kept exported for tooling/preload manifests)
}

export function parseManaString(mana: string): string[] {
  const matches = mana.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1, -1));
}

const SYMBOL_TOKEN_RE = /\{([^}]+)\}/g;

/**
 * Collect the set of mana-symbol keys referenced anywhere in a card by walking
 * its already-parsed text fields (recursively, including structured abilities
 * and any linked card) and extracting `{…}` tokens. No re-parse: it operates on
 * the in-memory card object the renderer already has.
 *
 * Mana cost / loyalty costs load their symbols asynchronously at draw time, but
 * rules-text layout resolves inline symbols *synchronously* (getManaSymbolSync),
 * so those must be cached first. This warms exactly the symbols a card uses —
 * typically a handful — instead of the whole manifest.
 */
export function collectSymbolKeys(card: unknown): string[] {
  const keys = new Set<string>();
  const seen = new Set<unknown>();
  const visit = (v: unknown): void => {
    if (v == null) return;
    if (typeof v === 'string') {
      for (const m of v.matchAll(SYMBOL_TOKEN_RE)) keys.add(normalizeKey(m[1]));
      return;
    }
    if (typeof v !== 'object') return;
    // Skip binary art payloads (Uint8Array/Buffer/ArrayBuffer) — walking their
    // byte indices would be pointless and slow.
    if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer) return;
    if (seen.has(v)) return; // guard against cycles (e.g. MDFC back→front link)
    seen.add(v);
    if (Array.isArray(v)) { for (const x of v) visit(x); return; }
    for (const x of Object.values(v as Record<string, unknown>)) visit(x);
  };
  visit(card);
  return [...keys];
}

/** Warm the cache for a specific set of symbols (no-op for already-cached or
 *  unknown keys). Pair with `collectSymbolKeys` to preload only what a card needs. */
export async function preloadSymbols(symbols: Iterable<string>): Promise<void> {
  await Promise.all([...symbols].map(s => loadManaSymbol(s)));
}
