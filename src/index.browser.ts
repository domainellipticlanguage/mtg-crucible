/**
 * Browser entry point. Registers the browser platform (OffscreenCanvas/Image +
 * fetch + FontFace) and re-exports the shared API. Never imports
 * @napi-rs/canvas, so it's safe for browser bundlers.
 *
 * Frame/mask/symbol/font assets are fetched on demand from `assetBaseUrl`
 * (default: this package's assets on jsDelivr, pinned to the installed version).
 * Call `setAssetBaseUrl` before rendering to self-host.
 */
import { setPlatform } from './platform';
import { browserPlatform, setAssetBaseUrl, getAssetBaseUrl } from './platform/browser';

setPlatform(browserPlatform);

export { setAssetBaseUrl, getAssetBaseUrl };
export * from './core';
