// Measure output size for every quality x format combination, for the README
// table. Uses the README's own Crucible of Legends example so the numbers are
// reproducible from a card anyone can render.
import { renderCard } from '../src/index';
import type { RenderFormat, RenderQuality } from '../src/types';

const CARD = {
  name: 'Crucible of Legends',
  manaCost: '{3}',
  typeLine: 'Legendary Artifact',
  abilities:
    'Whenever a legendary creature you control dies, return it to your hand at the beginning of your next upkeep.',
  flavorText: 'Every great story begins with fire.',
  rarity: 'mythic' as const,
  artUrl:
    'https://raw.githubusercontent.com/domainellipticlanguage/mtg-crucible/refs/heads/main/examples/crucible-art.png',
};

const QUALITIES: RenderQuality[] = ['low', 'medium', 'high'];
const FORMATS: RenderFormat[] = ['png', 'jpeg', 'webp'];
const DIMS: Record<RenderQuality, string> = {
  low: '350x490',
  medium: '745x1040',
  high: '2010x2814',
};

async function main() {
  const rows: Record<string, string>[] = [];
  for (const quality of QUALITIES) {
    const row: Record<string, string> = { quality: `${quality} (${DIMS[quality]})` };
    for (const format of FORMATS) {
      const result = await renderCard(CARD, { quality, format });
      row[format] = `${Math.round(result.frontFace.length / 1024)} KB`;
    }
    rows.push(row);
  }
  console.table(rows);
}

main();
