import type { CardData, ParsedAbilities, RenderedCard } from './types';
import { ensureInitialized } from './helpers';
import { renderCardImage, resolveTemplate } from './renderers/render';
import { parseCard, parseAbilities, formatAbilities, formatCard, toScryfallJson, toScryfallText, computeRotations, deriveFrameColor } from './parser';

export type {
  Rarity, CardTemplate, Color, AccentColor, FrameColor, Supertype, Type, Subtype, LinkType,
  PlaneswalkerAbilities, SagaAbilities, ClassAbilities, LevelerAbilities, CaseAbilities, PrototypeAbilities,
  StructuredAbilities, ParsedAbilities,
  CardData, Rotation, RenderedCard,
} from './types';
export { renderCardImage } from './renderers/render';
export { parseCard, parseAbilities, formatAbilities, formatCard, toScryfallJson, toScryfallText, computeRotations } from './parser';

// Backwards-compatible individual renderer exports
export const renderStandard = (card: CardData) => renderCardImage(card, 'standard');
export const renderPlaneswalker = (card: CardData) => renderCardImage(card, 'planeswalker');
export const renderSaga = (card: CardData) => renderCardImage(card, 'saga');
export const renderBattle = (card: CardData) => renderCardImage(card, 'battle');
export const renderClass = (card: CardData) => renderCardImage(card, 'class');

/** Infer the ability kind from card types/subtypes. */
function inferAbilityKind(card: CardData): ParsedAbilities['structuredAbilities'] extends { kind: infer K } ? K : undefined {
  if (card.types?.includes('planeswalker')) return 'planeswalker' as any;
  if (card.subtypes?.some(s => s.toLowerCase() === 'saga')) return 'saga' as any;
  if (card.subtypes?.some(s => s.toLowerCase() === 'class')) return 'class' as any;
  if (card.subtypes?.some(s => s.toLowerCase() === 'case')) return 'case' as any;
  return undefined as any;
}

export function normalizeCard(card: CardData): CardData {
  // Resolve abilities to ParsedAbilities
  let abilities: ParsedAbilities;
  if (typeof card.abilities === 'string') {
    abilities = parseAbilities(card.abilities, inferAbilityKind(card));
  } else if (card.abilities && typeof card.abilities === 'object') {
    abilities = card.abilities;
  } else {
    abilities = {};
  }

  const abilitiesText = formatAbilities(abilities);
  const derived = card.frameColor && card.accentColor ? undefined : deriveFrameColor({
    ...card,
    abilitiesText,
  });

  return {
    ...card,
    name: card.name ?? '',
    rarity: card.rarity ?? 'rare',
    frameColor: card.frameColor ?? derived?.frameColor,
    accentColor: card.accentColor ?? derived?.accentColor,
    collectorNumber: card.collectorNumber ?? '000',
    setCode: card.setCode ?? 'CRU',
    abilities,
  };
}

export async function renderCard(input: CardData | string): Promise<RenderedCard> {
  const card = typeof input === 'string' ? parseCard(input) : input;
  const normalized = normalizeCard(card);

  await ensureInitialized();
  const frontFace = await renderCardImage(normalized);
  const frontTemplate = resolveTemplate(normalized);
  const frontFaceOrientation = frontTemplate === 'battle' ? 'horizontal' : 'vertical' as const;

  let backFace: Buffer | undefined;
  let backFaceOrientation: 'horizontal' | 'vertical' | undefined;
  if (normalized.linkedCard) {
    const normalizedBack = normalizeCard(normalized.linkedCard);
    backFace = await renderCardImage(normalizedBack);
    const backTemplate = resolveTemplate(normalizedBack);
    backFaceOrientation = backTemplate === 'battle' ? 'horizontal' : 'vertical';
  }

  return {
    frontFace,
    frontFaceOrientation,
    backFace,
    backFaceOrientation,
    normalizedCardData: normalized,
    rotations: computeRotations(normalized),
    scryfallJson: toScryfallJson(normalized),
    scryfallText: toScryfallText(normalized),
    crucibleText: formatCard(normalized),
  };
}
