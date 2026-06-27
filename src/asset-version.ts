/**
 * Asset major version — the version axis for the hosted frame/mask/symbol/font
 * assets, DELIBERATELY DECOUPLED from the package version.
 *
 * Assets are served from a per-major Cloudflare Pages project named
 * `mtg-crucible-assets-v${ASSET_VERSION}` (e.g. mtg-crucible-assets-v1.pages.dev).
 * Each major is its own frozen, independently-cached deployment:
 *
 *  - Additive / lossless changes (new frames, new files) → redeploy the SAME
 *    project. Existing filenames keep their URLs, so `immutable`-cached clients
 *    are unaffected; only genuinely-new files are cold.
 *  - BREAKING changes (changing the bytes under an existing filename like
 *    `frames/standard/r.png`) → bump ASSET_VERSION, create a NEW project, and
 *    leave the old one frozen so already-published builds keep resolving.
 *
 * Because code releases that don't touch assets leave this untouched, we no
 * longer mint a new asset set per package version (the old jsDelivr `@vX.Y.Z`
 * scheme), which means consumers across package versions share one warm cache.
 */
export const ASSET_VERSION = 1;
