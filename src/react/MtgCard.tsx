import React, { useState, useCallback, useEffect } from 'react';
import type { MtgCardDisplayData } from '../types';

export interface MtgCardProps {
  card: MtgCardDisplayData;
  cardText?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Style override for the rotation arrow widget. Set `display: 'none'` to hide it. */
  rotateWidgetStyle?: React.CSSProperties;
}

interface ContextMenuItem {
  label: string;
  action: () => void;
}

function RotateWidget({ spinKey, style }: { spinKey: number; style?: React.CSSProperties }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...style,
        transform: hovered ? 'scale(1.15)' : 'scale(1)',
        opacity: hovered ? 1 : 0.8,
        transition: 'transform 0.15s ease, opacity 0.15s ease',
      }}
    >
      <svg
        key={spinKey}
        viewBox="0 0 24 24"
        width="100%"
        height="100%"
        style={spinKey > 0 ? { animation: 'mtg-crucible-spin 0.4s ease-in-out' } : undefined}
      >
        <circle cx="12" cy="12" r="11" fill={hovered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.85)'} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
        <path
          d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-1.76-4.24L14 10h6V4l-2.35 2.35z"
          fill={hovered ? '#333' : '#555'}
        />
      </svg>
    </div>
  );
}

// Inject keyframes once
let keyframesInjected = false;
function ensureKeyframes() {
  if (keyframesInjected || typeof document === 'undefined') return;
  const sheet = document.createElement('style');
  sheet.textContent = '@keyframes mtg-crucible-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
  document.head.appendChild(sheet);
  keyframesInjected = true;
}

export function MtgCard({ card, cardText, className, style, rotateWidgetStyle }: MtgCardProps) {
  const [rotationIndex, setRotationIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [widgetSpin, setWidgetSpin] = useState(0);

  useEffect(ensureKeyframes, []);

  const hasMultipleStates = card.rotations.length > 1;
  const currentRotation = card.rotations[rotationIndex] ?? { x: 0, y: 0, z: 0 };
  // Back face is visible when Y rotation puts it face-forward
  const showingFront = !card.backFaceImageUrl || (Math.round(currentRotation.y / 180) % 2 === 0);

  const handleClick = useCallback(() => {
    if (!hasMultipleStates) return;
    setRotationIndex(i => (i + 1) % card.rotations.length);
    setWidgetSpin(s => s + 1);
  }, [hasMultipleStates, card.rotations.length]);

  // Close context menu on click outside or escape
  useEffect(() => {
    if (!menuPos) return;
    const handleClose = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      setMenuPos(null);
    };
    document.addEventListener('mousedown', handleClose);
    document.addEventListener('keydown', handleClose);
    return () => {
      document.removeEventListener('mousedown', handleClose);
      document.removeEventListener('keydown', handleClose);
    };
  }, [menuPos]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
  }, []);

  const copyText = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setMenuPos(null);
  }, []);

  const copyImage = useCallback(async () => {
    setMenuPos(null);
    const src = showingFront ? card.frontFaceImageUrl : card.backFaceImageUrl;
    if (!src) return;
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    } catch {
      // Fallback: some browsers don't support clipboard.write for images
    }
  }, [showingFront, card.frontFaceImageUrl, card.backFaceImageUrl]);

  const downloadImage = useCallback(() => {
    setMenuPos(null);
    const baseName = card.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const download = (src: string, suffix: string) => {
      const a = document.createElement('a');
      a.href = src;
      a.download = `${baseName}${suffix}.png`;
      a.click();
    };
    if (card.backFaceImageUrl) {
      download(card.frontFaceImageUrl, '-front');
      download(card.backFaceImageUrl, '-back');
    } else {
      download(card.frontFaceImageUrl, '');
    }
  }, [card.frontFaceImageUrl, card.backFaceImageUrl, card.name]);

  const menuItems: ContextMenuItem[] = [
    { label: 'Download Image', action: downloadImage },
    { label: 'Copy Card Image', action: copyImage },
    { label: 'Copy Scryfall Text', action: () => copyText(card.scryfallText) },
    { label: 'Copy Crucible Text', action: () => copyText(card.crucibleText) },
    { label: 'Copy Scryfall JSON', action: () => copyText(card.scryfallJson) },
    { label: 'Copy Card Data JSON', action: () => copyText(card.scryfallJson) },
  ];

  const transforms: string[] = [];
  if (currentRotation.x) transforms.push(`rotateX(${currentRotation.x}deg)`);
  if (currentRotation.y) transforms.push(`rotateY(${currentRotation.y}deg)`);
  if (currentRotation.z) transforms.push(`rotateZ(${currentRotation.z}deg)`);
  const cardTransform = transforms.join(' ') || 'none';

  const aspectRatio = '5 / 7';
  const borderRadius = '4.5% / 3.2%';

  const faceStyle: React.CSSProperties = {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: card.backFaceImageUrl ? 'hidden' : 'visible',
    borderRadius,
    boxShadow: '0 0 0 1px #555',
  };

  return (
    <div
      className={className ? `mtg-card ${className}` : 'mtg-card'}
      style={{
        display: 'inline-block',
        position: 'relative',
        ...style,
      }}
    >
      {/* Searchable text overlay — transparent but highlightable with Ctrl+F */}
      {cardText && (
        <span
          className="mtg-card-text"
          style={{
            position: 'absolute',
            inset: 0,
            padding: '8%',
            color: 'transparent',
            fontSize: 14,
            lineHeight: 1.3,
            overflow: 'hidden',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        >
          {cardText}
        </span>
      )}

      <div
        className="mtg-card-viewport"
        style={{
          perspective: '1000px',
          cursor: hasMultipleStates ? 'pointer' : 'default',
          height: '100%',
          aspectRatio,
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <div
          className="mtg-card-transform"
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            transformStyle: 'preserve-3d',
            transform: cardTransform,
            transition: 'transform 0.5s ease-in-out',
          }}
        >
          <img
            className="mtg-card-face mtg-card-front"
            src={card.frontFaceImageUrl}
            alt={card.name}
            draggable={false}
            style={{ ...faceStyle }}
          />
          {card.backFaceImageUrl && (
            <img
              className="mtg-card-face mtg-card-back"
              src={card.backFaceImageUrl}
              alt={card.name}
              draggable={false}
              style={{ ...faceStyle, transform: 'rotateY(180deg)' }}
            />
          )}
        </div>
      </div>

      {/* Rotation arrow widget */}
      {hasMultipleStates && (
        <div
          className="mtg-card-rotate"
          style={{
            position: 'absolute',
            top: '45%',
            right: '4%',
            width: '12%',
            height: '12%',
            cursor: 'pointer',
            pointerEvents: 'auto',
            filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))',
            zIndex: 2,
            ...rotateWidgetStyle,
          }}
          onClick={handleClick}
        >
          <RotateWidget spinKey={widgetSpin} style={{ width: '100%', height: '100%' }} />
        </div>
      )}

      {/* Custom context menu */}
      {menuPos && (
        <div
          className="mtg-card-menu"
          style={{
            position: 'fixed',
            left: menuPos.x,
            top: menuPos.y,
            zIndex: 10000,
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: 6,
            padding: '4px 0',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            minWidth: 180,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: 13,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {menuItems.map((item) => (
            <div
              key={item.label}
              onClick={item.action}
              style={{
                padding: '6px 14px',
                cursor: 'pointer',
                color: '#e0e0e0',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = '#3a3a5a'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
