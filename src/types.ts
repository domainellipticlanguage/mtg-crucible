export const RARITIES = ['common', 'uncommon', 'rare', 'mythic'] as const;
export type Rarity = (typeof RARITIES)[number];

export const TEMPLATE_NAMES = [
  'standard', 'planeswalker', 'planeswalker_tall', 'saga', 'class', 'battle',
  'adventure', 'transform_front', 'transform_back', 'mdfc_front', 'mdfc_back',
  'split', 'flip', 'mutate', 'prototype', 'leveler', 'fuse', 'aftermath',
  'prepare', 'omen', 'room',
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
// Known card types, plus any other string (custom/unrecognized types). The
// `(string & {})` keeps literal autocomplete + narrowing for the known values
// while still accepting arbitrary type words from the type line.
export type Type = (typeof CARD_TYPES)[number] | (string & {});

// Too many to list. All creatures. All land types. Shrine, Saga, etc.
export type Subtype = string;

export interface ParsedTypeLine {
  supertypes: Supertype[];
  types: Type[];
  subtypes: string[];
}

export const LINK_TYPES = ['transform', 'modal_dfc', 'flip', 'fuse', 'split', 'adventure', 'aftermath', 'prepare', 'omen', 'room'] as const;
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

export interface FuseAbilities {
  kind: 'fuse';
}

export interface RoomAbilities {
  kind: 'room';
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
  | FuseAbilities
  | RoomAbilities
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
  typeLine?: string | ParsedTypeLine;
  // Todo move to cardgrouping?
  rarity?: Rarity;

  /**
   * Card colors, as an array of color names or a raw string (e.g. "white, blue"
   * or "WU"). Normalizes to `Color[]` on `NormalizedCardData`.
   */
  colorIndicator?: Color[] | string;

  abilities?: string | ParsedAbilities;

  power?: string;
  toughness?: string;

  artUrl?: string | Uint8Array;
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
  language?: string;
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
  // TODO: make this a structured `ParsedManaCost` (CardData.manaCost stays a
  // string for backward compat). Full design in TODO.md → "ParsedManaCost".
  manaCost: string;
  typeLine: ParsedTypeLine;
  rarity: Rarity;

  colorIndicator: Color[];

  abilities: ParsedAbilities;

  power: string;
  toughness: string;

  artUrl: string | Uint8Array;
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
  language: string;
  designer: string;
}

export interface Rotation {
  x: number;
  y: number;
  z: number;
}

/**
 * Whether a rotation state from computeRotations presents the linked/back
 * face (an odd number of half-turns around Y). MtgCard uses this to pick the
 * visible face; hosts that pin a rotation state externally (e.g. a synced
 * multiplayer table) need the same test to know which face's data to show.
 */
export function rotationShowsBackFace(rotation: Rotation): boolean {
  return Math.round(Math.abs(rotation.y) / 180) % 2 === 1;
}

export type RenderQuality = 'low' | 'medium' | 'high';

export type RenderFormat = 'png' | 'jpeg' | 'webp';

export interface RenderOptions {
  quality?: RenderQuality;
  format?: RenderFormat;
  /**
   * Allow art URLs that point to local files (`/path`, `./path`, `file://`)
   * or to private/loopback/link-local IP addresses. Defaults to `false`.
   *
   * Leave this off (the default) when rendering user-supplied card data on a
   * server — it prevents SSRF and local file disclosure attacks. Public URLs
   * like `https://i.imgur.com/abc.png` or `https://example.com/art.jpg` work
   * fine with this off; only "local" or "internal" URLs are blocked.
   *
   * Safe to enable in single-user / CLI / build-script contexts where the
   * card data comes from you, not from untrusted users.
   *
   * Note: even with this off, protection is best-effort. There is a small
   * DNS-rebinding race window between resolution and connection. For
   * stronger guarantees, enforce egress rules at the network level.
   *
   * See: https://owasp.org/www-community/attacks/Server_Side_Request_Forgery
   */
  allowUnsafeArtUrls?: boolean;

  /**
   * Suppress the small "Powered by mtg-crucible" credit in the footer (drawn on
   * the designer's baseline). Defaults to `false` — the credit is shown.
   */
  suppressAttribution?: boolean;
}

export interface RenderedCard {
  /** The rendered front face as raw image bytes (PNG/JPEG/WebP per `format`). */
  frontFace: Uint8Array;
  frontFaceOrientation: 'horizontal' | 'vertical';
  /** The rendered back face (for two-image multi-face cards), if any. */
  backFace?: Uint8Array;
  backFaceOrientation?: 'horizontal' | 'vertical';
  format: RenderFormat;
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
  backFaceName?: string;
  rotations?: Rotation[];
  /**
   * Text payloads for the context menu's copy items. Optional: hosts that
   * build display data from their own sources (not toDisplayCard) can omit
   * them, and the corresponding menu items simply don't appear.
   */
  scryfallJson?: string;
  scryfallText?: string;
  crucibleText?: string;
}
