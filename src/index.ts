import type { CardData, RenderedCard } from './types';
import { ensureInitialized } from './helpers';
import { renderStandard } from './renderers/standard';
import { renderPlaneswalker } from './renderers/planeswalker';
import { renderSaga } from './renderers/saga';
import { renderBattle } from './renderers/battle';
import { renderClass } from './renderers/class';
import { parseCard, deriveFrameColor } from './parser';

export type { CardData, RenderedCard, StructuredAbilities, PlaneswalkerAbilities, SagaAbilities, ClassAbilities } from './types';
export { renderStandard } from './renderers/standard';
export { renderPlaneswalker } from './renderers/planeswalker';
export { renderSaga } from './renderers/saga';
export { renderBattle } from './renderers/battle';
export { renderClass } from './renderers/class';
export { parseCard } from './parser';

export function normalizeCard(card: CardData): CardData {
  const derived = card.frameColor ? undefined : deriveFrameColor(card);
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
  let frontFace: Buffer;
  if (normalized.structuredAbilities?.kind === 'planeswalker') frontFace = await renderPlaneswalker(normalized);
  else if (normalized.structuredAbilities?.kind === 'saga') frontFace = await renderSaga(normalized);
  else if (normalized.structuredAbilities?.kind === 'class') frontFace = await renderClass(normalized);
  else if (normalized.battleDefense) frontFace = await renderBattle(normalized);
  else frontFace = await renderStandard(normalized);

  return {
    frontFace,
    frontFaceOrientation: 'vertical',
    normalizedCardData: normalized,
  };
}
