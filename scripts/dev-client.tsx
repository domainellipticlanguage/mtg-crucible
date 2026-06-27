import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { MtgCard } from '../src/react/MtgCard';
import type { MtgCardDisplayData } from '../src/types';

interface RenderResult {
  display: MtgCardDisplayData;
  cardData: any;
  crucibleTextNormalized: string;
}

type Tab = 'card' | 'cardData' | 'scryfallJson' | 'scryfallText' | 'crucibleText' | 'crucibleTextNormalized' | 'rotations';

const TABS: { key: Tab; label: string }[] = [
  { key: 'card', label: 'Card' },
  { key: 'cardData', label: 'CardData' },
  { key: 'scryfallJson', label: 'Scryfall JSON' },
  { key: 'scryfallText', label: 'Scryfall Text' },
  { key: 'crucibleText', label: 'Crucible Text' },
  { key: 'crucibleTextNormalized', label: 'Crucible Text Normalized' },
  { key: 'rotations', label: 'Rotations' },
];

const DEFAULT_TEXT = `{
  "name": "Invasion of Gobakhan",
  "manaCost": "{1}{W}",
  "types": ["battle"],
  "subtypes": ["Siege"],
  "abilities": "When Invasion of Gobakhan enters the battlefield, look at target opponent's hand. You may exile a nonland card from it. For as long as that card remains exiled, its owner may play it. A spell cast this way costs {2} more to cast.",
  "frameColor": "white",
  "rarity": "rare",
  "battleDefense": "3",
  "linkType": "transform",
  "linkedCard": {
    "name": "Lightshield Array",
    "types": ["enchantment", "creature"],
    "frameColor": "white",
    "rarity": "rare",
    "abilities": "At the beginning of your end step, put a +1/+1 counter on each creature you control.\\nSacrifice Lightshield Array: Creatures you control gain hexproof and indestructible until end of turn.",
    "power": "0",
    "toughness": "4"
  }
}`;

