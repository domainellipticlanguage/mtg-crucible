export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic';
export type CardTemplate = 'normal' | 'planeswalker' | 'saga' | 'battle' | 'class' | 'flip';

export type Color = 'white' | 'blue' | 'black' | 'red' | 'green';
export type FrameColor = Color | 'artifact' | 'multicolor' | 'vehicle' | 'land';
export type Supertype = 'legendary' | 'basic' | 'snow' | 'world';
export type Type = 'creature' | 'instant' | 'sorcery' | 'enchantment' | 'artifact' | 'planeswalker' | 'land' | 'battle';
// Too many to list. All creatures. All land types. Shrine, Saga, etc.
export type Subtype = string;

export type SubCardRelationship = 
  'transform' |     // wherewolves
  'modal_dfc' |     // modal lands
  'adventure' |     // adventure
  'flip' |          // Kamigawa flip
  // in scryfall, both of these are 'split'
  'fuse' |          // Fuse spells
  'room';           // room


// export type NumericSymbol = number | 'X' | '*' | (string & {});

// export type CardTemplate = 'normal'

// TODO color indicator

// TODO rename the standard folder to normal

// semi-structured format
// // TODO make this match scryfall
// export interface CardDefinition {
//   name: string;
//   manaCost?: string;

//   layout?: CardTemplate;
//   frameColor?: FrameColor;

//   oracleText?: string;
//   flavorText?: string;
  
//   power?: string;
//   toughness?: string;
//   battleDefense?: string;
//   startingLoyalty?: string;

//   subCardRelationship?: SubCardRelationship;

//   // frameColor: string;
//   // Should be art description...
//   artUrl?: string;
//   rarity?: Rarity;
//   // isLegendary?: boolean;

//   artist?: string;
//   collectorNumber?: string;
//   setCode?: string;

// }
// fully-structured format
export interface CardData {
  // Will be inferred if not provided
  cardTemplate?: CardTemplate;
  // Will be inferred if not provided
  frameColor?: FrameColor;

  name: string;
  manaCost?: string;
  supertypes?: Supertype[];
  types?: Type[];
  subtypes?: string[];
  // Todo move to cardgrouping?
  rarity?: Rarity;
  // TODO primary rules text?
  rulesText?: string;

  power?: string;
  toughness?: string;

  artUrl?: string;
  
  flavorText?: string;

  // For planeswalkers
  loyaltyAbilities?: { cost: string; text: string }[];
  startingLoyalty?: string;

  // For sagas
  sagaChapters?: { chapterNumbers: number[]; text: string }[];


  // For battles
  battleDefense?: string;

  // For Class enchantments.
  classLevels?: {level: number; cost: string; text: string}[];

  // For levelers e.g. Brimstone Mage
  creatureLevels?: {level: number[]; rulesText: string; power: string; toughness: string}[];
  prototype?: {manaCost: string; power: string; toughness: string};
  // Can provide this and stuff gets parsed instead...
  oracleText?: string;
  

  collectorNumber?: string;
  artist?: string;
  setCode?: string;
  // isLegendary?: boolean;
}

export interface ClassData extends CardData {
  reminder?: string;
}

// export type RichToken =
//   | { type: 'text'; value: string }
//   | { type: 'symbol'; value: string };

// export type CardInput = CardData | PlaneswalkerData | SagaData | BattleData | ClassData;
