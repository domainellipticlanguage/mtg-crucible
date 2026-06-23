/**
 * Browser smoke test / example.
 *
 * Renders a single card entirely client-side and asserts the output is a
 * non-empty PNG byte array, then displays it. Bundle with:
 *
 *   npm run example:browser
 *
 * then open examples/browser/index.html in a browser.
 *
 * In a real app you'd import from the package name ("mtg-crucible") — bundlers
 * resolve the "browser" export condition automatically. Here we import the
 * in-repo browser entry directly so the example builds from source.
 */
import { renderCard, toDisplayCard, setAssetBaseUrl } from '../../src/index.browser';

// Assets default to this package's files on jsDelivr (pinned to the installed
// version). To self-host — or to run this example before the version is
// published — point it elsewhere. Here we honor a `?assets=` query param so the
// bundled local server (`npm run example:browser`) can serve the repo's own
// assets same-origin.
const assetOverride = new URLSearchParams(location.search).get('assets');
if (assetOverride) setAssetBaseUrl(assetOverride);

const statusEl = document.getElementById('status')!;
const imgEl = document.getElementById('card') as HTMLImageElement;

function finish(ok: boolean, message: string): void {
  statusEl.textContent = message;
  statusEl.className = ok ? 'pass' : 'fail';
  document.title = ok ? 'SMOKE_PASS' : 'SMOKE_FAIL';
  (window as unknown as { __SMOKE_OK__: boolean }).__SMOKE_OK__ = ok;
  // When run headlessly (?report=1), phone the result home so the harness can
  // read a definitive pass/fail. No-op in normal browser use.
  if (new URLSearchParams(location.search).has('report')) {
    // A tracked fetch (not sendBeacon) so headless virtual-time waits for it.
    void fetch(`/report?ok=${ok ? 1 : 0}&msg=${encodeURIComponent(message)}`, { keepalive: true });
  }
}

async function main(): Promise<void> {
  const rendered = await renderCard(
    `Lightning Bolt {R}
Instant
Lightning Bolt deals 3 damage to any target.
*The sparkmage shrieked, calling on the rage of the storms of his youth.*`,
    { format: 'png' },
  );

  const buf = rendered.frontFace; // Uint8Array
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const ok = buf instanceof Uint8Array && buf.length > 1000 && isPng;

  // toDisplayCard still yields data-URL strings, in the browser too.
  // (Or wrap the bytes yourself: URL.createObjectURL(toBlob(buf, rendered.format)).)
  imgEl.src = toDisplayCard(rendered).frontFaceImageUrl;

  finish(ok, ok
    ? `PASS — rendered ${buf.length.toLocaleString()} bytes of ${rendered.format}`
    : 'FAIL — unexpected render output');
}

main().catch((err) => {
  finish(false, `FAIL — ${err instanceof Error ? err.message : String(err)}`);
});
