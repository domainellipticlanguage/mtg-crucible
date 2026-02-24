import { describe, it, expect } from 'vitest';
import { parseCard } from '../src/parser';

describe('parseCard', () => {
  it('parses a simple instant', () => {
    const card = parseCard(`
      Lightning Bolt {R}
      Instant
      Lightning Bolt deals 3 damage to any target.
    `);
    expect(card).toEqual({
      name: 'Lightning Bolt',
      manaCost: '{R}',
      types: ['instant'],
      frameColor: 'red',
      rarity: 'rare',
      oracleText: 'Lightning Bolt deals 3 damage to any target.',
    });
  });

  it('parses a creature with P/T', () => {
    const card = parseCard(`
      Grizzly Bears {1}{G}
      Creature \u2014 Bear
      2/2
    `);
    expect(card).toEqual({
      name: 'Grizzly Bears',
      manaCost: '{1}{G}',
      types: ['creature'],
      subtypes: ['Bear'],
      frameColor: 'green',
      rarity: 'rare',
      power: '2',
      toughness: '2',
    });
  });

  it('parses a legendary creature with rules text and P/T', () => {
    const card = parseCard(`
      Questing Beast {2}{G}{G}
      Legendary Creature \u2014 Beast
      Vigilance, deathtouch, haste
      Questing Beast can't be blocked by creatures with power 2 or less.
      4/4
    `);
    expect(card).toMatchObject({
      name: 'Questing Beast',
      manaCost: '{2}{G}{G}',
      supertypes: ['legendary'],
      types: ['creature'],
      subtypes: ['Beast'],
      frameColor: 'green',
      power: '4',
      toughness: '4',
      oracleText: "Vigilance, deathtouch, haste\nQuesting Beast can't be blocked by creatures with power 2 or less.",
    });
  });

  it('parses the user example (Najeela)', () => {
    const card = parseCard(`
      Najeela, the Blade-Blossom {2}{R}
      Legendary Creature \u2014 Human Warrior
      Whenever a Warrior attacks, you may have its controller create a 1/1 white Warrior creature token that's tapped and attacking.
      {W}{U}{B}{R}{G}: Untap all attacking creatures. They gain trample, lifelink, and haste until end of turn. After this phase, there is an additional combat phase. Activate only during combat.
      3/2
    `);
    expect(card).toMatchObject({
      name: 'Najeela, the Blade-Blossom',
      manaCost: '{2}{R}',
      supertypes: ['legendary'],
      types: ['creature'],
      subtypes: ['Human', 'Warrior'],
      frameColor: 'red',
      power: '3',
      toughness: '2',
    });
    expect(card.oracleText).toContain('{W}{U}{B}{R}{G}:');
  });

  it('parses a land (no mana cost)', () => {
    const card = parseCard(`
      Command Tower
      Land
      {T}: Add one mana of any color in your commander's color identity.
    `);
    expect(card).toEqual({
      name: 'Command Tower',
      types: ['land'],
      frameColor: 'land',
      rarity: 'rare',
      oracleText: "{T}: Add one mana of any color in your commander's color identity.",
    });
  });

  it('derives vehicle frame color', () => {
    const card = parseCard(`
      Smuggler's Copter {2}
      Artifact \u2014 Vehicle
      Flying
      Crew 1
      3/3
    `);
    expect(card).toMatchObject({
      frameColor: 'vehicle',
      power: '3',
      toughness: '3',
    });
  });

  it('derives multicolor gold frame', () => {
    const card = parseCard(`
      Maelstrom Wanderer {5}{U}{R}{G}
      Legendary Creature \u2014 Elemental
      Creatures you control have haste.
      Cascade, cascade
      7/5
    `);
    expect(card).toMatchObject({
      frameColor: 'multicolor',
      supertypes: ['legendary'],
    });
  });

  it('derives artifact frame for colorless non-land', () => {
    const card = parseCard(`
      Sol Ring {1}
      Artifact
      {T}: Add {C}{C}.
    `);
    expect(card).toMatchObject({ frameColor: 'artifact' });
  });

  it('derives color from phyrexian mana', () => {
    const card = parseCard(`
      Birthing Pod {3}{G/P}
      Artifact
      {1}{G/P}, {T}, Sacrifice a creature: Search your library.
    `);
    expect(card).toMatchObject({
      manaCost: '{3}{G/P}',
      frameColor: 'green',
    });
  });

  it('parses flavor text wrapped in *asterisks*', () => {
    const card = parseCard(`
      Lightning Bolt {R}
      Instant
      Lightning Bolt deals 3 damage to any target.
      *"The sparkmage shrieked."*
    `);
    expect(card).toMatchObject({
      oracleText: 'Lightning Bolt deals 3 damage to any target.',
      flavorText: '"The sparkmage shrieked."',
    });
  });

  it('handles multi-line flavor text', () => {
    const card = parseCard(`
      Wrath of God {2}{W}{W}
      Sorcery
      Destroy all creatures. They can't be regenerated.
      *"Legend speaks of the Creators' rage"*
      *"at their most prized creation."*
    `);
    expect(card).toMatchObject({
      oracleText: "Destroy all creatures. They can't be regenerated.",
      flavorText: '"Legend speaks of the Creators\' rage"\n"at their most prized creation."',
    });
  });

  it('does not treat mid-rules *reminder text* as flavor', () => {
    const card = parseCard(`
      Questing Beast {2}{G}{G}
      Legendary Creature \u2014 Beast
      Vigilance, deathtouch, haste
      *(Deathtouch means any damage this deals is enough.)*
      Questing Beast can't be blocked by creatures with power 2 or less.
      4/4
      *"The beast never rests."*
    `);
    expect(card).toMatchObject({
      oracleText: "Vigilance, deathtouch, haste\n*(Deathtouch means any damage this deals is enough.)*\nQuesting Beast can't be blocked by creatures with power 2 or less.",
      flavorText: '"The beast never rests."',
    });
  });

  it('does not misparse rules text containing N/N as P/T for non-creatures', () => {
    const card = parseCard(`
      Some Enchantment {1}{W}
      Enchantment
      Create a 1/1 white Soldier creature token.
    `);
    expect(card).toMatchObject({
      oracleText: 'Create a 1/1 white Soldier creature token.',
    });
    expect((card as any).power).toBeUndefined();
  });

  it('parses a planeswalker', () => {
    const card = parseCard(`
      Liliana of the Veil {1}{B}{B}
      Legendary Planeswalker \u2014 Liliana
      +1: Each player discards a card.
      -2: Target player sacrifices a creature.
      -6: Separate all permanents target player controls into two piles.
      Loyalty: 3
    `);
    expect(card).toMatchObject({
      name: 'Liliana of the Veil',
      manaCost: '{1}{B}{B}',
      supertypes: ['legendary'],
      types: ['planeswalker'],
      subtypes: ['Liliana'],
      frameColor: 'black',
      startingLoyalty: '3',
      structuredAbilities: {
        kind: 'planeswalker',
        loyaltyAbilities: [
          { cost: '+1', text: 'Each player discards a card.' },
          { cost: '-2', text: 'Target player sacrifices a creature.' },
          { cost: '-6', text: 'Separate all permanents target player controls into two piles.' },
        ],
      },
    });
  });

  it('parses a planeswalker with a static ability', () => {
    const card = parseCard(`
      Narset, Parter of Veils {1}{U}{U}
      Legendary Planeswalker \u2014 Narset
      Each opponent can't draw more than one card each turn.
      -2: Look at the top four cards of your library. You may reveal a noncreature, nonland card and put it into your hand. Put the rest on the bottom in a random order.
      Loyalty: 5
    `);
    expect(card.structuredAbilities).toEqual({
      kind: 'planeswalker',
      loyaltyAbilities: [
        { cost: '', text: "Each opponent can't draw more than one card each turn." },
        { cost: '-2', text: 'Look at the top four cards of your library. You may reveal a noncreature, nonland card and put it into your hand. Put the rest on the bottom in a random order.' },
      ],
    });
  });

  it('parses a saga', () => {
    const card = parseCard(`
      The Eldest Reborn {4}{B}
      Enchantment \u2014 Saga
      I \u2014 Each opponent sacrifices a creature or planeswalker.
      II \u2014 Each opponent discards a card.
      III \u2014 Put target creature or planeswalker card from a graveyard onto the battlefield under your control.
    `);
    expect(card).toMatchObject({
      name: 'The Eldest Reborn',
      frameColor: 'black',
      structuredAbilities: {
        kind: 'saga',
        chapters: [
          { chapterNumbers: [1], text: 'Each opponent sacrifices a creature or planeswalker.' },
          { chapterNumbers: [2], text: 'Each opponent discards a card.' },
          { chapterNumbers: [3], text: 'Put target creature or planeswalker card from a graveyard onto the battlefield under your control.' },
        ],
      },
    });
  });

  it('parses a saga with combined chapters', () => {
    const card = parseCard(`
      Fireside Tale {2}{R}
      Enchantment \u2014 Saga
      I, II \u2014 Create a 1/1 red Goblin creature token.
      III \u2014 Creatures you control get +2/+0 until end of turn.
    `);
    expect(card.structuredAbilities).toEqual({
      kind: 'saga',
      chapters: [
        { chapterNumbers: [1, 2], text: 'Create a 1/1 red Goblin creature token.' },
        { chapterNumbers: [3], text: 'Creatures you control get +2/+0 until end of turn.' },
      ],
    });
  });

  it('parses a battle', () => {
    const card = parseCard(`
      Invasion of Gobakhan {1}{W}
      Battle \u2014 Siege
      When Invasion of Gobakhan enters the battlefield, look at target opponent's hand.
      Defense: 3
    `);
    expect(card).toMatchObject({
      name: 'Invasion of Gobakhan',
      frameColor: 'white',
      battleDefense: '3',
      oracleText: "When Invasion of Gobakhan enters the battlefield, look at target opponent's hand.",
    });
  });

  it('parses Art: URL between name and type line', () => {
    const card = parseCard(`
      Archangel Avacyn {3}{W}{W}
      Art: https://cards.scryfall.io/art_crop/front/7/f/7f4893ef.jpg
      Legendary Creature \u2014 Angel
      Flash
      Flying, vigilance
      4/4
    `);
    expect(card).toMatchObject({
      name: 'Archangel Avacyn',
      artUrl: 'https://cards.scryfall.io/art_crop/front/7/f/7f4893ef.jpg',
      supertypes: ['legendary'],
      types: ['creature'],
      subtypes: ['Angel'],
      power: '4',
      toughness: '4',
    });
  });

  it('works without Art: line', () => {
    const card = parseCard(`
      Lightning Bolt {R}
      Instant
      Lightning Bolt deals 3 damage to any target.
    `);
    expect((card as any).artUrl).toBeUndefined();
  });

  it('parses Rarity: metadata', () => {
    const card = parseCard(`
      Sol Ring {1}
      Rarity: Uncommon
      Artifact
      {T}: Add {C}{C}.
    `);
    expect(card).toMatchObject({
      name: 'Sol Ring',
      rarity: 'uncommon',
      types: ['artifact'],
    });
  });

  it('parses "Mythic Rare" and normalizes to mythic', () => {
    const card = parseCard(`
      Questing Beast {2}{G}{G}
      Rarity: Mythic Rare
      Legendary Creature \u2014 Beast
      Vigilance, deathtouch, haste
      4/4
    `);
    expect(card).toMatchObject({ rarity: 'mythic' });
  });

  it('accepts shorthand "mythic" case-insensitively', () => {
    const card = parseCard(`
      Questing Beast {2}{G}{G}
      Rarity: mythic
      Legendary Creature \u2014 Beast
      Vigilance, deathtouch, haste
      4/4
    `);
    expect(card).toMatchObject({ rarity: 'mythic' });
  });

  it('parses Art: and Rarity: together in any order', () => {
    const card = parseCard(`
      Archangel Avacyn {3}{W}{W}
      Rarity: Mythic Rare
      Art: https://cards.scryfall.io/art_crop/front/7/f/7f4893ef.jpg
      Legendary Creature \u2014 Angel
      Flash
      4/4
    `);
    expect(card).toMatchObject({
      name: 'Archangel Avacyn',
      rarity: 'mythic',
      artUrl: 'https://cards.scryfall.io/art_crop/front/7/f/7f4893ef.jpg',
      supertypes: ['legendary'],
      types: ['creature'],
      subtypes: ['Angel'],
    });
  });

  it('throws for insufficient lines', () => {
    expect(() => parseCard('Just a name')).toThrow('at least a name line and type line');
  });

  it('handles wildcard P/T', () => {
    const card = parseCard(`
      Tarmogoyf {1}{G}
      Creature \u2014 Lhurgoyf
      Tarmogoyf's power is equal to the number of card types among cards in all graveyards and its toughness is equal to that number plus 1.
      */1+*
    `);
    expect(card).toMatchObject({
      power: '*',
      toughness: '1+*',
    });
  });

  it('parses a class enchantment with 3 levels', () => {
    const card = parseCard(`
      Barbarian Class {R}
      Enchantment \u2014 Class
      If you would roll one or more dice, instead roll that many dice plus one and ignore the lowest roll.
      {1}{R}: Level 2
      Whenever you roll one or more dice, target creature you control gets +2/+0 and gains menace until end of turn.
      {2}{R}: Level 3
      Creatures you control have haste.
    `);
    expect(card).toMatchObject({
      name: 'Barbarian Class',
      manaCost: '{R}',
      frameColor: 'red',
      structuredAbilities: {
        kind: 'class',
        classLevels: [
          { level: 1, cost: '', text: 'If you would roll one or more dice, instead roll that many dice plus one and ignore the lowest roll.' },
          { level: 2, cost: '{1}{R}', text: 'Whenever you roll one or more dice, target creature you control gets +2/+0 and gains menace until end of turn.' },
          { level: 3, cost: '{2}{R}', text: 'Creatures you control have haste.' },
        ],
      },
    });
  });

  it('extracts reminder text from class level 1', () => {
    const card = parseCard(`
      Barbarian Class {R}
      Enchantment \u2014 Class
      *(Gain the next level as a sorcery to add its ability.)*
      If you would roll one or more dice, instead roll that many dice plus one and ignore the lowest roll.
      {1}{R}: Level 2
      Whenever you roll one or more dice, target creature you control gets +2/+0 and gains menace until end of turn.
      {2}{R}: Level 3
      Creatures you control have haste.
    `);
    expect(card).toMatchObject({
      unstructuredAbilities: '(Gain the next level as a sorcery to add its ability.)',
      structuredAbilities: {
        kind: 'class',
        classLevels: [
          { level: 1, cost: '', text: 'If you would roll one or more dice, instead roll that many dice plus one and ignore the lowest roll.' },
          { level: 2, cost: '{1}{R}' },
          { level: 3, cost: '{2}{R}' },
        ],
      },
    });
  });

  it('parses class level cost and name correctly', () => {
    const card = parseCard(`
      Wizard Class {U}
      Enchantment \u2014 Class
      You may look at the top card of your library any time.
      {2}{U}: Level 2
      When this Class becomes level 2, draw two cards.
      {4}{U}: Level 3
      You have no maximum hand size.
    `);
    const cls = card.structuredAbilities as any;
    expect(cls.classLevels).toHaveLength(3);
    expect(cls.classLevels[0]).toEqual({ level: 1, cost: '', text: 'You may look at the top card of your library any time.' });
    expect(cls.classLevels[1]).toEqual({ level: 2, cost: '{2}{U}', text: 'When this Class becomes level 2, draw two cards.' });
    expect(cls.classLevels[2]).toEqual({ level: 3, cost: '{4}{U}', text: 'You have no maximum hand size.' });
  });
});
