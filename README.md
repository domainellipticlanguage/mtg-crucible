# <img src="logo/logo-256.png" height="40"> MTG Crucible

A TypeScript library for rendering custom Magic: The Gathering card images as PNGs.

Includes a react component for rendering resulting card images, complete with card rotations for double-faced cards, etc.

## Installation

```bash
npm install @domainellipticlanguage/mtg-crucible
```

## Quick Start

### From text

```typescript
import { renderCard } from '@domainellipticlanguage/mtg-crucible';
import { writeFileSync } from 'fs';

const result = await renderCard(`
Crucible of Legends {3}
Art URL: https://example.com/art.png
Rarity: Mythic Rare
Legendary Artifact
Whenever a legendary creature you control dies, return it to your hand at the beginning of the next end step.
Flavor Text: Every great story begins with fire.
`);

writeFileSync('crucible-of-legends.png', result.frontFace);
```

### From structured data

```typescript
import { renderCard } from '@domainellipticlanguage/mtg-crucible';

const result = await renderCard({
  name: 'Crucible of Legends',
  manaCost: '{3}',
  supertypes: ['legendary'],
  types: ['artifact'],
  rarity: 'mythic',
  abilities: 'Whenever a legendary creature you control dies, return it to your hand at the beginning of the next end step.',
  flavorText: 'Every great story begins with fire.',
});
```

<img src="logo/crucible-of-legends.png" alt="Crucible of Legends" width="300">


## Supported Templates

- Standard (including colorless/Eldrazi full-bleed art)
- Planeswalker (3 and 4 ability variants)
- Saga
- Class
- Battle
- Adventure
- Transform (front and back)
- MDFC / Modal DFC (front and back)
- Split
- Fuse
- Flip (Kamigawa-style)
- Aftermath
- Mutate
- Prototype
- Leveler

Also supports Snow, Devoid, and Nyx borders, although currently only for Standard cards.

## API

### `renderCard(input: CardData | string): Promise<RenderedCard>`

Parse and render a card. Accepts either a text-format string or a `CardData` object. Returns a `RenderedCard` with `frontFace` (PNG buffer), optional `backFace`, orientation info, and rotation data for multi-face cards.

### `parseCard(text: string): CardData`

Parse a text-format card definition into a `CardData` object.

### `formatCard(card: CardData): string`

Convert a `CardData` object back to text format (round-trips with `parseCard`).

### `normalizeCard(card: CardData): NormalizedCardData`

Normalize a `CardData` into `NormalizedCardData` with all fields resolved (frame colors derived, abilities parsed, defaults filled in).

### `getArtDimensions(card: CardData, template?: TemplateName, linked?: boolean): { width: number; height: number }`

Get the expected art image dimensions for a given card and template. Useful for generating or resizing art to fit correctly.

## Text Format

For convenience, cards can be defined in a plain text format, which is a superset of Scryfall's copy-pasteable text format. 

Additional fields include 
`Rarity:`
`Art URL:`  
`Art Description:`

`Flavor Text:`, `Frame Color:`, `Accent Color:`, `Frame Effect:`, `Has Legend Crown:`, `Set Code:`, `Designer:`

These fields can be used to create flavorful card styles. For example:

### Combine Snow and Nyx borders
```
Conduit of Fire and Ice {2}{U/R}
Artifact
Whenever you cast an instant or sorcery spell, choose one —
- Fire — Conduit of Fire and Ice deals 1 damage to each opponent.
- Ice — Scry 1.
Frame Effect: Nyx, Snow
Frame Color: Red, Blue
```

### Multi-color border

### 5-Color border
```
Warriors of Wooburg {W}{U}{B}{R}{G}
Creature — Human Warrior
First strike, flying, lifelink, haste, trample
5/5
Frame Color: White, Blue, Black, Red, Green
```

## React Component

```tsx
import { MtgCard } from '@domainellipticlanguage/mtg-crucible/react';

<MtgCard
  card={renderedCardDisplay}
  cardText="Crucible of Legends"           // will be invisible, but searchable with ctrl+f
  rotateWidgetStyle={{ display: 'none' }}  // optional: hide rotation arrow
/>
```

The component supports:
- Click to cycle through rotations (transform, flip, split, etc.)
- Rotation arrow widget (Scryfall-style) with hover/click animation
- Right-click context menu: download, copy image, copy text formats
- Invisible searchable text overlay for Ctrl+F
- CSS 3D transforms for card flipping

## Development

```bash
npm test          # run tests (vitest)
npm run build     # compile TypeScript
npm run dev       # start local dev server with hot reload
```

## TODO
- [ ] Add full support for Rooms
- [ ] Support all frame effects (Snow, Nyx, Devoid) for all card types
- [ ] Support MDFC/Transform for all card types