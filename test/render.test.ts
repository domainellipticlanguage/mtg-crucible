import { describe, it, expect } from 'vitest';
import { renderCard } from '../src';
import type { PlaneswalkerData, SagaData, BattleData } from '../src';

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
    const buf = await renderCard({
      name: 'Lightning Bolt', manaCost: '{R}', typeLine: 'Instant',
      rulesText: 'Lightning Bolt deals 3 damage to any target.',
      frameColor: 'r', rarity: 'uncommon',
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    const { width, height } = pngDimensions(buf);
    expect(width).toBe(2010);
    expect(height).toBe(2814);
  });

  it('renders a creature with P/T', async () => {
    const buf = await renderCard({
      name: 'Grizzly Bears', manaCost: '{1}{G}', typeLine: 'Creature \u2014 Bear',
      power: '2', toughness: '2', frameColor: 'g', rarity: 'common',
    });
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    expect(pngDimensions(buf)).toEqual({ width: 2010, height: 2814 });
  });

  it('renders a legendary creature with crown', async () => {
    const buf = await renderCard({
      name: 'Questing Beast', manaCost: '{2}{G}{G}',
      typeLine: 'Legendary Creature \u2014 Beast',
      rulesText: 'Vigilance, deathtouch, haste',
      power: '4', toughness: '4', frameColor: 'g', rarity: 'mythic', isLegendary: true,
    });
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    expect(buf.length).toBeGreaterThan(10000);
  });

  it('renders a vehicle with white P/T text', async () => {
    const buf = await renderCard({
      name: 'Smuggler\'s Copter', manaCost: '{2}', typeLine: 'Artifact \u2014 Vehicle',
      rulesText: 'Flying\nCrew 1',
      power: '3', toughness: '3', frameColor: 'v', rarity: 'rare',
    });
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });

  it('renders rules text with inline mana symbols', async () => {
    const buf = await renderCard({
      name: 'Sol Ring', manaCost: '{1}', typeLine: 'Artifact',
      rulesText: '{T}: Add {C}{C}.',
      frameColor: 'a', rarity: 'uncommon',
    });
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });

  it('renders rules + flavor text with divider', async () => {
    const buf = await renderCard({
      name: 'Lightning Bolt', manaCost: '{R}', typeLine: 'Instant',
      rulesText: 'Lightning Bolt deals 3 damage to any target.',
      flavorText: '"The sparkmage shrieked."',
      frameColor: 'r', rarity: 'uncommon',
    });
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });

  it('renders a planeswalker at 1500x2100', async () => {
    const card: PlaneswalkerData = {
      name: 'Liliana of the Veil', manaCost: '{1}{B}{B}',
      typeLine: 'Legendary Planeswalker \u2014 Liliana',
      frameColor: 'b', rarity: 'mythic', isLegendary: true,
      startingLoyalty: '3',
      abilities: [
        { cost: '+1', text: 'Each player discards a card.' },
        { cost: '-2', text: 'Target player sacrifices a creature.' },
        { cost: '-6', text: 'Separate all permanents target player controls into two piles. That player sacrifices all permanents in the pile of their choice.' },
      ],
    };
    const buf = await renderCard(card);
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    expect(pngDimensions(buf)).toEqual({ width: 1500, height: 2100 });
  });

  it('renders a saga at 1500x2100', async () => {
    const card: SagaData = {
      name: 'The Eldest Reborn', manaCost: '{4}{B}',
      typeLine: 'Enchantment \u2014 Saga',
      frameColor: 'b', rarity: 'uncommon',
      chapters: [
        { count: 1, text: 'Each opponent sacrifices a creature or planeswalker.' },
        { count: 1, text: 'Each opponent discards a card.' },
        { count: 1, text: 'Put target creature or planeswalker card from a graveyard onto the battlefield under your control.' },
      ],
    };
    const buf = await renderCard(card);
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    expect(pngDimensions(buf)).toEqual({ width: 1500, height: 2100 });
  });

  it('renders a battle at 2814x2010 (landscape)', async () => {
    const card: BattleData = {
      name: 'Invasion of Gobakhan', manaCost: '{1}{W}',
      typeLine: 'Battle \u2014 Siege',
      rulesText: 'When Invasion of Gobakhan enters the battlefield, look at target opponent\'s hand.',
      frameColor: 'w', rarity: 'rare',
      defense: '3',
    };
    const buf = await renderCard(card);
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    expect(pngDimensions(buf)).toEqual({ width: 2814, height: 2010 });
  });

  it('renders a gold multicolor legendary', async () => {
    const buf = await renderCard({
      name: 'Maelstrom Wanderer', manaCost: '{5}{U}{R}{G}',
      typeLine: 'Legendary Creature \u2014 Elemental',
      rulesText: 'Creatures you control have haste.\nCascade, cascade',
      power: '7', toughness: '5', frameColor: 'm', rarity: 'mythic', isLegendary: true,
    });
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });

  it('renders phyrexian mana in cost and rules', async () => {
    const buf = await renderCard({
      name: 'Birthing Pod', manaCost: '{3}{G/P}', typeLine: 'Artifact',
      rulesText: '{1}{G/P}, {T}, Sacrifice a creature: Search your library.',
      frameColor: 'a', rarity: 'rare',
    });
    expect(buf.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });
});
