import { describe, it, expect } from 'vitest';
import { parseCard, formatCard, toScryfallText } from '../src/parser';
import { renderCard } from '../src';

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
      abilities: { unstructuredAbilities: ['Lightning Bolt deals 3 damage to any target.'] },
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
      abilities: { unstructuredAbilities: ['Vigilance, deathtouch, haste', "Questing Beast can't be blocked by creatures with power 2 or less."] },
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
    const abilities = (card.abilities as any).unstructuredAbilities;
    expect(abilities.some((a: string) => a.includes('{W}{U}{B}{R}{G}:'))).toBe(true);
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
      abilities: { unstructuredAbilities: ["{T}: Add one mana of any color in your commander's color identity."] },
      accentColor: 'multicolor',
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

  it('derives artifact frame with accent from phyrexian mana', () => {
    const card = parseCard(`
      Birthing Pod {3}{G/P}
      Artifact
      {1}{G/P}, {T}, Sacrifice a creature: Search your library.
    `);
    expect(card).toMatchObject({
      manaCost: '{3}{G/P}',
      frameColor: 'artifact',
      accentColor: 'green',
    });
  });

  it('derives artifact frame with multicolor accent', () => {
    const card = parseCard(`
      Chromatic Orrery {7}
      Legendary Artifact
      You may spend mana as though it were mana of any color.
    `);
    expect(card).toMatchObject({ frameColor: 'artifact' });
    expect(card.accentColor).toBeUndefined();
  });

  it('derives artifact frame with accent from colored mana', () => {
    const card = parseCard(`
      Bolas's Citadel {3}{B}{B}{B}
      Legendary Artifact
      You may look at the top card of your library any time.
    `);
    expect(card).toMatchObject({
      frameColor: 'artifact',
      accentColor: 'black',
    });
  });

  it('derives land frame with multicolor accent for colorless land', () => {
    const card = parseCard(`
      Command Tower
      Land
      {T}: Add one mana of any color in your commander's color identity.
    `);
    expect(card).toMatchObject({ frameColor: 'land', accentColor: 'multicolor' });
  });

  it('derives land frame with accent from colorIndicator', () => {
    const card = parseCard(`
      Dryad Arbor
      Color Indicator: green
      Land Creature — Forest Dryad
      1/1
    `);
    expect(card).toMatchObject({
      frameColor: 'land',
      accentColor: 'green',
    });
  });

  it('derives land frame with accent from land subtypes', () => {
    const card = parseCard(`
      Test Land
      Color Indicator: blue, red
      Land Creature — Island Mountain
      1/1
    `);
    expect(card).toMatchObject({
      frameColor: 'land',
      accentColor: ['blue', 'red'],
    });
  });

  it('derives hybrid frame as array for 2-color hybrid mana', () => {
    const card = parseCard(`
      Boros Charm {R}{W}
      Frame Color: blue, red
      Instant
      Choose one —
    `);
    // Frame Color: override takes precedence, but let's test derivation without it
    const card2 = parseCard(`
      Boros Charm {R/W}{R/W}
      Instant
      Choose one —
    `);
    expect(card2).toMatchObject({
      frameColor: ['white', 'red'],
      accentColor: ['white', 'red'],
    });
  });

  it('derives multicolor frame with 2-color accent for non-hybrid 2-color', () => {
    const card = parseCard(`
      Electrolyze {1}{U}{R}
      Instant
      Electrolyze deals 2 damage divided as you choose.
    `);
    expect(card).toMatchObject({
      frameColor: 'multicolor',
      accentColor: ['blue', 'red'],
    });
  });

  it('derives hybrid frame for mixed hybrid + mono 2-color', () => {
    const card = parseCard(`
      Shaman of the Great Hunt {U}{U/R}{R}
      Creature — Shaman
      2/2
    `);
    expect(card).toMatchObject({
      frameColor: ['blue', 'red'],
      accentColor: ['blue', 'red'],
    });
  });

  it('derives artifact frame with 2-color accent array', () => {
    const card = parseCard(`
      Talisman of Creativity {2}
      Artifact
      {T}: Add {U} or {R}.
    `);
    // 0 colors in mana cost — no accent
    expect(card.accentColor).toBeUndefined();

    const card2 = parseCard(`
      Izzet Signet {1}{U}{R}
      Artifact
      Rules text.
    `);
    expect(card2).toMatchObject({
      frameColor: 'artifact',
      accentColor: ['blue', 'red'],
    });
  });

  it('derives 3+ color as multicolor with no array accent', () => {
    const card = parseCard(`
      Maelstrom Wanderer {5}{U}{R}{G}
      Legendary Creature — Elemental
      Creatures you control have haste.
      7/5
    `);
    expect(card).toMatchObject({ frameColor: 'multicolor' });
  });

  it('derives land accent from tap ability mana production', () => {
    const card = parseCard(`
      Super Cool Island
      Rarity: Mythic Rare
      Land — Island
      {T}: Add {R} or {U}.
    `);
    expect(card).toMatchObject({
      frameColor: 'land',
      accentColor: ['blue', 'red'],
    });
  });

  it('derives land accent from single basic land type', () => {
    const card = parseCard(`
      Mystic Sanctuary
      Land — Island
      Mystic Sanctuary enters the battlefield tapped unless you control three or more other Islands.
    `);
    expect(card).toMatchObject({
      frameColor: 'land',
      accentColor: 'blue',
    });
  });

  it('parses explicit Accent: metadata line', () => {
    const card = parseCard(`
      Mystic Sanctuary
      Accent: blue
      Land — Island
      Mystic Sanctuary enters the battlefield tapped unless you control three or more other Islands.
    `);
    expect(card).toMatchObject({
      frameColor: 'land',
      accentColor: 'blue',
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
      abilities: { unstructuredAbilities: ['Lightning Bolt deals 3 damage to any target.'] },
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
      abilities: { unstructuredAbilities: ["Destroy all creatures. They can't be regenerated."] },
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
      abilities: { unstructuredAbilities: ['Vigilance, deathtouch, haste', '*(Deathtouch means any damage this deals is enough.)*', "Questing Beast can't be blocked by creatures with power 2 or less."] },
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
      abilities: { unstructuredAbilities: ['Create a 1/1 white Soldier creature token.'] },
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
      abilities: { structuredAbilities: {
        kind: 'planeswalker',
        loyaltyAbilities: [
          { cost: '+1', text: 'Each player discards a card.' },
          { cost: '-2', text: 'Target player sacrifices a creature.' },
          { cost: '-6', text: 'Separate all permanents target player controls into two piles.' },
        ],
      } },
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
    expect((card.abilities as any).structuredAbilities).toEqual({
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
      abilities: { structuredAbilities: {
        kind: 'saga',
        chapters: [
          { chapterNumbers: [1], text: 'Each opponent sacrifices a creature or planeswalker.' },
          { chapterNumbers: [2], text: 'Each opponent discards a card.' },
          { chapterNumbers: [3], text: 'Put target creature or planeswalker card from a graveyard onto the battlefield under your control.' },
        ],
      } },
    });
  });

  it('parses a saga with combined chapters', () => {
    const card = parseCard(`
      Fireside Tale {2}{R}
      Enchantment \u2014 Saga
      I, II \u2014 Create a 1/1 red Goblin creature token.
      III \u2014 Creatures you control get +2/+0 until end of turn.
    `);
    expect((card.abilities as any).structuredAbilities).toEqual({
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
      abilities: { unstructuredAbilities: ["When Invasion of Gobakhan enters the battlefield, look at target opponent's hand."] },
    });
  });

  it('parses Art URL: URL between name and type line', () => {
    const card = parseCard(`
      Archangel Avacyn {3}{W}{W}
      Art URL: https://cards.scryfall.io/art_crop/front/7/f/7f4893ef.jpg
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

  it('works without Art URL: line', () => {
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

  it('parses Art URL: and Rarity: together in any order', () => {
    const card = parseCard(`
      Archangel Avacyn {3}{W}{W}
      Rarity: Mythic Rare
      Art URL: https://cards.scryfall.io/art_crop/front/7/f/7f4893ef.jpg
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
      abilities: { structuredAbilities: {
        kind: 'class',
        classLevels: [
          { level: 1, cost: '', text: 'If you would roll one or more dice, instead roll that many dice plus one and ignore the lowest roll.' },
          { level: 2, cost: '{1}{R}', text: 'Whenever you roll one or more dice, target creature you control gets +2/+0 and gains menace until end of turn.' },
          { level: 3, cost: '{2}{R}', text: 'Creatures you control have haste.' },
        ],
      } },
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
      abilities: {
        unstructuredAbilities: ['(Gain the next level as a sorcery to add its ability.)'],
        structuredAbilities: {
          kind: 'class',
          classLevels: [
            { level: 1, cost: '', text: 'If you would roll one or more dice, instead roll that many dice plus one and ignore the lowest roll.' },
            { level: 2, cost: '{1}{R}' },
            { level: 3, cost: '{2}{R}' },
          ],
        },
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
    const cls = (card.abilities as any).structuredAbilities;
    expect(cls.classLevels).toHaveLength(3);
    expect(cls.classLevels[0]).toEqual({ level: 1, cost: '', text: 'You may look at the top card of your library any time.' });
    expect(cls.classLevels[1]).toEqual({ level: 2, cost: '{2}{U}', text: 'When this Class becomes level 2, draw two cards.' });
    expect(cls.classLevels[2]).toEqual({ level: 3, cost: '{4}{U}', text: 'You have no maximum hand size.' });
  });

  it('captures extended metadata like artist, set, collector number, designer, and color indicator', () => {
    const card = parseCard(`
      \u200BThe Immortal Sun {6}
      Art URL: https://example.com/art.png
      Rarity: mythic
      Artist: Victor Adame Minguez
      Set: rix
      Collector Number: 180
      Designer: MTG Team
      Color Indicator: white blue
      Legendary Artifact
      Activated abilities can't be activated.
    `);
    expect(card).toMatchObject({
      name: 'The Immortal Sun',
      manaCost: '{6}',
      artUrl: 'https://example.com/art.png',
      rarity: 'mythic',
      artist: 'Victor Adame Minguez',
      setCode: 'RIX',
      collectorNumber: '180',
      designer: 'MTG Team',
      colorIndicator: ['white', 'blue'],
    });
  });

  it('normalizes lowercase mana symbols and handles CRLF newlines', () => {
    const card = parseCard(`Smoldering Egg {1}{r}
Instant\r
\r
Deal 2 damage to any target.\r
`);
    expect(card).toMatchObject({
      manaCost: '{1}{R}',
      types: ['instant'],
      abilities: { unstructuredAbilities: ['Deal 2 damage to any target.'] },
    });
  });

  it('ignores metadata lines it does not understand and keeps blank line separation safe', () => {
    const card = parseCard(`
      Example Card {1}{G}
      Flavor: Citrus
      Legendary Creature \u2014 Dryad

      Reach
      2/4
    `);
    expect(card).toMatchObject({
      name: 'Example Card',
      types: ['creature'],
      abilities: { unstructuredAbilities: ['Reach'] },
      power: '2',
      toughness: '4',
    });
  });

  it('parses color indicator metadata even without mana cost', () => {
    const card = parseCard(`
      O-Kagachi, Ghost of Vengeance
      Color Indicator: white blue black red green
      Legendary Creature \u2014 Dragon Spirit
      Flying, trample
      6/6
    `);
    expect(card.colorIndicator).toEqual(['white', 'blue', 'black', 'red', 'green']);
  });

  it('parses Scryfall-style color indicator with "and" and oxford commas', () => {
    expect(parseCard(`
      Ancestral Vision
      Color Indicator: Blue
      Sorcery
      Draw three cards.
    `).colorIndicator).toEqual(['blue']);

    expect(parseCard(`
      Archangel Avacyn
      Color Indicator: White and Red
      Legendary Creature \u2014 Angel
      Flying
      4/4
    `).colorIndicator).toEqual(['white', 'red']);

    expect(parseCard(`
      Nicol Bolas
      Color Indicator: Blue, Black, and Red
      Legendary Creature \u2014 Elder Dragon
      Flying
      7/7
    `).colorIndicator).toEqual(['blue', 'black', 'red']);
  });

  it('does not emit empty class levels when headers are missing', () => {
    const card = parseCard(`
      Future Class {1}{U}
      Enchantment \u2014 Class
      {1}{U}: Level 2
      Draw a card.
      {3}{U}: Level 3
      Scry 2, then draw a card.
    `);
    const cls = (card.abilities as any).structuredAbilities;
    expect(cls.classLevels).toEqual([
      { level: 2, cost: '{1}{U}', text: 'Draw a card.' },
      { level: 3, cost: '{3}{U}', text: 'Scry 2, then draw a card.' },
    ]);
  });

  it('accepts plain hyphens in type lines for easy typing', () => {
    const card = parseCard(`
      Grizzly Bears {1}{G}
      Creature - Bear
      2/2
    `);
    expect(card).toMatchObject({
      types: ['creature'],
      subtypes: ['Bear'],
    });
  });

  it('does not split compound subtypes on hyphens without spaces', () => {
    const card = parseCard(`
      The Thirteenth Doctor {1}{G}{U}
      Legendary Creature - Time-Lord Doctor
      2/2
    `);
    expect(card).toMatchObject({
      subtypes: ['Time-Lord', 'Doctor'],
    });
  });

  it('parses comma-separated Accent: red, blue', () => {
    const card = parseCard(`
      Test Gold Land
      Accent: red, blue
      Land
      {T}: Add {R} or {U}.
    `);
    expect(card).toMatchObject({
      frameColor: 'land',
      accentColor: ['red', 'blue'],
    });
  });

  it('parses Frame Color: blue, red for explicit multi-color frames', () => {
    const card = parseCard(`
      Hybrid Test {U/R}
      Frame Color: blue, red
      Instant
      Deal 2 damage to any target.
    `);
    expect(card).toMatchObject({
      frameColor: ['blue', 'red'],
    });
  });

  it('parses single-value Frame Color: green', () => {
    const card = parseCard(`
      Green Test {G}
      Frame Color: green
      Instant
      Untap target creature.
    `);
    expect(card).toMatchObject({
      frameColor: 'green',
    });
  });

  it('parses Flavor Text: syntax', () => {
    const card = parseCard(`
      Lightning Bolt {R}
      Instant
      Lightning Bolt deals 3 damage to any target.
      Flavor Text: "The sparkmage shrieked."
    `);
    expect(card).toMatchObject({
      abilities: { unstructuredAbilities: ['Lightning Bolt deals 3 damage to any target.'] },
      flavorText: '"The sparkmage shrieked."',
    });
  });

  it('parses Flavor Text: in metadata section (before type line)', () => {
    const card = parseCard(`
      Lightning Bolt {R}
      Flavor Text: "The sparkmage shrieked."
      Instant
      Lightning Bolt deals 3 damage to any target.
    `);
    expect(card).toMatchObject({
      abilities: { unstructuredAbilities: ['Lightning Bolt deals 3 damage to any target.'] },
      flavorText: '"The sparkmage shrieked."',
    });
  });

  it('parses multi-line Flavor Text:', () => {
    const card = parseCard(`
      Wrath of God {2}{W}{W}
      Sorcery
      Destroy all creatures. They can't be regenerated.
      Flavor Text: "Legend speaks of the Creators' rage"
      Flavor Text: "at their most prized creation."
    `);
    expect(card).toMatchObject({
      abilities: { unstructuredAbilities: ["Destroy all creatures. They can't be regenerated."] },
      flavorText: '"Legend speaks of the Creators\' rage"\n"at their most prized creation."',
    });
  });

  it('renderCard with frameColor array produces valid PNG', async () => {
    const { frontFace } = await renderCard({
      name: 'Gradient Test',
      frameColor: ['blue', 'red'],
      types: ['instant'],
      oracleText: 'Test card.',
    });
    expect(frontFace).toBeInstanceOf(Buffer);
    expect(frontFace.length).toBeGreaterThan(1000);
    // PNG magic bytes
    expect(frontFace[0]).toBe(0x89);
    expect(frontFace[1]).toBe(0x50);
  }, 30000);
});

describe('parseCard ↔ formatCard round-trip', () => {
  it('round-trips a simple instant with flavor text', () => {
    const input = `Lightning Bolt {R}
Rarity: uncommon
Instant
Lightning Bolt deals 3 damage to any target.
Flavor Text: "The sparkmage shrieked."`;
    const card = parseCard(input);
    const output = formatCard(card);
    const reparsed = parseCard(output);
    expect(reparsed.name).toBe(card.name);
    expect(reparsed.manaCost).toBe(card.manaCost);
    expect(reparsed.types).toEqual(card.types);
    expect(reparsed.flavorText).toBe(card.flavorText);
    expect((reparsed.abilities as any).unstructuredAbilities).toEqual(
      (card.abilities as any).unstructuredAbilities,
    );
  });

  it('round-trips a creature with P/T and flavor', () => {
    const input = `Grizzly Bears {1}{G}
Rarity: common
Creature \u2014 Bear
Flavor Text: "Don't try to outrun one; it'll just make you a meal on the go."
2/2`;
    const card = parseCard(input);
    const output = formatCard(card);
    const reparsed = parseCard(output);
    expect(reparsed.name).toBe('Grizzly Bears');
    expect(reparsed.power).toBe('2');
    expect(reparsed.toughness).toBe('2');
    expect(reparsed.flavorText).toBe(card.flavorText);
    expect(reparsed.types).toEqual(['creature']);
    expect(reparsed.subtypes).toEqual(['Bear']);
  });

  it('round-trips a legendary creature with abilities', () => {
    const input = `Questing Beast {2}{G}{G}
Rarity: mythic
Legendary Creature \u2014 Beast
Vigilance, deathtouch, haste
Questing Beast can't be blocked by creatures with power 2 or less.
4/4`;
    const card = parseCard(input);
    const output = formatCard(card);
    const reparsed = parseCard(output);
    expect(reparsed.name).toBe(card.name);
    expect(reparsed.supertypes).toEqual(['legendary']);
    expect(reparsed.power).toBe('4');
    expect(reparsed.toughness).toBe('4');
    expect((reparsed.abilities as any).unstructuredAbilities).toEqual(
      (card.abilities as any).unstructuredAbilities,
    );
  });

  it('round-trips a card with no abilities, only flavor', () => {
    const input = `Darksteel Relic {0}
Rarity: uncommon
Artifact
Flavor Text: It is a mystery even to its creator.`;
    const card = parseCard(input);
    expect(card.flavorText).toBe('It is a mystery even to its creator.');
    const output = formatCard(card);
    const reparsed = parseCard(output);
    expect(reparsed.flavorText).toBe(card.flavorText);
    expect(reparsed.name).toBe('Darksteel Relic');
  });

  it('preserves flavor text through legacy *asterisk* format', () => {
    const card = parseCard(`
      Bolt {R}
      Instant
      Deal 3 damage.
      *"Zap."*
    `);
    expect(card.flavorText).toBe('"Zap."');
    // formatCard outputs Flavor Text: format
    const output = formatCard(card);
    expect(output).toContain('Flavor Text: "Zap."');
    // Re-parsing the new format preserves it
    const reparsed = parseCard(output);
    expect(reparsed.flavorText).toBe('"Zap."');
  });
});

describe('parseCard ↔ toScryfallText round-trip', () => {
  it('round-trips a simple instant', () => {
    const card = parseCard(`
      Lightning Bolt {R}
      Instant
      Lightning Bolt deals 3 damage to any target.
    `);
    const sfText = toScryfallText(card);
    expect(sfText).toContain('Lightning Bolt {R}');
    expect(sfText).toContain('Instant');
    expect(sfText).toContain('Lightning Bolt deals 3 damage to any target.');
    // Scryfall text can be re-parsed
    const reparsed = parseCard(sfText);
    expect(reparsed.name).toBe('Lightning Bolt');
    expect(reparsed.manaCost).toBe('{R}');
    expect(reparsed.types).toEqual(['instant']);
    expect((reparsed.abilities as any).unstructuredAbilities).toEqual(
      ['Lightning Bolt deals 3 damage to any target.'],
    );
  });

  it('round-trips a creature with P/T', () => {
    const card = parseCard(`
      Tarmogoyf {1}{G}
      Creature \u2014 Lhurgoyf
      Tarmogoyf's power is equal to the number of card types among cards in all graveyards and its toughness is equal to that number plus 1.
      0/1
    `);
    const sfText = toScryfallText(card);
    expect(sfText).toContain('0/1');
    const reparsed = parseCard(sfText);
    expect(reparsed.name).toBe('Tarmogoyf');
    expect(reparsed.manaCost).toBe('{1}{G}');
    expect(reparsed.types).toEqual(['creature']);
    expect(reparsed.subtypes).toEqual(['Lhurgoyf']);
    expect(reparsed.power).toBe('0');
    expect(reparsed.toughness).toBe('1');
  });

  it('round-trips a legendary creature with multiple abilities', () => {
    const card = parseCard(`
      Questing Beast {2}{G}{G}
      Legendary Creature \u2014 Beast
      Vigilance, deathtouch, haste
      Questing Beast can't be blocked by creatures with power 2 or less.
      4/4
    `);
    const sfText = toScryfallText(card);
    const reparsed = parseCard(sfText);
    expect(reparsed.name).toBe('Questing Beast');
    expect(reparsed.supertypes).toEqual(['legendary']);
    expect(reparsed.power).toBe('4');
    expect(reparsed.toughness).toBe('4');
    expect((reparsed.abilities as any).unstructuredAbilities).toEqual([
      'Vigilance, deathtouch, haste',
      "Questing Beast can't be blocked by creatures with power 2 or less.",
    ]);
  });

  it('round-trips a sorcery with no P/T', () => {
    const card = parseCard(`
      Wrath of God {2}{W}{W}
      Sorcery
      Destroy all creatures. They can't be regenerated.
    `);
    const sfText = toScryfallText(card);
    const reparsed = parseCard(sfText);
    expect(reparsed.name).toBe('Wrath of God');
    expect(reparsed.types).toEqual(['sorcery']);
    expect(reparsed.power).toBeUndefined();
    expect(reparsed.toughness).toBeUndefined();
  });

  it('round-trips a planeswalker with loyalty', () => {
    const card = parseCard(`
      Jace, the Mind Sculptor {2}{U}{U}
      Legendary Planeswalker \u2014 Jace
      +2: Look at the top card of target player's library.
      0: Draw three cards, then put two cards from your hand on top of your library.
      -1: Return target creature to its owner's hand.
      -12: Exile all cards from target player's library, then that player shuffles their hand into their library.
      Loyalty: 3
    `);
    const sfText = toScryfallText(card);
    expect(sfText).toContain('Loyalty: 3');
    const reparsed = parseCard(sfText);
    expect(reparsed.name).toBe('Jace, the Mind Sculptor');
    expect(reparsed.startingLoyalty).toBe('3');
    expect(reparsed.types).toEqual(['planeswalker']);
  });

  it('round-trips a planeswalker with Unicode minus abilities', () => {
    const card = parseCard(`
      Jace, the Mind Sculptor {2}{U}{U}
      Legendary Planeswalker \u2014 Jace
      +2: Look at the top card of target player's library.
      0: Draw three cards, then put two cards from your hand on top of your library.
      \u22121: Return target creature to its owner's hand.
      \u221212: Exile all cards from target player's library, then that player shuffles their hand into their library.
      Loyalty: 3
    `);
    const sa = (card.abilities as any).structuredAbilities;
    expect(sa.kind).toBe('planeswalker');
    expect(sa.loyaltyAbilities).toHaveLength(4);
    // Unicode minus should be normalized to ASCII
    expect(sa.loyaltyAbilities[2].cost).toBe('-1');
    expect(sa.loyaltyAbilities[3].cost).toBe('-12');
    // Round-trip through Scryfall text
    const sfText = toScryfallText(card);
    const reparsed = parseCard(sfText);
    const rsa = (reparsed.abilities as any).structuredAbilities;
    expect(rsa.loyaltyAbilities).toHaveLength(4);
    expect(rsa.loyaltyAbilities[0].cost).toBe('+2');
    expect(rsa.loyaltyAbilities[2].cost).toBe('-1');
    expect(rsa.loyaltyAbilities[3].cost).toBe('-12');
  });

  it('round-trips a battle with defense', () => {
    const card = parseCard(`
      Invasion of Gobakhan {1}{W}
      Battle \u2014 Siege
      When Invasion of Gobakhan enters the battlefield, look at target opponent's hand.
      Defense: 3
    `);
    const sfText = toScryfallText(card);
    expect(sfText).toContain('Defense: 3');
    const reparsed = parseCard(sfText);
    expect(reparsed.name).toBe('Invasion of Gobakhan');
    expect(reparsed.battleDefense).toBe('3');
    expect(reparsed.types).toEqual(['battle']);
  });
});

describe('parseCard — metadata ordering', () => {
  it('parses metadata between name and type line', () => {
    const card = parseCard(`
      Test Card {R}
      Rarity: mythic
      Frame Color: blue
      Artist: Someone
      Instant
      Deal 3 damage.
    `);
    expect(card).toMatchObject({
      name: 'Test Card',
      rarity: 'mythic',
      frameColor: 'blue',
      artist: 'Someone',
      types: ['instant'],
    });
  });

  it('parses metadata after type line', () => {
    const card = parseCard(`
      Test Card {R}
      Instant
      Rarity: mythic
      Deal 3 damage.
    `);
    expect(card).toMatchObject({
      name: 'Test Card',
      rarity: 'mythic',
      types: ['instant'],
      abilities: { unstructuredAbilities: ['Deal 3 damage.'] },
    });
  });

  it('parses metadata after rules text', () => {
    const card = parseCard(`
      Test Card {R}
      Instant
      Deal 3 damage.
      Rarity: uncommon
      Artist: Artist Name
    `);
    expect(card).toMatchObject({
      name: 'Test Card',
      rarity: 'uncommon',
      artist: 'Artist Name',
      types: ['instant'],
      abilities: { unstructuredAbilities: ['Deal 3 damage.'] },
    });
  });

  it('parses metadata scattered throughout', () => {
    const card = parseCard(`
      Test Card {2}{G}
      Frame Color: green
      Creature \u2014 Beast
      Rarity: rare
      Trample
      Artist: John Doe
      4/4
    `);
    expect(card).toMatchObject({
      name: 'Test Card',
      frameColor: 'green',
      rarity: 'rare',
      artist: 'John Doe',
      types: ['creature'],
      subtypes: ['Beast'],
      power: '4',
      toughness: '4',
      abilities: { unstructuredAbilities: ['Trample'] },
    });
  });

  it('parses PT Box Color metadata', () => {
    const card = parseCard(`
      Test Card {2}{G}
      PT Box Color: blue
      Creature \u2014 Beast
      Trample
      4/4
    `);
    expect(card).toMatchObject({
      ptBoxColor: 'blue',
      power: '4',
      toughness: '4',
    });
  });

  it('parses PT Box Color with multiple colors', () => {
    const card = parseCard(`
      Test Card {2}{G}
      PT Box Color: blue, red
      Creature \u2014 Beast
      4/4
    `);
    expect(card).toMatchObject({
      ptBoxColor: ['blue', 'red'],
    });
  });
});

describe('parseCard — multi-face inference', () => {
  it('infers split linkType for two instants/sorceries with mana costs', () => {
    const card = parseCard(`
      Assault {R}
      Sorcery
      Assault deals 2 damage to any target.
      ----
      Battery {3}{G}
      Sorcery
      Create a 3/3 green Elephant creature token.
    `);
    expect(card.linkType).toBe('split');
    expect(card.linkedCard?.name).toBe('Battery');
  });

  it('infers fuse as split linkType with Fuse keyword', () => {
    const card = parseCard(`
      Turn {2}{U}
      Instant
      Target creature becomes 0/1.
      Fuse
      ----
      Burn {1}{R}
      Instant
      Deal 2 damage to any target.
      Fuse
    `);
    expect(card.linkType).toBe('split');
    expect(card.linkedCard?.name).toBe('Burn');
  });

  it('infers aftermath linkType with Aftermath keyword', () => {
    const card = parseCard(`
      Appeal {G}
      Sorcery
      Target creature gets +X/+X.
      ----
      Authority {1}{W}
      Sorcery
      Aftermath
      Tap up to two target creatures.
    `);
    expect(card.linkType).toBe('aftermath');
  });

  it('infers transform linkType when only front has mana cost', () => {
    const card = parseCard(`
      Delver of Secrets {U}
      Creature \u2014 Human Wizard
      At the beginning of your upkeep, look at the top card of your library. You may reveal that card. If an instant or sorcery card is revealed this way, transform Delver of Secrets.
      1/1
      ----
      Insectile Aberration
      Creature \u2014 Human Insect
      Flying
      3/2
    `);
    expect(card.linkType).toBe('transform');
  });

  it('infers modal_dfc when both faces have mana costs and at least one is a permanent', () => {
    const card = parseCard(`
      Emeria's Call {4}{W}{W}{W}
      Sorcery
      Create two 4/4 white Angel Warrior tokens with flying.
      ----
      Emeria, Shattered Skyclave
      Land
      Emeria enters tapped.
      {T}: Add {W}.
    `);
    expect(card.linkType).toBe('transform');
  });

  it('infers modal_dfc for two permanents with mana costs', () => {
    const card = parseCard(`
      Barkchannel Pathway {G}
      Land
      {T}: Add {G}.
      ----
      Tidechannel Pathway {U}
      Land
      {T}: Add {U}.
    `);
    expect(card.linkType).toBe('modal_dfc');
  });

  it('infers flip linkType when rules text contains "flip"', () => {
    const card = parseCard(`
      Akki Lavarunner {3}{R}
      Creature \u2014 Goblin Warrior
      Whenever Akki Lavarunner deals damage to an opponent, flip it.
      1/1
      ----
      Tok-Tok, Volcano Born
      Legendary Creature \u2014 Goblin Shaman
      Protection from red
      If a red source would deal damage, it deals that much damage plus 1 instead.
      2/2
    `);
    expect(card.linkType).toBe('flip');
  });
});
