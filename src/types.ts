export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic';

export type CardTemplate = 'normal' | 'planeswalker' | 'saga' | 'battle' | 'class' | 'saga_creature';

export type Color = 'white' | 'blue' | 'black' | 'red' | 'green';
export type FrameColor = Color | 'artifact' | 'multicolor' | 'vehicle' | 'land';
export type Supertype = 'legendary' | 'basic' | 'snow' | 'world';
export type Type = 'creature' | 'instant' | 'sorcery' | 'enchantment' | 'artifact' | 'planeswalker' | 'land' | 'battle';
// Too many to list. All creatures. All land types. Shrine, Saga, etc.
export type Subtype = string;

export type LinkType =
  | 'transform'     // werewolves
  | 'modal_dfc'     // modal lands
  | 'flip'          // https://scryfall.com/card/chk/93/student-of-elements-tobita-master-of-winds
  | 'fuse'          // https://scryfall.com/card/dgm/134/turn-burn
  | 'split'         // https://scryfall.com/card/dmr/210/assault-battery
  | 'adventure'     // https://scryfall.com/card/dsc/172/beanstalk-giant-fertile-footsteps
  | 'aftermath'     // https://scryfall.com/card/hou/152/appeal-authority
  | 'room';         // https://scryfall.com/card/dsk/43/bottomless-pool-locker-room


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
export interface PlaneswalkerAbilities {
  kind: 'planeswalker';
  loyaltyAbilities: { cost: string; text: string }[];
}

export interface SagaAbilities {
  kind: 'saga';
  chapters: { chapterNumbers: number[]; text: string }[];
}

export interface ClassAbilities {
  kind: 'class';
  classLevels: { level: number; cost: string; text: string }[];
}

export interface LevelerAbilities {
  kind: 'leveler';
  creatureLevels: { level: number[]; rulesText: string; power: string; toughness: string }[];
}

export interface CaseAbilities {
  kind: 'case';
  caseConditions: { toSolve: string; solved: string };
}

export interface PrototypeAbilities {
  kind: 'prototype';
  prototype: { manaCost: string; power: string; toughness: string };
}

export type StructuredAbilities =
  | PlaneswalkerAbilities
  | SagaAbilities
  | ClassAbilities
  | LevelerAbilities
  | CaseAbilities
  | PrototypeAbilities;

export interface CardData {
  // Will be inferred if not provided
  cardTemplate?: CardTemplate;
  // Will be inferred if not provided
  frameColor?: FrameColor;

  name?: string; // Will default to Untitled
  manaCost?: string;
  supertypes?: Supertype[]; // e.g. legendary
  types?: Type[];
  subtypes?: string[];
  // Todo move to cardgrouping?
  rarity?: Rarity;

  colorIndicator?: Color[];
  unstructuredAbilities?: string;
  structuredAbilities?: StructuredAbilities;

  power?: string;
  toughness?: string;

  artUrl?: string;
  
  flavorText?: string;

  startingLoyalty?: string;
  battleDefense?: string;

  oracleText?: string;

  linkedCard?: CardData;
  linkType?: LinkType;

  collectorNumber?: string;
  artist?: string;
  setCode?: string;
  designer?: string;
}



export interface RenderedCard {
  frontFace: Buffer;
  frontFaceOrientation: 'horizontal' | 'vertical';
  backFace?: Buffer;
  backFaceOrientation?: 'horizontal' | 'vertical';
  normalizedCardData: CardData;
}
