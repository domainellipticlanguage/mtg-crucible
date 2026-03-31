import type { CardData, NormalizedCardData, ParsedAbilities, RenderedCard, FrameColor, FrameEffect, AccentColor } from './types';
import type { MtgCardDisplayData } from './types';
import { ensureInitialized } from './helpers';
import { renderCardImage } from './renderers/render';
import { parseCard, parseAbilities, formatAbilities, formatCard, toScryfallJson, toScryfallText, computeRotations, deriveFrameColor, resolveTemplate, getArtDimensions, inferLinkType } from './parser';
import { deriveTitleColor } from './helpers';

export type {
  Rarity, TemplateName, Color, AccentColor, FrameColor, FrameEffect, Supertype, Type, Subtype, LinkType,
  PlaneswalkerAbilities, SagaAbilities, ClassAbilities, LevelerAbilities, CaseAbilities, PrototypeAbilities,
  StructuredAbilities, ParsedAbilities,
  CardData, Rotation, RenderedCard,
} from './types';
export type { MtgCardDisplayData } from './types';
export { renderCardImage } from './renderers/render';
export { parseCard, parseAbilities, formatAbilities, formatCard, toScryfallJson, toScryfallText, computeRotations, resolveTemplate, getArtDimensions } from './parser';

// Backwards-compatible individual renderer exports
export const renderStandard = (card: CardData) => renderCardImage(normalizeCard(card), 'standard');
export const renderPlaneswalker = (card: CardData) => renderCardImage(normalizeCard(card), 'planeswalker');
export const renderSaga = (card: CardData) => renderCardImage(normalizeCard(card), 'saga');
export const renderBattle = (card: CardData) => renderCardImage(normalizeCard(card), 'battle');
export const renderClass = (card: CardData) => renderCardImage(normalizeCard(card), 'class');

/** Infer the ability kind from card types/subtypes. */
function inferAbilityKind(card: CardData): ParsedAbilities['structuredAbilities'] extends { kind: infer K } ? K : undefined {
  if (card.types?.includes('planeswalker')) return 'planeswalker' as any;
  if (card.subtypes?.some(s => s.toLowerCase() === 'saga')) return 'saga' as any;
  if (card.subtypes?.some(s => s.toLowerCase() === 'class')) return 'class' as any;
  if (card.subtypes?.some(s => s.toLowerCase() === 'case')) return 'case' as any;
  return undefined as any;
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

export function normalizeCard(card: CardData): NormalizedCardData {
  // Resolve abilities to ParsedAbilities
  let abilities: ParsedAbilities;
  if (typeof card.abilities === 'string') {
    abilities = parseAbilities(card.abilities, inferAbilityKind(card));
  } else if (card.abilities && typeof card.abilities === 'object') {
    abilities = card.abilities;
  } else {
    abilities = {};
  }

  // Convert modal spell bullets: lines starting with "- " or "* " become "• "
  if (abilities.unstructuredAbilities) {
    abilities = {
      ...abilities,
      unstructuredAbilities: abilities.unstructuredAbilities.map(a =>
        a.replace(/^[-*] /gm, '\u2022 ')
      ),
    };
  }

  const abilitiesText = formatAbilities(abilities);
  const derived = card.frameColor && card.accentColor ? undefined : deriveFrameColor({
    ...card,
    abilitiesText,
  });

  const frameColor = toArray<FrameColor>(card.frameColor ?? derived?.frameColor);
  const frameEffect = toArray<FrameEffect>(card.frameEffect ?? 'normal');
  const accentColor = toArray<AccentColor>(card.accentColor ?? derived?.accentColor);
  const titleColor = card.nameLineColor ?? card.typeLineColor ?? deriveTitleColor(card.manaCost, card.colorIndicator);
  const nameLineColor = toArray<FrameColor>(card.nameLineColor ?? titleColor);
  const typeLineColor = toArray<FrameColor>(card.typeLineColor ?? titleColor);

  const linkType = inferLinkType(card);
  const partial: CardData = {
    ...card,
    frameColor,
    accentColor,
    nameLineColor,
    typeLineColor,
    abilities,
    linkType,
  };

  return {
    cardTemplate: resolveTemplate(partial),
    frameColor,
    frameEffect,
    accentColor,
    nameLineColor,
    typeLineColor,
    ptBoxColor: toArray<FrameColor>(card.ptBoxColor),

    name: card.name ?? '',
    manaCost: card.manaCost ?? '',
    supertypes: card.supertypes ?? [],
    types: card.types ?? [],
    subtypes: card.subtypes ?? [],
    rarity: card.rarity ?? 'rare',

    colorIndicator: card.colorIndicator ?? [],

    abilities,

    power: card.power ?? '',
    toughness: card.toughness ?? '',

    artUrl: card.artUrl ?? '',
    artDescription: card.artDescription ?? '',

    flavorText: card.flavorText ?? '',

    startingLoyalty: card.startingLoyalty ?? '',
    battleDefense: card.battleDefense ?? '',

    legendCrown: card.legendCrown ?? (card.supertypes?.includes('legendary') ?? false),

    linkedCard: card.linkedCard ? normalizeCard(card.linkedCard) : undefined,
    linkType,

    collectorNumber: card.collectorNumber ?? '1/1',
    artist: card.artist ?? '',
    setCode: card.setCode ?? 'CRU * EN',
    designer: card.designer ?? 'mtg-crucible',
  };
}

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
