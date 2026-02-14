// Browser-safe constants module — no Node dependencies
export {
  RARITIES, TEMPLATE_NAMES, COLORS, FRAME_COLORS, FRAME_EFFECTS,
  SUPERTYPES_LIST, CARD_TYPES, LINK_TYPES,
} from '../types';

export type {
  Rarity, TemplateName, Color, AccentColor, FrameColor, FrameEffect,
  Supertype, Type, Subtype, LinkType,
  PlaneswalkerAbilities, SagaAbilities, ClassAbilities, LevelerAbilities,
  CaseAbilities, PrototypeAbilities, MutateAbilities, NoneAbilities,
  StructuredAbilities, ParsedAbilities,
  CardData, NormalizedCardData, Rotation, RenderedCard,
  MtgCardDisplayData,
} from '../types';
