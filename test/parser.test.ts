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
      typeLine: 'Instant',
      frameColor: 'r',
      rarity: 'rare',
      rulesText: 'Lightning Bolt deals 3 damage to any target.',
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
      typeLine: 'Creature \u2014 Bear',
      frameColor: 'g',
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
      isLegendary: true,
      frameColor: 'g',
      power: '4',
      toughness: '4',
      rulesText: "Vigilance, deathtouch, haste\nQuesting Beast can't be blocked by creatures with power 2 or less.",
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
      typeLine: 'Legendary Creature \u2014 Human Warrior',
      isLegendary: true,
      frameColor: 'r',
      power: '3',
      toughness: '2',
    });
    expect((card as any).rulesText).toContain('{W}{U}{B}{R}{G}:');
  });

  it('parses a land (no mana cost)', () => {
    const card = parseCard(`
      Command Tower
      Land
      {T}: Add one mana of any color in your commander's color identity.
    `);
    expect(card).toEqual({
      name: 'Command Tower',
      typeLine: 'Land',
      frameColor: 'l',
      rarity: 'rare',
      rulesText: "{T}: Add one mana of any color in your commander's color identity.",
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
      frameColor: 'v',
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
      frameColor: 'm',
      isLegendary: true,
    });
  });

  it('derives artifact frame for colorless non-land', () => {
    const card = parseCard(`
      Sol Ring {1}
      Artifact
      {T}: Add {C}{C}.
    `);
    expect(card).toMatchObject({ frameColor: 'a' });
  });

  it('derives color from phyrexian mana', () => {
    const card = parseCard(`
      Birthing Pod {3}{G/P}
      Artifact
      {1}{G/P}, {T}, Sacrifice a creature: Search your library.
    `);
    expect(card).toMatchObject({
      manaCost: '{3}{G/P}',
      frameColor: 'g',
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
      rulesText: 'Lightning Bolt deals 3 damage to any target.',
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
      rulesText: "Destroy all creatures. They can't be regenerated.",
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
      rulesText: "Vigilance, deathtouch, haste\n*(Deathtouch means any damage this deals is enough.)*\nQuesting Beast can't be blocked by creatures with power 2 or less.",
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
      rulesText: 'Create a 1/1 white Soldier creature token.',
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
      isLegendary: true,
      frameColor: 'b',
      startingLoyalty: '3',
      abilities: [
        { cost: '+1', text: 'Each player discards a card.' },
        { cost: '-2', text: 'Target player sacrifices a creature.' },
        { cost: '-6', text: 'Separate all permanents target player controls into two piles.' },
      ],
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
    expect((card as any).abilities).toEqual([
      { cost: '', text: "Each opponent can't draw more than one card each turn." },
      { cost: '-2', text: 'Look at the top four cards of your library. You may reveal a noncreature, nonland card and put it into your hand. Put the rest on the bottom in a random order.' },
    ]);
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
      frameColor: 'b',
      chapters: [
        { count: 1, text: 'Each opponent sacrifices a creature or planeswalker.' },
        { count: 1, text: 'Each opponent discards a card.' },
        { count: 1, text: 'Put target creature or planeswalker card from a graveyard onto the battlefield under your control.' },
      ],
    });
  });

  it('parses a saga with combined chapters', () => {
    const card = parseCard(`
      Fireside Tale {2}{R}
      Enchantment \u2014 Saga
      I, II \u2014 Create a 1/1 red Goblin creature token.
      III \u2014 Creatures you control get +2/+0 until end of turn.
    `);
    expect((card as any).chapters).toEqual([
      { count: 2, text: 'Create a 1/1 red Goblin creature token.' },
      { count: 1, text: 'Creatures you control get +2/+0 until end of turn.' },
    ]);
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
      frameColor: 'w',
      defense: '3',
      rulesText: "When Invasion of Gobakhan enters the battlefield, look at target opponent's hand.",
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
      typeLine: 'Legendary Creature \u2014 Angel',
      isLegendary: true,
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
      typeLine: 'Artifact',
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
      typeLine: 'Legendary Creature \u2014 Angel',
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
});
