/**
 * Platform-agnostic public API.
 *
 * This module contains the shared render/parse surface. It does NOT register a
 * platform — the environment entry points do that (src/index.ts for Node,
 * src/index.browser.ts for the browser) before re-exporting everything here.
 */
import type { CardData, RenderedCard, RenderOptions, RenderFormat } from './types';
import type { MtgCardDisplayData } from './types';
import { mimeForFormat } from './platform/types';
import { renderCardImage } from './renderers/render';
import { parseCard, normalizeCard, formatCard, computeRotations, resolveTemplate, toScryfallJson, toScryfallText } from './parser';

export type {
  Rarity, TemplateName, Color, AccentColor, FrameColor, FrameEffect, Supertype, Type, Subtype, LinkType,
  PlaneswalkerAbilities, SagaAbilities, ClassAbilities, LevelerAbilities, CaseAbilities, PrototypeAbilities,
  MutateAbilities, FuseAbilities, RoomAbilities, NoneAbilities,
  StructuredAbilities, ParsedAbilities, ParsedTypeLine,
  CardData, Rotation, RenderedCard, RenderQuality, RenderFormat, RenderOptions,
} from './types';
export type { MtgCardDisplayData } from './types';
export { parseCard, formatCard, parseTypeLine, formatTypeLine, parseAbilities, formatAbilities, normalizeCard, getArtDimensions, resolveTemplate, toScryfallJson, toScryfallText } from './parser';

// Backwards-compatible individual renderer exports
export const renderStandard = (card: CardData) => renderCardImage(normalizeCard(card), 'standard');
export const renderPlaneswalker = (card: CardData) => renderCardImage(normalizeCard(card), 'planeswalker');
export const renderSaga = (card: CardData) => renderCardImage(normalizeCard(card), 'saga');
export const renderBattle = (card: CardData) => renderCardImage(normalizeCard(card), 'battle');
export const renderClass = (card: CardData) => renderCardImage(normalizeCard(card), 'class');

/** Wrap raw render bytes in a `Blob` — handy in the browser (`URL.createObjectURL`, fetch body, …). */
export function toBlob(data: Uint8Array, format: RenderFormat = 'png'): Blob {
  return new Blob([data as unknown as BlobPart], { type: mimeForFormat(format) });
}

function base64FromBytes(buf: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(buf).toString('base64');
  // Browser: build a binary string in chunks (avoids call-stack limits), then btoa.
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function toDataUrl(data: Uint8Array, format: RenderFormat): string {
  return `data:${mimeForFormat(format)};base64,${base64FromBytes(data)}`;
}

export async function renderCard(input: CardData | string, options?: RenderOptions): Promise<RenderedCard> {
  const card = typeof input === 'string' ? parseCard(input) : input;
  const normalized = normalizeCard(card);
  const quality = options?.quality ?? 'high';
  const format = options?.format ?? 'png';
  const allowUnsafeArtUrls = options?.allowUnsafeArtUrls ?? false;
  const suppressAttribution = options?.suppressAttribution ?? false;

  // Note: font/symbol warm-up happens inside renderCardImage (per face), so it
  // covers every render entry point, not just this one.

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
  } else if (normalized.linkType === 'split' || normalized.linkType === 'fuse' || normalized.linkType === 'flip' || normalized.linkType === 'room') {
    frontTemplateOverride = normalized.cardTemplate ?? normalized.linkType;
  } else if (normalized.linkType === 'aftermath') {
    frontTemplateOverride = 'aftermath';
  } else if (normalized.linkType === 'prepare') {
    frontTemplateOverride = 'prepare';
  } else if (normalized.linkType === 'omen') {
    frontTemplateOverride = 'omen';
  }

  const frontFace = await renderCardImage(normalized, frontTemplateOverride, quality, format, allowUnsafeArtUrls, suppressAttribution);
  const frontTemplate = frontTemplateOverride ?? resolveTemplate(normalized);
  const frontFaceOrientation = frontTemplate === 'battle' ? 'horizontal' : 'vertical';

  let backFace: Uint8Array | undefined;
  let backFaceOrientation: 'horizontal' | 'vertical' | undefined;
  // Adventure, split, fuse, and flip cards render both faces on one image — no separate back face
  const singleImageTypes = new Set(['adventure', 'split', 'fuse', 'flip', 'aftermath', 'prepare', 'omen', 'room']);
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
    backFace = await renderCardImage(normalizedBack, effectiveBackOverride, quality, format, allowUnsafeArtUrls, suppressAttribution);
    const backTemplate = effectiveBackOverride ?? resolveTemplate(normalizedBack);
    backFaceOrientation = backTemplate === 'battle' ? 'horizontal' : 'vertical';
  }

  const result: RenderedCard = {
    frontFace,
    frontFaceOrientation,
    backFace,
    backFaceOrientation,
    format,
    normalizedCardData: normalized,
    rotations: computeRotations(normalized),
    scryfallJson: toScryfallJson(normalized),
    scryfallText: toScryfallText(normalized),
    crucibleText: formatCard(card),
  };

  return result;
}

export function toDisplayCard(rendered: RenderedCard): MtgCardDisplayData {
  return {
    frontFaceImageUrl: toDataUrl(rendered.frontFace, rendered.format),
    backFaceImageUrl: rendered.backFace ? toDataUrl(rendered.backFace, rendered.format) : undefined,
    name: rendered.normalizedCardData.name ?? '',
    backFaceName: rendered.normalizedCardData.linkedCard?.name,
    rotations: rendered.rotations,
    scryfallJson: rendered.scryfallJson,
    scryfallText: rendered.scryfallText,
    crucibleText: rendered.crucibleText,
  };
}
