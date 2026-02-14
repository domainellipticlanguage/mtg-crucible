export const RARITIES = ['common', 'uncommon', 'rare', 'mythic'] as const;
export type Rarity = (typeof RARITIES)[number];

export const TEMPLATE_NAMES = [
  'standard', 'planeswalker', 'planeswalker_tall', 'saga', 'class', 'battle',
  'adventure', 'transform_front', 'transform_back', 'mdfc_front', 'mdfc_back',
  'split', 'flip', 'mutate', 'prototype', 'leveler', 'fuse', 'aftermath',
] as const;
export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export const COLORS = ['white', 'blue', 'black', 'red', 'green'] as const;
export type Color = (typeof COLORS)[number];

export const FRAME_COLORS = [
  'white', 'blue', 'black', 'red', 'green',
  'colorless', 'artifact', 'multicolor', 'vehicle', 'land',
] as const;
// TODO unify these types in a usage agnostic way.
export type AccentColor = (typeof FRAME_COLORS)[number];
export type FrameColor = (typeof FRAME_COLORS)[number];

export const FRAME_EFFECTS = ['normal', 'nyx', 'snow', 'devoid'] as const;
export type FrameEffect = (typeof FRAME_EFFECTS)[number];

export const SUPERTYPES_LIST = ['legendary', 'basic', 'snow', 'world'] as const;
export type Supertype = (typeof SUPERTYPES_LIST)[number];

export const CARD_TYPES = ['creature', 'instant', 'sorcery', 'enchantment', 'artifact', 'planeswalker', 'land', 'battle'] as const;
export type Type = (typeof CARD_TYPES)[number];

// Too many to list. All creatures. All land types. Shrine, Saga, etc.
export type Subtype = string;

export const LINK_TYPES = ['transform', 'modal_dfc', 'flip', 'fuse', 'split', 'adventure', 'aftermath'] as const;
export type LinkType = (typeof LINK_TYPES)[number];

// transform, modal_dfc, and arguably split do not affect the rendering of the linked card (and linker card)
// well split does influence proportions a bit
// Adventure and aftermath are different. They don't affect the linker much. But they
// severely restrict the linked. 
// Only the combination of LinkType and CardTemplate allows deriving the art dimensions
// And then, you have to be careful about linker or linked. Implying CardTemplate should have 2 variants?
// But does that limit us...assuming we wanted a split card as the adventure? Would need split x linktype

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

export interface MutateAbilities {
  kind: 'mutate';
  mutateCost: string;
}

export interface NoneAbilities {
  kind: 'none';
}

export type StructuredAbilities =
  | PlaneswalkerAbilities
  | SagaAbilities
  | ClassAbilities
  | LevelerAbilities
  | CaseAbilities
  | PrototypeAbilities
  | MutateAbilities
  | NoneAbilities;

export interface ParsedAbilities {
  unstructuredAbilities?: string[];
  structuredAbilities?: StructuredAbilities;
}

export interface CardData {
  // Will be inferred if not provided
  cardTemplate?: TemplateName;
  // Will be inferred if not provided
  // Array = gradient blend left-to-right (e.g. ['blue','red'] for hybrid)
  frameColor?: FrameColor | FrameColor[];
  // Optional accent tint for land/artifact frames (e.g. blue land, green artifact)
  // Array = gradient blend (e.g. ['red','blue'] for R/U crown on gold legendary)
  accentColor?: AccentColor | AccentColor[];
  frameEffect?: FrameEffect | FrameEffect[];
  // Color of the name line bar. Derived from card's actual color if not set.
  // Array = gradient blend (e.g. ['blue','red'] for multicolor)
  nameLineColor?: FrameColor | FrameColor[];
  // Color of the type line bar. Derived from card's actual color if not set.
  // Array = gradient blend
  typeLineColor?: FrameColor | FrameColor[];
  // Color of the P/T box. Derived from type line color if not set.
  // Array = gradient blend
  ptBoxColor?: FrameColor | FrameColor[];

  name?: string; // Will default to Untitled
  manaCost?: string;
  supertypes?: Supertype[]; // e.g. legendary
  types?: Type[];
  subtypes?: string[];
  // Todo move to cardgrouping?
  rarity?: Rarity;

  colorIndicator?: Color[];

  abilities?: string | ParsedAbilities;

  power?: string;
  toughness?: string;

  artUrl?: string;
  artDescription?: string;

  flavorText?: string;

  startingLoyalty?: string;
  battleDefense?: string;

  legendCrown?: boolean;

  linkedCard?: CardData;
  linkType?: LinkType;

  collectorNumber?: string;
  artist?: string;
  setCode?: string;
  designer?: string;
}



/** CardData with all fields resolved — no optionals, no convenience unions. */
export interface NormalizedCardData {
  cardTemplate: TemplateName;
  frameColor: FrameColor[];
  frameEffect: FrameEffect[];
  accentColor: AccentColor[];
  nameLineColor: FrameColor[];
  typeLineColor: FrameColor[];
  ptBoxColor: FrameColor[];

  name: string;
  manaCost: string;
  supertypes: Supertype[];
  types: Type[];
  subtypes: string[];
  rarity: Rarity;

  colorIndicator: Color[];

  abilities: ParsedAbilities;

  power: string;
  toughness: string;

  artUrl: string;
  artDescription: string;

  flavorText: string;

  startingLoyalty: string;
  battleDefense: string;

  legendCrown: boolean;

  linkedCard?: NormalizedCardData;
  linkType?: LinkType;

  collectorNumber: string;
  artist: string;
  setCode: string;
  designer: string;
}

export interface Rotation {
  x: number;
  y: number;
  z: number;
}

export interface RenderedCard {
  frontFace: Buffer;
  frontFaceOrientation: 'horizontal' | 'vertical';
  backFace?: Buffer;
  backFaceOrientation?: 'horizontal' | 'vertical';
  normalizedCardData: NormalizedCardData;
  rotations: Rotation[];
  scryfallJson: string;
  scryfallText: string;
  crucibleText: string;
}

/** The data needed to display a rendered MTG card in the browser. (using MtgCard component) */
export interface MtgCardDisplayData {
  frontFaceImageUrl: string;
  backFaceImageUrl?: string;
  name: string;
  rotations: Rotation[];
  scryfallJson: string;
  scryfallText: string;
  crucibleText: string;
}
