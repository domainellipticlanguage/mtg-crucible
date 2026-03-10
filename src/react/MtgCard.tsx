import React, { useState, useCallback, useRef, useEffect } from 'react';
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

// Flip phases: idle -> hiding (rotate to 90deg) -> showing (swap image, rotate back from 90deg) -> idle
type FlipPhase = 'idle' | 'hiding' | 'showing';

export function MtgCard({ card, className, style }: MtgCardProps) {
  const [faceIndex, setFaceIndex] = useState(0);
  const [flipPhase, setFlipPhase] = useState<FlipPhase>('idle');
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasMultipleFaces = card.backFace !== undefined && card.rotations.length > 1;
  const showingFront = faceIndex === 0;
  const currentFace = showingFront ? card.frontFace : card.backFace!;
  const currentOrientation = showingFront
    ? card.frontFaceOrientation
    : (card.backFaceOrientation ?? 'vertical');
  const isLandscape = currentOrientation === 'horizontal';

  const handleClick = useCallback(() => {
    if (!hasMultipleFaces || flipPhase !== 'idle') return;
    setFlipPhase('hiding');
  }, [hasMultipleFaces, flipPhase]);

  const handleTransitionEnd = useCallback(() => {
    if (flipPhase === 'hiding') {
      setFaceIndex(i => i === 0 ? 1 : 0);
      setFlipPhase('showing');
    } else if (flipPhase === 'showing') {
      setFlipPhase('idle');
    }
  }, [flipPhase]);

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

  // Flip axis: diagonal for orientation changes, Y-axis otherwise
  const orientationChanges = card.frontFaceOrientation !== (card.backFaceOrientation ?? card.frontFaceOrientation);
  const flipAxis = orientationChanges ? 'rotate3d(1,1,0,' : 'rotateY(';

  let flipTransform = 'none';
  if (flipPhase === 'hiding') {
    flipTransform = flipAxis + '90deg)';
  }

  // Always render in portrait aspect ratio; landscape cards are shown
  // as a smaller inset on a black background (like real MTG battle cards).
  const aspectRatio = '5 / 7';
  const borderRadius = '4.5% / 3.2%';

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
          height: '100%',
          aspectRatio,
          position: 'relative',
          overflow: 'hidden',
          borderRadius,
          background: isLandscape ? '#000' : undefined,
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {isLandscape ? (
          // Landscape card in portrait frame:
          // 1) Background: the card image rendered portrait-sized but blacked out
          // 2) Foreground: a smaller landscape version centered on top
          <>
            {/* Blacked-out portrait background */}
            <img
              src={currentFace}
              alt=""
              draggable={false}
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                filter: 'brightness(0.5)',
              }}
            />
            {/* Small landscape card centered on top */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={currentFace}
                alt={card.name}
                draggable={false}
                onTransitionEnd={handleTransitionEnd}
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  aspectRatio: '7 / 5',
                  borderRadius: '4.5% / 3.2%',
                  transform: flipPhase === 'hiding' ? flipAxis + '90deg)' : 'none',
                  transition: flipPhase !== 'idle' ? 'transform 0.25s ease-in-out' : 'none',
                }}
              />
            </div>
          </>
        ) : (
          <img
            src={currentFace}
            alt={card.name}
            draggable={false}
            onTransitionEnd={handleTransitionEnd}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              transform: flipTransform,
              transition: flipPhase !== 'idle' ? 'transform 0.25s ease-in-out' : 'none',
            }}
          />
        )}
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
