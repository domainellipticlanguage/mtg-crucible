import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { RenderedCardDisplay, Rotation } from '../types';

export interface MtgCardProps {
  card: RenderedCardDisplay;
  className?: string;
  style?: React.CSSProperties;
}

interface ContextMenuItem {
  label: string;
  action: () => void;
}

function rotationToCss(r: Rotation): string {
  return `rotateX(${r.x}deg) rotateY(${r.y}deg) rotateZ(${r.z}deg)`;
}

export function MtgCard({ card, className, style }: MtgCardProps) {
  const [faceIndex, setFaceIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasMultipleFaces = card.backFace !== undefined && card.rotations.length > 1;
  const currentRotation = card.rotations[faceIndex] ?? { x: 0, y: 0, z: 0 };
  const showingFront = faceIndex === 0;

  const handleClick = useCallback(() => {
    if (!hasMultipleFaces || isFlipping) return;
    setIsFlipping(true);
    const nextIndex = faceIndex === 0 ? 1 : 0;
    setTimeout(() => {
      setFaceIndex(nextIndex);
      setIsFlipping(false);
    }, 300);
  }, [hasMultipleFaces, isFlipping, faceIndex]);

  const currentFace = showingFront ? card.frontFace : card.backFace!;
  const currentOrientation = showingFront ? card.frontFaceOrientation : (card.backFaceOrientation ?? 'vertical');

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
    const src = showingFront ? card.frontFace : card.backFace;
    if (!src) return;
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    } catch {
      // Fallback: some browsers don't support clipboard.write for images
    }
  }, [showingFront, card.frontFace, card.backFace]);

  const menuItems: ContextMenuItem[] = [
    { label: 'Copy Card Image', action: copyImage },
    { label: 'Copy Scryfall Text', action: () => copyText(card.scryfallText) },
    { label: 'Copy Crucible Text', action: () => copyText(card.crucibleText) },
    { label: 'Copy Scryfall JSON', action: () => copyText(card.scryfallJson) },
    { label: 'Copy Card Data JSON', action: () => copyText(card.scryfallJson) },
  ];

  // Determine flip animation transform
  const rotation = card.rotations[faceIndex] ?? { x: 0, y: 0, z: 0 };
  const flipTransform = isFlipping
    ? rotationToCss(card.rotations[faceIndex === 0 ? 1 : 0] ?? rotation)
    : rotationToCss(currentRotation);

  return (
    <div
      className={className}
      style={{
        display: 'inline-block',
        position: 'relative',
        ...style,
      }}
    >
      {/* Invisible searchable name */}
      <span
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
        }}
      >
        {card.name}
      </span>

      <div
        style={{
          perspective: '1000px',
          cursor: hasMultipleFaces ? 'pointer' : 'default',
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <img
          src={currentFace}
          alt={card.name}
          draggable={false}
          style={{
            display: 'block',
            width: '100%',
            height: 'auto',
            transition: 'transform 0.3s ease',
            transform: flipTransform,
            borderRadius: '4.5% / 3.2%',
          }}
        />
      </div>

      {/* Custom context menu */}
      {menuPos && (
        <div
          ref={menuRef}
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
