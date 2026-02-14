/**
 * Spike v5: Renders all 13 test cards using the library.
 *
 * Card types: instant, sorcery, creature (legendary w/ crown), enchantment,
 * artifact, vehicle, land, planeswalker, saga, battle, gold multicolor, phyrexian mana.
 */

import * as fs from 'fs';
import * as path from 'path';
import { renderCard } from '../src';
import type { CardData, PlaneswalkerData, SagaData, BattleData } from '../src';

const OUT = '/tmp/mtg-crucible-spike';

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let idx = 1;

  function fname(name: string) { return path.join(OUT, `${String(idx++).padStart(2, '0')}-${name}.png`); }

  // 1. Instant — Lightning Bolt
  console.log('Rendering Lightning Bolt (Instant)...');
  fs.writeFileSync(fname('lightning-bolt'), await renderCard({
    name: 'Lightning Bolt', manaCost: '{R}', typeLine: 'Instant',
    rulesText: 'Lightning Bolt deals 3 damage to any target.',
    flavorText: '"The sparkmage shrieked, calling on the rage of the storms of his youth. To his surprise, the sky responded with a fierce energy he had never thought to see again."',
    frameColor: 'r', rarity: 'uncommon', artist: 'Christopher Moeller', collectorNumber: '141',
  }));

  // 2. Sorcery — Wrath of God
  console.log('Rendering Wrath of God (Sorcery)...');
  fs.writeFileSync(fname('wrath-of-god'), await renderCard({
    name: 'Wrath of God', manaCost: '{2}{W}{W}', typeLine: 'Sorcery',
    rulesText: 'Destroy all creatures. They can\'t be regenerated.',
    flavorText: '"Legend speaks of the Creators\' rage at their most prized creation, humanity, for its hubris in believing it could attain divinity."',
    frameColor: 'w', rarity: 'rare', artist: 'Willian Murai', collectorNumber: '049',
  }));

  // 3. Legendary Creature — Questing Beast (with crown)
  console.log('Rendering Questing Beast (Legendary Creature w/ Crown)...');
  fs.writeFileSync(fname('questing-beast'), await renderCard({
    name: 'Questing Beast', manaCost: '{2}{G}{G}', typeLine: 'Legendary Creature \u2014 Beast',
    rulesText: 'Vigilance, deathtouch, haste\nQuesting Beast can\'t be blocked by creatures with power 2 or less.\nCombat damage that would be dealt by creatures you control can\'t be prevented.\nWhenever Questing Beast deals combat damage to an opponent, it deals that much damage to target planeswalker that player controls.',
    power: '4', toughness: '4', frameColor: 'g', rarity: 'mythic',
    artist: 'Igor Kieryluk', collectorNumber: '171', isLegendary: true,
  }));

  // 4. Legendary Creature with custom art — Archangel Avacyn (with crown)
  console.log('Rendering Archangel Avacyn (Legendary + Custom Art)...');
  fs.writeFileSync(fname('avacyn'), await renderCard({
    name: 'Archangel Avacyn', manaCost: '{3}{W}{W}', typeLine: 'Legendary Creature \u2014 Angel',
    rulesText: 'Flash\nFlying, vigilance\nWhen Archangel Avacyn enters the battlefield, creatures you control gain indestructible until end of turn.\nWhen a non-Angel creature you control dies, transform Archangel Avacyn at the beginning of the next upkeep.',
    power: '4', toughness: '4', frameColor: 'w', rarity: 'mythic',
    artist: 'James Ryman', collectorNumber: '005', isLegendary: true,
    artUrl: 'https://cards.scryfall.io/art_crop/front/7/f/7f4893ef-f983-418b-b7a4-5f073c844545.jpg?1673149345',
  }));

  // 5. Enchantment — Rhystic Study
  console.log('Rendering Rhystic Study (Enchantment)...');
  fs.writeFileSync(fname('rhystic-study'), await renderCard({
    name: 'Rhystic Study', manaCost: '{2}{U}', typeLine: 'Enchantment',
    rulesText: 'Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.',
    flavorText: '"Friends teach what you want to know. Enemies teach what you need to know."',
    frameColor: 'u', rarity: 'rare', artist: 'Paul Scott Canavan', collectorNumber: '100',
  }));

  // 6. Artifact — Sol Ring
  console.log('Rendering Sol Ring (Artifact)...');
  fs.writeFileSync(fname('sol-ring'), await renderCard({
    name: 'Sol Ring', manaCost: '{1}', typeLine: 'Artifact',
    rulesText: '{T}: Add {C}{C}.',
    flavorText: '"The ring maintains a nigh-unbreachable connection to the sun."',
    frameColor: 'a', rarity: 'uncommon', artist: 'Mike Bierek', collectorNumber: '249',
  }));

  // 7. Vehicle — Smuggler's Copter
  console.log('Rendering Smuggler\'s Copter (Vehicle)...');
  fs.writeFileSync(fname('smugglers-copter'), await renderCard({
    name: 'Smuggler\'s Copter', manaCost: '{2}', typeLine: 'Artifact \u2014 Vehicle',
    rulesText: 'Flying\nWhenever Smuggler\'s Copter attacks or blocks, you may draw a card. If you do, discard a card.\nCrew 1',
    power: '3', toughness: '3', frameColor: 'v', rarity: 'rare',
    artist: 'Florian de Gesincourt', collectorNumber: '235',
  }));

  // 8. Land — Command Tower
  console.log('Rendering Command Tower (Land)...');
  fs.writeFileSync(fname('command-tower'), await renderCard({
    name: 'Command Tower', typeLine: 'Land',
    rulesText: '{T}: Add one mana of any color in your commander\'s color identity.',
    flavorText: '"When defeat is near and guidance is scarce, all look to the tower for hope."',
    frameColor: 'l', rarity: 'common', artist: 'Evan Shipard', collectorNumber: '351',
  }));

  // 9. Planeswalker — Liliana of the Veil
  console.log('Rendering Liliana of the Veil (Planeswalker)...');
  const liliana: PlaneswalkerData = {
    name: 'Liliana of the Veil', manaCost: '{1}{B}{B}',
    typeLine: 'Legendary Planeswalker \u2014 Liliana',
    frameColor: 'b', rarity: 'mythic', isLegendary: true,
    artist: 'Steve Argyle', collectorNumber: '105',
    startingLoyalty: '3',
    abilities: [
      { cost: '+1', text: 'Each player discards a card.' },
      { cost: '-2', text: 'Target player sacrifices a creature.' },
      { cost: '-6', text: 'Separate all permanents target player controls into two piles. That player sacrifices all permanents in the pile of their choice.' },
    ],
  };
  fs.writeFileSync(fname('liliana'), await renderCard(liliana));

  // 10. Saga — The Eldest Reborn
  console.log('Rendering The Eldest Reborn (Saga)...');
  const eldestReborn: SagaData = {
    name: 'The Eldest Reborn', manaCost: '{4}{B}',
    typeLine: 'Enchantment \u2014 Saga',
    frameColor: 'b', rarity: 'uncommon',
    artist: 'Jenn Ravenna', collectorNumber: '090',
    chapters: [
      { count: 1, text: 'Each opponent sacrifices a creature or planeswalker.' },
      { count: 1, text: 'Each opponent discards a card.' },
      { count: 1, text: 'Put target creature or planeswalker card from a graveyard onto the battlefield under your control.' },
    ],
  };
  fs.writeFileSync(fname('eldest-reborn'), await renderCard(eldestReborn));

  // 11. Gold multicolor — Maelstrom Wanderer
  console.log('Rendering Maelstrom Wanderer (Gold Multicolor)...');
  fs.writeFileSync(fname('maelstrom-wanderer'), await renderCard({
    name: 'Maelstrom Wanderer', manaCost: '{5}{U}{R}{G}',
    typeLine: 'Legendary Creature \u2014 Elemental',
    rulesText: 'Creatures you control have haste.\nCascade, cascade',
    flavorText: '"The brewing of the immense elemental was a sight to behold, nature itself bowing to its whims as it rampaged across the land."',
    power: '7', toughness: '5', frameColor: 'm', rarity: 'mythic',
    artist: 'Thomas M. Baxa', collectorNumber: '206', isLegendary: true,
  }));

  // 12. Phyrexian mana — Birthing Pod
  console.log('Rendering Birthing Pod (Phyrexian Mana)...');
  fs.writeFileSync(fname('birthing-pod'), await renderCard({
    name: 'Birthing Pod', manaCost: '{3}{G/P}',
    typeLine: 'Artifact',
    rulesText: '{1}{G/P}, {T}, Sacrifice a creature: Search your library for a creature card with mana value equal to 1 plus the sacrificed creature\'s mana value, put that card onto the battlefield, then shuffle.',
    frameColor: 'a', rarity: 'rare',
    artist: 'Daarken', collectorNumber: '104',
  }));

  // 13. Battle — Invasion of Gobakhan
  console.log('Rendering Invasion of Gobakhan (Battle)...');
  const gobakhan: BattleData = {
    name: 'Invasion of Gobakhan', manaCost: '{1}{W}',
    typeLine: 'Battle \u2014 Siege',
    rulesText: 'When Invasion of Gobakhan enters the battlefield, look at target opponent\'s hand and exile a nonland card from it. For as long as that card remains exiled, its owner may play it. A spell cast this way costs {2} more to cast.',
    frameColor: 'w', rarity: 'rare',
    artist: 'Zoltan Boros', collectorNumber: '014',
    defense: '3',
  };
  fs.writeFileSync(fname('invasion-gobakhan'), await renderCard(gobakhan));

  console.log(`\nDone! ${idx - 1} cards rendered to ${OUT}`);
}

main().catch(console.error);
