import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as esbuild from 'esbuild';
import { renderCard, toDisplayCard, formatCard } from '../src';
import { TEMPLATES } from '../src/renderers/render';
import { clearAssetImageCache } from '../src/platform';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

/** Map from template name to the JSON file holding its layout (relative to src/layouts/). */
const LAYOUT_JSON_FILES: Record<string, string> = {
  standard: 'standard.json',
  planeswalker: 'planeswalker.json',
  planeswalker_tall: 'planeswalker_tall.json',
  saga: 'saga.json',
  class: 'class.json',
  battle: 'battle.json',
  adventure: 'adventure.json',
  transform_front: 'transform_front.json',
  transform_back: 'transform_back.json',
  mdfc_front: 'mdfc_front.json',
  mdfc_back: 'mdfc_back.json',
  split: 'split_right.json',
  fuse: 'fuse.json',
  flip: 'flip.json',
  mutate: 'mutate.json',
  prototype: 'prototype.json',
  leveler: 'leveler.json',
  aftermath: 'aftermath.json',
  prepare: 'prepare.json',
  omen: 'omen.json',
  room: 'room.json',
};

/** Write the merged layout to its JSON file. Returns the keys that ended up changing. */
async function saveLayoutToFile(
  jsonFile: string,
  currentLayout: Record<string, any>,
  override: Record<string, any>,
): Promise<{ written: string[] }> {
  const filePath = path.resolve(__dirname, '..', 'src', 'layouts', jsonFile);
  const merged = { ...currentLayout, ...override };
  await fs.promises.writeFile(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  // Report which top-level keys actually differ from the previous layout
  const written = Object.keys(override).filter(k => JSON.stringify(currentLayout[k]) !== JSON.stringify(override[k]));
  return { written };
}

// --- Client bundling with watch mode ---

const clientEntry = path.join(__dirname, 'dev-client.tsx');
let clientBundle = '';

// SSE clients waiting for reload signals
const sseClients = new Set<http.ServerResponse>();

// esbuild plugin that captures the bundle output and notifies SSE clients
const hotReloadPlugin: esbuild.Plugin = {
  name: 'hot-reload',
  setup(build) {
    build.onEnd(result => {
      if (result.errors.length > 0) {
        console.error('Build errors:', result.errors);
        return;
      }
      clientBundle = result.outputFiles![0].text;
      console.log(`Client bundle: ${(clientBundle.length / 1024).toFixed(0)} KB`);
      for (const res of sseClients) {
        res.write('data: reload\n\n');
      }
    });
  },
};

async function startWatcher() {
  const ctx = await esbuild.context({
    entryPoints: [clientEntry],
    bundle: true,
    write: false,
    format: 'esm',
    jsx: 'automatic',
    target: 'es2020',
    define: {
      'process.env.NODE_ENV': '"development"',
    },
    plugins: [hotReloadPlugin],
  });
  await ctx.watch();
}

// --- HTML shell ---

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MTG Crucible — Dev Server</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #1a1a2e; color: #e0e0e0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 2rem; }
  h1 { margin-bottom: 1.5rem; font-size: 1.5rem; color: #c4a35a; }
  .container { display: flex; gap: 2rem; width: 100%; max-width: 1100px; }
  .input-panel, .output-panel { flex: 1; display: flex; flex-direction: column; }
  textarea { width: 100%; height: 360px; background: #16213e; color: #e0e0e0; border: 1px solid #444; border-radius: 6px; padding: 0.75rem; font-family: 'Menlo', 'Consolas', monospace; font-size: 13px; resize: vertical; }
  textarea:focus { outline: none; border-color: #c4a35a; }
  .controls { display: flex; gap: 1rem; align-items: center; margin-top: 0.75rem; }
  .tabs { display: flex; background: #16213e; border-radius: 6px; overflow: hidden; border: 1px solid #444; flex-wrap: wrap; }
  .tabs button { background: none; border: none; color: #e0e0e0; padding: 0.5rem 1rem; cursor: pointer; font-size: 0.85rem; transition: background 0.15s; }
  .tabs button:hover { background: #2a2a4e; }
  .tabs button.active { background: #c4a35a; color: #1a1a2e; }
  button { background: #c4a35a; color: #1a1a2e; border: none; border-radius: 6px; padding: 0.5rem 1.5rem; font-weight: 600; cursor: pointer; font-size: 0.9rem; }
  button:hover { background: #d4b36a; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .output-panel { align-items: center; justify-content: flex-start; }
  #output { width: 100%; min-height: 360px; display: flex; align-items: center; justify-content: center; background: #16213e; border-radius: 6px; border: 1px solid #444; overflow: auto; padding: 1rem; }
  #output pre { font-size: 12px; white-space: pre-wrap; word-break: break-word; width: 100%; max-height: 500px; overflow: auto; }
  .error { color: #ff6b6b; }
  .spinner { border: 3px solid #444; border-top: 3px solid #c4a35a; border-radius: 50%; width: 32px; height: 32px; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .timing { margin-top: 0.5rem; font-size: 0.8rem; color: #888; }
</style>
</head>
<body>
<div id="root"></div>
<script type="module" src="/client.js"></script>
<script>
  new EventSource('/sse').onmessage = () => location.reload();
</script>
</body>
</html>`;

// --- HTTP server ---

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML);
    return;
  }

  if (req.method === 'GET' && req.url === '/client.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(clientBundle);
    return;
  }

  if (req.method === 'GET' && req.url === '/sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // Serve image files from .local/ directory
  if (req.method === 'GET' && req.url?.startsWith('/local/')) {
    const IMAGE_EXTS: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif',
    };
    const relPath = decodeURIComponent(req.url.slice('/local/'.length));
    const ext = path.extname(relPath).toLowerCase();
    if (!IMAGE_EXTS[ext]) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Only image files are served');
      return;
    }
    const filePath = path.resolve(__dirname, '..', '.local', relPath);
    // Ensure resolved path is within .local/
    const localDir = path.resolve(__dirname, '..', '.local');
    if (!filePath.startsWith(localDir + path.sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Access denied');
      return;
    }
    try {
      const data = await fs.promises.readFile(filePath);
      res.writeHead(200, { 'Content-Type': IMAGE_EXTS[ext], 'Cache-Control': 'max-age=3600' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
    return;
  }

  // Return the current layout JSON for a template
  if (req.method === 'GET' && req.url?.startsWith('/layout/')) {
    const name = decodeURIComponent(req.url.slice('/layout/'.length));
    const tmpl = TEMPLATES[name];
    if (!tmpl) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Unknown template: ${name}`);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ layout: tmpl.layout, w: tmpl.w, h: tmpl.h }));
    return;
  }

  // List known templates
  if (req.method === 'GET' && req.url === '/layout-templates') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ templates: Object.keys(TEMPLATES) }));
    return;
  }

  // List existing mask SVGs in assets/masks/originals/
  if (req.method === 'GET' && req.url === '/masks') {
    const dir = path.resolve(__dirname, '..', 'assets', 'masks', 'originals');
    try {
      const files = (await fs.promises.readdir(dir)).filter(f => f.endsWith('.svg'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ masks: files }));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ masks: [] }));
    }
    return;
  }

  // Load an existing mask SVG by filename (from assets/masks/originals/)
  if (req.method === 'GET' && req.url?.startsWith('/mask/')) {
    const name = decodeURIComponent(req.url.slice('/mask/'.length));
    const filePath = path.resolve(__dirname, '..', 'assets', 'masks', 'originals', name);
    const dir = path.resolve(__dirname, '..', 'assets', 'masks', 'originals');
    if (!filePath.startsWith(dir + path.sep)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Access denied');
      return;
    }
    try {
      const data = await fs.promises.readFile(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
    return;
  }

  // Save a mask: writes SVG to assets/masks/originals/{name}.svg AND rasterizes to assets/masks/{name}.png
  if (req.method === 'POST' && req.url === '/save-mask') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const { name, svg, width, height } = body as { name: string; svg: string; width: number; height: number };

    if (!name || !/^[a-z0-9_-]+$/i.test(name)) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('name must match [a-z0-9_-]+');
      return;
    }
    try {
      const svgPath = path.resolve(__dirname, '..', 'assets', 'masks', 'originals', `${name}.svg`);
      const pngPath = path.resolve(__dirname, '..', 'assets', 'masks', `${name}.png`);
      await fs.promises.writeFile(svgPath, svg, 'utf-8');

      // Rasterize SVG to PNG. @napi-rs/canvas's loadImage handles SVG via librsvg.
      const img = await loadImage(Buffer.from(svg, 'utf-8'));
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const png = canvas.toBuffer('image/png');
      await fs.promises.writeFile(pngPath, png);

      // The render core caches decoded assets by path; drop it so the next
      // render picks up the freshly-written mask.
      clearAssetImageCache();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ svgPath, pngPath }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(err.message || 'Internal server error');
    }
    return;
  }

  // Save layout changes back to src/layout.ts
  if (req.method === 'POST' && req.url === '/save-layout') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const { templateName, layoutOverride } = body as { templateName: string; layoutOverride: Record<string, any> };

    const tmpl = TEMPLATES[templateName];
    const jsonFile = LAYOUT_JSON_FILES[templateName];
    if (!tmpl || !jsonFile) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end(`Unknown template: ${templateName}`);
      return;
    }

    try {
      const result = await saveLayoutToFile(jsonFile, tmpl.layout, layoutOverride);
      // Mutate the existing layout object in place so other templates that share
      // the same JSON-imported object (e.g. split & fuse both use split_right.json)
      // see the updated values without needing a server restart.
      Object.assign(tmpl.layout, layoutOverride);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(err.message || 'Internal server error');
    }
    return;
  }

  // Render a card with a temporarily-patched layout for a specific template
  if (req.method === 'POST' && req.url === '/render-with-layout') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const { text, templateName, layoutOverride, quality, format } = body as {
      text: string;
      templateName: string;
      layoutOverride: Record<string, any>;
      quality?: 'low' | 'medium' | 'high';
      format?: 'png' | 'jpeg';
    };

    const tmpl = TEMPLATES[templateName];
    if (!tmpl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end(`Unknown template: ${templateName}`);
      return;
    }

    const originalLayout = tmpl.layout;
    // Merge override on top of original so missing keys fall back to defaults
    tmpl.layout = { ...originalLayout, ...layoutOverride };

    try {
      let input: any = text;
      try { input = JSON.parse(text); } catch {}
      const t0 = performance.now();
      const rendered = await renderCard(input, {
        format: format ?? 'jpeg',
        quality: quality ?? 'high',
        allowUnsafeArtUrls: true,
      });
      const display = toDisplayCard(rendered);
      const ms = Math.round(performance.now() - t0);
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Render-Time-Ms': String(ms) });
      res.end(JSON.stringify({
        display,
        cardData: rendered.normalizedCardData,
        effectiveLayout: tmpl.layout,
      }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(err.message || 'Internal server error');
    } finally {
      tmpl.layout = originalLayout;
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/render') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const { text, quality, format } = body as { text: string; quality?: 'low' | 'medium' | 'high'; format?: 'png' | 'jpeg' };

    try {
      let input: any = text;
      try { input = JSON.parse(text); } catch {}
      const t0 = performance.now();
      const rendered = await renderCard(input, {
        format: format ?? 'jpeg',
        quality: quality ?? 'high',
        allowUnsafeArtUrls: true,
      });
      const display = toDisplayCard(rendered);
      const ms = Math.round(performance.now() - t0);
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Render-Time-Ms': String(ms) });
      res.end(JSON.stringify({
        display,
        cardData: rendered.normalizedCardData,
        crucibleTextNormalized: formatCard(rendered.normalizedCardData),
      }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(err.message || 'Internal server error');
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

startWatcher().then(() => {
  server.listen(PORT, () => {
    console.log(`MTG Crucible dev server running at http://localhost:${PORT}`);
  });
});
