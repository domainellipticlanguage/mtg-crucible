import { describe, it, expect } from 'vitest';
import { renderCard, toDisplayCard, bytes } from '../src';
import type { CardData } from '../src';

// PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
const PNG_MAGIC = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function startsWith(buf: Uint8Array, prefix: Uint8Array): boolean {
  if (buf.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) if (buf[i] !== prefix[i]) return false;
  return true;
}

function pngDimensions(buf: Uint8Array): { width: number; height: number } {
  // Width at bytes 16-19, height at bytes 20-23 (big-endian uint32 in IHDR)
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe('renderCard', () => {
  it('renders a standard card as a valid PNG Blob', async () => {
    const { frontFace } = await renderCard({
      name: 'Lightning Bolt', manaCost: '{R}',
      typeLine: { supertypes: [], types: ['instant'], subtypes: [] },
      abilities: 'Lightning Bolt deals 3 damage to any target.',
      frameColor: 'red', rarity: 'uncommon',
    });
    expect(frontFace).toBeInstanceOf(Blob);
    expect(frontFace.type).toBe('image/png');
    const buf = await bytes(frontFace);
    expect(startsWith(buf, PNG_MAGIC)).toBe(true);
    const { width, height } = pngDimensions(buf);
    expect(width).toBe(2010);
    expect(height).toBe(2814);
  });

  it('renders a creature with P/T', async () => {
    const { frontFace } = await renderCard({
      name: 'Grizzly Bears', manaCost: '{1}{G}',
      typeLine: { supertypes: [], types: ['creature'], subtypes: ['Bear'] },
      power: '2', toughness: '2', frameColor: 'green', rarity: 'common',
    });
    const buf = await bytes(frontFace);
    expect(startsWith(buf, PNG_MAGIC)).toBe(true);
    expect(pngDimensions(buf)).toEqual({ width: 2010, height: 2814 });
  });

  it('renders a legendary creature with crown', async () => {
    const { frontFace } = await renderCard({
      name: 'Questing Beast', manaCost: '{2}{G}{G}',
      typeLine: { supertypes: ['legendary'], types: ['creature'], subtypes: ['Beast'] },
      abilities: 'Vigilance, deathtouch, haste',
      power: '4', toughness: '4', frameColor: 'green', rarity: 'mythic',
    });
    const buf = await bytes(frontFace);
    expect(startsWith(buf, PNG_MAGIC)).toBe(true);
    expect(buf.length).toBeGreaterThan(10000);
  });

  it('renders a vehicle with white P/T text', async () => {
    const { frontFace } = await renderCard({
      name: 'Smuggler\'s Copter', manaCost: '{2}',
      typeLine: { supertypes: [], types: ['artifact'], subtypes: ['Vehicle'] },
      abilities: 'Flying\nCrew 1',
      power: '3', toughness: '3', frameColor: 'vehicle', rarity: 'rare',
    });
    expect(startsWith(await bytes(frontFace), PNG_MAGIC)).toBe(true);
  });

  it('renders rules text with inline mana symbols', async () => {
    const { frontFace } = await renderCard({
      name: 'Sol Ring', manaCost: '{1}',
      typeLine: { supertypes: [], types: ['artifact'], subtypes: [] },
      abilities: '{T}: Add {C}{C}.',
      frameColor: 'artifact', rarity: 'uncommon',
    });
    expect(startsWith(await bytes(frontFace), PNG_MAGIC)).toBe(true);
  });

  it('renders rules + flavor text with divider', async () => {
    const { frontFace } = await renderCard({
      name: 'Lightning Bolt', manaCost: '{R}',
      typeLine: { supertypes: [], types: ['instant'], subtypes: [] },
      abilities: 'Lightning Bolt deals 3 damage to any target.',
      flavorText: '"The sparkmage shrieked."',
      frameColor: 'red', rarity: 'uncommon',
    });
    expect(startsWith(await bytes(frontFace), PNG_MAGIC)).toBe(true);
  });

  it('renders a planeswalker as a valid PNG', async () => {
    const card: CardData = {
      name: 'Liliana of the Veil', manaCost: '{1}{B}{B}',
      typeLine: { supertypes: ['legendary'], types: ['planeswalker'], subtypes: ['Liliana'] },
      frameColor: 'black', rarity: 'mythic',
      startingLoyalty: '3',
      abilities: { structuredAbilities: {
        kind: 'planeswalker',
        loyaltyAbilities: [
          { cost: '+1', text: 'Each player discards a card.' },
          { cost: '-2', text: 'Target player sacrifices a creature.' },
          { cost: '-6', text: 'Separate all permanents target player controls into two piles. That player sacrifices all permanents in the pile of their choice.' },
        ],
      } },
    };
    const buf = await bytes((await renderCard(card)).frontFace);
    expect(startsWith(buf, PNG_MAGIC)).toBe(true);
    expect(pngDimensions(buf)).toEqual({ width: 2010, height: 2814 });
  });

  it('renders a saga as a valid PNG', async () => {
    const card: CardData = {
      name: 'The Eldest Reborn', manaCost: '{4}{B}',
      typeLine: { supertypes: [], types: ['enchantment'], subtypes: ['Saga'] },
      frameColor: 'black', rarity: 'uncommon',
      abilities: { structuredAbilities: {
        kind: 'saga',
        chapters: [
          { chapterNumbers: [1], text: 'Each opponent sacrifices a creature or planeswalker.' },
          { chapterNumbers: [2], text: 'Each opponent discards a card.' },
          { chapterNumbers: [3], text: 'Put target creature or planeswalker card from a graveyard onto the battlefield under your control.' },
        ],
      } },
    };
    const buf = await bytes((await renderCard(card)).frontFace);
    expect(startsWith(buf, PNG_MAGIC)).toBe(true);
    expect(pngDimensions(buf)).toEqual({ width: 2010, height: 2814 });
  });

  it('renders a battle at 2010x2814 (rotated to portrait)', async () => {
    const card: CardData = {
      name: 'Invasion of Gobakhan', manaCost: '{1}{W}',
      typeLine: { supertypes: [], types: ['battle'], subtypes: ['Siege'] },
      abilities: 'When Invasion of Gobakhan enters the battlefield, look at target opponent\'s hand.',
      frameColor: 'white', rarity: 'rare',
      battleDefense: '3',
    };
    const buf = await bytes((await renderCard(card)).frontFace);
    expect(startsWith(buf, PNG_MAGIC)).toBe(true);
    expect(pngDimensions(buf)).toEqual({ width: 2010, height: 2814 });
  });

  it('renders a battle with creature back face', async () => {
    const card: CardData = {
      name: 'Invasion of Gobakhan', manaCost: '{1}{W}',
      typeLine: { supertypes: [], types: ['battle'], subtypes: ['Siege'] },
      abilities: 'When Invasion of Gobakhan enters the battlefield, look at target opponent\'s hand. You may exile a nonland card from it. For as long as that card remains exiled, its owner may play it. A spell cast this way costs {2} more to cast.',
      frameColor: 'white', rarity: 'rare',
      battleDefense: '3',
      linkType: 'transform',
      linkedCard: {
        name: 'Lightshield Array',
        typeLine: { supertypes: [], types: ['enchantment'], subtypes: [] },
        frameColor: 'white', rarity: 'rare',
        abilities: 'At the beginning of your end step, put a +1/+1 counter on each creature you control.\nSacrifice Lightshield Array: Creatures you control gain hexproof and indestructible until end of turn.',
      },
    };
    const result = await renderCard(card);
    expect(startsWith(await bytes(result.frontFace), PNG_MAGIC)).toBe(true);
    expect(pngDimensions(await bytes(result.frontFace))).toEqual({ width: 2010, height: 2814 });
    expect(result.frontFaceOrientation).toBe('horizontal');
    expect(result.backFace).toBeDefined();
    expect(result.backFace).toBeInstanceOf(Blob);
    expect(startsWith(await bytes(result.backFace!), PNG_MAGIC)).toBe(true);
    expect(pngDimensions(await bytes(result.backFace!))).toEqual({ width: 2010, height: 2814 });
    expect(result.backFaceOrientation).toBe('vertical');
    expect(result.rotations).toEqual([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 90 }, { x: 0, y: 180, z: 0 }]);
  });

  it('renders a gold multicolor legendary', async () => {
    const { frontFace } = await renderCard({
      name: 'Maelstrom Wanderer', manaCost: '{5}{U}{R}{G}',
      typeLine: { supertypes: ['legendary'], types: ['creature'], subtypes: ['Elemental'] },
      abilities: 'Creatures you control have haste.\nCascade, cascade',
      power: '7', toughness: '5', frameColor: 'multicolor', rarity: 'mythic',
    });
    expect(startsWith(await bytes(frontFace), PNG_MAGIC)).toBe(true);
  });

  it('renders phyrexian mana in cost and rules', async () => {
    const { frontFace } = await renderCard({
      name: 'Birthing Pod', manaCost: '{3}{G/P}',
      typeLine: { supertypes: [], types: ['artifact'], subtypes: [] },
      abilities: '{1}{G/P}, {T}, Sacrifice a creature: Search your library.',
      frameColor: 'artifact', rarity: 'rare',
    });
    expect(startsWith(await bytes(frontFace), PNG_MAGIC)).toBe(true);
  });

  it('toDisplayCard derives data-URL strings from the Blob output', async () => {
    const rendered = await renderCard({
      name: 'Lightning Bolt', manaCost: '{R}',
      typeLine: { supertypes: [], types: ['instant'], subtypes: [] },
      frameColor: 'red', rarity: 'common',
    });
    const card = toDisplayCard(rendered);
    expect(card.frontFaceImageUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(card.frontFaceImageUrl.length).toBeGreaterThan(100);
  });
});
