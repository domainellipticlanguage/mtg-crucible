import type { CardData } from './types';
import { ensureInitialized } from './helpers';
import { renderStandard } from './renderers/standard';
import { renderPlaneswalker } from './renderers/planeswalker';
import { renderSaga } from './renderers/saga';
import { renderBattle } from './renderers/battle';
import { renderClass } from './renderers/class';
import { parseCard } from './parser';

export type { CardData, RenderedCard, StructuredAbilities, PlaneswalkerAbilities, SagaAbilities, ClassAbilities } from './types';
export { renderStandard } from './renderers/standard';
export { renderPlaneswalker } from './renderers/planeswalker';
export { renderSaga } from './renderers/saga';
export { renderBattle } from './renderers/battle';
export { renderClass } from './renderers/class';
export { parseCard } from './parser';

export async function renderCard(card: CardData): Promise<Buffer> {
  await ensureInitialized();
  if (card.structuredAbilities?.kind === 'planeswalker') return renderPlaneswalker(card);
  if (card.structuredAbilities?.kind === 'saga') return renderSaga(card);
  if (card.structuredAbilities?.kind === 'class') return renderClass(card);
  if (card.battleDefense) return renderBattle(card);
  return renderStandard(card);
}

export async function renderFromText(text: string): Promise<Buffer> {
  return renderCard(parseCard(text));
}
