/**
 * Verifies the browser entry bundles cleanly with NO Node built-ins or the
 * native @napi-rs/canvas addon pulled in. Run after `npm run build`:
 *
 *   npm run build:check-browser
 *
 * If the browser entry ever (transitively) imports the Node platform, esbuild
 * fails to resolve `fs`/`path`/`https`/etc. or chokes on the `.node` binary, and
 * this script exits non-zero.
 */
import * as esbuild from 'esbuild';
import * as path from 'path';

const ENTRY = path.resolve(__dirname, '..', 'dist', 'index.browser.js');
const FORBIDDEN = ['@napi-rs/canvas', 'require("fs")', "require('fs')", 'node:fs', 'librsvg'];

async function main() {
  const result = await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    write: false,
    logLevel: 'silent',
    // React is an optional peer; the core browser entry doesn't import it, but
    // keep it external so an unrelated resolution can't fail the check.
    external: ['react', 'react-dom'],
  });

  const output = result.outputFiles.map(f => f.text).join('\n');
  const hits = FORBIDDEN.filter(token => output.includes(token));
  if (hits.length > 0) {
    console.error(`❌ Browser bundle contains forbidden references: ${hits.join(', ')}`);
    process.exit(1);
  }

  const kb = (output.length / 1024).toFixed(0);
  console.log(`✅ Browser bundle is clean (no Node built-ins / napi). Bundled size: ${kb} KB`);
}

main().catch((err) => {
  console.error('❌ Browser bundle failed to build (likely a Node-only import leaked in):');
  console.error(err.message || err);
  process.exit(1);
});
