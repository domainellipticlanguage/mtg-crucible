#!/usr/bin/env tsx
/**
 * Re-render the example card images referenced by the README.
 *
 * Outputs (medium quality, 745×1043):
 *   examples/crucible-of-legends.png
 *   examples/the-candy-striper.png
 *   examples/conduit-of-fire-and-ice.png
 *   examples/wine-dine.png
 *
 * Art is pulled from the local *-art.png files (allowUnsafeArtUrls), so this
 * runs offline and stays in sync with whatever the renderer currently produces.
 *
 * Usage:
 *   npx tsx scripts/gen-examples.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { renderCard } from '../src';

const EX = path.resolve(__dirname, '..', 'examples');
const art = (f: string) => path.join(EX, f);

const CARDS: { out: string; text: string }[] = [
  {
    out: 'crucible-of-legends.png',
    text: `Crucible of Legends {3}
Legendary Artifact
Whenever a legendary creature you control dies, return it to your hand at the beginning of your next upkeep.
Flavor Text: Every great story begins with fire.
Rarity: Mythic Rare
Designer: DEL
Art URL: ${art('crucible-art.png')}`,
  },
  {
    out: 'the-candy-striper.png',
    text: `The Candy Striper {2}{R}{W}
Legendary Creature — Nightmare Spirit
Haste, lifelink
Whenever the Candy Striper attacks, each opponent loses 1 life and you gain 1 life for each enchantment you control.
3/3
Designer: DEL
Art URL: ${art('candy-striper-art.png')}
Frame Color: Red, White, Red, White, Red, White, Red, and White
Accent: Red, White, Red, White, Red, White, Red, and White
Name Line Color: Red, White, Red, White, Red, White, Red, and White
Type Line Color: Red, White, Red, White, Red, White, Red, and White
PT Box Color: Red, White, Red, White, Red, White, Red, and White`,
  },
  {
    out: 'the-candy-striper2.png',
    text: `The Mendacious Candy Striper {2}{R}{W}
Legendary Creature — Nightmare Spirit
Haste, lifelink
Whenever the Candy Striper attacks, each opponent loses 1 life and you gain 1 life for each enchantment you control.
3/3
Designer: DEL
Art URL: ${art('candy-striper-art.png')}
Frame Color: Red, White, Red, White, Red, White, Red, and White
Accent: Red, White, Red, White, Red, White, Red, and White
Name Line Color: Red, White, Red, White, Red, White, Red, and White
Type Line Color: Red, White, Red, White, Red, White, Red, and White
PT Box Color: Red, White, Red, White, Red, White, Red, and White`,
  },
  {
    out: 'conduit-of-fire-and-ice.png',
    text: `Conduit of Fire and Ice {2}{U/R}
Artifact
Whenever you cast an instant or sorcery spell, choose one —
- Fire — Conduit of Fire and Ice deals 1 damage to each opponent.
- Ice — Scry 1.
Designer: DEL
Art URL: ${art('conduit-art.png')}
Frame Effect: Nyx, Snow
Frame Color: Red, Blue
Accent Color: Red, Blue`,
  },
  {
    out: 'wine-dine.png',
    text: `Wine {1}{G}
Instant
Put a +1/+1 counter on each of up to two target creatures.
Designer: DEL
Art URL: ${art('wine-art.png')}
Rarity: Uncommon
----
Dine {3}{B}
Instant
Destroy target creature. Create a Food token. (It's an artifact with "{2}, {T}, Sacrifice this token: You gain 3 life.")
Art URL: ${art('dine-art.png')}`,
  },
];

async function main() {
  for (const c of CARDS) {
    const result = await renderCard(c.text, {
      quality: 'medium',
      allowUnsafeArtUrls: true,
    });
    const outPath = path.join(EX, c.out);
    fs.writeFileSync(outPath, result.frontFace);
    console.log(`  wrote examples/${c.out}`);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
