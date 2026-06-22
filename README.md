# <img src="https://raw.githubusercontent.com/domainellipticlanguage/mtg-crucible/main/logo/logo-256.png" height="40"> MTG Crucible

A TypeScript library for rendering custom Magic: The Gathering card images. Runs in **both Node and the browser** from a single package — the right build is selected automatically via conditional `exports`.

Includes a react component for rendering resulting card images, complete with card rotations for double-faced cards, etc.

> **Upgrading from 0.3.x?** `renderCard` now returns a `Blob` instead of a `Buffer` (uniform across Node and the browser). See [Migration: Buffer → Blob](#migration-buffer--blob).

## Installation

```bash
npm install mtg-crucible
```

## Quick Start

### From text

```typescript
import { renderCard, bytes } from 'mtg-crucible';
import { writeFileSync } from 'fs';

const result = await renderCard(`
Crucible of Legends {3}
Legendary Artifact
Whenever a legendary creature you control dies, return it to your hand at the beginning of your next upkeep.
Flavor Text: Every great story begins with fire.
Rarity: Mythic Rare
Art URL: https://raw.githubusercontent.com/domainellipticlanguage/mtg-crucible/refs/heads/main/examples/crucible-art.png
`);

// result.frontFace is a Blob. Write it to disk:
writeFileSync('crucible-of-legends.png', await bytes(result.frontFace));
```

### From structured data

```typescript
import { renderCard } from 'mtg-crucible';

const result = await renderCard({
  name: 'Crucible of Legends',
  manaCost: '{3}',
  typeLine: 'Legendary Artifact',
  abilities: 'Whenever a legendary creature you control dies, return it to your hand at the beginning of your next upkeep.',
  flavorText: 'Every great story begins with fire.',
  rarity: 'mythic',
  artUrl: 'https://raw.githubusercontent.com/domainellipticlanguage/mtg-crucible/refs/heads/main/examples/crucible-art.png',
});

writeFileSync('crucible-of-legends.png', Buffer.from(await result.frontFace.arrayBuffer()));
```

<img src="https://raw.githubusercontent.com/domainellipticlanguage/mtg-crucible/main/examples/crucible-of-legends.png" alt="Crucible of Legends" width="300">


## Browser usage

The **same package** renders cards client-side. Bundlers (Vite, webpack, esbuild, Next.js, …) automatically pick the browser build via the `"browser"` export condition — no extra config, and `@napi-rs/canvas` (a native addon) is never pulled into your bundle.

```typescript
import { renderCard, toDisplayCard } from 'mtg-crucible';

const result = await renderCard({
  name: 'Lightning Bolt',
  manaCost: '{R}',
  typeLine: 'Instant',
  abilities: 'Lightning Bolt deals 3 damage to any target.',
  rarity: 'common',
});

// result.frontFace is a Blob — show it directly:
const url = URL.createObjectURL(result.frontFace);
document.querySelector('img')!.src = url;

// …or use toDisplayCard for a ready-to-render data URL (works with <MtgCard>):
const display = toDisplayCard(result);
document.querySelector('img')!.src = display.frontFaceImageUrl;
```

### Assets (`assetBaseUrl`)

The browser build does **not** bundle the ~190 MB of frame assets. Frames, masks, symbols, and fonts are fetched **on demand** — only the ones a given card needs — and cached by the browser's HTTP cache. By default they come from this package's own assets on jsDelivr, pinned to the installed version:

```
https://cdn.jsdelivr.net/npm/mtg-crucible@<version>/assets/
```

To self-host the assets (the `assets/` folder is included in the npm package), override the base URL **before** your first `renderCard`:

```typescript
import { setAssetBaseUrl } from 'mtg-crucible';

setAssetBaseUrl('https://your-cdn.example.com/mtg-crucible/assets/');
```

Notes:
- Fonts are loaded with `FontFace` and awaited before any text is drawn.
- Non-Chromium browsers may rasterize text slightly differently than the Node (`@napi-rs/canvas`) output; this is expected and acceptable.

A runnable example lives in [`examples/browser/`](examples/browser/) — `npm run example:browser` builds it and serves it (with the repo's own assets) at <http://localhost:5173>.

## Migration: Buffer → Blob

As of **0.4.0**, `renderCard` returns a `Blob` (with the correct MIME type) instead of a Node `Buffer`, so the return type is uniform across Node and the browser. `Blob` is a global in Node 18+.

To write render output to disk or object storage in Node, convert the `Blob` to bytes:

```typescript
import { renderCard, bytes } from 'mtg-crucible';
import { writeFileSync } from 'fs';

const { frontFace } = await renderCard(card);

// Option A — the exported helper:
writeFileSync('card.png', await bytes(frontFace));        // bytes(blob) => Uint8Array

// Option B — plain Web APIs:
writeFileSync('card.png', Buffer.from(await frontFace.arrayBuffer()));
```

`toDisplayCard(rendered)` is unchanged — it still returns data-URL strings in both environments, so `<MtgCard>` and any data-URL consumers keep working without modification.

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

### `renderCard(input: CardData | string, options?: RenderOptions): Promise<RenderedCard>`

Parse and render a card. Accepts either a text-format string or a `CardData` object. Returns a `RenderedCard` with `frontFace` (a `Blob` with the correct image MIME type), optional `backFace` (also a `Blob`), orientation info, and rotation data for multi-face cards. The same call works in Node and the browser.

Options:
- `quality` — `'high'` (2010x2814, default), `'medium'` (745x1040), or `'low'` (350x490)
- `format` — `'png'` (default, lossless with transparency), `'jpeg'` (smaller, no transparency, white corners), or `'webp'` (smallest, with transparency)
- `allowUnsafeArtUrls` — defaults to `false`. See [Security](#security) below.

### `bytes(blob: Blob): Promise<Uint8Array>`

Small helper to read a `Blob`'s raw bytes — handy for writing render output to disk or uploading to object storage in Node.

#### Output sizes

Front-face image size for a typical card:

| quality | png | jpeg | webp |
|---------|-----|------|------|
| low (350×490) | 308 KB | 72 KB | 28 KB |
| medium (745×1040) | 1167 KB | 233 KB | 86 KB |
| high (2010×2814) | 5529 KB | 1013 KB | 355 KB |

WebP uses lossy quality 60/70/80 for low/medium/high. Generate fresh numbers with `npx tsx scripts/sizes.ts`.

### `parseCard(text: string): CardData`

Parse a text-format card definition into a `CardData` object.

### `formatCard(card: CardData): string`

Convert a `CardData` object back to text format (round-trips with `parseCard`).

### `normalizeCard(card: CardData): NormalizedCardData`

Normalize a `CardData` into `NormalizedCardData` with all fields resolved (frame colors derived, abilities parsed, defaults filled in).

### `getArtDimensions(card: CardData): { primaryArtDimensions: { width, height }; secondaryArtDimensions?: { width, height } }`

Get the expected art image dimensions for a card. Returns primary dimensions, and secondary dimensions if the card has a linked card (e.g. transform, split, aftermath).

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
Art URL: https://raw.githubusercontent.com/domainellipticlanguage/mtg-crucible/refs/heads/main/examples/conduit-art.png
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
Art URL: https://raw.githubusercontent.com/domainellipticlanguage/mtg-crucible/refs/heads/main/examples/candy-striper-art.png
Frame Color: Red, White, Red, White, Red, White, Red, and White
Accent: Red, White, Red, White, Red, White, Red, and White
Name Line Color: Red, White, Red, White, Red, White, Red, and White
Type Line Color: Red, White, Red, White, Red, White, Red, and White
PT Box Color: Red, White, Red, White, Red, White, Red, and White
```

<img src="https://raw.githubusercontent.com/domainellipticlanguage/mtg-crucible/main/examples/the-candy-striper.png" alt="The Candy Striper" width="300">

### Composite cards
To define a composite card (split, modal double-faced, etc.) use the `----` separator between card parts.

```
Wine {1}{G}
Instant
Put a +1/+1 counter on each of up to two target creatures.
Art URL: https://raw.githubusercontent.com/domainellipticlanguage/mtg-crucible/refs/heads/main/examples/wine-art.png
Rarity: Uncommon
----
Dine {3}{B}
Instant
Destroy target creature. Create a Food token. (It's an artifact with "{2}, {T}, Sacrifice this token: You gain 3 life.")
Art URL: https://raw.githubusercontent.com/domainellipticlanguage/mtg-crucible/refs/heads/main/examples/dine-art.png
```

<img src="examples/wine-dine.png" alt="Wine // Dine" height="300">

Crucible will infer the link type from the card parts, but if you want to be explicit, you can use the link type in the card definition:

Instead of `----`, you can use one of `--transform--`, `--mdfc--`, `--split--`, `--fuse--`, `--flip--`, `--adventure--`, or `--aftermath--`.

## React Component
Crucible provides a React component for rendering cards.

```tsx
import { MtgCard } from 'mtg-crucible/react';

<MtgCard
  card={renderedCardDisplay}
  cardText="Crucible of Legends"           // will be invisible, but searchable with ctrl+f
/>
```

The component supports:
- Rotations for non-standard cards (battles, flip, aftermath, etc.)
- Right-click context menu: download, copy image, copy text formats
- Invisible searchable text overlay for Ctrl+F

![React Component Demo](https://raw.githubusercontent.com/domainellipticlanguage/mtg-crucible/main/examples/react-component.gif)

## In the Wild

Projects built with Crucible:

- **[This Magic Card Does Not Exist](https://thismagiccarddoesnotexist.com/)** — A website for creating custom cards with AI.
- **[Obsidian Custom MTG](https://github.com/domainellipticlanguage/obsidian-custom-mtg)** — an [Obsidian](https://obsidian.md) plugin for creating custom cards in plaintext in your vault.

Built something with Crucible? Open a PR to add it here.

## Development

```bash
npm test          # run tests (vitest)
npm run build     # compile TypeScript
npm run dev       # start local dev server with hot reload
```

## Security

When rendering card data from untrusted users (e.g. on a public web server), leave `allowUnsafeArtUrls` off (the default). This blocks art URLs that point to:

- Local files (`/path`, `./path`, `file://`)
- Loopback addresses (`127.0.0.1`, `localhost`)
- Private network ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
- Link-local addresses (`169.254.0.0/16`, including cloud metadata services like `169.254.169.254`)

Safe to enable in single-user, CLI, or build-script contexts where the card data comes from you, not from untrusted users.

Public URLs like `https://i.imgur.com/abc.png` always work fine — only "local" or "internal" URLs are affected by `allowUnsafeArtUrls`. This prevents [SSRF](https://owasp.org/www-community/attacks/Server_Side_Request_Forgery) and local file disclosure attacks.

Note: protection is best-effort. There is a small DNS-rebinding race window between hostname resolution and connection. For stronger guarantees, enforce egress rules at the network level.

## Acknowledgements

Card frame assets are derived from [Card Conjurer](https://github.com/Investigamer/cardconjurer), an open-source MTG card creation tool.

Magic: The Gathering is a trademark of Wizards of the Coast, LLC. This project is not affiliated with, endorsed by, or sponsored by Wizards of the Coast or Hasbro.
