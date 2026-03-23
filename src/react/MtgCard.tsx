import React, { useState, useCallback, useEffect } from 'react';
import type { RenderedCardDisplay } from '../types';

export interface MtgCardProps {
  card: RenderedCardDisplay;
  className?: string;
  style?: React.CSSProperties;
}

interface ContextMenuItem {
  label: string;
  action: () => void;
}

export function MtgCard({ card, className, style }: MtgCardProps) {
  const [rotationIndex, setRotationIndex] = useState(0);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  const hasMultipleStates = card.rotations.length > 1;
  const currentRotation = card.rotations[rotationIndex] ?? { x: 0, y: 0, z: 0 };
  // Back face is visible when Y rotation puts it face-forward
  const showingFront = !card.backFace || (Math.round(currentRotation.y / 180) % 2 === 0);

  const handleClick = useCallback(() => {
    if (!hasMultipleStates) return;
    setRotationIndex(i => (i + 1) % card.rotations.length);
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

  const downloadImage = useCallback(() => {
    setMenuPos(null);
    const src = showingFront ? card.frontFace : card.backFace;
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = `${card.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
    a.click();
  }, [showingFront, card.frontFace, card.backFace, card.name]);

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
    backfaceVisibility: card.backFace ? 'hidden' : 'visible',
    borderRadius,
  };

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
          cursor: hasMultipleStates ? 'pointer' : 'default',
          height: '100%',
          aspectRatio,
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <div
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
            src={card.frontFace}
            alt={card.name}
            draggable={false}
            style={{ ...faceStyle }}
          />
          {card.backFace && (
            <img
              src={card.backFace}
              alt={card.name}
              draggable={false}
              style={{ ...faceStyle, transform: 'rotateY(180deg)' }}
            />
          )}
        </div>
      </div>

      {/* Custom context menu */}
      {menuPos && (
        <div
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
