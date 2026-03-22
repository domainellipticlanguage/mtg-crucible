import { describe, it, expect } from 'vitest';
import { renderCard } from '../src';
import type { CardData } from '../src';

// PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngDimensions(buf: Buffer): { width: number; height: number } {
  // Width at bytes 16-19, height at bytes 20-23 (big-endian uint32 in IHDR)
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

describe('renderCard', () => {
  it('renders a standard card as a valid PNG', async () => {
    const { frontFace: buf } = await renderCard({
      name: 'Lightning Bolt', manaCost: '{R}', types: ['instant'],
      oracleText: 'Lightning Bolt deals 3 damage to any target.',
      frameColor: 'red', rarity: 'uncommon',
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    const { width, height } = pngDimensions(buf);
    expect(width).toBe(2010);
    expect(height).toBe(2814);
  });

  it('renders a creature with P/T', async () => {
    const { frontFace: buf } = await renderCard({
      name: 'Grizzly Bears', manaCost: '{1}{G}', types: ['creature'], subtypes: ['Bear'],
      power: '2', toughness: '2', frameColor: 'green', rarity: 'common',
    });
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    expect(pngDimensions(buf)).toEqual({ width: 2010, height: 2814 });
  });

  it('renders a legendary creature with crown', async () => {
    const { frontFace: buf } = await renderCard({
      name: 'Questing Beast', manaCost: '{2}{G}{G}',
      supertypes: ['legendary'], types: ['creature'], subtypes: ['Beast'],
      oracleText: 'Vigilance, deathtouch, haste',
      power: '4', toughness: '4', frameColor: 'green', rarity: 'mythic',
    });
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    expect(buf.length).toBeGreaterThan(10000);
  });

  it('renders a vehicle with white P/T text', async () => {
    const { frontFace: buf } = await renderCard({
      name: 'Smuggler\'s Copter', manaCost: '{2}', types: ['artifact'], subtypes: ['Vehicle'],
      oracleText: 'Flying\nCrew 1',
      power: '3', toughness: '3', frameColor: 'vehicle', rarity: 'rare',
    });
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });

  it('renders rules text with inline mana symbols', async () => {
    const { frontFace: buf } = await renderCard({
      name: 'Sol Ring', manaCost: '{1}', types: ['artifact'],
      oracleText: '{T}: Add {C}{C}.',
      frameColor: 'artifact', rarity: 'uncommon',
    });
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });

  it('renders rules + flavor text with divider', async () => {
    const { frontFace: buf } = await renderCard({
      name: 'Lightning Bolt', manaCost: '{R}', types: ['instant'],
      oracleText: 'Lightning Bolt deals 3 damage to any target.',
      flavorText: '"The sparkmage shrieked."',
      frameColor: 'red', rarity: 'uncommon',
    });
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });

  it('renders a planeswalker as a valid PNG', async () => {
    const card: CardData = {
      name: 'Liliana of the Veil', manaCost: '{1}{B}{B}',
      supertypes: ['legendary'], types: ['planeswalker'], subtypes: ['Liliana'],
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
    const { frontFace: buf } = await renderCard(card);
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    expect(pngDimensions(buf)).toEqual({ width: 1500, height: 2100 });
  });

  it('renders a saga as a valid PNG', async () => {
    const card: CardData = {
      name: 'The Eldest Reborn', manaCost: '{4}{B}',
      types: ['enchantment'], subtypes: ['Saga'],
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
    const { frontFace: buf } = await renderCard(card);
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    expect(pngDimensions(buf)).toEqual({ width: 1500, height: 2100 });
  });

  it('renders a battle at 2814x2010 (landscape)', async () => {
    const card: CardData = {
      name: 'Invasion of Gobakhan', manaCost: '{1}{W}',
      types: ['battle'], subtypes: ['Siege'],
      oracleText: 'When Invasion of Gobakhan enters the battlefield, look at target opponent\'s hand.',
      frameColor: 'white', rarity: 'rare',
      battleDefense: '3',
    };
    const { frontFace: buf } = await renderCard(card);
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    expect(pngDimensions(buf)).toEqual({ width: 2814, height: 2010 });
  });

  it('renders a battle with creature back face', async () => {
    const card: CardData = {
      name: 'Invasion of Gobakhan', manaCost: '{1}{W}',
      types: ['battle'], subtypes: ['Siege'],
      abilities: 'When Invasion of Gobakhan enters the battlefield, look at target opponent\'s hand. You may exile a nonland card from it. For as long as that card remains exiled, its owner may play it. A spell cast this way costs {2} more to cast.',
      frameColor: 'white', rarity: 'rare',
      battleDefense: '3',
      linkType: 'transform',
      linkedCard: {
        name: 'Lightshield Array',
        types: ['enchantment'],
        frameColor: 'white', rarity: 'rare',
        abilities: 'At the beginning of your end step, put a +1/+1 counter on each creature you control.\nSacrifice Lightshield Array: Creatures you control gain hexproof and indestructible until end of turn.',
      },
    };
    const result = await renderCard(card);
    expect(result.frontFace.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    expect(pngDimensions(result.frontFace)).toEqual({ width: 2814, height: 2010 });
    expect(result.frontFaceOrientation).toBe('horizontal');
    expect(result.backFace).toBeDefined();
    expect(result.backFace!.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    expect(pngDimensions(result.backFace!)).toEqual({ width: 1500, height: 2100 });
    expect(result.backFaceOrientation).toBe('vertical');
    expect(result.rotations).toEqual([{ x: 0, y: 0, z: 0 }, { x: 0, y: 180, z: 0 }]);
  });

  it('renders a gold multicolor legendary', async () => {
    const { frontFace: buf } = await renderCard({
      name: 'Maelstrom Wanderer', manaCost: '{5}{U}{R}{G}',
      supertypes: ['legendary'], types: ['creature'], subtypes: ['Elemental'],
      oracleText: 'Creatures you control have haste.\nCascade, cascade',
      power: '7', toughness: '5', frameColor: 'multicolor', rarity: 'mythic',
    });
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });

  it('renders phyrexian mana in cost and rules', async () => {
    const { frontFace: buf } = await renderCard({
      name: 'Birthing Pod', manaCost: '{3}{G/P}', types: ['artifact'],
      oracleText: '{1}{G/P}, {T}, Sacrifice a creature: Search your library.',
      frameColor: 'artifact', rarity: 'rare',
    });
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });
});
