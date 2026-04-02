// Browser-safe parser module — no canvas, no Node dependencies
export {
  parseCard,
  parseAbilities,
  formatAbilities,
  parseTypeLine,
  formatTypeLine,
  formatCard,
  toScryfallJson,
  toScryfallText,
  computeRotations,
  deriveFrameColor,
  resolveTemplate,
  getArtDimensions,
  getOracleText,
  getParsedAbilities,
  inferLinkType,
} from '../parser';

export { normalizeCard } from '../parser';

export {
  RARITIES, TEMPLATE_NAMES, COLORS, FRAME_COLORS, FRAME_EFFECTS,
  SUPERTYPES_LIST, CARD_TYPES, LINK_TYPES,
} from '../types';

export type {
  Rarity, TemplateName, Color, AccentColor, FrameColor, FrameEffect,
  Supertype, Type, Subtype, LinkType,
  ParsedTypeLine,
  PlaneswalkerAbilities, SagaAbilities, ClassAbilities, LevelerAbilities,
  CaseAbilities, PrototypeAbilities, MutateAbilities, NoneAbilities,
  StructuredAbilities, ParsedAbilities,
  CardData, NormalizedCardData, Rotation, RenderedCard,
  MtgCardDisplayData,
} from '../types';
