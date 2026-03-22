# CLAUDE.md

## Project overview
TypeScript library that renders MTG card images as PNGs. Takes card data (structured or text), produces card images.

## Image Interaction
Do not read image files unless explicitly asked. When reading images, prefer one at a time rather than loading multiple images.

## Key files
- `src/types.ts` — Core type definitions (CardData, CardTemplate, StructuredAbilities, etc.)
- `src/index.ts` — Public API entry point
- `src/renderers/` — One renderer per CardTemplate (normal, planeswalker, saga, battle, class)

## Black boxes (don't read unless specifically asked)
- `src/parser.ts` — Parses text input into CardData. Treat as: text in, CardData out.
- `src/symbols.ts` — Loads and caches mana symbol SVGs. Treat as: symbol string in, Image out.
- `src/helpers.ts` — Shared utility functions for rendering.
- `src/layout.ts` — Layout constants, dimensions, and asset paths.
- `src/text.ts` — Text measurement and rendering utilities.

## Other stuff that can simply be ignored
- scripts
- assets - all the images and stuff
- logo
- functions/api.ts
    - a dev server
- test
    - unit tests. i don't really care about these

## Commands
- `npm run build` — Build the project
- `npm test` — Run tests

## References
We use Card Conjurer as a reference for card designs and layouts. Look at 
/Users/nathandunn/Projects/cardconjurer-master
you can find assets and find how they do stuff
