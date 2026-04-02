import { loadImage, type Image } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import { ASSETS_DIR } from './assets-dir';

const manaCache = new Map<string, Image | null>();
const symbolDir = path.join(ASSETS_DIR, 'symbols');

/** Find an SVG by key, searching all subdirectories. */
function findSymbolPath(key: string): string | null {
  const dirs = fs.readdirSync(symbolDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  for (const dir of dirs) {
    const p = path.join(symbolDir, dir, `${key}.svg`);
    if (fs.existsSync(p)) return p;
  }
  // Fallback to flat (in case any stray files remain)
  const flat = path.join(symbolDir, `${key}.svg`);
  if (fs.existsSync(flat)) return flat;
  return null;
}

export async function loadManaSymbol(symbol: string): Promise<Image | null> {
  const key = symbol.toLowerCase().replace(/\//g, '').replace(/∞|infinity/g, 'inf');
  if (manaCache.has(key)) return manaCache.get(key)!;
  const svgPath = findSymbolPath(key);
  if (!svgPath) { manaCache.set(key, null); return null; }
  const img = await loadImage(svgPath);
  manaCache.set(key, img);
  return img;
}

export function getManaSymbolSync(symbol: string): Image | null {
  const key = symbol.toLowerCase().replace(/\//g, '').replace(/∞|infinity/g, 'inf');
  return manaCache.get(key) ?? null;
}

export async function preloadAllSymbols(): Promise<void> {
  const dirs = fs.readdirSync(symbolDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  for (const dir of dirs) {
    const dirPath = path.join(symbolDir, dir);
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.svg'));
    for (const f of files) {
      const key = f.replace('.svg', '');
      if (!manaCache.has(key)) {
        const img = await loadImage(path.join(dirPath, f));
        manaCache.set(key, img);
      }
    }
  }
}

export function parseManaString(mana: string): string[] {
  const matches = mana.match(/\{([^}]+)\}/g);
  if (!matches) return [];
  return matches.map(m => m.slice(1, -1));
}
