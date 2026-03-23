import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as esbuild from 'esbuild';
import { renderCard, toDisplayCard, formatCard } from '../src';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

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

  if (req.method === 'POST' && req.url === '/render') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const { text } = body as { text: string };

    try {
      let input: any = text;
      try { input = JSON.parse(text); } catch {}
      const t0 = performance.now();
      const rendered = await renderCard(input);
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
