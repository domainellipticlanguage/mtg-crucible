/**
 * Browser platform: OffscreenCanvas / HTMLCanvasElement for rendering,
 * HTMLImageElement for decoding (handles both PNG and SVG reliably), `fetch`
 * (via image/font URLs) for assets, and FontFace for fonts.
 *
 * Frame/mask/symbol/font assets are NOT bundled — they're fetched on demand
 * from `assetBaseUrl`, which defaults to this package's assets hosted on
 * Cloudflare Pages, pinned to the asset major version. Override it with
 * `setAssetBaseUrl` to self-host. Only the assets a given card needs are
 * fetched; the browser's HTTP cache (assets are served `immutable`) handles
 * repeats.
 *
 * This module must never import @napi-rs/canvas at runtime (it's a native addon
 * that breaks browser bundlers). It only uses type-only platform types.
 */
import type { Platform, AssetData, CanvasImage, RenderCanvas } from './types';
import { mimeForFormat } from './types';
import type { RenderFormat } from '../types';
import { ASSET_VERSION } from '../asset-version';

// Assets are served from a per-major Cloudflare Pages project (see
// src/asset-version.ts), NOT pinned to the package version, so consumers across
// package versions share one warm edge cache. Pages serves them from its own
// edge (no slow GitHub-origin hop like jsDelivr's gh source had), with permissive
// CORS and a 1-year `immutable` Cache-Control (see assets/_headers).
let assetBaseUrl = `https://mtg-crucible-assets-v${ASSET_VERSION}.pages.dev/`;

/**
 * Override the base URL that frame/mask/symbol/font assets are fetched from.
 * Useful for self-hosting. A trailing slash is added if missing. Defaults to
 * this package's assets on Cloudflare Pages, pinned to the asset major version.
 */
export function setAssetBaseUrl(url: string): void {
  assetBaseUrl = url.endsWith('/') ? url : url + '/';
}

/** The current asset base URL. */
export function getAssetBaseUrl(): string {
  return assetBaseUrl;
}

const fontSet = (): FontFaceSet => {
  if (typeof document !== 'undefined' && document.fonts) return document.fonts;
  // Web Worker (OffscreenCanvas off the main thread)
  return (self as unknown as { fonts: FontFaceSet }).fonts;
};

async function decodeImage(url: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  const img = new Image();
  if (crossOrigin) img.crossOrigin = 'anonymous';
  img.src = url;
  // `decode()` resolves once the image is fully decoded and safe to draw.
  await img.decode();
  return img;
}

export const browserPlatform: Platform = {
  createCanvas(width, height): RenderCanvas {
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(width, height) as unknown as RenderCanvas;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas as unknown as RenderCanvas;
  },

  async loadImage(src: AssetData | Blob): Promise<CanvasImage> {
    let url: string;
    let revoke = false;
    if (typeof src === 'string') {
      url = src; // remote URL or data URL — decode directly (uses HTTP cache)
    } else {
      const blob = src instanceof Blob ? src : new Blob([src as unknown as BlobPart]);
      url = URL.createObjectURL(blob);
      revoke = true;
    }
    try {
      // Cross-origin remote URLs (e.g. the CDN) must be requested with CORS so
      // the canvas isn't tainted and stays encodable.
      const crossOrigin = !revoke && /^https?:/i.test(url);
      const img = await decodeImage(url, crossOrigin);
      return img as unknown as CanvasImage;
    } finally {
      if (revoke) URL.revokeObjectURL(url);
    }
  },

  async loadArt(src): Promise<CanvasImage> {
    // The browser sandbox already constrains fetches; CORS-less hosts will taint
    // the canvas and surface at encode time. (Local paths aren't meaningful here.)
    return this.loadImage(src);
  },

  async loadFont(family, relativePath): Promise<void> {
    const face = new FontFace(family, `url(${assetBaseUrl}${relativePath})`);
    await face.load();
    fontSet().add(face);
  },

  async readAsset(relativePath): Promise<AssetData> {
    // Return a URL; loadImage fetches it (leveraging the HTTP cache). Existence
    // is determined when the image fails to decode (loadAssetImage → null).
    return assetBaseUrl + relativePath;
  },

  async encode(canvas, format: RenderFormat, quality?: number): Promise<Uint8Array> {
    const type = mimeForFormat(format);
    const q = quality != null ? (quality > 1 ? quality / 100 : quality) : undefined;
    const c = canvas as unknown as OffscreenCanvas | HTMLCanvasElement;
    // OffscreenCanvas → convertToBlob; HTMLCanvasElement → toBlob.
    let blob: Blob;
    if ('convertToBlob' in c) {
      const opts: ImageEncodeOptions = { type };
      if (q != null) opts.quality = q;
      blob = await c.convertToBlob(opts);
    } else {
      blob = await new Promise<Blob>((resolve, reject) => {
        (c as HTMLCanvasElement).toBlob(
          (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
          type,
          q,
        );
      });
    }
    return new Uint8Array(await blob.arrayBuffer());
  },
};
