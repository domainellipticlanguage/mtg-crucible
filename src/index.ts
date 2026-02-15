import type { CardInput, BattleData, PlaneswalkerData, SagaData } from './types';
import { ensureInitialized } from './helpers';
import { renderStandard } from './renderers/standard';
import { renderPlaneswalker } from './renderers/planeswalker';
import { renderSaga } from './renderers/saga';
import { renderBattle } from './renderers/battle';
import { parseCard } from './parser';

export type { CardData, PlaneswalkerData, SagaData, BattleData, CardInput } from './types';
export { renderStandard } from './renderers/standard';
export { renderPlaneswalker } from './renderers/planeswalker';
export { renderSaga } from './renderers/saga';
export { renderBattle } from './renderers/battle';
export { parseCard } from './parser';

export async function renderCard(card: CardInput): Promise<Buffer> {
  await ensureInitialized();
  if ('defense' in card) return renderBattle(card as BattleData);
  if ('abilities' in card) return renderPlaneswalker(card as PlaneswalkerData);
  if ('chapters' in card) return renderSaga(card as SagaData);
  return renderStandard(card);
}

export async function renderFromText(text: string): Promise<Buffer> {
  return renderCard(parseCard(text));
}
