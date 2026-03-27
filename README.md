# mtg-crucible

A TypeScript library for rendering Magic: The Gathering card images as PNGs.

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

### `renderCardImage(card: NormalizedCardData, templateOverride?: string): Promise<Buffer>`

Low-level renderer. Renders a single face to PNG. Requires pre-normalized card data.

## Text Format

Cards are defined in a plain text format. For the full grammar see [docs/text-format.md](docs/text-format.md).

### Standard cards

```
Lightning Bolt {R}
Instant
Lightning Bolt deals 3 damage to any target.
```

### Creatures

```
Tarmogoyf {1}{G}
Creature -- Lhurgoyf
Tarmogoyf's power is equal to the number of card types among cards in all graveyards and its toughness is equal to that number plus 1.
*/1+*
```

### Planeswalkers

```
Liliana of the Veil {1}{B}{B}
Legendary Planeswalker -- Liliana
+1: Each player discards a card.
-2: Target player sacrifices a creature.
-6: Separate all permanents target player controls into two piles.
Loyalty: 3
```

### Sagas

```
The Eldest Reborn {4}{B}
Enchantment -- Saga
I -- Each opponent sacrifices a creature or planeswalker.
II -- Each opponent discards a card.
III -- Put target creature or planeswalker card from a graveyard onto the battlefield under your control.
```

### Battles

```
Invasion of Gobakhan {1}{W}
Battle -- Siege
When Invasion of Gobakhan enters, look at target opponent's hand.
Defense: 3
```

### Multi-face cards

Use `--linkType--` delimiters between faces:

```
Huntmaster of the Fells {2}{R}{G}
Creature -- Human Werewolf
Whenever this creature enters or transforms into Huntmaster of the Fells, create a 2/2 green Wolf creature token and you gain 2 life.
2/2
--transform--
Ravager of the Fells
Color Indicator: Red and Green
Creature -- Werewolf
Trample
4/4
```

Supported link types: `--transform--`, `--mdfc--`, `--split--`, `--fuse--`, `--flip--`, `--adventure--`, `--aftermath--`

A bare `----` delimiter will infer the link type from card content (e.g. "Fuse" in text, both sides being instants/sorceries, presence of "transform" keyword).

### Metadata fields

These can appear on any line (order doesn't matter):

| Field | Example |
|---|---|
| `Art URL:` | `Art URL: https://example.com/art.png` |
| `Art Description:` | `Art Description: A fiery landscape` |
| `Rarity:` | `Rarity: Mythic Rare` |
| `Flavor Text:` | `Flavor Text: Some italic text` |
| `Frame Color:` | `Frame Color: Red and Blue` |
| `Accent Color:` | `Accent Color: Green` |
| `Frame Effect:` | `Frame Effect: Miracle` |
| `Color Indicator:` | `Color Indicator: Red and Green` |
| `Has Legend Crown:` | `Has Legend Crown: true` |
| `Set Code:` | `Set Code: MH3` |
| `Collector Number:` | `Collector Number: 205` |
| `Artist:` | `Artist: Chris Rahn` |
| `Designer:` | `Designer: Mark Rosewater` |

### Mana symbols

Use curly brace notation: `{W}`, `{U}`, `{B}`, `{R}`, `{G}`, `{C}`, `{T}`, `{1}`, `{2}`, etc.

Hybrid: `{G/U}`, `{W/B}`. Phyrexian: `{G/P}`, `{R/P}`.

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

## React Component

```tsx
import { MtgCard } from '@domainellipticlanguage/mtg-crucible/react';

<MtgCard
  card={renderedCardDisplay}
  cardText="searchable text for ctrl+f"
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
