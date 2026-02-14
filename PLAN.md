# mtg-crucible Implementation Plan

## Overview
TypeScript library that renders MTG card images as PNGs. Based on CardConjurer's layer compositing model. Supports standard cards, planeswalkers, sagas, battles, and vehicles.

## Core API

```typescript
import { renderCard } from 'mtg-crucible';

const png: Buffer = await renderCard({
  name: 'Swords to Plowshares',
  manaCost: '{W}',
  types: ['Instant'],
  rulesText: 'Exile target creature. Its controller gains life equal to its power.',
  flavorText: '"The so-called civilized races ..."',
  rarity: 'uncommon',
});
```

## Phase 1: Spike (validate rendering approach)

Before any architecture, prove the pipeline works end-to-end. Install sharp + @napi-rs/canvas, grab a handful of assets, and render three test cards:

### Spike test cases:

1. **Happy path** — Lightning Bolt
   - Name, {R} mana cost, one line of rules text
   - Validates: frame compositing, text rendering, mana symbol rendering

2. **Text-heavy card** — something with lots of rules text (e.g. Questing Beast)
   - Validates: word wrapping, auto font sizing, multi-paragraph text

3. **Planeswalker** — any 3-ability planeswalker
   - Validates: different layout, loyalty box, +/- ability costs

4. **Custom art** — use art from https://cards.scryfall.io/art_crop/front/7/f/7f4893ef-f983-418b-b7a4-5f073c844545.jpg?1673149345
   - Validates: art fetching, scaling, positioning within art bounds

### Spike approach:
- Try `sharp` for image compositing (layering PNGs)
- Try `@napi-rs/canvas` for text rendering (fillText, measureText — same API CardConjurer uses)
- Determine if we need both or can use @napi-rs/canvas for everything
- Output PNGs to `/tmp/` for visual inspection

### Spike assets needed (grab from /tmp/cardconjurer4):
- 1 standard frame: `img/frames/m15/new/r.png` (red)
- 1 P/T box: `img/frames/m15/regular/m15PTR.png`
- 1 planeswalker frame: `img/frames/planeswalker/regular/planeswalkerFrameB.png`
- A few mana symbols: `img/manaSymbols/{r,1,2,3,b}.svg`
- 2 fonts: `fonts/beleren-b.ttf`, `fonts/mplantin.ttf`
- Planeswalker shared assets: `img/frames/planeswalker/planeswalkerPlus.png`, etc.

## Phase 2: Asset pipeline

Write `scripts/prepare-assets.ts` to copy and organize all assets from CardConjurer clone.

### Full asset inventory (~60MB):

**Standard frames (16 files, ~32MB)** — `img/frames/m15/new/`:
w, u, b, r, g, m, a, l, c, v, lw, lu, lb, lr, lg, lm

**P/T boxes (9 files, ~800KB)** — `img/frames/m15/regular/`:
m15PT{W,U,B,R,G,M,A,C,V}

**Legend crowns (10 files, ~1MB)** — `img/frames/m15/crowns/new/`:
w, u, b, r, g, m, a, l, c + maskCrown, maskCrownPinline

**Planeswalker (7 frames + 5 masks + ~6 shared, ~3MB)** — `img/frames/planeswalker/regular/` + parent:
planeswalkerFrame{W,U,B,R,G,M,A}, masks, plus/minus/neutral/abilityLine PNGs

**Saga (8 frames + ~7 shared, ~8MB)** — `img/frames/saga/regular/` + parent:
sagaFrame{W,U,B,R,G,M,A}, l.png, chapter/divider/midstripe/masks

**Battle (9 frames + ~7 masks, ~15MB)** — `img/frames/m15/battle/`:
w, u, b, r, g, m, a, l, c + masks + holostamp

**Mana symbols (~50 SVGs, ~50KB)** — `img/manaSymbols/`

**Fonts (4 files, ~374KB)**:
beleren-b.ttf, beleren-bsc.ttf, mplantin.ttf, mplantin-i.ttf

## Phase 3: Types & frame selection

Define TypeScript interfaces and implement logic to select the right assets for a given card:

```typescript
export interface CardData {
  name: string;
  manaCost?: string;
  types?: CardType[];
  supertypes?: Supertype[];
  subtypes?: string[];
  rulesText?: string;
  flavorText?: string;
  power?: string | number;
  toughness?: string | number;
  loyalty?: string | number;
  defense?: string | number;
  art?: CardArt;
  rarity?: 'common' | 'uncommon' | 'rare' | 'mythic';
  colors?: Color[];
}
```

- Derive card colors from manaCost if colors not set
- Determine layout type: standard / planeswalker / saga / battle
- Select frame PNG, P/T box, crown based on color + type

## Phase 4: Standard card rendering

Full implementation of renderCard() for standard layout (creature, instant, sorcery, enchantment, artifact, vehicle, land):

1. Art compositing (scale/position into art bounds)
2. Frame layer
3. P/T box for creatures
4. Crown for legendaries
5. Text: card name, mana cost, type line, rules text, flavor text, P/T
6. Corner radius cutout

### Key layout constants (from CardConjurer):
- Canvas: 2010×2814
- Art bounds: x=0.0767, y=0.1129, w=0.8476, h=0.4429
- Card name: x=0.0836, y=0.0515, font=beleren-b, size=0.0381
- Mana cost: y=0.0625, width=0.9274, align=right
- Type line: x=0.0836, y=0.5643, font=beleren-b, size=0.0324
- Rules text: x=0.086, y=0.6324, w=0.828, h=0.2875, font=mplantin, size=0.0362
- P/T: x=0.7928, y=0.902, font=beleren-bsc, size=0.0372, align=center

### Text rendering approach:
- Use @napi-rs/canvas (Canvas 2D for Node) — same API as CardConjurer
- Register custom fonts (Beleren, MPlantin)
- Word wrap rules text by measuring with measureText()
- Render mana symbols inline by drawing SVG images at text positions
- Auto-shrink font if rules text overflows text box (CC's outerloop approach)

## Phase 5: Mana cost & symbol rendering
- Parse "{2}{W}{U}" into symbol list
- Load SVG mana symbols as images
- Render right-aligned in mana cost area
- Render inline in rules text (e.g. "{T}: Add {R}")

## Phase 6: Additional layouts
- **Planeswalker**: loyalty box, ability lines with +/-/0 costs, different text regions
- **Saga**: chapter markers on left, art on right, chapter text areas
- **Battle**: rotated frame, defense counter box

## Phase 7: Testing & polish
- Snapshot tests for each card type (vitest)
- Edge cases: long names, many abilities, split mana costs, no art
- Clean public API, JSDoc comments
