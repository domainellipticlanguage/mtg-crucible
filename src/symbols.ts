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
