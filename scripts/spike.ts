/**
 * Spike v5: Renders all 13 test cards using the library.
 *
 * Card types: instant, sorcery, creature (legendary w/ crown), enchantment,
 * artifact, vehicle, land, planeswalker, saga, battle, gold multicolor, phyrexian mana.
 */

import * as fs from 'fs';
import * as path from 'path';
import { renderCard } from '../src';
import type { CardData } from '../src';

const OUT = '/tmp/mtg-crucible-spike';

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let idx = 1;

  function fname(name: string) { return path.join(OUT, `${String(idx++).padStart(2, '0')}-${name}.png`); }

  fs.writeFileSync(fname('lightning-bolt'), (await renderCard({
    name: 'Lightning Bolt', manaCost: '{R}', types: ['instant'],
    oracleText: 'Lightning Bolt deals 3 damage to any target.',
    flavorText: '"The sparkmage shrieked, calling on the rage of the storms of his youth. To his surprise, the sky responded with a fierce energy he had never thought to see again."',
    frameColor: 'red', rarity: 'uncommon', artist: 'Christopher Moeller', collectorNumber: '141',
  })).frontFace);

  // 1. Instant — Lightning Bolt
  console.log('Rendering Lightning Bolt (Instant)...');
  fs.writeFileSync(fname('lightning-bolt'), (await renderCard({
    name: 'Lightning Bolt', manaCost: '{R}', types: ['instant'],
    oracleText: 'Lightning Bolt deals 3 damage to any target.',
    flavorText: '"The sparkmage shrieked, calling on the rage of the storms of his youth. To his surprise, the sky responded with a fierce energy he had never thought to see again."',
    frameColor: 'red', rarity: 'uncommon', artist: 'Christopher Moeller', collectorNumber: '141',
  })).frontFace);

  // 2. Sorcery — Wrath of God
  console.log('Rendering Wrath of God (Sorcery)...');
  fs.writeFileSync(fname('wrath-of-god'), (await renderCard({
    name: 'Wrath of God', manaCost: '{2}{W}{W}', types: ['sorcery'],
    oracleText: 'Destroy all creatures. They can\'t be regenerated.',
    flavorText: '"Legend speaks of the Creators\' rage at their most prized creation, humanity, for its hubris in believing it could attain divinity."',
    frameColor: 'white', rarity: 'rare', artist: 'Willian Murai', collectorNumber: '049',
  })).frontFace);

  // 3. Legendary Creature — Questing Beast (with crown)
  console.log('Rendering Questing Beast (Legendary Creature w/ Crown)...');
  fs.writeFileSync(fname('questing-beast'), (await renderCard({
    name: 'Questing Beast', manaCost: '{2}{G}{G}',
    supertypes: ['legendary'], types: ['creature'], subtypes: ['Beast'],
    oracleText: 'Vigilance, deathtouch, haste\nQuesting Beast can\'t be blocked by creatures with power 2 or less.\nCombat damage that would be dealt by creatures you control can\'t be prevented.\nWhenever Questing Beast deals combat damage to an opponent, it deals that much damage to target planeswalker that player controls.',
    power: '4', toughness: '4', frameColor: 'green', rarity: 'mythic',
    artist: 'Igor Kieryluk', collectorNumber: '171',
  })).frontFace);

  // 4. Legendary Creature with custom art — Archangel Avacyn (with crown)
  console.log('Rendering Archangel Avacyn (Legendary + Custom Art)...');
  fs.writeFileSync(fname('avacyn'), (await renderCard({
    name: 'Archangel Avacyn', manaCost: '{3}{W}{W}',
    supertypes: ['legendary'], types: ['creature'], subtypes: ['Angel'],
    oracleText: 'Flash\nFlying, vigilance\nWhen Archangel Avacyn enters the battlefield, creatures you control gain indestructible until end of turn.\nWhen a non-Angel creature you control dies, transform Archangel Avacyn at the beginning of the next upkeep.',
    power: '4', toughness: '4', frameColor: 'white', rarity: 'mythic',
    artist: 'James Ryman', collectorNumber: '005',
    artUrl: 'https://cards.scryfall.io/art_crop/front/7/f/7f4893ef-f983-418b-b7a4-5f073c844545.jpg?1673149345',
  })).frontFace);

  // 5. Enchantment — Rhystic Study
  console.log('Rendering Rhystic Study (Enchantment)...');
  fs.writeFileSync(fname('rhystic-study'), (await renderCard({
    name: 'Rhystic Study', manaCost: '{2}{U}', types: ['enchantment'],
    oracleText: 'Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.',
    flavorText: '"Friends teach what you want to know. Enemies teach what you need to know."',
    frameColor: 'blue', rarity: 'rare', artist: 'Paul Scott Canavan', collectorNumber: '100',
  })).frontFace);

  // 6. Artifact — Sol Ring
  console.log('Rendering Sol Ring (Artifact)...');
  fs.writeFileSync(fname('sol-ring'), (await renderCard({
    name: 'Sol Ring', manaCost: '{1}', types: ['artifact'],
    oracleText: '{T}: Add {C}{C}.',
    flavorText: '"The ring maintains a nigh-unbreachable connection to the sun."',
    frameColor: 'artifact', rarity: 'uncommon', artist: 'Mike Bierek', collectorNumber: '249',
  })).frontFace);

  // 7. Vehicle — Smuggler's Copter
  console.log('Rendering Smuggler\'s Copter (Vehicle)...');
  fs.writeFileSync(fname('smugglers-copter'), (await renderCard({
    name: 'Smuggler\'s Copter', manaCost: '{2}', types: ['artifact'], subtypes: ['Vehicle'],
    oracleText: 'Flying\nWhenever Smuggler\'s Copter attacks or blocks, you may draw a card. If you do, discard a card.\nCrew 1',
    power: '3', toughness: '3', frameColor: 'vehicle', rarity: 'rare',
    artist: 'Florian de Gesincourt', collectorNumber: '235',
  })).frontFace);

  // 8. Land — Command Tower
  console.log('Rendering Command Tower (Land)...');
  fs.writeFileSync(fname('command-tower'), (await renderCard({
    name: 'Command Tower', types: ['land'],
    oracleText: '{T}: Add one mana of any color in your commander\'s color identity.',
    flavorText: '"When defeat is near and guidance is scarce, all look to the tower for hope."',
    frameColor: 'land', rarity: 'common', artist: 'Evan Shipard', collectorNumber: '351',
  })).frontFace);

  // 9. Planeswalker — Liliana of the Veil
  console.log('Rendering Liliana of the Veil (Planeswalker)...');
  const liliana: CardData = {
    name: 'Liliana of the Veil', manaCost: '{1}{B}{B}',
    supertypes: ['legendary'], types: ['planeswalker'], subtypes: ['Liliana'],
    frameColor: 'black', rarity: 'mythic',
    artist: 'Steve Argyle', collectorNumber: '105',
    startingLoyalty: '3',
    structuredAbilities: {
      kind: 'planeswalker',
      loyaltyAbilities: [
        { cost: '+1', text: 'Each player discards a card.' },
        { cost: '-2', text: 'Target player sacrifices a creature.' },
        { cost: '-6', text: 'Separate all permanents target player controls into two piles. That player sacrifices all permanents in the pile of their choice.' },
      ],
    },
  };
  fs.writeFileSync(fname('liliana'), (await renderCard(liliana)).frontFace);

  // 10. Saga — The Eldest Reborn
  console.log('Rendering The Eldest Reborn (Saga)...');
  const eldestReborn: CardData = {
    name: 'The Eldest Reborn', manaCost: '{4}{B}',
    types: ['enchantment'], subtypes: ['Saga'],
    frameColor: 'black', rarity: 'uncommon',
    artist: 'Jenn Ravenna', collectorNumber: '090',
    structuredAbilities: {
      kind: 'saga',
      chapters: [
        { chapterNumbers: [1], text: 'Each opponent sacrifices a creature or planeswalker.' },
        { chapterNumbers: [2], text: 'Each opponent discards a card.' },
        { chapterNumbers: [3], text: 'Put target creature or planeswalker card from a graveyard onto the battlefield under your control.' },
      ],
    },
  };
  fs.writeFileSync(fname('eldest-reborn'), (await renderCard(eldestReborn)).frontFace);

  // 11. Gold multicolor — Maelstrom Wanderer
  console.log('Rendering Maelstrom Wanderer (Gold Multicolor)...');
  fs.writeFileSync(fname('maelstrom-wanderer'), (await renderCard({
    name: 'Maelstrom Wanderer', manaCost: '{5}{U}{R}{G}',
    supertypes: ['legendary'], types: ['creature'], subtypes: ['Elemental'],
    oracleText: 'Creatures you control have haste.\nCascade, cascade',
    flavorText: '"The brewing of the immense elemental was a sight to behold, nature itself bowing to its whims as it rampaged across the land."',
    power: '7', toughness: '5', frameColor: 'multicolor', rarity: 'mythic',
    artist: 'Thomas M. Baxa', collectorNumber: '206',
  })).frontFace);

  // 12. Phyrexian mana — Birthing Pod
  console.log('Rendering Birthing Pod (Phyrexian Mana)...');
  fs.writeFileSync(fname('birthing-pod'), (await renderCard({
    name: 'Birthing Pod', manaCost: '{3}{G/P}',
    types: ['artifact'],
    oracleText: '{1}{G/P}, {T}, Sacrifice a creature: Search your library for a creature card with mana value equal to 1 plus the sacrificed creature\'s mana value, put that card onto the battlefield, then shuffle.',
    frameColor: 'artifact', rarity: 'rare',
    artist: 'Daarken', collectorNumber: '104',
  })).frontFace);

  // 13. Battle — Invasion of Gobakhan
  console.log('Rendering Invasion of Gobakhan (Battle)...');
  const gobakhan: CardData = {
    name: 'Invasion of Gobakhan', manaCost: '{1}{W}',
    types: ['battle'], subtypes: ['Siege'],
    oracleText: 'When Invasion of Gobakhan enters the battlefield, look at target opponent\'s hand and exile a nonland card from it. For as long as that card remains exiled, its owner may play it. A spell cast this way costs {2} more to cast.',
    frameColor: 'white', rarity: 'rare',
    artist: 'Zoltan Boros', collectorNumber: '014',
    battleDefense: '3',
  };
  fs.writeFileSync(fname('invasion-gobakhan'), (await renderCard(gobakhan)).frontFace);

  // 14. README example — Crucible of Legends (via string overload)
  console.log('Rendering Crucible of Legends (renderCard with text)...');
  fs.writeFileSync(fname('crucible-of-legends'), (await renderCard(`
    Crucible of Legends {3}
    Art: https://raw.githubusercontent.com/nathanfdunn/mtg-crucible/refs/heads/main/logo/banner-image.png
    Rarity: Mythic Rare
    Legendary Artifact
    Whenever a legendary creature you control dies, return it to your hand at the beginning of the next end step.
    *Every great story begins with fire.*
  `)).frontFace);

  // 15. Class enchantment — Barbarian Class
  console.log('Rendering Barbarian Class (Class Enchantment)...');
  const barbarianClass: CardData = {
    name: 'Barbarian Class', manaCost: '{R}',
    types: ['enchantment'], subtypes: ['Class'],
    frameColor: 'red', rarity: 'rare',
    artist: 'Lie Setiawan', collectorNumber: '131',
    unstructuredAbilities: '(Gain the next level as a sorcery to add its ability.)',
    structuredAbilities: {
      kind: 'class',
      classLevels: [
        { level: 1, cost: '', text: 'If you would roll one or more dice, instead roll that many dice plus one and ignore the lowest roll.' },
        { level: 2, cost: '{1}{R}', text: 'Whenever you roll one or more dice, target creature you control gets +2/+0 and gains menace until end of turn.' },
        { level: 3, cost: '{2}{R}', text: 'Creatures you control have haste.' },
      ],
    },
  };
  fs.writeFileSync(fname('barbarian-class'), (await renderCard(barbarianClass)).frontFace);

  console.log(`\nDone! ${idx - 1} cards rendered to ${OUT}`);
}

main().catch(console.error);
