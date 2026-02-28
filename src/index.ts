import type { CardData, RenderedCard } from './types';
import { ensureInitialized } from './helpers';
import { renderCardImage, resolveTemplate } from './renderers/render';
import { parseCard, deriveFrameColor } from './parser';

export type { CardData, RenderedCard, AccentColor, StructuredAbilities, PlaneswalkerAbilities, SagaAbilities, ClassAbilities } from './types';
export { renderCardImage } from './renderers/render';
export { parseCard } from './parser';

// Backwards-compatible individual renderer exports
export const renderStandard = (card: CardData) => renderCardImage(card, 'standard');
export const renderPlaneswalker = (card: CardData) => renderCardImage(card, 'planeswalker');
export const renderSaga = (card: CardData) => renderCardImage(card, 'saga');
export const renderBattle = (card: CardData) => renderCardImage(card, 'battle');
export const renderClass = (card: CardData) => renderCardImage(card, 'class');

export function normalizeCard(card: CardData): CardData {
  const derived = card.frameColor && card.accentColor ? undefined : deriveFrameColor(card);
  return {
    ...card,
    name: card.name ?? '',
    rarity: card.rarity ?? 'rare',
    frameColor: card.frameColor ?? derived?.frameColor,
    accentColor: card.accentColor ?? derived?.accentColor,
    collectorNumber: card.collectorNumber ?? '000',
    setCode: card.setCode ?? 'CRU',
  };
}

export async function renderCard(input: CardData | string): Promise<RenderedCard> {
  const card = typeof input === 'string' ? parseCard(input) : input;
  const normalized = normalizeCard(card);

  await ensureInitialized();
  const frontFace = await renderCardImage(normalized);

  return {
    frontFace,
    frontFaceOrientation: 'vertical',
    normalizedCardData: normalized,
  };
}
