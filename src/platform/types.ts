/**
 * Platform abstraction.
 *
 * The render/layout/compositing core is platform-agnostic. Only a handful of
 * operations differ between Node and the browser — canvas creation, image
 * loading, font loading, asset resolution, and encoding — and those live behind
 * the `Platform` interface, implemented once per environment (./node, ./browser).
 *
 * The structural canvas/context/image types are borrowed from @napi-rs/canvas
 * via TYPE-ONLY imports. Type-only imports are fully erased at compile time, so
 * referencing them here does NOT pull the native `.node` binary into the browser
 * bundle. The browser implementation supplies OffscreenCanvas / ImageBitmap /
 * HTMLImageElement values and casts them to these shapes at the boundary — both
 * back the standard Canvas2D API the core relies on.
 */
import type { SKRSContext2D, Canvas as NapiCanvas, Image as NapiImage } from '@napi-rs/canvas';
import type { RenderFormat } from '../types';

/** A 2D rendering context (standard Canvas2D surface). */
export type Ctx = SKRSContext2D;

/** A canvas the core can draw onto, use as a draw source, and hand to `encode`. */
export type RenderCanvas = NapiCanvas;

/** Anything drawable via `ctx.drawImage` (decoded image / bitmap / canvas). */
export type CanvasImage = NapiImage;

/** The `ImageData` shape produced by `ctx.createImageData`. */
export type CtxImageData = ReturnType<Ctx['createImageData']>;

/** Bytes or a URL — what `readAsset` yields and `loadImage` accepts for assets. */
export type AssetData = Uint8Array | ArrayBuffer | string;

export interface Platform {
  /** Create an offscreen drawing surface of the given pixel dimensions. */
  createCanvas(width: number, height: number): RenderCanvas;

  /**
   * Decode an image from a URL, data URL, Blob, or raw bytes into a drawable.
   * Used both for bundled/hosted assets and for user-supplied card art.
   */
  loadImage(src: AssetData | Blob): Promise<CanvasImage>;

  /**
   * Load card art from a user-supplied source string (URL / data URL / —in
   * Node— a local path when `allowUnsafe`). Separate from `loadImage` so the
   * Node implementation can apply SSRF/local-file protections.
   */
  loadArt(src: string, allowUnsafe: boolean): Promise<CanvasImage>;

  /** Register a font family from an asset path (relative to the assets root). */
  loadFont(family: string, relativePath: string): Promise<void>;

  /**
   * Resolve an asset (relative to the assets root) to bytes (Node) or a URL
   * (browser). Rejects if the asset does not exist.
   */
  readAsset(relativePath: string): Promise<AssetData>;

  /** Encode a canvas to raw image bytes. */
  encode(canvas: RenderCanvas, format: RenderFormat, quality?: number): Promise<Uint8Array>;
}

/** MIME type for a render format. */
export function mimeForFormat(format: RenderFormat): string {
  return format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
}
