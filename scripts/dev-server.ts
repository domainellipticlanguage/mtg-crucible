import * as http from 'http';
import { parseCard, renderCard, toDisplayCard } from '../src';

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
  #output pre { padding: 1rem; font-size: 12px; white-space: pre-wrap; word-break: break-word; width: 100%; max-height: 500px; overflow: auto; }
  .error { color: #ff6b6b; }
  .spinner { border: 3px solid #444; border-top: 3px solid #c4a35a; border-radius: 50%; width: 32px; height: 32px; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Card display */
  .mtg-card-wrapper { display: inline-block; position: relative; perspective: 1000px; max-width: 100%; }
  .mtg-card-wrapper img { display: block; max-width: 100%; height: auto; transition: transform 0.3s ease; border-radius: 4.5% / 3.2%; user-select: none; -webkit-user-drag: none; }
  .mtg-card-wrapper.clickable { cursor: pointer; }
  .mtg-card-wrapper .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }

  /* Context menu */
  .ctx-menu { position: fixed; z-index: 10000; background: #2a2a2a; border: 1px solid #444; border-radius: 6px; padding: 4px 0; box-shadow: 0 4px 16px rgba(0,0,0,0.4); min-width: 180; font-size: 13px; }
  .ctx-menu-item { padding: 6px 14px; cursor: pointer; color: #e0e0e0; transition: background 0.1s; }
  .ctx-menu-item:hover { background: #3a3a5a; }
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
      <button class="active" data-tab="card">Card</button>
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
let activeTab = 'card';
let faceIndex = 0;
let isFlipping = false;

function rotationToCss(r) {
  return 'rotateX(' + r.x + 'deg) rotateY(' + r.y + 'deg) rotateZ(' + r.z + 'deg)';
}

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
      renderCardDisplay(output, r);
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
    case 'rotations':
      output.innerHTML = '<pre>' + escapeHtml(JSON.stringify(r.display.rotations, null, 2)) + '</pre>';
      break;
  }
}

function renderCardDisplay(container, r) {
  const d = r.display;
  const hasBack = !!d.backFace;
  const rotation = d.rotations[faceIndex] || { x: 0, y: 0, z: 0 };
  const currentFace = faceIndex === 0 ? d.frontFace : d.backFace;

  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'mtg-card-wrapper' + (hasBack ? ' clickable' : '');

  const srSpan = document.createElement('span');
  srSpan.className = 'sr-only';
  srSpan.textContent = d.name;
  wrapper.appendChild(srSpan);

  const img = document.createElement('img');
  img.src = currentFace;
  img.alt = d.name;
  img.draggable = false;
  img.style.transform = rotationToCss(rotation);
  wrapper.appendChild(img);

  if (hasBack) {
    wrapper.addEventListener('click', () => {
      if (isFlipping) return;
      isFlipping = true;
      const nextIndex = faceIndex === 0 ? 1 : 0;
      const nextRotation = d.rotations[nextIndex] || { x: 0, y: 0, z: 0 };
      img.style.transform = rotationToCss(nextRotation);
      setTimeout(() => {
        faceIndex = nextIndex;
        const newFace = faceIndex === 0 ? d.frontFace : d.backFace;
        const finalRotation = d.rotations[faceIndex] || { x: 0, y: 0, z: 0 };
        img.src = newFace;
        img.style.transform = rotationToCss(finalRotation);
        isFlipping = false;
      }, 300);
    });
  }

  wrapper.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, d);
  });

  container.appendChild(wrapper);
}

function showContextMenu(x, y, display) {
  closeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.id = 'ctxMenu';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  const items = [
    { label: 'Copy Card Image', action: () => copyImage(display) },
    { label: 'Copy Scryfall Text', action: () => copyText(display.scryfallText) },
    { label: 'Copy Crucible Text', action: () => copyText(display.crucibleText) },
    { label: 'Copy Scryfall JSON', action: () => copyText(display.scryfallJson) },
    { label: 'Copy Card Data JSON', action: () => copyText(JSON.stringify(JSON.parse(display.scryfallJson), null, 2)) },
  ];

  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'ctx-menu-item';
    el.textContent = item.label;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      item.action();
      closeContextMenu();
    });
    menu.appendChild(el);
  });

  menu.addEventListener('mousedown', e => e.stopPropagation());
  document.body.appendChild(menu);
  document.addEventListener('mousedown', closeContextMenu);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeContextMenu(); });
}

function closeContextMenu() {
  const menu = document.getElementById('ctxMenu');
  if (menu) menu.remove();
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

async function copyImage(display) {
  const src = faceIndex === 0 ? display.frontFace : display.backFace;
  if (!src) return;
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
  } catch (e) {
    console.error('Failed to copy image:', e);
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
  faceIndex = 0;
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
      const display = toDisplayCard(rendered);
      const ms = Math.round(performance.now() - t0);
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Render-Time-Ms': String(ms) });
      res.end(JSON.stringify({
        display,
        cardData: rendered.normalizedCardData,
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
