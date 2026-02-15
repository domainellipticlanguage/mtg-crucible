# mtg-crucible

A TypeScript library for rendering Magic: The Gathering card images as PNGs.

## Installation

```bash
npm install mtg-crucible
```

## Quick Start

```typescript
import { renderFromText } from 'mtg-crucible';
import { writeFileSync } from 'fs';

const png = await renderFromText(`
  Crucible of Legends {3}
  Art: https://raw.githubusercontent.com/nathanfdunn/mtg-crucible/refs/heads/main/logo/banner-image.png
  Rarity: Mythic Rare
  Legendary Artifact
  Whenever a legendary creature you control dies, return it to your hand at the beginning of the next end step.
  *Every great story begins with fire.*
`);

writeFileSync('crucible-of-legends.png', png);
```

![Crucible of Legends](logo/crucible-of-legends.png)

## API

### `renderFromText(text: string): Promise<Buffer>`

Parse a text-format card definition and render it to a PNG buffer in one step.

### `parseCard(text: string): CardInput`

Parse a text-format card definition into a `CardInput` object. Useful when you want to inspect or modify the parsed data before rendering.

### `renderCard(card: CardInput): Promise<Buffer>`

Render a `CardInput` object to a PNG buffer. Automatically dispatches to the correct renderer based on the card type (standard, planeswalker, saga, or battle).

### Individual renderers

For direct control, each renderer is also exported:

- `renderStandard(card: CardData): Promise<Buffer>`
- `renderPlaneswalker(card: PlaneswalkerData): Promise<Buffer>`
- `renderSaga(card: SagaData): Promise<Buffer>`
- `renderBattle(card: BattleData): Promise<Buffer>`

## Text Format

Cards are defined in a plain text format inspired by official text spoilers.

### Standard cards

```
Name {mana cost}
Art: <art url> (Optional)
Rarity: <rarity> (Optional)
Type Line
Rules text line 1
Rules text line 2
Power/Toughness
*Flavor text*
```

Each line of rules text becomes a separate paragraph on the rendered card. Mana symbols use curly brace notation: `{W}`, `{U}`, `{B}`, `{R}`, `{G}`, `{C}`, `{T}`, `{1}`, `{2}`, etc. Hybrid and phyrexian mana are supported: `{G/U}`, `{G/P}`.

Power/toughness is only parsed for creatures and vehicles. Wildcards like `*/1+*` are supported.

Flavor text is wrapped in `*asterisks*` and must come after P/T (at the very end). Multiple flavor lines are joined with newlines:

```
Wrath of God {2}{W}{W}
Sorcery
Destroy all creatures. They can't be regenerated.
*Legend speaks of the Creators' rage at their most prized creation.*
```

Reminder text `(like this)` in the middle of rules text is preserved as rules text, not treated as flavor.

### Art URL (optional)

An art image URL can be specified between the name and type line:

```
Archangel Avacyn {3}{W}{W}
Art: https://cards.scryfall.io/art_crop/front/7/f/7f4893ef.jpg
Legendary Creature — Angel
Flash
Flying, vigilance
4/4
```

### Planeswalkers

```
Liliana of the Veil {1}{B}{B}
Legendary Planeswalker — Liliana
+1: Each player discards a card.
-2: Target player sacrifices a creature.
-6: Separate all permanents target player controls into two piles.
Loyalty: 3
```

Abilities prefixed with `+N:`, `-N:`, or `0:` are parsed as loyalty abilities. Lines without a cost prefix are treated as static abilities.

### Sagas

```
The Eldest Reborn {4}{B}
Enchantment — Saga
I — Each opponent sacrifices a creature or planeswalker.
II — Each opponent discards a card.
III — Put target creature or planeswalker card from a graveyard onto the battlefield under your control.
```

Chapter numerals (I through VI) are parsed automatically. Combined chapters are supported:

```
I, II — Create a 1/1 red Goblin creature token.
III — Creatures you control get +2/+0 until end of turn.
```

### Battles

```
Invasion of Gobakhan {1}{W}
Battle — Siege
When Invasion of Gobakhan enters the battlefield, look at target opponent's hand.
Defense: 3
```

### Lands (no mana cost)

```
Command Tower
Land
{T}: Add one mana of any color in your commander's color identity.
```

## Frame Color

The frame color is automatically derived:

| Condition | Frame |
|---|---|
| Type includes "Vehicle" | `v` (vehicle) |
| Type includes "Land" + no mana cost | `l` (land) |
| No colored mana symbols | `a` (artifact/colorless) |
| One color in mana cost | That color (`w`, `u`, `b`, `r`, `g`) |
| Two or more colors | `m` (multicolor/gold) |

Colors are extracted from all mana symbols including hybrid (`{G/U}`) and phyrexian (`{G/P}`).

## Card Dimensions

| Card Type | Width | Height |
|---|---|---|
| Standard | 2010 | 2814 |
| Planeswalker | 1500 | 2100 |
| Saga | 1500 | 2100 |
| Battle | 2814 | 2010 (landscape) |

## Development

```bash
npm test          # run tests (vitest)
npm run build     # compile TypeScript
npm run spike     # render test cards to output/
```

## TODO

- Improve set symbol generation with logo
- Fix missing rarity on sagas
- Test limits of parser leniency
- Test reminder text without asterisks
- Test multiple lines of flavor text
- Reconsider splitting into multiple render apis
- Investigate card dimensions
- reconsider the frame enum
- Update readme examples to be custom
- Add a carddata example to quickstart
- Add logo somewhere