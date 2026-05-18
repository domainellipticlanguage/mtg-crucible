/**
 * Render each rendering-bug repro card to .output/bug-snapshots/{name}.png.
 *
 *   npx tsx scripts/bug-snapshots.ts before    # before fixing
 *   npx tsx scripts/bug-snapshots.ts after     # after fixing
 *
 * before-run dumps under .output/bug-snapshots/before/; after-run dumps under
 * .output/bug-snapshots/after/ so they're easy to flip between.
 *
 * Each entry corresponds to one bullet under "### Rendering bugs" in README.md
 * (or one of the inline-quoted bug-report cards beneath it).
 */

import * as fs from 'fs';
import * as path from 'path';
import { renderCard } from '../src';
import type { CardData } from '../src';

interface Case { name: string; card: CardData | string; }

const CASES: Case[] = [
  // 1. Omen — too much room between name and mana cost on the omen line.
  { name: '01-omen-spacing', card: {
    name: 'Bloomvine Regent', manaCost: '{3}{G}{G}',
    typeLine: { supertypes: [], types: ['creature'], subtypes: ['Dragon'] },
    frameColor: 'green', rarity: 'rare',
    abilities: 'Flying\nWhenever this creature or another Dragon you control enters, you gain 3 life.',
    power: '4', toughness: '4',
    linkType: 'omen',
    linkedCard: {
      name: 'Claim Territory', manaCost: '{2}{G}',
      typeLine: { supertypes: [], types: ['sorcery'], subtypes: ['Omen'] },
      abilities: 'Search your library for up to two basic Forest cards, reveal them, put one onto the battlefield tapped and the other into your hand, then shuffle.',
    },
  }},

  // 2. Flip — flavor text not rendered on secondary face.
  { name: '02-flip-secondary-flavor', card: {
    name: 'Bushi Tenderfoot', manaCost: '{W}',
    typeLine: { supertypes: [], types: ['creature'], subtypes: ['Human', 'Soldier'] },
    frameColor: 'white', rarity: 'uncommon',
    abilities: 'When a creature dealt damage by Bushi Tenderfoot this turn dies, flip Bushi Tenderfoot.',
    flavorText: 'Untested, but eager.',
    power: '1', toughness: '1',
    linkType: 'flip',
    linkedCard: {
      name: 'Kenzo the Hardhearted',
      typeLine: { supertypes: ['legendary'], types: ['creature'], subtypes: ['Human', 'Samurai'] },
      frameColor: 'white',
      abilities: 'Double strike; bushido 2',
      flavorText: 'His name is now spoken with reverence in the halls of Eiganjo.',
      power: '3', toughness: '4',
    },
  }},

  // 3. Flip — color indicator on secondary rendered on wrong side.
  { name: '03-flip-color-indicator', card: {
    name: 'Mirage Trickster', manaCost: '{2}{U}',
    typeLine: { supertypes: [], types: ['creature'], subtypes: ['Illusion'] },
    frameColor: 'blue', rarity: 'uncommon',
    abilities: 'Whenever Mirage Trickster deals combat damage to a player, flip Mirage Trickster.',
    power: '2', toughness: '2',
    linkType: 'flip',
    linkedCard: {
      name: 'Illusory Apex',
      typeLine: { supertypes: [], types: ['creature'], subtypes: ['Illusion'] },
      frameColor: 'blue',
      colorIndicator: ['blue'],
      abilities: 'Flying\nWhenever Illusory Apex deals combat damage to a player, you may return target nonland permanent to its owner\'s hand.',
      power: '4', toughness: '4',
    },
  }},

  // 4. Modal — tab alignment on Cryptic Command-style "Choose two -" + bullet list.
  { name: '04-modal-tab-alignment', card: {
    name: 'Cryptic Command', manaCost: '{1}{U}{U}{U}',
    typeLine: { supertypes: [], types: ['instant'], subtypes: [] },
    frameColor: 'blue', rarity: 'rare',
    abilities: 'Choose two -\n- Counter target spell.\n- Return target permanent to its owner\'s hand.\n- Tap all creatures your opponents control.\n- Draw a card.',
  }},

  // 5. Multi-line Art Description in parser. Verbatim parser input as a string.
  // Currently the parser only keeps the last `Art Description:` line; this case
  // expects all three to accumulate (joined by \n) the way `Flavor Text:` does.
  { name: '05-multiline-art-description', card: `
Lightning Bolt {R}
Instant
Lightning Bolt deals 3 damage to any target.
Rarity: Common
Art Description: A dragon, breathing fire.
Art Description: Spirals of flame curl off the wings.
Art Description: The ground beneath cracks and glows orange.
Flavor Text: "The sparkmage shrieked."
`.trim() },

  // 6. Cinderforge — flip primary has no P/T but set symbol still respects exclusion.
  { name: '06-cinderforge-flip-no-pt', card: {
    name: 'Cinderforge Goblet', manaCost: '{2}{R}',
    typeLine: { supertypes: [], types: ['artifact'], subtypes: [] },
    frameColor: 'artifact', rarity: 'uncommon',
    abilities: 'Whenever you cast an instant or sorcery spell, Cinderforge Goblet deals 1 damage to any target.\nIf a player would be dealt damage by Cinderforge Goblet, instead flip it.',
    flavorText: 'The molten brew never stays still.',
    linkType: 'flip',
    linkedCard: {
      name: 'Cinderforge Dragon',
      typeLine: { supertypes: [], types: ['creature'], subtypes: ['Dragon'] },
      frameColor: 'red',
      colorIndicator: ['red'],
      abilities: 'Flying\nWhenever Cinderforge Dragon deals combat damage to a player, that player discards a card.',
      flavorText: 'Its roar reshapes the battlefield.',
      power: '4', toughness: '4',
    },
  }},

  // 7. Kami's Blade — messed-up reminder hint on primary face.
  { name: '07-kamis-blade-reminder', card: {
    name: "Kami's Blade", manaCost: '{3}{W}{U}',
    typeLine: { supertypes: [], types: ['creature'], subtypes: ['Spirit', 'Soldier'] },
    frameColor: ['white', 'blue'], rarity: 'rare',
    abilities: 'First strike\nWhenever Kami\'s Blade attacks, you may exile target instant or sorcery card from your graveyard. If you do, Kami\'s Blade gets +1/+1 until end of turn.',
    flavorText: 'The blade sings with the voices of ancestors.',
    power: '2', toughness: '3',
    linkType: 'flip',
    linkedCard: {
      name: "Kami's Edge",
      typeLine: { supertypes: [], types: ['artifact'], subtypes: ['Equipment'] },
      frameColor: ['white', 'blue'],
      colorIndicator: ['white', 'blue'],
      abilities: 'Equipped creature gets +2/+2 and has vigilance.\nWhenever equipped creature deals combat damage to a player, you may sacrifice Kami\'s Edge. If you do, create a 2/2 white Spirit creature token.',
    },
  }},

  // 8a. Flip-with-PT regression — renders AFTER the no-PT Cinderforge above.
  //     If flipPreFrame leaks its `setSymbol.x` mutation back to the cached
  //     layout, this card's set symbol will be in the wrong (far-right) place
  //     instead of its usual position left of the P/T.
  { name: '08a-flip-with-pt-after-no-pt', card: {
    name: 'Bushi Tenderfoot', manaCost: '{W}',
    typeLine: { supertypes: [], types: ['creature'], subtypes: ['Human', 'Soldier'] },
    frameColor: 'white', rarity: 'uncommon',
    abilities: 'When a creature dealt damage by Bushi Tenderfoot this turn dies, flip Bushi Tenderfoot.',
    power: '1', toughness: '1',
    linkType: 'flip',
    linkedCard: {
      name: 'Kenzo the Hardhearted',
      typeLine: { supertypes: ['legendary'], types: ['creature'], subtypes: ['Human', 'Samurai'] },
      frameColor: 'white',
      abilities: 'Double strike; bushido 2',
      power: '3', toughness: '4',
    },
  }},

  // 8. Mirage Trickster — weirdly small type line on primary card (different from #3 — focus on type-line sizing).
  { name: '08-mirage-trickster-small-type', card: {
    name: 'Mirage Trickster', manaCost: '{2}{U}',
    typeLine: { supertypes: [], types: ['creature'], subtypes: ['Illusion'] },
    frameColor: 'blue', rarity: 'uncommon',
    abilities: 'Whenever Mirage Trickster deals combat damage to a player, flip Mirage Trickster.',
    flavorText: 'Its form shimmers, never quite where you think.',
    power: '2', toughness: '2',
    linkType: 'flip',
    linkedCard: {
      name: 'Illusory Apex',
      typeLine: { supertypes: [], types: ['creature'], subtypes: ['Illusion'] },
      frameColor: 'blue',
      colorIndicator: ['blue'],
      abilities: 'Flying\nWhenever Illusory Apex deals combat damage to a player, you may return target nonland permanent to its owner\'s hand.',
      power: '4', toughness: '4',
    },
  }},

  // 9. UG color indicator — green looks too dark and blue too light; wedges look too similar.
  { name: '09-ug-color-indicator', card: {
    name: 'Simic Aether Mage', manaCost: '{1}{G}{U}',
    typeLine: { supertypes: [], types: ['creature'], subtypes: ['Human', 'Wizard'] },
    frameColor: ['green', 'blue'], rarity: 'rare',
    colorIndicator: ['green', 'blue'],
    abilities: 'Flash\nWhenever Simic Aether Mage enters, scry 2.',
    flavorText: 'Currents of mana flow through her like rivers through the canopy.',
    power: '2', toughness: '3',
  }},

  // 10. Adventure mis-inferred as MDFC. Parser-level bug — verbatim input.
  { name: '10-adventure-mis-inferred', card: `
Arcane Librarian {2}{U}
Creature — Human Wizard
{T}: Add {U}.
Whenever you cast an instant or sorcery spell, draw a card, then discard a card.
2/3
Rarity: Uncommon
Flavor Text: She catalogues secrets the world has forgotten.
----
Tome of Unraveling {2}{U}
Sorcery — Adventure
Target player mills three cards. (Then exile this card.)
Rarity: Uncommon
`.trim() },

  // 11. Prepare — secondary face flavor text not rendered.
  { name: '11-prepare-secondary-flavor', card: `
Sylvan Arcanist {1}{U}{G}
Creature — Human Wizard
Whenever you cast an instant or sorcery spell, Sylvan Arcanist becomes prepared. (While it's prepared, you may cast a copy of its spell. Doing so unprepares it.)
2/2
Rarity: Uncommon
Flavor Text: "Knowledge blooms when the forest whispers."
----
Arcane Surge {U}{G}
Instant — Prepared
Draw two cards.
Rarity: Common
Flavor Text: "The currents of magic surge in tandem."
`.trim() },

  // 12. Room — secondary door name/mana-cost spacing.
  { name: '12-room-secondary-name-spacing', card: `
Rainforest Canopy {2}{G}{U}{U}
Enchantment — Room
Whenever you cast a noncreature spell, you may draw a card, then discard a card.
Rarity: Uncommon
Flavor Text: A sigh of green and blue drifts through the canopy.
--room--
Rainforest Canopy {3}{G}{U}{U}
Enchantment — Room
Whenever a land you control becomes tapped, you may add {G}.
Rarity: Uncommon
Flavor Text: Sunlight dapples the floor in emerald shards.
`.trim() },

  // 13. Transform front — hint line should use back type line, not the front's full ability text.
  { name: '13-transform-front-hint-line', card: `
Duskfang {2}{B}
Creature — Vampire
Whenever you cast a white spell, Duskfang transforms into Dawnfang.
Whenever Duskfang deals combat damage to a player, you may discard a card. If you do, draw a card.
2/2
Rarity: Uncommon
Flavor Text: He prowls the twilight, waiting for the first light.
----
Dawnfang
Color Indicator: White
Creature — Vampire
Whenever Dawnfang attacks, you gain 2 life.
Whenever a white spell you control resolves, Dawnfang gets +1/+1 until end of turn.
3/3
Rarity: Uncommon
Flavor Text: At sunrise, his bite becomes a blessing.
`.trim() },
];

async function main() {
  const which = process.argv[2];
  if (which !== 'before' && which !== 'after') {
    console.error('Usage: bug-snapshots.ts before|after');
    process.exit(2);
  }
  const outDir = path.resolve(__dirname, '..', '.output', 'bug-snapshots', which);
  fs.mkdirSync(outDir, { recursive: true });
  for (const c of CASES) {
    try {
      const r = await renderCard(c.card);
      fs.writeFileSync(path.join(outDir, `${c.name}.png`), r.frontFace);
      if (r.backFace) fs.writeFileSync(path.join(outDir, `${c.name}-back.png`), r.backFace);
      console.log(`  ${c.name}`);
    } catch (e) {
      console.error(`  ${c.name}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`\nWrote to ${outDir}`);
}

main().catch(e => { console.error(e); process.exit(1); });
