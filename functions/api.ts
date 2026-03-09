import { parseCard, renderCard, toDisplayCard } from '../src';

// Re-use the same HTML from the dev server, served at GET /
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MTG Crucible</title>
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
  #output pre { padding: 1rem; font-size: 12px; white-space: pre-wrap; word-break: break-word; width: 100%; max-height: 500px; overflow: auto; }
  .error { color: #ff6b6b; }
  .spinner { border: 3px solid #444; border-top: 3px solid #c4a35a; border-radius: 50%; width: 32px; height: 32px; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .mtg-card-wrapper { display: inline-block; position: relative; perspective: 1000px; }
  .mtg-card-inner { width: 100%; aspect-ratio: 5/7; overflow: hidden; border-radius: 4.5% / 3.2%; }
  .mtg-card-inner img { display: block; width: 100%; height: 100%; object-fit: cover; user-select: none; -webkit-user-drag: none; }
  .mtg-card-wrapper.clickable { cursor: pointer; }
  .mtg-card-wrapper .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }
</style>
</head>
<body>
<h1>MTG Crucible (Lambda)</h1>
<div class="container">
  <div class="input-panel">
    <textarea id="cardText">Crucible of Legends {3}
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
      <button class="active" data-tab="card">Card</button>
      <button data-tab="cardData">CardData</button>
      <button data-tab="scryfallJson">Scryfall JSON</button>
      <button data-tab="scryfallText">Scryfall Text</button>
      <button data-tab="crucibleText">Crucible Text</button>
    </div>
    <div id="output"><span style="color:#666">Click Render to see output</span></div>
    <div id="timing" style="margin-top:0.5rem;font-size:0.8rem;color:#888"></div>
  </div>
</div>
<script>
let lastResult = null;
let activeTab = 'card';

function showTab(tab) {
  activeTab = tab;
  document.querySelectorAll('#tabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  if (!lastResult) return;
  const output = document.getElementById('output');
  const r = lastResult;
  switch (tab) {
    case 'card':
      output.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.className = 'mtg-card-wrapper';
      wrapper.style.width = '100%';
      const inner = document.createElement('div');
      inner.className = 'mtg-card-inner';
      const img = document.createElement('img');
      img.src = r.display.frontFace;
      img.alt = r.display.name;
      img.draggable = false;
      inner.appendChild(img);
      wrapper.appendChild(inner);
      output.appendChild(wrapper);
      break;
    case 'cardData':
      output.innerHTML = '<pre>' + escapeHtml(JSON.stringify(r.cardData, null, 2)) + '</pre>';
      break;
    case 'scryfallJson':
      output.innerHTML = '<pre>' + escapeHtml(JSON.stringify(JSON.parse(r.display.scryfallJson), null, 2)) + '</pre>';
      break;
    case 'scryfallText':
      output.innerHTML = '<pre>' + escapeHtml(r.display.scryfallText) + '</pre>';
      break;
    case 'crucibleText':
      output.innerHTML = '<pre>' + escapeHtml(r.display.crucibleText) + '</pre>';
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
    lastResult = {
      display: json.display,
      cardData: json.cardData,
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

export async function handler(event: any) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = event.requestContext?.http?.path || event.rawPath || event.path || '/';

  // Serve HTML page
  if (method === 'GET' && (path === '/' || path === '')) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: HTML,
    };
  }

  // Render endpoint
  if (method === 'POST' && path === '/render') {
    try {
      const body = typeof event.body === 'string'
        ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body)
        : event.body;

      const { text } = body as { text: string };

      let input: any = text;
      try { input = JSON.parse(text); } catch {}

      const t0 = performance.now();
      const rendered = await renderCard(input);
      const display = toDisplayCard(rendered);
      const ms = Math.round(performance.now() - t0);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Render-Time-Ms': String(ms),
        },
        body: JSON.stringify({
          display,
          cardData: rendered.normalizedCardData,
        }),
      };
    } catch (err: any) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'text/plain' },
        body: err.message || 'Internal server error',
      };
    }
  }

  return { statusCode: 404, body: 'Not found' };
}
