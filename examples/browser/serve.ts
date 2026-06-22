/**
 * Tiny static server for the browser example. Serves examples/browser/* and
 * maps /assets/* to the repo's assets/ directory so the example can render with
 * same-origin assets (handy before the package version is published to a CDN).
 *
 *   npm run example:browser   # builds main.js then starts this server
 */
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = __dirname;
const ASSETS = path.resolve(__dirname, '..', '..', 'assets');
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5173;

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.json': 'application/json',
};

function send(res: http.ServerResponse, file: string) {
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
    res.end(data);
  });
}

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (process.env.LOG_REQUESTS) console.log(`REQ ${req.method} ${req.url}`);
  // Result channel for the headless smoke test: the page reports here when done.
  if (url === '/report') {
    const query = (req.url ?? '').split('?')[1] ?? '';
    console.log(`REPORT: ${decodeURIComponent(query)}`);
    res.writeHead(204); res.end();
    return;
  }
  if (url.startsWith('/assets/')) {
    const rel = url.slice('/assets/'.length);
    const target = path.resolve(ASSETS, rel);
    if (!target.startsWith(ASSETS + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
    return send(res, target);
  }
  const file = url === '/' ? path.join(ROOT, 'index.html') : path.join(ROOT, url);
  if (!path.resolve(file).startsWith(ROOT + path.sep) && path.resolve(file) !== path.join(ROOT, 'index.html')) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  send(res, file);
}).listen(PORT, () => {
  console.log(`Example server: http://localhost:${PORT}/?assets=/assets/`);
});
