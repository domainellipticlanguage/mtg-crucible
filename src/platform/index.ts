/**
 * Platform singleton + convenience wrappers used by the render core.
 *
 * Exactly one platform is registered per environment by the package entry point
 * (src/index.ts registers the Node platform; src/index.browser.ts registers the
 * browser platform). This module intentionally imports NEITHER implementation,
 * so pulling it into a bundle never drags in the other environment's deps.
 */
import type { Platform, RenderCanvas, CanvasImage, AssetData, Ctx } from './types';
import type { RenderFormat } from '../types';

export type { Platform, RenderCanvas, CanvasImage, Ctx, CtxImageData } from './types';

let active: Platform | null = null;

export function setPlatform(platform: Platform): void {
  active = platform;
}

export function getPlatform(): Platform {
  if (!active) {
    throw new Error(
      'mtg-crucible: no platform registered. Import the package entry point ' +
        '("mtg-crucible") rather than internal modules — the entry registers the ' +
        'Node or browser platform automatically.',
    );
  }
  return active;
}

export function createCanvas(width: number, height: number): RenderCanvas {
  return getPlatform().createCanvas(width, height);
}

/** Decode an image from raw bytes / Blob / data URL into a drawable. */
export function loadImageBytes(src: AssetData | Blob): Promise<CanvasImage> {
  return getPlatform().loadImage(src);
}

/** Load user-supplied card art (URL/data URL/local path), applying platform safety rules. */
export function loadArt(src: string, allowUnsafe: boolean): Promise<CanvasImage> {
  return getPlatform().loadArt(src, allowUnsafe);
}

export function loadFont(family: string, relativePath: string): Promise<void> {
  return getPlatform().loadFont(family, relativePath);
}

export function readAsset(relativePath: string): Promise<AssetData> {
  return getPlatform().readAsset(relativePath);
}

export function encode(canvas: RenderCanvas, format: RenderFormat, quality?: number): Promise<Uint8Array> {
  return getPlatform().encode(canvas, format, quality);
}

// Decoded assets are immutable and reused across renders, so cache them by path.
// Misses (a non-existent optional mask, a colorless frame with no `c.webp`) resolve
// to `null` and are cached too, so repeated renders don't re-attempt the fetch.
const assetImageCache = new Map<string, Promise<CanvasImage | null>>();

async function loadAssetImageUncached(relativePath: string): Promise<CanvasImage | null> {
  const platform = getPlatform();
  try {
    const data = await platform.readAsset(relativePath);
    return await platform.loadImage(data);
  } catch {
    return null;
  }
}

/**
 * Load an asset image by its path relative to the assets root, returning `null`
 * if the asset doesn't exist. Replaces the old `fs.existsSync` + `loadImage`
 * pattern with one existence-tolerant, cached call that works in both
 * environments.
 */
export function loadAssetImage(relativePath: string): Promise<CanvasImage | null> {
  let pending = assetImageCache.get(relativePath);
  if (!pending) {
    pending = loadAssetImageUncached(relativePath);
    assetImageCache.set(relativePath, pending);
  }
  return pending;
}

/**
 * Best-effort: kick off parallel loads to warm the decoded-asset cache, then
 * return immediately (does NOT await). Each path's fetch is started concurrently
 * and parked in `assetImageCache`, so a later `await loadAssetImage(path)` during
 * the (sequential) draw phase joins the in-flight promise instead of starting a
 * fresh round-trip. Purely additive: callers still load normally, so a missing or
 * wrong prefetch path just degrades to on-demand loading. Critical in the browser,
 * where each asset is a 1–3s CDN fetch and the draw phase would otherwise serialize
 * them; a no-op cost in Node (assets are local).
 */
export function prefetchAssets(relativePaths: Iterable<string>): void {
  for (const path of relativePaths) void loadAssetImage(path);
}

/** Clear the decoded-asset cache (used by the dev server after editing masks). */
export function clearAssetImageCache(): void {
  assetImageCache.clear();
}
