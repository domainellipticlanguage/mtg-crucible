/**
 * Spike v5: Renders all test cards using the library.
 * Usage: npx tsx scripts/spike.ts [card numbers...]
 * Example: npx tsx scripts/spike.ts 28 29
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { renderCard } from '../src';
import type { CardData, RenderedCard } from '../src';

const OUT = path.resolve(__dirname, '..', '.output', 'spike');
const args = process.argv.slice(2);
const openFlag = args.includes('--open');
const indices = args.filter(a => a !== '--open').map(Number).filter(n => !isNaN(n));
const ONLY = indices.length > 0 ? new Set(indices) : null;

let idx = 0;

async function render(name: string, card: CardData | string): Promise<RenderedCard | null> {
  idx++;
  if (ONLY && !ONLY.has(idx)) return null;
  console.log(`${idx}. ${name}`);
  const result = await renderCard(card);
  const outPath = path.join(OUT, `${String(idx).padStart(2, '0')}-${name}.png`);
  fs.writeFileSync(outPath, result.frontFace);
  if (openFlag && ONLY) execSync(`open "${outPath}"`);
  return result;
}

async function main() {
  // if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true });
  // fs.mkdirSync(OUT, { recursive: true });

  // // 1
  // await render('lightning-bolt', {
  //   name: 'Lightning Bolt', manaCost: '{R}', types: ['instant'],
  //   abilities: 'Lightning Bolt deals 3 damage to any target.',
  //   flavorText: '"The sparkmage shrieked, calling on the rage of the storms of his youth. To his surprise, the sky responded with a fierce energy he had never thought to see again."',
  //   frameColor: 'red', rarity: 'uncommon', artist: 'Christopher Moeller', collectorNumber: '141',
  // });

  // // 2
  // await render('lightning-bolt-2', {
  //   name: 'Lightning Bolt', manaCost: '{R}', types: ['instant'],
  //   abilities: 'Lightning Bolt deals 3 damage to any target.',
  //   flavorText: '"The sparkmage shrieked, calling on the rage of the storms of his youth. To his surprise, the sky responded with a fierce energy he had never thought to see again."',
  //   frameColor: 'red', rarity: 'uncommon', artist: 'Christopher Moeller', collectorNumber: '141',
  // });

  // // 3
  // await render('wrath-of-god', {
  //   name: 'Wrath of God', manaCost: '{2}{W}{W}', types: ['sorcery'],
  //   abilities: 'Destroy all creatures. They can\'t be regenerated.',
  //   flavorText: '"Legend speaks of the Creators\' rage at their most prized creation, humanity, for its hubris in believing it could attain divinity."',
  //   frameColor: 'white', rarity: 'rare', artist: 'Willian Murai', collectorNumber: '049',
  // });

  // // 4
  // await render('questing-beast', {
  //   name: 'Questing Beast', manaCost: '{2}{G}{G}',
  //   supertypes: ['legendary'], types: ['creature'], subtypes: ['Beast'],
  //   abilities: 'Vigilance, deathtouch, haste\nQuesting Beast can\'t be blocked by creatures with power 2 or less.\nCombat damage that would be dealt by creatures you control can\'t be prevented.\nWhenever Questing Beast deals combat damage to an opponent, it deals that much damage to target planeswalker that player controls.',
  //   power: '4', toughness: '4', frameColor: 'green', rarity: 'mythic',
  //   artist: 'Igor Kieryluk', collectorNumber: '171',
  // });

  // // 5
  // await render('avacyn', {
  //   name: 'Archangel Avacyn', manaCost: '{3}{W}{W}',
  //   supertypes: ['legendary'], types: ['creature'], subtypes: ['Angel'],
  //   abilities: 'Flash\nFlying, vigilance\nWhen Archangel Avacyn enters the battlefield, creatures you control gain indestructible until end of turn.\nWhen a non-Angel creature you control dies, transform Archangel Avacyn at the beginning of the next upkeep.',
  //   power: '4', toughness: '4', frameColor: 'white', rarity: 'mythic',
  //   artist: 'James Ryman', collectorNumber: '005',
  //   artUrl: 'https://cards.scryfall.io/art_crop/front/7/f/7f4893ef-f983-418b-b7a4-5f073c844545.jpg?1673149345',
  // });

  // // 6
  // await render('rhystic-study', {
  //   name: 'Rhystic Study', manaCost: '{2}{U}', types: ['enchantment'],
  //   abilities: 'Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.',
  //   flavorText: '"Friends teach what you want to know. Enemies teach what you need to know."',
  //   frameColor: 'blue', rarity: 'rare', artist: 'Paul Scott Canavan', collectorNumber: '100',
  // });

  // // 7
  // await render('sol-ring', {
  //   name: 'Sol Ring', manaCost: '{1}', types: ['artifact'],
  //   abilities: '{T}: Add {C}{C}.',
  //   flavorText: '"The ring maintains a nigh-unbreachable connection to the sun."',
  //   frameColor: 'artifact', rarity: 'uncommon', artist: 'Mike Bierek', collectorNumber: '249',
  // });

  // // 8
  // await render('smugglers-copter', {
  //   name: 'Smuggler\'s Copter', manaCost: '{2}', types: ['artifact'], subtypes: ['Vehicle'],
  //   abilities: 'Flying\nWhenever Smuggler\'s Copter attacks or blocks, you may draw a card. If you do, discard a card.\nCrew 1',
  //   power: '3', toughness: '3', frameColor: 'vehicle', rarity: 'rare',
  //   artist: 'Florian de Gesincourt', collectorNumber: '235',
  // });

  // // 9
  // await render('command-tower', {
  //   name: 'Command Tower', types: ['land'],
  //   abilities: '{T}: Add one mana of any color in your commander\'s color identity.',
  //   flavorText: '"When defeat is near and guidance is scarce, all look to the tower for hope."',
  //   frameColor: 'land', rarity: 'common', artist: 'Evan Shipard', collectorNumber: '351',
  // });

  // // 10
  // await render('liliana', {
  //   name: 'Liliana of the Veil', manaCost: '{1}{B}{B}',
  //   supertypes: ['legendary'], types: ['planeswalker'], subtypes: ['Liliana'],
  //   frameColor: 'black', rarity: 'mythic',
  //   artist: 'Steve Argyle', collectorNumber: '105',
  //   startingLoyalty: '3',
  //   abilities: { structuredAbilities: {
  //     kind: 'planeswalker',
  //     loyaltyAbilities: [
  //       { cost: '+1', text: 'Each player discards a card.' },
  //       { cost: '-2', text: 'Target player sacrifices a creature.' },
  //       { cost: '-6', text: 'Separate all permanents target player controls into two piles. That player sacrifices all permanents in the pile of their choice.' },
  //     ],
  //   } },
  // });

  // // 11
  // await render('eldest-reborn', {
  //   name: 'The Eldest Reborn', manaCost: '{4}{B}',
  //   types: ['enchantment'], subtypes: ['Saga'],
  //   frameColor: 'black', rarity: 'uncommon',
  //   artist: 'Jenn Ravenna', collectorNumber: '090',
  //   abilities: { structuredAbilities: {
  //     kind: 'saga',
  //     chapters: [
  //       { chapterNumbers: [1], text: 'Each opponent sacrifices a creature or planeswalker.' },
  //       { chapterNumbers: [2], text: 'Each opponent discards a card.' },
  //       { chapterNumbers: [3], text: 'Put target creature or planeswalker card from a graveyard onto the battlefield under your control.' },
  //     ],
  //   } },
  // });

  // // 12
  // await render('maelstrom-wanderer', {
  //   name: 'Maelstrom Wanderer', manaCost: '{5}{U}{R}{G}',
  //   supertypes: ['legendary'], types: ['creature'], subtypes: ['Elemental'],
  //   abilities: 'Creatures you control have haste.\nCascade, cascade',
  //   flavorText: '"The brewing of the immense elemental was a sight to behold, nature itself bowing to its whims as it rampaged across the land."',
  //   power: '7', toughness: '5', frameColor: 'multicolor', rarity: 'mythic',
  //   artist: 'Thomas M. Baxa', collectorNumber: '206',
  // });

  // // 13
  // await render('birthing-pod', {
  //   name: 'Birthing Pod', manaCost: '{3}{G/P}',
  //   types: ['artifact'],
  //   abilities: '{1}{G/P}, {T}, Sacrifice a creature: Search your library for a creature card with mana value equal to 1 plus the sacrificed creature\'s mana value, put that card onto the battlefield, then shuffle.',
  //   frameColor: 'artifact', rarity: 'rare',
  //   artist: 'Daarken', collectorNumber: '104',
  // });

  // 14
  await render('invasion-gobakhan', {
    name: 'Invasion of Gobakhan', manaCost: '{1}{W}',
    types: ['battle'], subtypes: ['Siege'],
    abilities: 'When Invasion of Gobakhan enters the battlefield, look at target opponent\'s hand and exile a nonland card from it. For as long as that card remains exiled, its owner may play it. A spell cast this way costs {2} more to cast.',
    frameColor: 'white', rarity: 'rare',
    artist: 'Zoltan Boros', collectorNumber: '014',
    battleDefense: '3',
  });

  // // 15
  // await render('crucible-of-legends', `
  //   Crucible of Legends {3}
  //   Art: https://raw.githubusercontent.com/nathanfdunn/mtg-crucible/refs/heads/main/logo/banner-image.png
  //   Rarity: Mythic Rare
  //   Legendary Artifact
  //   Whenever a legendary creature you control dies, return it to your hand at the beginning of the next end step.
  //   *Every great story begins with fire.*
  // `);

  // // 16
  // await render('barbarian-class', {
  //   name: 'Barbarian Class', manaCost: '{R}',
  //   types: ['enchantment'], subtypes: ['Class'],
  //   frameColor: 'red', rarity: 'rare',
  //   artist: 'Lie Setiawan', collectorNumber: '131',
  //   abilities: {
  //     unstructuredAbilities: ['(Gain the next level as a sorcery to add its ability.)'],
  //     structuredAbilities: {
  //       kind: 'class',
  //       classLevels: [
  //         { level: 1, cost: '', text: 'If you would roll one or more dice, instead roll that many dice plus one and ignore the lowest roll.' },
  //         { level: 2, cost: '{1}{R}', text: 'Whenever you roll one or more dice, target creature you control gets +2/+0 and gains menace until end of turn.' },
  //         { level: 3, cost: '{2}{R}', text: 'Creatures you control have haste.' },
  //       ],
  //     },
  //   },
  // });

  // // 17
  // await render('tidal-loreweaving', {
  //   name: 'The Tidal Loreweaving', manaCost: '{4}{U}{G}',
  //   supertypes: ['legendary'], types: ['enchantment'], subtypes: ['Saga'],
  //   frameColor: 'multicolor', rarity: 'rare',
  //   artist: 'Magali Villeneuve', collectorNumber: '220',
  //   abilities: {
  //     unstructuredAbilities: ['(As this Saga enters and after your draw step, add a lore counter.)'],
  //     structuredAbilities: {
  //       kind: 'saga',
  //       chapters: [
  //         { chapterNumbers: [1], text: 'Draw two cards, then put a card from your hand on the bottom of your library.' },
  //         { chapterNumbers: [2], text: 'Create a 3/3 green Beast creature token.' },
  //         { chapterNumbers: [3], text: 'Return target creature card from your graveyard to your hand. You gain life equal to its mana value.' },
  //       ],
  //     },
  //   },
  // });

  // // 18
  // await render('niv-mizzet-parun', {
  //   name: 'Niv-Mizzet, Parun', manaCost: '{U}{U}{U}{R}{R}{R}',
  //   supertypes: ['legendary'], types: ['creature'], subtypes: ['Dragon', 'Wizard'],
  //   abilities: 'This spell can\'t be countered.\nFlying\nWhenever you draw a card, Niv-Mizzet, Parun deals 1 damage to any target.\nWhenever a player casts an instant or sorcery spell, you draw a card.',
  //   flavorText: '"The Izzet are quite adept at distraction."',
  //   power: '5', toughness: '5', frameColor: 'multicolor', accentColor: ['blue', 'red'], rarity: 'rare',
  //   artist: 'Svetlin Velinov', collectorNumber: '192',
  // });

  // // 19
  // await render('wrenn-and-six', {
  //   name: 'Wrenn and Six', manaCost: '{R}{G}',
  //   supertypes: ['legendary'], types: ['planeswalker'], subtypes: ['Wrenn'],
  //   frameColor: 'multicolor', accentColor: ['red', 'green'], rarity: 'mythic',
  //   artist: 'Chase Stone', collectorNumber: '217',
  //   startingLoyalty: '3',
  //   abilities: { structuredAbilities: {
  //     kind: 'planeswalker',
  //     loyaltyAbilities: [
  //       { cost: '+1', text: 'Return up to one target land card from your graveyard to your hand.' },
  //       { cost: '-1', text: 'Wrenn and Six deals 1 damage to any target.' },
  //       { cost: '-7', text: 'You get an emblem with "Instant and sorcery cards in your graveyard have retrace."' },
  //     ],
  //   } },
  // });

  // // 20
  // await render('tidehollow-sculler', {
  //   name: 'Tidehollow Sculler', manaCost: '{W}{B}',
  //   types: ['artifact', 'creature'], subtypes: ['Zombie'],
  //   abilities: 'When Tidehollow Sculler enters the battlefield, target opponent reveals their hand and you choose a nonland card from it. Exile that card.\nWhen Tidehollow Sculler leaves the battlefield, return the exiled card to its owner\'s hand.',
  //   power: '2', toughness: '2', rarity: 'uncommon',
  //   artist: 'rk post', collectorNumber: '202',
  // });

  // // 21
  // await render('ashiok-dream-render', {
  //   name: 'Ashiok, Dream Render', manaCost: '{1}{U/B}{U/B}',
  //   types: ['planeswalker'], subtypes: ['Ashiok'],
  //   rarity: 'uncommon',
  //   artist: 'Cynthia Sheppard', collectorNumber: '228',
  //   startingLoyalty: '5',
  //   abilities: { structuredAbilities: {
  //     kind: 'planeswalker',
  //     loyaltyAbilities: [
  //       { cost: '', text: 'Spells and abilities your opponents control can\'t cause their controller to search their library.' },
  //       { cost: '-1', text: 'Target player mills four cards. Then exile each opponent\'s graveyard.' },
  //     ],
  //   } },
  // });

  // // 22
  // await render('weatherseed-treaty', {
  //   name: 'The Weatherseed Treaty', manaCost: '{1}{B}{G}',
  //   types: ['enchantment'], subtypes: ['Saga'],
  //   rarity: 'uncommon',
  //   artist: 'Alex Brock', collectorNumber: '222',
  //   abilities: { structuredAbilities: {
  //     kind: 'saga',
  //     chapters: [
  //       { chapterNumbers: [1], text: 'Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.' },
  //       { chapterNumbers: [2], text: 'Put two +1/+1 counters on target creature you control.' },
  //       { chapterNumbers: [3], text: 'Create a 4/3 green Fungus Beast creature token with trample and haste.' },
  //     ],
  //   } },
  // });

  // // 23
  // await render('divine-scholar-class', {
  //   name: 'Divine Scholar Class', manaCost: '{W}{U}',
  //   supertypes: ['legendary'], types: ['enchantment'], subtypes: ['Class'],
  //   rarity: 'rare',
  //   artist: 'Wylie Beckert', collectorNumber: '301',
  //   abilities: {
  //     unstructuredAbilities: ['(Gain the next level as a sorcery to add its ability.)',
  //       'When this Class enters, scry 2, then draw a card.'
  //     ],
  //     structuredAbilities: {
  //       kind: 'class',
  //       classLevels: [
  //         // { level: 1, cost: '', text: 'When this Class enters, scry 2, then draw a card.' },
  //         { level: 2, cost: '{1}{W}{U}', text: 'Instant and sorcery spells you cast cost {1} less to cast.' },
  //         { level: 3, cost: '{3}{W}{U}', text: 'Whenever you cast a noncreature spell, create a 1/1 white Bird creature token with flying.' },
  //       ],
  //     },
  //   },
  // });

  // // 24
  // await render('primal-fury-class', {
  //   name: 'Primal Fury Class', manaCost: '{R}{G}',
  //   types: ['enchantment'], subtypes: ['Class'],
  //   rarity: 'uncommon',
  //   artist: 'Lie Setiawan', collectorNumber: '302',
  //   abilities: {
  //     unstructuredAbilities: ['(Gain the next level as a sorcery to add its ability.)'],
  //     structuredAbilities: {
  //       kind: 'class',
  //       classLevels: [
  //         { level: 1, cost: '', text: 'Creatures you control get +1/+0.' },
  //         { level: 2, cost: '{1}{R}{G}', text: 'Creatures you control have trample.' },
  //         { level: 3, cost: '{2}{R}{G}', text: 'Whenever a creature you control attacks, it gets +X/+0 until end of turn, where X is its power.' },
  //       ],
  //     },
  //   },
  // });

  // // 25
  // await render('invasion-keral-keep', {
  //   name: 'Invasion of Keral Keep', manaCost: '{3}{U}{R}',
  //   supertypes: ['legendary'], types: ['battle'], subtypes: ['Siege'],
  //   abilities: 'When Invasion of Keral Keep enters the battlefield, it deals 4 damage to target creature or planeswalker, then you may cast an instant or sorcery spell with mana value 3 or less from your hand without paying its mana cost.',
  //   rarity: 'mythic',
  //   artist: 'Dominik Mayer', collectorNumber: '303',
  //   battleDefense: '5',
  // });

  // // 26
  // await render('invasion-wilds', {
  //   name: 'Invasion of the Wilds', manaCost: '{2}{W}{G}',
  //   types: ['battle'], subtypes: ['Siege'],
  //   abilities: 'When Invasion of the Wilds enters the battlefield, search your library for a basic land card, put it onto the battlefield tapped, then shuffle. You gain 3 life.',
  //   rarity: 'uncommon',
  //   artist: 'Bryan Sola', collectorNumber: '304',
  //   battleDefense: '4',
  // });

  // // 27
  // await render('reaper-king-symbols', {
  //   name: 'Reaper King', manaCost: '{2/W}{2/U}{2/B}{2/R}{2/G}',
  //   supertypes: ['legendary'], types: ['artifact', 'creature'], subtypes: ['Scarecrow'],
  //   abilities: 'Other Scarecrow creatures you control get +1/+1.\nWhenever another Scarecrow enters the battlefield under your control, destroy target permanent.\n{Q}: Add {C}{C}{C}. Activate only once each turn.\nThis spell costs {11} less to cast if you control fifteen or more Scarecrows. Its mana value is {20}.\n{12}{13}{14}{15}{16}{17}{18}{19} — reminder: {∞}',
  //   power: '6', toughness: '6', frameColor: 'multicolor', rarity: 'mythic',
  //   artist: 'Jim Murray', collectorNumber: '260',
  // });

  // // 28. Battle with creature back face
  // const gobakhanDFC = await render('invasion-gobakhan-dfc', {
  //   name: 'Invasion of Gobakhan', manaCost: '{1}{W}',
  //   types: ['battle'], subtypes: ['Siege'],
  //   abilities: '(As a Siege enters, choose an opponent to protect it. You and others can attack it. When it’s defeated, exile it, then cast it transformed.)\nWhen Invasion of Gobakhan enters the battlefield, look at target opponent\'s hand. You may exile a nonland card from it. For as long as that card remains exiled, its owner may play it. A spell cast this way costs {2} more to cast.',
  //   frameColor: 'white', rarity: 'rare',
  //   artist: 'Zoltan Boros', collectorNumber: '014',
  //   battleDefense: '3',
  //   linkType: 'transform',
  //   linkedCard: {
  //     name: 'Lightshield Array',
  //     types: ['enchantment', 'creature'],
  //     frameColor: 'white', rarity: 'rare',
  //     artist: 'Zoltan Boros', collectorNumber: '014',
  //     abilities: 'At the beginning of your end step, put a +1/+1 counter on each creature you control.\nSacrifice Lightshield Array: Creatures you control gain hexproof and indestructible until end of turn.',
  //     power: '0', toughness: '4',
  //   },
  // });
  // if (gobakhanDFC?.backFace) {
  //   idx++;
  //   if (!ONLY || ONLY.has(idx)) {
  //     console.log(`${idx}. invasion-gobakhan-back`);
  //     fs.writeFileSync(path.join(OUT, `${String(idx).padStart(2, '0')}-invasion-gobakhan-back.png`), gobakhanDFC.backFace);
  //   }
  // }

  // // 29. Tall planeswalker with multicolored frame
  // await render('nicol-bolas-dragon-god', {
  //   name: 'Nicol Bolas, Dragon-God', manaCost: '{U}{B}{B}{B}{R}{U}{B}{B}{B}{R}',
  //   supertypes: ['legendary'], types: ['planeswalker'], subtypes: ['Bolas'],
  //   // frameColor: 'multicolor', 
  //   accentColor: ['blue', 'black', 'red'], 
  //   // frameColor: ['blue', 'black', 'red'], 
  //   rarity: 'mythic',
  //   artist: 'Raymond Swanland', collectorNumber: '207',
  //   startingLoyalty: '4',
  //   abilities: { 
  //     // unstructuredAbilities: [
  //     //   'Flying, Lifelink, Trample, Haste\ncool stuff',
  //     //   // 'Nicol Bolas, Dragon-God has all loyalty abilities of all other planeswalkers on the battlefield.'
  //     // ],
  //     structuredAbilities: {
  //     kind: 'planeswalker',
  //     loyaltyAbilities: [
  //       // { cost: '', text: 'Nicol Bolas, Dragon-God has all loyalty abilities of all other planeswalkers on the battlefield.' },
  //       { cost: '+21', text: 'You draw a card. Each opponent exiles a card from their hand or a permanent they control.' },
  //       { cost: '-3', text: 'Destroy target creature or planeswalker.' },
  //       { cost: '-8', text: 'Each opponent who doesn\'t control a legendary creature or planeswalker loses the game.' },
  //     ],
  //   } },
  // });

  // // 30. All mana symbols
  // await render('mana-symbols', {
  //   name: 'Mana Symbol Test', manaCost: '{W}{U}{B}{R}{G}{W/U}{B/R}{G/W}',
  //   types: ['sorcery'],
  //   abilities: 'Regular: {W}{U}{B}{R}{G}{C}{S}{X}\nGeneric: {0}{1}{2}{3}{4}{5}{6}{7}{8}{9}{10}\nAllied hybrid: {W/U}{U/B}{B/R}{R/G}{G/W}\nEnemy hybrid: {W/B}{U/R}{B/G}{R/W}{G/U}\nPhyrexian: {W/P}{U/P}{B/P}{R/P}{G/P}\nPhyrexian hybrid allied: {W/U/P}{U/B/P}{B/R/P}{R/G/P}{G/W/P}\nPhyrexian hybrid enemy: {W/B/P}{U/R/P}{B/G/P}{R/W/P}{G/U/P}\nColorless hybrid: {C/W}{C/U}{C/B}{C/R}{C/G}\nTwobrid: {2/W}{2/U}{2/B}{2/R}{2/G}',
  //   frameColor: 'multicolor', rarity: 'rare',
  // });

  // // 31. Colorless hybrid mana (Eldrazi devoid)
  // await render('ulalek-fused-atrocity', {
  //   name: 'Ulalek, Fused Atrocity', manaCost: '{C/W}{C/U}{C/B}{C/R}{C/G}',
  //   supertypes: ['legendary'], types: ['creature'], subtypes: ['Eldrazi'],
  //   abilities: 'Devoid (This card has no color.)\nWhenever you cast an Eldrazi spell, you may pay {C}{C}. If you do, copy all spells you control, then copy all other activated and triggered abilities you control. You may choose new targets for the copies. (Mana abilities can\'t be copied.)',
  //   power: '2', toughness: '5', frameColor: 'artifact', rarity: 'mythic',
  //   artist: 'Alex Konstad', collectorNumber: '4',
  //   artUrl: 'https://cards.scryfall.io/art_crop/front/f/d/fdad1b0e-d3cc-4d76-ae7e-fee12558cf2c.jpg?1735676761',
  // });

  // // 32. All 5 colors for nameLineColor and typeLineColor
  // await render('warrior-of-wooburg', {
  //   name: 'Warrior of Wooburg', manaCost: '{W}{U}{B}{R}{G}',
  //   supertypes: ['legendary'], types: ['creature'], subtypes: ['Human', 'Warrior'],
  //   abilities: 'Flying, first strike, deathtouch, haste, trample\nWhenever Warrior of Wooburg attacks, draw a card for each color among permanents you control.',
  //   power: '5', toughness: '5',
  //   rarity: 'mythic',
  //   nameLineColor: ['white', 'blue', 'black', 'red', 'green'],
  //   typeLineColor: ['white', 'blue', 'black', 'red', 'green'],

  //   // frameColor: ['white', 'blue', 'black', 'red', 'green'],
  //   // accentColor: ['white', 'blue', 'black', 'red', 'green'],
  //   flavorText: '"I am become Wooburg, destroyer of worlds."',
  // });

  // // 33. Sword of Fire and Ice — Snow blue / Nyx red
  // await render('sword-fire-ice', {
  //   name: 'Sword of Fire and Ice', manaCost: '{3}',
  //   types: ['artifact'], subtypes: ['Equipment'],
  //   frameColor: ['blue', 'red'],
  //   frameEffect: ['snow', 'nyx'],
  //   rarity: 'mythic',
  //   abilities: 'Equipped creature gets +2/+2 and has protection from red and from blue.\nWhenever equipped creature deals combat damage to a player, Sword of Fire and Ice deals 2 damage to any target and you draw a card.\nEquip {2}',
  // });

  // // 34. Sword of Light and Shadow — Miracle white / Devoid black
  // await render('sword-light-shadow', {
  //   name: 'Sword of Light and Shadow', manaCost: '{3}',
  //   types: ['artifact'], subtypes: ['Equipment'],
  //   frameColor: ['white', 'black'],
  //   frameEffect: ['miracle', 'devoid'],
  //   rarity: 'mythic',
  //   abilities: 'Equipped creature gets +2/+2 and has protection from white and from black.\nWhenever equipped creature deals combat damage to a player, you gain 3 life and you may return up to one target creature card from your graveyard to your hand.\nEquip {2}',
  // });

  // 35. Custom dual-effect card — Snow blue / Nyx red
  await render('conduit-of-fire-and-ice', {
    name: 'Conduit of Fire and Ice', manaCost: '{2}{U}{R}',
    types: ['artifact'],
    frameColor: ['blue', 'red'],
    frameEffect: ['snow', 'nyx'],
    rarity: 'mythic',
    abilities: 'Whenever you cast an instant or sorcery spell, choose one —\n• Conduit of Fire and Ice deals 2 damage to any target.\n• Draw a card, then discard a card.',
    flavorText: '"It does not choose between extremes — it holds them both."',
  });

  // 36. Adventure card — Bonecrusher Giant // Stomp
  await render('bonecrusher-giant', {
    name: 'Bonecrusher Giant', manaCost: '{2}{R}',
    types: ['creature'], subtypes: ['Giant'],
    frameColor: 'red',
    rarity: 'rare',
    abilities: 'Whenever Bonecrusher Giant becomes the target of a spell, Bonecrusher Giant deals 2 damage to that spell\'s controller.',
    power: '4', toughness: '3',
    linkType: 'adventure',
    linkedCard: {
      name: 'Stomp', manaCost: '{1}{R}',
      types: ['instant'],
      subtypes: ['Adventure'],
      abilities: 'Damage can\'t be prevented this turn. Stomp deals 2 damage to any target.',
    },
  });

  // 37. Adventure card — Lovestruck Beast // Heart's Desire (multicolor test)
  await render('lovestruck-beast', {
    name: 'Lovestruck Beast', manaCost: '{2}{G}',
    types: ['creature'], subtypes: ['Beast', 'Noble'],
    frameColor: 'green',
    rarity: 'rare',
    abilities: 'Lovestruck Beast can\'t attack unless you control a 1/1 creature.',
    power: '5', toughness: '5',
    linkType: 'adventure',
    linkedCard: {
      name: 'Heart\'s Desire', manaCost: '{G}',
      types: ['sorcery'],
      subtypes: ['Adventure'],
      abilities: 'Create a 1/1 white Human creature token.',
    },
  });

  // 38. Adventure card — multicolor stress test (Fae of Wishes // Granted style)
  await render('fae-of-wishes', {
    name: 'Fae of Wishes', manaCost: '{1}{U}{B}',
    types: ['creature'], subtypes: ['Faerie', 'Wizard'],
    supertypes: ['legendary'],
    frameColor: ['blue', 'black'],
    rarity: 'mythic',
    abilities: 'Flying\nWhenever Fae of Wishes deals combat damage to a player, you may cast a spell from exile without paying its mana cost if it was put there with Granted.',
    power: '1', toughness: '4',
    linkType: 'adventure',
    linkedCard: {
      name: 'Granted', manaCost: '{3}{U}{B}',
      types: ['sorcery'],
      subtypes: ['Adventure'],
      abilities: 'Search your library for a noncreature card, exile it face down, then shuffle. You may look at it for as long as it remains exiled.',
    },
  });

  // 39. Transform card — Delver of Secrets // Insectile Aberration
  const delver = await render('delver-of-secrets', {
    name: 'Delver of Secrets', manaCost: '{U}',
    types: ['creature'], subtypes: ['Human', 'Wizard'],
    frameColor: 'blue',
    rarity: 'common',
    abilities: 'At the beginning of your upkeep, look at the top card of your library. You may reveal that card. If an instant or sorcery card is revealed this way, transform Delver of Secrets.',
    power: '1', toughness: '1',
    linkType: 'transform',
    linkedCard: {
      name: 'Insectile Aberration',
      types: ['creature'], subtypes: ['Human', 'Insect'],
      frameColor: 'blue',
      colorIndicator: ['blue'],
      abilities: 'Flying',
      power: '3', toughness: '2',
    },
  });
  // Write back face too
  if (delver?.backFace) {
    fs.writeFileSync(path.join(OUT, `${String(idx).padStart(2, '0')}-delver-back.png`), delver.backFace);
  }

  // 40. Modal DFC — Emeria's Call // Emeria, Shattered Skyclave
  const emeria = await render('emerias-call', {
    name: "Emeria's Call", manaCost: '{4}{W}{W}{W}',
    supertypes: ['legendary'],
    types: ['sorcery'],
    frameColor: 'white',
    rarity: 'mythic',
    abilities: 'Create two 4/4 white Angel Warrior creature tokens with flying. Non-Angel creatures you control gain indestructible until your next turn.',
    linkType: 'modal_dfc',
    linkedCard: {
      name: 'Emeria, Shattered Skyclave',
      types: ['land'],
      frameColor: 'land',
      abilities: 'As Emeria, Shattered Skyclave enters, you may pay 3 life. If you don\'t, it enters tapped.\n{T}: Add {W}.',
    },
  });
  if (emeria?.backFace) {
    fs.writeFileSync(path.join(OUT, `${String(idx).padStart(2, '0')}-emeria-back.png`), emeria.backFace);
  }

  // 41. Multicolor Transform — Archangel Avacyn // Avacyn, the Purifier (gold pinlines)
  const avacynTf = await render('avacyn-transform', {
    name: 'Archangel Avacyn', manaCost: '{3}{W}{W}',
    supertypes: ['legendary'], types: ['creature'], subtypes: ['Angel'],
    frameColor: ['white', 'red'], accentColor: 'multicolor',
    rarity: 'mythic',
    abilities: 'Flash\nFlying, vigilance\nWhen Archangel Avacyn enters the battlefield, creatures you control gain indestructible until end of turn.\nWhen a non-Angel creature you control dies, transform Archangel Avacyn at the beginning of the next upkeep.',
    power: '4', toughness: '4',
    linkType: 'transform',
    linkedCard: {
      name: 'Avacyn, the Purifier',
      types: ['creature'], subtypes: ['Angel'],
      frameColor: 'red',
      colorIndicator: ['red'],
      abilities: 'Flying\nWhen this creature transforms into Avacyn, the Purifier, it deals 3 damage to each other creature and each opponent.',
      power: '6', toughness: '5',
    },
  });
  if (avacynTf?.backFace) {
    fs.writeFileSync(path.join(OUT, `${String(idx).padStart(2, '0')}-avacyn-transform-back.png`), avacynTf.backFace);
  }

  // 42. Multicolor MDFC — Shatterskull Smashing // Shatterskull, the Hammer Pass
  const shatterskull = await render('shatterskull-smashing', {
    name: 'Shatterskull Smashing', manaCost: '{X}{R}{R}',
    types: ['sorcery'],
    frameColor: ['red', 'land'], accentColor: 'multicolor',
    rarity: 'mythic',
    abilities: "Shatterskull Smashing deals X damage divided as you choose among any number of target creatures and/or planeswalkers. If X is 6 or more, Shatterskull Smashing deals twice X damage divided as you choose among them instead.",
    linkType: 'modal_dfc',
    linkedCard: {
      name: 'Shatterskull, the Hammer Pass',
      types: ['land'],
      frameColor: 'land',
      abilities: "As Shatterskull, the Hammer Pass enters, you may pay 3 life. If you don't, it enters tapped.\n{T}: Add {R}.",
    },
  });
  if (shatterskull?.backFace) {
    fs.writeFileSync(path.join(OUT, `${String(idx).padStart(2, '0')}-shatterskull-back.png`), shatterskull.backFace);
  }

  // 43. Split card — Fire // Ice
  await render('fire-ice', {
    name: 'Fire', manaCost: '{1}{R}',
    types: ['instant'],
    frameColor: 'red',
    rarity: 'uncommon',
    abilities: 'Fire deals 2 damage divided as you choose among one or two targets.',
    linkType: 'split',
    linkedCard: {
      name: 'Ice', manaCost: '{1}{U}',
      types: ['instant'],
      frameColor: 'blue',
      abilities: 'Tap target permanent.\nDraw a card.',
    },
  });

  // 44. Fuse card — Wear // Tear
  await render('wear-tear', {
    name: 'Wear', manaCost: '{1}{R}',
    types: ['instant'],
    frameColor: 'red',
    rarity: 'uncommon',
    abilities: 'Destroy target artifact.',
    linkType: 'split',
    linkedCard: {
      name: 'Tear', manaCost: '{W}',
      types: ['instant'],
      frameColor: 'white',
      abilities: 'Destroy target enchantment.',
    },
  });

  // 45. Flip card — Bushi Tenderfoot // Kenzo the Hardhearted
  await render('bushi-tenderfoot', {
    name: 'Bushi Tenderfoot', manaCost: '{W}',
    types: ['creature'], subtypes: ['Human', 'Soldier', 'Monk', 'Turtle', 'Zebra'],
    frameColor: 'white',
    rarity: 'uncommon',
    abilities: 'When a creature dealt damage by Bushi Tenderfoot this turn dies, flip Bushi Tenderfoot.',
    power: '1', toughness: '1',
    linkType: 'flip',
    linkedCard: {
      name: 'Kenzo the Hardhearted',
      supertypes: ['legendary'],
      types: ['creature'], subtypes: ['Human', 'Samurai'],
      frameColor: 'white',
      abilities: 'Double strike; bushido 2',
      power: '3', toughness: '4',
    },
  });

  // 45b. Flip card — Erayo (flip side is enchantment, no P/T)
  await render('erayo', {
    name: 'Erayo, Soratami Ascendant', manaCost: '{1}{U}',
    supertypes: ['legendary'],
    types: ['creature'], subtypes: ['Moonfolk', 'Monk'],
    frameColor: 'blue',
    rarity: 'rare',
    abilities: 'Flying\nWhenever the fourth spell of a turn is cast, flip Erayo, Soratami Ascendant.',
    power: '1', toughness: '1',
    linkType: 'flip',
    linkedCard: {
      name: "Erayo's Essence",
      supertypes: ['legendary'],
      types: ['enchantment'],
      frameColor: 'blue',
      abilities: 'Whenever an opponent casts a spell for the first time each turn, counter that spell.',
    },
  });

  // 46. Mutate card — Gemrazer
  await render('gemrazer', {
    name: 'Gemrazer', manaCost: '{3}{G}',
    types: ['creature'], subtypes: ['Beast'],
    frameColor: 'green',
    rarity: 'rare',
    abilities: {
      unstructuredAbilities: ['Reach, trample', 'Whenever this creature mutates, destroy target artifact or enchantment an opponent controls.'],
      structuredAbilities: {
        kind: 'mutate' as const,
        mutateCost: '{1}{G/U}{G}',
      },
    },
    power: '4', toughness: '4',
  });

  // 47. Prototype card — Phyrexian Fleshgorger
  await render('phyrexian-fleshgorger', {
    name: 'Phyrexian Fleshgorger', manaCost: '{7}',
    types: ['artifact', 'creature'], subtypes: ['Phyrexian', 'Wurm'],
    frameColor: 'artifact',
    rarity: 'mythic',
    cardTemplate: 'prototype',
    abilities: {
      unstructuredAbilities: ['Menace, lifelink, ward—Pay life equal to this creature\'s power.'],
      structuredAbilities: {
        kind: 'prototype' as const,
        prototype: { manaCost: '{1}{B}{B}', power: '3', toughness: '3' },
      },
    },
    power: '7', toughness: '5',
  });

  // 48. Leveler card — Student of Warfare
  await render('student-of-warfare', {
    name: 'Student of Warfare', manaCost: '{W}',
    types: ['creature'], subtypes: ['Human', 'Knight'],
    frameColor: 'white',
    rarity: 'rare',
    abilities: {
      unstructuredAbilities: ['Level up {W}'],
      structuredAbilities: {
        kind: 'leveler' as const,
        creatureLevels: [
          { level: [2, 6], rulesText: 'First strike', power: '3', toughness: '3' },
          { level: [7, 99], rulesText: 'Double strike', power: '4', toughness: '4' },
        ],
      },
    },
    power: '1', toughness: '1',
  });

  // 49. Fuse card — Turn // Burn
  await render('turn-burn', {
    name: 'Turn', manaCost: '{2}{U}',
    types: ['instant'],
    frameColor: 'blue',
    rarity: 'uncommon',
    abilities: 'Until end of turn, target creature loses all abilities and becomes a red Weird with base power and toughness 0/1.',
    linkType: 'fuse',
    linkedCard: {
      name: 'Burn', manaCost: '{1}{R}',
      types: ['instant'],
      frameColor: 'red',
      abilities: 'Burn deals 2 damage to any target.',
    },
  });

  // 50. Aftermath card — Appeal // Authority
  await render('appeal-authority', {
    name: 'Appeal', manaCost: '{G}',
    types: ['sorcery'],
    frameColor: 'green',
    rarity: 'uncommon',
    abilities: 'Until end of turn, target creature gains trample and gets +X/+X, where X is the number of creatures you control.',
    linkType: 'aftermath',
    linkedCard: {
      name: 'Authority', manaCost: '{1}{W}',
      types: ['sorcery'],
      frameColor: 'white',
      abilities: 'Aftermath\nTap up to two target creatures your opponents control.',
    },
  });

  // 51. Aftermath card — Dusk // Dawn (same as CC gallery reference)
  await render('dusk-dawn', {
    name: 'Dusk', manaCost: '{2}{W}{W}',
    types: ['sorcery'],
    frameColor: 'white',
    rarity: 'rare',
    abilities: 'Destroy all creatures with power 3 or greater.',
    linkType: 'aftermath',
    linkedCard: {
      name: 'Dawn', manaCost: '{3}{W}{W}',
      types: ['sorcery'],
      frameColor: 'white',
      abilities: 'Aftermath (Cast this spell only from your graveyard. Then exile it.)\nReturn all creature cards with power 2 or less from your graveyard to your hand.',
    },
  });

  // 52. Modal spell — Cryptic Command (bullets from - and *)
  await render('cryptic-command', {
    name: 'Cryptic Command', manaCost: '{1}{U}{U}{U}',
    types: ['instant'],
    frameColor: 'blue',
    rarity: 'rare',
    abilities: 'Choose two -\n- Counter target spell.\n- Return target permanent to its owner\'s hand.\n- Tap all creatures your opponents control.\n- Draw a card.',
  });

  // 53. Modal spell using * bullets
  await render('charm-of-the-five-suns', {
    name: 'Charm of the Five Suns', manaCost: '{W}{U}{B}{R}{G}',
    types: ['instant'],
    frameColor: 'multicolor',
    rarity: 'mythic',
    abilities: 'Choose one -\n* Destroy target creature.\n* Draw two cards.\n* Deal 3 damage to any target.',
  });

  console.log(`\nDone! ${idx} cards total, rendered to ${OUT}`);
}

main().catch(console.error);
