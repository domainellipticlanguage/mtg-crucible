import { loadImage, type Image } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import { ASSETS_DIR } from './layout';

const manaCache = new Map<string, Image | null>();

export async function loadManaSymbol(symbol: string): Promise<Image | null> {
  const key = symbol.toLowerCase().replace(/\//g, '');
  if (manaCache.has(key)) return manaCache.get(key)!;
  const svgPath = path.join(ASSETS_DIR, 'symbols', `${key}.svg`);
  if (!fs.existsSync(svgPath)) { manaCache.set(key, null); return null; }
  const img = await loadImage(svgPath);
  manaCache.set(key, img);
  return img;
}

export function getManaSymbolSync(symbol: string): Image | null {
  const key = symbol.toLowerCase().replace(/\//g, '');
  return manaCache.get(key) ?? null;
}

export async function preloadAllSymbols(): Promise<void> {
  const symbolDir = path.join(ASSETS_DIR, 'symbols');
  const files = fs.readdirSync(symbolDir).filter(f => f.endsWith('.svg'));
  for (const f of files) {
    const key = f.replace('.svg', '');
    if (!manaCache.has(key)) {
      const img = await loadImage(path.join(symbolDir, f));
      manaCache.set(key, img);
    }
  }
}

export function parseManaString(mana: string): string[] {
  const matches = mana.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1, -1));
}
