import { parseCard, renderCard } from '../src';

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
  .toggle { display: flex; background: #16213e; border-radius: 6px; overflow: hidden; border: 1px solid #444; }
  .toggle label { padding: 0.5rem 1rem; cursor: pointer; font-size: 0.85rem; transition: background 0.15s; }
  .toggle input { display: none; }
  .toggle input:checked + span { background: #c4a35a; color: #1a1a2e; }
  .toggle span { display: block; padding: 0.5rem 1rem; }
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
      <div class="toggle">
        <label><input type="radio" name="mode" value="image" checked><span>Image</span></label>
        <label><input type="radio" name="mode" value="json"><span>CardData</span></label>
      </div>
      <button id="renderBtn" onclick="doRender()">Render</button>
    </div>
  </div>
  <div class="output-panel">
    <h2>Output</h2>
    <div id="output"><span style="color:#666">Click Render to see output</span></div>
    <div id="timing" style="margin-top:0.5rem;font-size:0.8rem;color:#888"></div>
  </div>
</div>
<script>
async function doRender() {
  const text = document.getElementById('cardText').value;
  const mode = document.querySelector('input[name="mode"]:checked').value;
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
      body: JSON.stringify({ text, mode }),
    });
    const serverMs = res.headers.get('X-Render-Time-Ms');
    if (!res.ok) {
      const err = await res.text();
      output.innerHTML = '<pre class="error">' + escapeHtml(err) + '</pre>';
      return;
    }
    if (mode === 'image') {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      output.innerHTML = '<img src="' + url + '" alt="Rendered card">';
    } else {
      const json = await res.json();
      output.innerHTML = '<pre>' + escapeHtml(JSON.stringify(json.cardData, null, 2)) + '</pre>';
    }
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
  const method = event.requestContext?.http?.method || event.httpMethod;
  const rawPath = event.rawPath || event.path || '/';

  if (method === 'GET' && (rawPath === '/' || rawPath === '')) {
    return {
      statusCode: 200,
      headers: { 'content-type': 'text/html' },
      body: HTML,
    };
  }

  if (method === 'POST' && rawPath === '/render') {
    const body = event.isBase64Encoded
      ? JSON.parse(Buffer.from(event.body, 'base64').toString())
      : JSON.parse(event.body);
    const { text, mode } = body;

    try {
      const t0 = performance.now();
      if (mode === 'json') {
        const cardData = parseCard(text);
        const ms = Math.round(performance.now() - t0);
        return {
          statusCode: 200,
          headers: {
            'content-type': 'application/json',
            'x-render-time-ms': String(ms),
          },
          body: JSON.stringify({ cardData }),
        };
      } else {
        const rendered = await renderCard(text);
        const ms = Math.round(performance.now() - t0);
        return {
          statusCode: 200,
          headers: {
            'content-type': 'image/png',
            'x-render-time-ms': String(ms),
          },
          body: rendered.frontFace.toString('base64'),
          isBase64Encoded: true,
        };
      }
    } catch (err: any) {
      return {
        statusCode: 500,
        headers: { 'content-type': 'text/plain' },
        body: err.message || 'Internal server error',
      };
    }
  }

  return { statusCode: 404, body: 'Not found' };
}
