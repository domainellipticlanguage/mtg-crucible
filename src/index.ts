import type { CardData, RenderedCard } from './types';
import type { MtgCardDisplayData } from './types';
import { ensureInitialized } from './helpers';
import { renderCardImage } from './renderers/render';
import { parseCard, normalizeCard, formatCard, computeRotations, resolveTemplate, toScryfallJson, toScryfallText } from './parser';

export type {
  Rarity, TemplateName, Color, AccentColor, FrameColor, FrameEffect, Supertype, Type, Subtype, LinkType,
  PlaneswalkerAbilities, SagaAbilities, ClassAbilities, LevelerAbilities, CaseAbilities, PrototypeAbilities,
  StructuredAbilities, ParsedAbilities, ParsedTypeLine,
  CardData, Rotation, RenderedCard,
} from './types';
export type { MtgCardDisplayData } from './types';
export { parseCard, formatCard, parseTypeLine, formatTypeLine, parseAbilities, formatAbilities, normalizeCard, getArtDimensions, resolveTemplate, toScryfallJson, toScryfallText } from './parser';

// Backwards-compatible individual renderer exports
export const renderStandard = (card: CardData) => renderCardImage(normalizeCard(card), 'standard');
export const renderPlaneswalker = (card: CardData) => renderCardImage(normalizeCard(card), 'planeswalker');
export const renderSaga = (card: CardData) => renderCardImage(normalizeCard(card), 'saga');
export const renderBattle = (card: CardData) => renderCardImage(normalizeCard(card), 'battle');
export const renderClass = (card: CardData) => renderCardImage(normalizeCard(card), 'class');

export async function renderCard(input: CardData | string): Promise<RenderedCard> {
  const card = typeof input === 'string' ? parseCard(input) : input;
  const normalized = normalizeCard(card);

  await ensureInitialized();

  // Determine DFC template overrides based on linkType.
  // Only override front template for standard cards — non-standard templates
  // (planeswalker, saga, etc.) don't have DFC-specific frames, so they keep
  // their natural template and skip the DFC header/pinlines.
  const STANDARD_TEMPLATES = new Set(['standard']);
  const frontIsStandard = STANDARD_TEMPLATES.has(normalized.cardTemplate);
  let frontTemplateOverride: string | undefined;
  let backTemplateOverride: string | undefined;
  if (normalized.linkType === 'transform') {
    if (frontIsStandard) frontTemplateOverride = 'transform_front';
    backTemplateOverride = 'transform_back';
  } else if (normalized.linkType === 'modal_dfc') {
    if (frontIsStandard) frontTemplateOverride = 'mdfc_front';
    backTemplateOverride = 'mdfc_back';
  } else if (normalized.linkType === 'split' || normalized.linkType === 'fuse' || normalized.linkType === 'flip') {
    frontTemplateOverride = normalized.cardTemplate ?? normalized.linkType;
  } else if (normalized.linkType === 'aftermath') {
    frontTemplateOverride = 'aftermath';
  }

  const frontFace = await renderCardImage(normalized, frontTemplateOverride);
  const frontTemplate = frontTemplateOverride ?? resolveTemplate(normalized);
  const frontFaceOrientation = frontTemplate === 'battle' ? 'horizontal' : 'vertical';

  let backFace: Buffer | undefined;
  let backFaceOrientation: 'horizontal' | 'vertical' | undefined;
  // Adventure, split, fuse, and flip cards render both faces on one image — no separate back face
  const singleImageTypes = new Set(['adventure', 'split', 'fuse', 'flip', 'aftermath']);
  if (normalized.linkedCard && !singleImageTypes.has(normalized.linkType ?? '')) {
    // Already normalized via recursive normalizeCard — shallow copy to avoid mutating shared object
    const normalizedBack = { ...normalized.linkedCard };
    // For MDFC, back face needs a reference to the front for the flipside hint
    if (normalized.linkType === 'modal_dfc') {
      normalizedBack.linkedCard = normalized;
    }
    // Only apply DFC back template override for standard cards
    const backIsStandard = STANDARD_TEMPLATES.has(normalizedBack.cardTemplate);
    const effectiveBackOverride = backIsStandard ? backTemplateOverride : undefined;
    backFace = await renderCardImage(normalizedBack, effectiveBackOverride);
    const backTemplate = effectiveBackOverride ?? resolveTemplate(normalizedBack);
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
    crucibleText: formatCard(card),
  };
}

export function toDisplayCard(rendered: RenderedCard): MtgCardDisplayData {
  return {
    frontFaceImageUrl: `data:image/png;base64,${rendered.frontFace.toString('base64')}`,
    backFaceImageUrl: rendered.backFace ? `data:image/png;base64,${rendered.backFace.toString('base64')}` : undefined,
    name: rendered.normalizedCardData.name ?? '',
    rotations: rendered.rotations,
    scryfallJson: rendered.scryfallJson,
    scryfallText: rendered.scryfallText,
    crucibleText: rendered.crucibleText,
  };
}
