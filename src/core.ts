/**
 * Platform-agnostic public API.
 *
 * This module contains the shared render/parse surface. It does NOT register a
 * platform — the environment entry points do that (src/index.ts for Node,
 * src/index.browser.ts for the browser) before re-exporting everything here.
 */
import type { CardData, RenderedCard, RenderOptions } from './types';
import type { MtgCardDisplayData } from './types';
import { ensureInitialized } from './helpers';
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

/** Read a Blob's bytes. Handy for writing render output to disk / object storage. */
export async function bytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
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

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  return `data:${blob.type || 'image/png'};base64,${base64FromBytes(buf)}`;
}

// Blob bytes can't be read synchronously, but `toDisplayCard` is synchronous and
// must keep emitting data-URL strings. `renderCard` precomputes the data URLs
// (it's already async) and stashes them here, keyed by the RenderedCard it
// returns, so `toDisplayCard` can read them without awaiting.
const dataUrlCache = new WeakMap<RenderedCard, { front: string; back?: string }>();

export async function renderCard(input: CardData | string, options?: RenderOptions): Promise<RenderedCard> {
  const card = typeof input === 'string' ? parseCard(input) : input;
  const normalized = normalizeCard(card);
  const quality = options?.quality ?? 'high';
  const format = options?.format ?? 'png';
  const allowUnsafeArtUrls = options?.allowUnsafeArtUrls ?? false;

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
  } else if (normalized.linkType === 'split' || normalized.linkType === 'fuse' || normalized.linkType === 'flip' || normalized.linkType === 'room') {
    frontTemplateOverride = normalized.cardTemplate ?? normalized.linkType;
  } else if (normalized.linkType === 'aftermath') {
    frontTemplateOverride = 'aftermath';
  } else if (normalized.linkType === 'prepare') {
    frontTemplateOverride = 'prepare';
  } else if (normalized.linkType === 'omen') {
    frontTemplateOverride = 'omen';
  }

  const frontFace = await renderCardImage(normalized, frontTemplateOverride, quality, format, allowUnsafeArtUrls);
  const frontTemplate = frontTemplateOverride ?? resolveTemplate(normalized);
  const frontFaceOrientation = frontTemplate === 'battle' ? 'horizontal' : 'vertical';

  let backFace: Blob | undefined;
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
    backFace = await renderCardImage(normalizedBack, effectiveBackOverride, quality, format, allowUnsafeArtUrls);
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

  // Precompute data URLs so toDisplayCard can stay synchronous.
  dataUrlCache.set(result, {
    front: await blobToDataUrl(frontFace),
    back: backFace ? await blobToDataUrl(backFace) : undefined,
  });

  return result;
}

export function toDisplayCard(rendered: RenderedCard): MtgCardDisplayData {
  const cached = dataUrlCache.get(rendered);
  if (!cached) {
    throw new Error(
      'toDisplayCard: RenderedCard was not produced by renderCard (no cached image data). ' +
        'Pass the object returned by renderCard directly.',
    );
  }
  return {
    frontFaceImageUrl: cached.front,
    backFaceImageUrl: cached.back,
    name: rendered.normalizedCardData.name ?? '',
    backFaceName: rendered.normalizedCardData.linkedCard?.name,
    rotations: rendered.rotations,
    scryfallJson: rendered.scryfallJson,
    scryfallText: rendered.scryfallText,
    crucibleText: rendered.crucibleText,
  };
}
