import * as http from 'http';
import { parseCard, renderCard } from '../src';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

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
  .output-panel h2 { font-size: 1rem; margin-bottom: 0.75rem; color: #888; }
  #output { width: 100%; min-height: 360px; display: flex; align-items: center; justify-content: center; background: #16213e; border-radius: 6px; border: 1px solid #444; overflow: auto; }
  #output img { max-width: 100%; height: auto; }
  #output pre { padding: 1rem; font-size: 12px; white-space: pre-wrap; word-break: break-word; width: 100%; max-height: 500px; overflow: auto; }
  .error { color: #ff6b6b; }
  .spinner { border: 3px solid #444; border-top: 3px solid #c4a35a; border-radius: 50%; width: 32px; height: 32px; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<h1>MTG Crucible</h1>
<div class="container">
  <div class="input-panel">
    <textarea id="cardText">Crucible of Legends {3}
Art: https://raw.githubusercontent.com/nathanfdunn/mtg-crucible/refs/heads/main/logo/banner-image.png
Rarity: Mythic Rare
Legendary Artifact
Whenever a legendary creature you control dies, return it to your hand at the beginning of the next end step.
*Every great story begins with fire.*</textarea>
    <div class="controls">
      <button id="renderBtn" onclick="doRender()">Render</button>
    </div>
  </div>
  <div class="output-panel">
    <div class="tabs" id="tabs">
      <button class="active" data-tab="image">Image</button>
      <button data-tab="cardData">CardData</button>
      <button data-tab="scryfallJson">Scryfall JSON</button>
      <button data-tab="scryfallText">Scryfall Text</button>
      <button data-tab="crucibleText">Crucible Text</button>
      <button data-tab="rotations">Rotations</button>
    </div>
    <div id="output"><span style="color:#666">Click Render to see output</span></div>
    <div id="timing" style="margin-top:0.5rem;font-size:0.8rem;color:#888"></div>
  </div>
</div>
<script>
let lastResult = null;
let activeTab = 'image';

function showTab(tab) {
  activeTab = tab;
  document.querySelectorAll('#tabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  if (!lastResult) return;
  const output = document.getElementById('output');
  const r = lastResult;
  switch (tab) {
    case 'image':
      output.innerHTML = '<img src="' + r.imageUrl + '" alt="Rendered card">';
      break;
    case 'cardData':
      output.innerHTML = '<pre>' + escapeHtml(JSON.stringify(r.cardData, null, 2)) + '</pre>';
      break;
    case 'scryfallJson':
      output.innerHTML = '<pre>' + escapeHtml(JSON.stringify(JSON.parse(r.scryfallJson), null, 2)) + '</pre>';
      break;
    case 'scryfallText':
      output.innerHTML = '<pre>' + escapeHtml(r.scryfallText) + '</pre>';
      break;
    case 'crucibleText':
      output.innerHTML = '<pre>' + escapeHtml(r.crucibleText) + '</pre>';
      break;
    case 'rotations':
      output.innerHTML = '<pre>' + escapeHtml(JSON.stringify(r.rotations, null, 2)) + '</pre>';
      break;
  }
}

document.getElementById('tabs').addEventListener('click', (e) => {
  const tab = e.target.dataset.tab;
  if (tab) showTab(tab);
});

async function doRender() {
  const text = document.getElementById('cardText').value;
  const output = document.getElementById('output');
  const btn = document.getElementById('renderBtn');
  const timing = document.getElementById('timing');
  btn.disabled = true;
  output.innerHTML = '<div class="spinner"></div>';
  timing.textContent = '';
  const t0 = performance.now();

  try {
    const res = await fetch('/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const serverMs = res.headers.get('X-Render-Time-Ms');

    if (!res.ok) {
      const err = await res.text();
      output.innerHTML = '<pre class="error">' + escapeHtml(err) + '</pre>';
      return;
    }

    const json = await res.json();
    const blob = new Blob([Uint8Array.from(atob(json.image), c => c.charCodeAt(0))], { type: 'image/png' });
    const imageUrl = URL.createObjectURL(blob);

    lastResult = {
      imageUrl,
      cardData: json.cardData,
      scryfallJson: json.scryfallJson,
      scryfallText: json.scryfallText,
      crucibleText: json.crucibleText,
      rotations: json.rotations,
    };

    showTab(activeTab);

    const totalMs = Math.round(performance.now() - t0);
    timing.textContent = 'Total: ' + totalMs + 'ms' + (serverMs ? ' (server: ' + serverMs + 'ms)' : '');
  } catch (e) {
    output.innerHTML = '<pre class="error">Error: ' + escapeHtml(e.message) + '</pre>';
  } finally {
    btn.disabled = false;
  }
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

document.getElementById('cardText').addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') doRender();
});

</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML);
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
      const ms = Math.round(performance.now() - t0);
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Render-Time-Ms': String(ms) });
      res.end(JSON.stringify({
        image: rendered.frontFace.toString('base64'),
        cardData: rendered.normalizedCardData,
        scryfallJson: rendered.scryfallJson,
        scryfallText: rendered.scryfallText,
        crucibleText: rendered.crucibleText,
        rotations: rendered.rotations,
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

server.listen(PORT, () => {
  console.log(`MTG Crucible dev server running at http://localhost:${PORT}`);
});