function PreviewApp() {
  const [cardText, setCardText] = useState(DEFAULT_TEXT);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('card');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timing, setTiming] = useState('');
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('high');
  const [format, setFormat] = useState<'png' | 'jpeg'>('jpeg');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const doRender = async () => {
    setLoading(true);
    setError(null);
    setTiming('');
    const t0 = performance.now();

    try {
      const res = await fetch('/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cardText, quality, format }),
      });
      const serverMs = res.headers.get('X-Render-Time-Ms');

      if (!res.ok) {
        const err = await res.text();
        setError(err);
        return;
      }

      const json = await res.json();
      setResult({ display: json.display, cardData: json.cardData, crucibleTextNormalized: json.crucibleTextNormalized });

      const totalMs = Math.round(performance.now() - t0);
      setTiming(`Total: ${totalMs}ms${serverMs ? ` (server: ${serverMs}ms)` : ''}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') doRender();
  };

  const renderTabContent = () => {
    if (loading) return <div className="spinner" />;
    if (error) return <pre className="error">{error}</pre>;
    if (!result) return <span style={{ color: '#666' }}>Click Render to see output</span>;

    switch (activeTab) {
      case 'card':
        return (
          <div style={{ height: 800, width: 800, display: 'flex', justifyContent: 'center', margin: '100px' }}>
            <MtgCard card={result.display} cardText={result.display.scryfallText} />
          </div>
        );
      case 'cardData':
        return <pre>{JSON.stringify(result.cardData, null, 2)}</pre>;
      case 'scryfallJson':
        return <pre>{JSON.stringify(JSON.parse(result.display.scryfallJson), null, 2)}</pre>;
      case 'scryfallText':
        return <pre>{result.display.scryfallText}</pre>;
      case 'crucibleText':
        return <pre>{result.display.crucibleText}</pre>;
      case 'crucibleTextNormalized':
        return <pre>{result.crucibleTextNormalized}</pre>;
      case 'rotations':
        return <pre>{JSON.stringify(result.display.rotations, null, 2)}</pre>;
    }
  };

  return (
    <div className="container">
      <div className="input-panel">
        <textarea
          ref={textareaRef}
          value={cardText}
          onChange={(e) => setCardText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="controls">
          <button onClick={doRender} disabled={loading}>Render</button>
          <label style={{ marginLeft: 12, fontSize: 13 }}>
            Quality:&nbsp;
            <select value={quality} onChange={(e) => setQuality(e.target.value as any)}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>
          <label style={{ marginLeft: 12, fontSize: 13 }}>
            Format:&nbsp;
            <select value={format} onChange={(e) => setFormat(e.target.value as any)}>
              <option value="jpeg">jpeg</option>
              <option value="png">png</option>
            </select>
          </label>
        </div>
      </div>
      <div className="output-panel">
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={activeTab === t.key ? 'active' : ''}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div id="output">
          {renderTabContent()}
        </div>
        {timing && <div className="timing">{timing}</div>}
      </div>
    </div>
  );
}

// =========================================================================
// Layout Editor
// =========================================================================

type Rect = { x: number; y: number; w: number; h: number };
type Handle = 'move' | 'n' | 'e' | 's' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

function isRect(entry: any): entry is Rect & Record<string, any> {
  return entry && typeof entry === 'object'
    && typeof entry.x === 'number'
    && typeof entry.y === 'number'
    && typeof entry.w === 'number'
    && typeof entry.h === 'number';
}

/**
 * Mana-style entries carry the mana-cost shadow offsets and a `size`, but no
 * font/h (those mark a text rect). Detecting by `shadowX` catches both the
 * unrotated form ({y, w, size} — `w` is the right-edge x) and the rotated form
 * ({x, y, size, angle} — `x`/`y` is the right-edge anchor, no `w`).
 */
function isManaLayout(entry: any): entry is { y: number; size: number } & Record<string, any> {
  return entry && typeof entry === 'object'
    && typeof entry.y === 'number'
    && typeof entry.size === 'number'
    && 'shadowX' in entry
    && !('font' in entry);
}

/** Dotted-path read. */
function getAtPath(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Immutable dotted-path write — clones containers along the path. */
function setAtPath(obj: any, path: string, value: any): any {
  const parts = path.split('.');
  if (parts.length === 1) return { ...obj, [path]: value };
  const [head, ...rest] = parts;
  return { ...obj, [head]: setAtPath(obj?.[head] ?? {}, rest.join('.'), value) };
}

/**
 * Walk a layout object and return dotted paths for every leaf rect/mana entry.
 * Stops descending into anything that already looks like a Rect or Mana layout
 * (so x/y/w/h numbers don't get mistaken for further keys to recurse into).
 */
function findEditablePaths(obj: any, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  if (isRect(obj) || isManaLayout(obj)) return prefix ? [prefix] : [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.push(...findEditablePaths(v, path));
  }
  return out;
}

/**
 * Element rotation convention (see src/renderers/element.ts).
 *
 * Every layout element stores `(x, y)` as the canvas position of its local
 * upper-left (x → cw, y → ch), with an optional `angle` (degrees, clockwise
 * about that anchor). Its `w`/`h` extents are in the LOCAL post-rotation frame:
 * for a quarter turn the local-x axis runs along canvas-y and vice-versa, so a
 * fraction's normalization dimension swaps. The editor therefore draws each box
 * anchored at (x, y) and CSS-rotates it about that anchor, and converts drag
 * deltas from screen space into the element's local frame before applying them.
 */
function elementAngle(entry: any): number {
  return (((entry?.angle ?? 0) % 360) + 360) % 360;
}

/** Trig + per-axis display-pixel normalizers for an element at `angle`. */
function rotationBasis(angle: number, displayW: number, displayH: number) {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const quarter = angle === 90 || angle === 270;
  // A `w` fraction maps to canvas-y (→ displayH) on a quarter turn, else canvas-x.
  return {
    cos: Math.abs(cos) < 1e-9 ? 0 : cos,
    sin: Math.abs(sin) < 1e-9 ? 0 : sin,
    wDim: quarter ? displayH : displayW,
    hDim: quarter ? displayW : displayH,
  };
}

interface LayoutBoxProps {
  layoutKey: string;
  entry: Record<string, any>;
  angle: number;
  displayW: number;
  displayH: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (next: Record<string, any>) => void;
}

function LayoutBox({ layoutKey, entry, angle, displayW, displayH, selected, onSelect, onChange }: LayoutBoxProps) {
  const { cos, sin, wDim, hDim } = rotationBasis(angle, displayW, displayH);
  // Box is anchored at (x, y) — its local upper-left — and CSS-rotated about it.
  const pxX = entry.x * displayW;
  const pxY = entry.y * displayH;
  const pxW = entry.w * wDim;
  const pxH = entry.h * hDim;

  const dragRef = useRef<{ startX: number; startY: number; orig: Rect; handle: Handle } | null>(null);

  const startDrag = (e: React.MouseEvent, handle: Handle) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: entry.x, y: entry.y, w: entry.w, h: entry.h },
      handle,
    };
    const onMove = (ev: MouseEvent) => {
      const state = dragRef.current;
      if (!state) return;
      const ddx = ev.clientX - state.startX;
      const ddy = ev.clientY - state.startY;
      const next = { ...state.orig };
      const { handle: h } = state;
      if (h === 'move') {
        // Move shifts the anchor (rotation-invariant) directly in screen space.
        next.x += ddx / displayW; next.y += ddy / displayH;
      } else {
        // Project the screen delta onto the element's local axes, then resize.
        const dLx = ddx * cos + ddy * sin;   // along local-x
        const dLy = -ddx * sin + ddy * cos;  // along local-y
        if (h.includes('e')) { next.w += dLx / wDim; }
        if (h.includes('w')) { next.w -= dLx / wDim; next.x += (dLx * cos) / displayW; next.y += (dLx * sin) / displayH; }
        if (h.includes('s')) { next.h += dLy / hDim; }
        if (h.includes('n')) { next.h -= dLy / hDim; next.x += (-dLy * sin) / displayW; next.y += (dLy * cos) / displayH; }
      }
      // Don't allow negative width/height
      if (next.w < 0.005) next.w = 0.005;
      if (next.h < 0.005) next.h = 0.005;
      onChange({ ...entry, ...next });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleSize = 10;
  const handles: { handle: Handle; style: React.CSSProperties; cursor: string }[] = [
    { handle: 'nw', style: { left: -handleSize/2, top: -handleSize/2 }, cursor: 'nwse-resize' },
    { handle: 'n',  style: { left: '50%', top: -handleSize/2, transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
    { handle: 'ne', style: { right: -handleSize/2, top: -handleSize/2 }, cursor: 'nesw-resize' },
    { handle: 'e',  style: { right: -handleSize/2, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
    { handle: 'se', style: { right: -handleSize/2, bottom: -handleSize/2 }, cursor: 'nwse-resize' },
    { handle: 's',  style: { left: '50%', bottom: -handleSize/2, transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
    { handle: 'sw', style: { left: -handleSize/2, bottom: -handleSize/2 }, cursor: 'nesw-resize' },
    { handle: 'w',  style: { left: -handleSize/2, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
  ];

  return (
    <div
      onMouseDown={(e) => startDrag(e, 'move')}
      style={{
        position: 'absolute',
        left: pxX,
        top: pxY,
        width: pxW,
        height: pxH,
        transformOrigin: '0 0',
        transform: angle ? `rotate(${angle}deg)` : undefined,
        border: selected ? '2px solid #00ffff' : '1px solid rgba(255, 80, 80, 0.7)',
        background: selected ? 'rgba(0, 255, 255, 0.08)' : 'transparent',
        cursor: 'move',
        boxSizing: 'border-box',
      }}
    >
      <span style={{
        position: 'absolute', top: -18, left: 0,
        fontSize: 10, color: selected ? '#00ffff' : '#ff8080',
        background: 'rgba(0,0,0,0.7)', padding: '1px 4px', borderRadius: 2,
        whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>
        {layoutKey}
      </span>
      {selected && handles.map((h) => (
        <div
          key={h.handle}
          onMouseDown={(e) => startDrag(e, h.handle)}
          style={{
            position: 'absolute',
            width: handleSize,
            height: handleSize,
            background: '#00ffff',
            border: '1px solid #000',
            cursor: h.cursor,
            ...h.style,
          }}
        />
      ))}
    </div>
  );
}

interface ManaBoxProps {
  layoutKey: string;
  entry: Record<string, any>;
  angle: number;
  displayW: number;
  displayH: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (next: Record<string, any>) => void;
}

/**
 * Mana-cost position box. The anchor is the mana cost's RIGHT edge: unrotated
 * entries store it as `w` (an absolute x), rotated ones as `x`. `size` is the
 * symbol height (normalized to ch). We render a fixed-width proxy extending LEFT
 * and DOWN from the anchor, rotated about it. Dragging moves the anchor; the
 * n/s handles adjust `size`.
 */
function ManaBox({ layoutKey, entry, angle, displayW, displayH, selected, onSelect, onChange }: ManaBoxProps) {
  const { cos, sin } = rotationBasis(angle, displayW, displayH);
  const anchorKey = 'x' in entry ? 'x' : 'w'; // which field stores the right-edge x
  // Proxy width represents ~3 mana symbols — just for UX, doesn't affect rendering.
  const PROXY_W_PX = 110;
  const rightPx = entry[anchorKey] * displayW;
  const topPx = entry.y * displayH;
  const heightPx = entry.size * displayH; // font size is normalized to ch
  const leftPx = rightPx - PROXY_W_PX;

  const dragRef = useRef<{ startX: number; startY: number; orig: { y: number; ax: number; size: number }; handle: 'move' | 'n' | 's' } | null>(null);

  const startDrag = (e: React.MouseEvent, handle: 'move' | 'n' | 's') => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      orig: { y: entry.y, ax: entry[anchorKey], size: entry.size },
      handle,
    };
    const onMove = (ev: MouseEvent) => {
      const state = dragRef.current;
      if (!state) return;
      const ddx = ev.clientX - state.startX;
      const ddy = ev.clientY - state.startY;
      const next: Record<string, any> = { y: state.orig.y, [anchorKey]: state.orig.ax, size: state.orig.size };
      if (state.handle === 'move') {
        next[anchorKey] = state.orig.ax + ddx / displayW; next.y = state.orig.y + ddy / displayH;
      } else {
        const dLy = -ddx * sin + ddy * cos; // along local-y (size grows down)
        if (state.handle === 's') { next.size = state.orig.size + dLy / displayH; }
        if (state.handle === 'n') {
          next.size = state.orig.size - dLy / displayH;
          next[anchorKey] = state.orig.ax + (-dLy * sin) / displayW;
          next.y = state.orig.y + (dLy * cos) / displayH;
        }
      }
      if (next.size < 0.005) next.size = 0.005;
      onChange({ ...entry, ...next });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleSize = 10;

  return (
    <div
      onMouseDown={(e) => startDrag(e, 'move')}
      style={{
        position: 'absolute',
        left: leftPx,
        top: topPx,
        width: PROXY_W_PX,
        height: heightPx,
        transformOrigin: '100% 0',
        transform: angle ? `rotate(${angle}deg)` : undefined,
        border: selected ? '2px dashed #00ffff' : '1px dashed rgba(255, 200, 80, 0.8)',
        background: selected ? 'rgba(0, 255, 255, 0.08)' : 'transparent',
        cursor: 'move',
        boxSizing: 'border-box',
      }}
    >
      <span style={{
        position: 'absolute', top: -18, right: 0,
        fontSize: 10, color: selected ? '#00ffff' : '#ffc850',
        background: 'rgba(0,0,0,0.7)', padding: '1px 4px', borderRadius: 2,
        whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>
        {layoutKey} (right-anchored)
      </span>
      {selected && (
        <>
          <div
            onMouseDown={(e) => startDrag(e, 'n')}
            style={{ position: 'absolute', left: '50%', top: -handleSize/2, transform: 'translateX(-50%)', width: handleSize, height: handleSize, background: '#00ffff', border: '1px solid #000', cursor: 'ns-resize' }}
          />
          <div
            onMouseDown={(e) => startDrag(e, 's')}
            style={{ position: 'absolute', left: '50%', bottom: -handleSize/2, transform: 'translateX(-50%)', width: handleSize, height: handleSize, background: '#00ffff', border: '1px solid #000', cursor: 'ns-resize' }}
          />
        </>
      )}
    </div>
  );
}

interface SetSymbolBoxProps {
  layoutKey: string;
  entry: Rect & Record<string, any>;
  angle: number;
  displayW: number;
  displayH: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (next: Record<string, any>) => void;
}

/**
 * Set symbol box — special coordinates: `x` is the right-edge, `y` is the vertical center.
 * See drawSetSymbol in helpers.ts. `w` is stored but ignored by the renderer (actual width
 * is derived from the SVG aspect ratio at draw time); we use it here as a visual proxy.
 * The box is anchored at its right-center (x, y) and CSS-rotated about it.
 */
function SetSymbolBox({ layoutKey, entry, angle, displayW, displayH, selected, onSelect, onChange }: SetSymbolBoxProps) {
  const { cos, sin, wDim, hDim } = rotationBasis(angle, displayW, displayH);
  const pxW = entry.w * wDim;
  const pxH = entry.h * hDim;
  const pxX = entry.x * displayW - pxW;         // x is right-edge
  const pxY = entry.y * displayH - pxH / 2;     // y is center

  const dragRef = useRef<{ startX: number; startY: number; orig: Rect; handle: Handle } | null>(null);

  const startDrag = (e: React.MouseEvent, handle: Handle) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: entry.x, y: entry.y, w: entry.w, h: entry.h },
      handle,
    };
    const onMove = (ev: MouseEvent) => {
      const state = dragRef.current;
      if (!state) return;
      const ddx = ev.clientX - state.startX;
      const ddy = ev.clientY - state.startY;
      const next = { ...state.orig };
      const { handle: h } = state;
      // 'move' shifts the anchor (right-edge x, center y) directly
      if (h === 'move') {
        next.x += ddx / displayW; next.y += ddy / displayH;
      } else {
        // Project the screen delta onto the element's local axes.
        const dLx = ddx * cos + ddy * sin;
        const dLy = -ddx * sin + ddy * cos;
        // Width: x = right edge, so w handle keeps it fixed; e handle moves it along local-x.
        if (h.includes('w')) { next.w -= dLx / wDim; }
        if (h.includes('e')) { next.w += dLx / wDim; next.x += (dLx * cos) / displayW; next.y += (dLx * sin) / displayH; }
        // Height: y = center, so an edge drag shifts the center by half along local-y.
        if (h.includes('n')) { next.h -= dLy / hDim; next.x += (-dLy / 2 * sin) / displayW; next.y += (dLy / 2 * cos) / displayH; }
        if (h.includes('s')) { next.h += dLy / hDim; next.x += (-dLy / 2 * sin) / displayW; next.y += (dLy / 2 * cos) / displayH; }
      }
      if (next.w < 0.005) next.w = 0.005;
      if (next.h < 0.005) next.h = 0.005;
      onChange({ ...entry, ...next });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleSize = 10;
  const handles: { handle: Handle; style: React.CSSProperties; cursor: string }[] = [
    { handle: 'nw', style: { left: -handleSize/2, top: -handleSize/2 }, cursor: 'nwse-resize' },
    { handle: 'n',  style: { left: '50%', top: -handleSize/2, transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
    { handle: 'ne', style: { right: -handleSize/2, top: -handleSize/2 }, cursor: 'nesw-resize' },
    { handle: 'e',  style: { right: -handleSize/2, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
    { handle: 'se', style: { right: -handleSize/2, bottom: -handleSize/2 }, cursor: 'nwse-resize' },
    { handle: 's',  style: { left: '50%', bottom: -handleSize/2, transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
    { handle: 'sw', style: { left: -handleSize/2, bottom: -handleSize/2 }, cursor: 'nesw-resize' },
    { handle: 'w',  style: { left: -handleSize/2, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
  ];

  return (
    <div
      onMouseDown={(e) => startDrag(e, 'move')}
      style={{
        position: 'absolute',
        left: pxX,
        top: pxY,
        width: pxW,
        height: pxH,
        transformOrigin: '100% 50%',
        transform: angle ? `rotate(${angle}deg)` : undefined,
        border: selected ? '2px solid #00ffff' : '1px dashed rgba(180, 120, 255, 0.8)',
        background: selected ? 'rgba(0, 255, 255, 0.08)' : 'transparent',
        cursor: 'move',
        boxSizing: 'border-box',
      }}
    >
      <span style={{
        position: 'absolute', top: -18, right: 0,
        fontSize: 10, color: selected ? '#00ffff' : '#b478ff',
        background: 'rgba(0,0,0,0.7)', padding: '1px 4px', borderRadius: 2,
        whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>
        {layoutKey} (right-anchored, y-centered)
      </span>
      {selected && handles.map((h) => (
        <div
          key={h.handle}
          onMouseDown={(e) => startDrag(e, h.handle)}
          style={{
            position: 'absolute',
            width: handleSize,
            height: handleSize,
            background: '#00ffff',
            border: '1px solid #000',
            cursor: h.cursor,
            ...h.style,
          }}
        />
      ))}
    </div>
  );
}

/** Crucible text samples per template — picked to hit the main layout regions. */
const TEMPLATE_SAMPLES: Record<string, string> = {
  standard: `Lightning Bolt {R}
Instant
Lightning Bolt deals 3 damage to any target.
Rarity: Uncommon`,
  planeswalker: `Chandra, Torch of Defiance {2}{R}{R}
Legendary Planeswalker — Chandra
+1: Exile the top card of your library. You may cast it.
+1: Chandra, Torch of Defiance deals 2 damage to any target.
-3: Chandra deals 4 damage to target creature.
-7: You get an emblem.
Loyalty: 4
Rarity: Mythic Rare`,
  saga: `History of Benalia {2}{W}
Enchantment — Saga
I, II — Create a 2/2 white Knight creature token with vigilance.
III — Knights you control get +2/+1 until end of turn.
Rarity: Mythic Rare`,
  class: `Ranger Class {1}{G}
Enchantment — Class
Creatures you control get +1/+1.
{3}{G}: Level 2
When this Class becomes level 2, search your library for a creature card.
{5}{G}: Level 3
Whenever a creature enters the battlefield under your control, it gains trample and lifelink.
Rarity: Rare`,
  battle: `Invasion of Gobakhan {1}{W}
Battle — Siege
When this Battle enters, look at target opponent's hand.
Defense: 3
Rarity: Rare
----
Lightshield Array
Enchantment Creature
At the beginning of your end step, put a +1/+1 counter on each creature you control.
0/4`,
  adventure: `Bonecrusher Giant {2}{R}
Creature — Giant
Whenever Bonecrusher Giant becomes the target of a spell, Bonecrusher deals 2 damage to that spell's controller.
4/3
Rarity: Rare
--adventure--
Stomp {1}{R}
Instant — Adventure
Stomp deals 2 damage to any target.`,
  prepare: `Abigale, Poet Laureate {1}{W}{B}
Legendary Creature — Bird Bard
Flying
Whenever you cast a creature spell, Abigale becomes prepared.
2/2
Rarity: Mythic Rare
--prepare--
Heroic Stanza {1}{W/B}
Sorcery
Put a +1/+1 counter on target creature.`,
  omen: `Bloomvine Regent {3}{G}{G}
Creature — Dragon
Flying
Whenever this creature or another Dragon you control enters, you gain 3 life.
4/4
Rarity: Rare
--omen--
Claim Territory {2}{G}
Sorcery — Omen
Search your library for up to two basic Forest cards.`,
  room: `Bottomless Pool {U}
Enchantment — Room
When you unlock this door, return up to one target creature to its owner's hand.
Rarity: Uncommon
----
Locker Room {4}{U}
Enchantment — Room
Whenever one or more creatures you control deal combat damage to a player, draw a card.`,
  planeswalker_tall: `Teferi, Hero of Dominaria {3}{W}{U}
Legendary Planeswalker — Teferi
+1: Draw a card. At the beginning of the next end step, untap two lands.
-3: Put target nonland permanent into its owner's library third from the top.
-8: You get an emblem with "Whenever you draw a card, exile target permanent an opponent controls."
Loyalty: 4
Rarity: Mythic Rare`,
  transform_front: `Delver of Secrets {U}
Creature — Human Wizard
At the beginning of your upkeep, look at the top card of your library. You may reveal that card. If an instant or sorcery card is revealed this way, transform Delver of Secrets.
1/1
Rarity: Common
--transform--
Insectile Aberration
Creature — Human Insect
Flying
3/2`,
  transform_back: `Insectile Aberration
Creature — Human Insect
Flying
3/2
Rarity: Common
--transform--
Delver of Secrets {U}
Creature — Human Wizard
At the beginning of your upkeep, look at the top card of your library. You may reveal that card.
1/1`,
  mdfc_front: `Emeria's Call {4}{W}{W}
Sorcery
Create two 4/4 white Angel Warrior creature tokens with flying. Non-Angel creatures you control gain indestructible until your next turn.
Rarity: Mythic Rare
--modal--
Emeria, Shattered Skyclave
Land
({T}: Add {W}.)
Emeria, Shattered Skyclave enters tapped unless you pay 3 life.`,
  mdfc_back: `Emeria, Shattered Skyclave
Land
({T}: Add {W}.)
Emeria, Shattered Skyclave enters tapped unless you pay 3 life.
Rarity: Mythic Rare
--modal--
Emeria's Call {4}{W}{W}
Sorcery
Create two 4/4 white Angel Warrior creature tokens with flying.`,
  split: `Fire {1}{R}
Instant
Fire deals 2 damage divided as you choose among one or two targets.
Rarity: Uncommon
----
Ice {1}{U}
Instant
Tap target permanent. Draw a card.`,
  fuse: `Wear {1}{R}
Instant
Destroy target artifact.
Fuse
Rarity: Rare
----
Tear {W}
Instant
Destroy target enchantment.
Fuse`,
  flip: `Bushi Tenderfoot {W}
Creature — Human Soldier
When a creature dealt damage by Bushi Tenderfoot this turn dies, flip Bushi Tenderfoot.
1/1
Rarity: Uncommon
--flip--
Kenzo the Hardhearted
Legendary Creature — Human Samurai
Double strike; bushido 2
3/4`,
  mutate: `Gemrazer {2}{R}{G}
Creature — Beast
Mutate {1}{G}{W}
Reach, trample
Whenever this creature mutates, destroy target artifact or enchantment.
4/4
Rarity: Rare`,
  prototype: `Phyrexian Fleshgorger {7}
Artifact Creature — Phyrexian Wurm
Prototype {1}{B}{B} — 3/3
Menace
Whenever Phyrexian Fleshgorger attacks, each opponent loses 2 life and you gain 2 life.
7/5
Rarity: Mythic Rare`,
  leveler: `Student of Warfare {W}
Creature — Human Soldier
LEVEL 2-7: 1/1
First strike
LEVEL 8+: 4/4
Double strike
1/1
Rarity: Rare`,
  aftermath: `Appeal {G}
Sorcery
Target creature gets +X/+X until end of turn, where X is the number of creatures you control.
Rarity: Uncommon
--aftermath--
Authority {1}{W}
Sorcery
Aftermath
Tap up to two target creatures.`,
};

function EditorApp() {
  const [templates, setTemplates] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState<string>('standard');
  const [cardText, setCardText] = useState<string>(TEMPLATE_SAMPLES.standard);
  const [baseLayout, setBaseLayout] = useState<Record<string, any> | null>(null);
  const [overrides, setOverrides] = useState<Record<string, any>>({});
  const [rendered, setRendered] = useState<RenderResult | null>(null);
  const [displaySize, setDisplaySize] = useState<{ w: number; h: number }>({ w: 600, h: 840 });
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 1500, h: 2100 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Fetch list of templates once
  useEffect(() => {
    fetch('/layout-templates')
      .then(r => r.json())
      .then(j => setTemplates(j.templates))
      .catch(e => setError(String(e)));
  }, []);

  // When template changes, fetch its base layout and load the sample text
  useEffect(() => {
    fetch(`/layout/${templateName}`)
      .then(r => r.json())
      .then(j => {
        setBaseLayout(j.layout);
        setCanvasSize({ w: j.w, h: j.h });
        setOverrides({});
      })
      .catch(e => setError(String(e)));
    const sample = TEMPLATE_SAMPLES[templateName];
    if (sample) setCardText(sample);
  }, [templateName]);

  const effectiveLayout = useMemo(() => {
    if (!baseLayout) return null;
    let result: any = baseLayout;
    for (const [path, value] of Object.entries(overrides)) {
      result = setAtPath(result, path, value);
    }
    return result;
  }, [baseLayout, overrides]);

  // Debounced re-render when text or overrides change
  const renderTimer = useRef<number | null>(null);
  const doRender = useCallback(async () => {
    if (!effectiveLayout) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/render-with-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cardText,
          templateName,
          layoutOverride: effectiveLayout,
          format: 'jpeg',
          quality: 'medium',
        }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const json = await res.json();
      setRendered({
        display: json.display,
        cardData: json.cardData,
        crucibleTextNormalized: '',
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [cardText, templateName, effectiveLayout]);

  useEffect(() => {
    if (renderTimer.current) window.clearTimeout(renderTimer.current);
    renderTimer.current = window.setTimeout(doRender, 250);
    return () => {
      if (renderTimer.current) window.clearTimeout(renderTimer.current);
    };
  }, [doRender]);

  const rectKeys = useMemo(() => {
    if (!effectiveLayout) return [];
    return findEditablePaths(effectiveLayout)
      .filter(p => isRect(getAtPath(effectiveLayout, p)) && !p.endsWith('setSymbol'));
  }, [effectiveLayout]);

  const setSymbolKeys = useMemo(() => {
    if (!effectiveLayout) return [];
    return findEditablePaths(effectiveLayout)
      .filter(p => isRect(getAtPath(effectiveLayout, p)) && p.endsWith('setSymbol'));
  }, [effectiveLayout]);

  const manaKeys = useMemo(() => {
    if (!effectiveLayout) return [];
    return findEditablePaths(effectiveLayout)
      .filter(p => isManaLayout(getAtPath(effectiveLayout, p)));
  }, [effectiveLayout]);

  const updateEntry = (key: string, next: Record<string, any>) => {
    setOverrides(prev => ({ ...prev, [key]: next }));
  };

  // Apply display scale — fit within a fixed height
  const DISPLAY_H = 840;
  const aspect = canvasSize.w / canvasSize.h;
  const displayW = DISPLAY_H * aspect;
  const displayH = DISPLAY_H;

  // Nudge the selected element by (dxPx, dyPx) in on-screen display pixels —
  // same basis as the drag handlers (which divide deltas by displayW/displayH).
  // A "move" shifts the element's anchor in screen space, regardless of rotation.
  // Mana stores its right-edge x in `w` when unrotated; everything else uses `x`.
  const nudgeSelected = useCallback((dxPx: number, dyPx: number) => {
    if (!selectedKey || !effectiveLayout) return;
    const entry = getAtPath(effectiveLayout, selectedKey);
    if (!entry) return;
    const dx = dxPx / displayW;
    const dy = dyPx / displayH;
    const anchorKey = 'x' in entry ? 'x' : 'w';
    updateEntry(selectedKey, { ...entry, [anchorKey]: entry[anchorKey] + dx, y: entry.y + dy });
  }, [selectedKey, effectiveLayout, displayW, displayH]);

  // Focus the canvas when an element is selected so arrow keys reach our handler
  // (clicking a box calls preventDefault, so focus would otherwise stay in the
  // card-text textarea and the guard below would swallow the arrows).
  const canvasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedKey) canvasRef.current?.focus({ preventScroll: true });
  }, [selectedKey]);

  // Arrow keys nudge the selected element by 1 display pixel (Shift = 10).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -1;
      else if (e.key === 'ArrowRight') dx = 1;
      else if (e.key === 'ArrowUp') dy = -1;
      else if (e.key === 'ArrowDown') dy = 1;
      else return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      nudgeSelected(dx * step, dy * step);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedKey, nudgeSelected]);

  return (
    <div style={{ display: 'flex', gap: '1rem', width: '100%', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: 360, maxWidth: 600 }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label>Template:&nbsp;
            <select value={templateName} onChange={(e) => setTemplateName(e.target.value)}>
              {templates.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <span style={{ fontSize: 12, color: '#888' }}>
            {loading ? 'rendering…' : ''}
          </span>
        </div>
        <textarea
          value={cardText}
          onChange={(e) => setCardText(e.target.value)}
          style={{ height: 240 }}
        />
        <div>
          <strong>Layout JSON (override):</strong>
          <pre style={{
            background: '#16213e', padding: 8, borderRadius: 4, fontSize: 11,
            maxHeight: 300, overflow: 'auto',
            width: '100%', boxSizing: 'border-box',
          }}>
            {JSON.stringify(effectiveLayout, null, 2)}
          </pre>
          <button onClick={() => {
            if (effectiveLayout) navigator.clipboard.writeText(JSON.stringify(effectiveLayout, null, 2));
          }}>Copy layout JSON</button>
          &nbsp;
          <button onClick={() => setOverrides({})}>Reset to base</button>
          &nbsp;
          <button
            disabled={!effectiveLayout || Object.keys(overrides).length === 0}
            onClick={async () => {
              if (!effectiveLayout) return;
              const res = await fetch('/save-layout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateName, layoutOverride: effectiveLayout }),
              });
              if (!res.ok) {
                setError(await res.text());
                return;
              }
              const j = await res.json();
              // Clear overrides — they're now the base layout on disk and in memory
              setOverrides({});
              // Refetch base layout so the UI reflects the new on-disk state
              const lay = await fetch(`/layout/${templateName}`).then(r => r.json());
              setBaseLayout(lay.layout);
              setError(null);
              console.log('Saved:', j);
            }}
          >Save to layout.ts</button>
        </div>
        {error && <pre className="error">{error}</pre>}
      </div>
      <div ref={canvasRef} tabIndex={0}
           style={{ position: 'relative', width: displayW, height: displayH, flexShrink: 0, background: '#000', overflow: 'hidden', outline: 'none' }}
           onMouseDown={() => setSelectedKey(null)}>
        {rendered && (
          <img
            src={rendered.display.frontFaceImageUrl}
            alt="card"
            style={{ position: 'absolute', left: 0, top: 0, width: displayW, height: displayH, pointerEvents: 'none' }}
          />
        )}
        {effectiveLayout && rectKeys.map(key => {
          const entry = getAtPath(effectiveLayout, key);
          return (
            <LayoutBox
              key={key}
              layoutKey={key}
              entry={entry}
              angle={elementAngle(entry)}
              displayW={displayW}
              displayH={displayH}
              selected={selectedKey === key}
              onSelect={() => setSelectedKey(key)}
              onChange={(next) => updateEntry(key, next)}
            />
          );
        })}
        {effectiveLayout && manaKeys.map(key => {
          const entry = getAtPath(effectiveLayout, key);
          return (
            <ManaBox
              key={key}
              layoutKey={key}
              entry={entry}
              angle={elementAngle(entry)}
              displayW={displayW}
              displayH={displayH}
              selected={selectedKey === key}
              onSelect={() => setSelectedKey(key)}
              onChange={(next) => updateEntry(key, next)}
            />
          );
        })}
        {effectiveLayout && setSymbolKeys.map(key => {
          const entry = getAtPath(effectiveLayout, key);
          return (
            <SetSymbolBox
              key={key}
              layoutKey={key}
              entry={entry as Rect & Record<string, any>}
              angle={elementAngle(entry)}
              displayW={displayW}
              displayH={displayH}
              selected={selectedKey === key}
              onSelect={() => setSelectedKey(key)}
              onChange={(next) => updateEntry(key, next)}
            />
          );
        })}
      </div>
    </div>
  );
}

// =========================================================================
// Mask Editor — compose SVG masks from rectangle primitives.
// Each shape is a rect with optional rx/ry corner radii.
//   - Straight pinline: rx=0, ry=0
//   - Name banner: rx=cap_depth, ry=h/2
// =========================================================================

interface MaskShape {
  id: string;
  x: number;      // canvas-space (e.g. 1500x2100)
  y: number;
  w: number;
  h: number;
  rx: number;
  ry: number;
  strokeWidth: number;  // 0 = filled solid; >0 = outline only (for pinlines)
}

function shapesToSvg(shapes: MaskShape[], width: number, height: number): string {
  const rects = shapes.map(s => {
    const stroked = s.strokeWidth > 0;
    const fill = stroked ? 'none' : 'black';
    const strokeAttrs = stroked ? ` stroke="black" stroke-width="${s.strokeWidth}"` : '';
    return `  <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.rx}" ry="${s.ry}" fill="${fill}"${strokeAttrs}/>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
${rects}
</svg>
`;
}

interface MaskShapeBoxProps {
  shape: MaskShape;
  scaleX: number;
  scaleY: number;
  selected: boolean;
  onSelect: () => void;
  onChange: (next: MaskShape) => void;
}

function MaskShapeBox({ shape, scaleX, scaleY, selected, onSelect, onChange }: MaskShapeBoxProps) {
  const pxX = shape.x * scaleX;
  const pxY = shape.y * scaleY;
  const pxW = shape.w * scaleX;
  const pxH = shape.h * scaleY;

  const dragRef = useRef<{ startX: number; startY: number; orig: MaskShape; handle: Handle } | null>(null);

  const startDrag = (e: React.MouseEvent, handle: Handle) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, orig: { ...shape }, handle };
    const onMove = (ev: MouseEvent) => {
      const state = dragRef.current;
      if (!state) return;
      const dx = (ev.clientX - state.startX) / scaleX;
      const dy = (ev.clientY - state.startY) / scaleY;
      const next = { ...state.orig };
      const { handle: h } = state;
      if (h === 'move') {
        next.x += dx; next.y += dy;
      } else {
        if (h.includes('w')) { next.x += dx; next.w -= dx; }
        if (h.includes('e')) { next.w += dx; }
        if (h.includes('n')) { next.y += dy; next.h -= dy; }
        if (h.includes('s')) { next.h += dy; }
      }
      if (next.w < 1) next.w = 1;
      if (next.h < 1) next.h = 1;
      onChange(next);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleSize = 10;
  const handles: { handle: Handle; style: React.CSSProperties; cursor: string }[] = [
    { handle: 'nw', style: { left: -handleSize/2, top: -handleSize/2 }, cursor: 'nwse-resize' },
    { handle: 'n',  style: { left: '50%', top: -handleSize/2, transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
    { handle: 'ne', style: { right: -handleSize/2, top: -handleSize/2 }, cursor: 'nesw-resize' },
    { handle: 'e',  style: { right: -handleSize/2, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
    { handle: 'se', style: { right: -handleSize/2, bottom: -handleSize/2 }, cursor: 'nwse-resize' },
    { handle: 's',  style: { left: '50%', bottom: -handleSize/2, transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
    { handle: 'sw', style: { left: -handleSize/2, bottom: -handleSize/2 }, cursor: 'nesw-resize' },
    { handle: 'w',  style: { left: -handleSize/2, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
  ];

  const stroked = shape.strokeWidth > 0;
  // Approximate SVG stroke (centered on path) with CSS border (inside box). Close enough visually.
  const strokePxX = shape.strokeWidth * scaleX;
  return (
    <div
      onMouseDown={(e) => startDrag(e, 'move')}
      style={{
        position: 'absolute',
        left: pxX,
        top: pxY,
        width: pxW,
        height: pxH,
        background: stroked ? 'transparent' : 'rgba(0,0,0,0.7)',
        border: stroked ? `${Math.max(strokePxX, 1)}px solid rgba(0,0,0,0.7)` : 'none',
        borderRadius: `${shape.rx * scaleX}px / ${shape.ry * scaleY}px`,
        outline: selected ? '2px solid #00ffff' : '1px solid rgba(0, 255, 255, 0.4)',
        cursor: 'move',
        boxSizing: 'border-box',
      }}
    >
      {selected && handles.map((h) => (
        <div
          key={h.handle}
          onMouseDown={(e) => startDrag(e, h.handle)}
          style={{
            position: 'absolute',
            width: handleSize,
            height: handleSize,
            background: '#00ffff',
            border: '1px solid #000',
            cursor: h.cursor,
            ...h.style,
          }}
        />
      ))}
    </div>
  );
}

function MaskEditorApp() {
  const [templateName, setTemplateName] = useState<string>('standard');
  const [templates, setTemplates] = useState<string[]>([]);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 1500, h: 2100 });
  const [shapes, setShapes] = useState<MaskShape[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [maskName, setMaskName] = useState('my-mask');
  const [maskList, setMaskList] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);

  // Fetch template list and mask list once
  useEffect(() => {
    fetch('/layout-templates').then(r => r.json()).then(j => setTemplates(j.templates));
    fetch('/masks').then(r => r.json()).then(j => setMaskList(j.masks));
  }, []);

  // When template changes, fetch its canvas size and render a sample card as the background reference
  useEffect(() => {
    fetch(`/layout/${templateName}`).then(r => r.json()).then(j => {
      setCanvasSize({ w: j.w, h: j.h });
    });
    const sample = TEMPLATE_SAMPLES[templateName] ?? TEMPLATE_SAMPLES.standard;
    fetch('/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: sample, format: 'jpeg', quality: 'medium' }),
    }).then(r => r.ok ? r.json() : null).then(j => {
      if (j?.display?.frontFaceImageUrl) setBgImageUrl(j.display.frontFaceImageUrl);
    });
  }, [templateName]);

  const DISPLAY_H = 840;
  const aspect = canvasSize.w / canvasSize.h;
  const displayW = DISPLAY_H * aspect;
  const displayH = DISPLAY_H;
  const scaleX = displayW / canvasSize.w;
  const scaleY = displayH / canvasSize.h;

  const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const addRect = () => {
    setShapes([...shapes, {
      id: newId(),
      x: canvasSize.w * 0.1, y: canvasSize.h * 0.1,
      w: canvasSize.w * 0.8, h: canvasSize.h * 0.05,
      rx: 0, ry: 0, strokeWidth: 0,
    }]);
  };

  const addBanner = () => {
    // Default banner ratios derived from class-pinline.svg's name banner
    const w = canvasSize.w * 0.85;
    const h = canvasSize.h * 0.06;
    setShapes([...shapes, {
      id: newId(),
      x: (canvasSize.w - w) / 2, y: canvasSize.h * 0.05,
      w, h,
      rx: h * 0.18, ry: h / 2, strokeWidth: 0,
    }]);
  };

  const addPinline = () => {
    // Outline-only rectangle for art-box pinlines etc.
    setShapes([...shapes, {
      id: newId(),
      x: canvasSize.w * 0.08, y: canvasSize.h * 0.10,
      w: canvasSize.w * 0.84, h: canvasSize.h * 0.45,
      rx: 0, ry: 0, strokeWidth: 6,
    }]);
  };

  const updateShape = (id: string, next: MaskShape) => {
    setShapes(shapes.map(s => s.id === id ? next : s));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setShapes(shapes.filter(s => s.id !== selectedId));
    setSelectedId(null);
  };

  const loadMask = async (filename: string) => {
    try {
      const text = await fetch(`/mask/${filename}`).then(r => r.text());
      const parsed = parseSvgRects(text);
      setShapes(parsed.map(r => ({ id: newId(), ...r })));
      setMaskName(filename.replace(/\.svg$/i, ''));
      setError(null);
    } catch (e: any) {
      setError(`Failed to load: ${e.message}`);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const svg = shapesToSvg(shapes, canvasSize.w, canvasSize.h);
      const res = await fetch('/save-mask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: maskName, svg, width: canvasSize.w, height: canvasSize.h }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      // Refresh mask list
      const j = await fetch('/masks').then(r => r.json());
      setMaskList(j.masks);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedShape = shapes.find(s => s.id === selectedId) ?? null;
  const updateSelectedField = (field: keyof MaskShape, value: number) => {
    if (!selectedShape) return;
    updateShape(selectedShape.id, { ...selectedShape, [field]: value });
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', width: '100%', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: 320, maxWidth: 600 }}>
        <label>Template (background reference):&nbsp;
          <select value={templateName} onChange={(e) => setTemplateName(e.target.value)}>
            {templates.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={addRect}>+ Rectangle</button>
          <button onClick={addBanner}>+ Banner (rounded)</button>
          <button onClick={addPinline}>+ Pinline (outline)</button>
          <button onClick={deleteSelected} disabled={!selectedShape}>Delete</button>
        </div>
        <div style={{ marginTop: 12 }}>
          <strong>Mask name:</strong>
          <input
            value={maskName}
            onChange={(e) => setMaskName(e.target.value)}
            style={{ marginLeft: 8, padding: 4 }}
          />
          <button onClick={save} disabled={saving || shapes.length === 0} style={{ marginLeft: 8 }}>
            {saving ? 'Saving…' : 'Save SVG + PNG'}
          </button>
        </div>
        <div>
          <strong>Existing masks:</strong>
          <select onChange={(e) => e.target.value && loadMask(e.target.value)} value="" style={{ marginLeft: 8 }}>
            <option value="">— load existing —</option>
            {maskList.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {selectedShape && (
          <div style={{ marginTop: 12, padding: 8, background: '#16213e', borderRadius: 4 }}>
            <strong>Selected shape:</strong>
            <table style={{ marginTop: 4, fontSize: 12 }}>
              <tbody>
                {(['x','y','w','h','rx','ry','strokeWidth'] as const).map(field => (
                  <tr key={field}>
                    <td style={{ paddingRight: 8 }}>{field}:</td>
                    <td>
                      <input
                        type="number"
                        value={Math.round(selectedShape[field])}
                        onChange={(e) => updateSelectedField(field, parseFloat(e.target.value) || 0)}
                        style={{ width: 80 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <strong>SVG output:</strong>
          <pre style={{
            background: '#16213e', padding: 8, borderRadius: 4, fontSize: 11,
            maxHeight: 200, overflow: 'auto',
            width: '100%', boxSizing: 'border-box',
          }}>
            {shapesToSvg(shapes, canvasSize.w, canvasSize.h)}
          </pre>
        </div>
        {error && <pre className="error">{error}</pre>}
      </div>
      <div
        style={{ position: 'relative', width: displayW, height: displayH, flexShrink: 0, background: '#000', overflow: 'hidden' }}
        onMouseDown={() => setSelectedId(null)}
      >
        {bgImageUrl && (
          <img
            src={bgImageUrl}
            alt="reference"
            style={{ position: 'absolute', left: 0, top: 0, width: displayW, height: displayH, opacity: 0.4, pointerEvents: 'none' }}
          />
        )}
        {shapes.map(s => (
          <MaskShapeBox
            key={s.id}
            shape={s}
            scaleX={scaleX}
            scaleY={scaleY}
            selected={selectedId === s.id}
            onSelect={() => setSelectedId(s.id)}
            onChange={(next) => updateShape(s.id, next)}
          />
        ))}
      </div>
    </div>
  );
}

/** Naive SVG <rect> parser — works for masks produced by this editor (and most simple SVGs). */
function parseSvgRects(svg: string): Omit<MaskShape, 'id'>[] {
  const out: Omit<MaskShape, 'id'>[] = [];
  const re = /<rect\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) {
    const attrs = m[1];
    const get = (name: string) => {
      const a = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(attrs);
      return a ? parseFloat(a[1]) : 0;
    };
    out.push({
      x: get('x'), y: get('y'), w: get('width'), h: get('height'),
      rx: get('rx'), ry: get('ry'),
      strokeWidth: get('stroke-width'),
    });
  }
  return out;
}

// =========================================================================
// Top-level app w/ Preview|Editor|Mask mode toggle
// =========================================================================

type Mode = 'preview' | 'editor' | 'mask';

function Root() {
  const [mode, setMode] = useState<Mode>('preview');
  const tabStyle = (m: Mode) => mode === m
    ? { background: '#c4a35a', color: '#1a1a2e' }
    : { background: '#16213e', color: '#e0e0e0' };
  return (
    <>
      <h1>MTG Crucible</h1>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => setMode('preview')} style={tabStyle('preview')}>Preview</button>
        <button onClick={() => setMode('editor')} style={tabStyle('editor')}>Editor</button>
        <button onClick={() => setMode('mask')} style={tabStyle('mask')}>Mask</button>
      </div>
      {mode === 'preview' && <PreviewApp />}
      {mode === 'editor' && <EditorApp />}
      {mode === 'mask' && <MaskEditorApp />}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
