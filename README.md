# <img src="https://raw.githubusercontent.com/domainellipticlanguage/mtg-crucible/main/logo/logo-256.png" height="40"> MTG Crucible

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

<img src="https://raw.githubusercontent.com/domainellipticlanguage/mtg-crucible/main/examples/crucible-of-legends.png" alt="Crucible of Legends" width="300">


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

Additional metadata fields can appear on any line (order doesn't matter):

- `Rarity: Mythic Rare`
- `Flavor Text: Every great story begins with fire.`
- `Art URL: https://example.com/art.png`
- `Art Description: A fiery landscape`
- `Artist: Chris Rahn`
- `Set: MH3`
- `Collector Number: 205`
- `Designer: Mark Rosewater`
- `Frame Color: Red and Blue`
- `Frame Effect: Nyx`
- `Accent Color: Green`
- `Name Line Color: Blue and Red`
- `Type Line Color: White`
- `PT Box Color: Black`

These fields can be used to create flavorful card styles. For example:

### Combine Snow and Nyx borders
```
Conduit of Fire and Ice {2}{U/R}
Artifact
Whenever you cast an instant or sorcery spell, choose one —
- Fire — Conduit of Fire and Ice deals 1 damage to each opponent.
- Ice — Scry 1.
Art URL: https://example.com/art.png
Frame Effect: Nyx, Snow
Frame Color: Red, Blue
```
<img src="https://raw.githubusercontent.com/domainellipticlanguage/mtg-crucible/main/examples/conduit-of-fire-and-ice.png" alt="Crucible of Legends" width="300">


### Multi-color border
```
The Candy Striper {2}{R}{W}
Legendary Creature — Nightmare Spirit
Haste, lifelink
Whenever the Candy Striper attacks, each opponent loses 1 life and you gain 1 life for each enchantment you control.
3/3
Art URL: https://example.com/art.png
Frame Color: Red, White, Red, White, Red, White, Red, and White
Accent: Red, White, Red, White, Red, White, Red, and White
PT Box Color: Red, White, Red, White, Red, White, Red, and White
```

<img src="https://raw.githubusercontent.com/domainellipticlanguage/mtg-crucible/main/examples/the-candy-striper.png" alt="Crucible of Legends" width="300">

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

## Acknowledgements

Card frame assets are derived from [Card Conjurer](https://github.com/Investigamer/cardconjurer), an open-source MTG card creation tool.

Magic: The Gathering is a trademark of Wizards of the Coast, LLC. This project is not affiliated with, endorsed by, or sponsored by Wizards of the Coast or Hasbro.
