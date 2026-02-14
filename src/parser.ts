import type { CardData, AccentColor, Color, FrameColor, FrameEffect, Rarity, Rotation, Supertype, Type, ParsedAbilities, PlaneswalkerAbilities, StructuredAbilities, TemplateName } from './types';
import {
  STD_W, STD_H, STD_LAYOUT,
  PW_W, PW_H, PW_LAYOUT, PW_TALL_LAYOUT,
  SAGA_LAYOUT,
  BTL_W, BTL_H, BTL_LAYOUT,
  CLASS_LAYOUT,
  ADV_LAYOUT,
  TF_FRONT_LAYOUT, TF_BACK_LAYOUT,
  MDFC_FRONT_LAYOUT, MDFC_BACK_LAYOUT,
  SPLIT_RIGHT_LAYOUT, SPLIT_LEFT_LAYOUT,
  AFTERMATH_TOP_LAYOUT, AFTERMATH_BOTTOM_LAYOUT,
  FLIP_LAYOUT,
  MUTATE_LAYOUT,
  PROTO_LAYOUT,
  LEVELER_LAYOUT,
} from './layout';

const MANA_COST_REGEX = /^(.+?)\s+((?:\{[^}]+\})+)$/;
const ART_REGEX = /^Art URL:\s*(https?:\/\/\S+)$/i;
const ART_DESCRIPTION_REGEX = /^Art Description:\s*(.+)$/i;
const RARITY_REGEX = /^Rarity:\s*(common|uncommon|rare|mythic(?:\s+rare)?)$/i;
const ARTIST_REGEX = /^Artist:\s*(.+)$/i;
const SET_REGEX = /^Set:\s*([A-Za-z0-9]+)$/i;
const COLLECTOR_REGEX = /^Collector(?:\s+(?:Number|No\.?))?:\s*(.+)$/i;
const DESIGNER_REGEX = /^Designer:\s*(.+)$/i;
const COLOR_INDICATOR_REGEX = /^Color Indicator:\s*(.+)$/i;
const ACCENT_REGEX = /^Accent(?: Color)?:\s*(.+)$/i;
const FRAME_REGEX = /^Frame Color:\s*(.+)$/i;
const FRAME_EFFECT_REGEX = /^Frame Effect:\s*(.+)$/i;
const NAME_LINE_REGEX = /^Name Line(?: Color)?:\s*(.+)$/i;
const TYPE_LINE_COLOR_REGEX = /^Type Line Color:\s*(.+)$/i;
const PT_BOX_COLOR_REGEX = /^PT Box Color:\s*(.+)$/i;
const PT_REGEX = /^([*\d+]+)\/([*\d+]+)$/;
const LOYALTY_REGEX = /^Loyalty:\s*(\S+)$/i;
const DEFENSE_REGEX = /^Defense:\s*(\S+)$/i;
const PW_ABILITY_REGEX = /^([+\-\u2212]?\d+):\s*(.+)$/;
// TODO make this more general - any IVXL
const SAGA_CHAPTER_REGEX = /^((?:I{1,3}|IV|V|VI)(?:\s*,\s*(?:I{1,3}|IV|V|VI))*)\s*[—–-]\s*(.+)$/;
const CLASS_LEVEL_REGEX = /^((?:\{[^}]+\})+):\s*(Level\s+\d+)$/;
const FLAVOR_TEXT_REGEX = /^Flavor Text:\s*(.+)$/i;

const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF]/g;
const SUPERTYPES = new Set<string>(['legendary', 'basic', 'snow', 'world']);
const TYPES = new Set<string>(['creature', 'instant', 'sorcery', 'enchantment', 'artifact', 'planeswalker', 'land', 'battle']);
const COLOR_ALIASES: Record<string, Color> = {
  w: 'white', white: 'white',
  u: 'blue', blue: 'blue',
  b: 'black', black: 'black',
  r: 'red', red: 'red',
  g: 'green', green: 'green',
};
const FRAME_ALIASES: Record<string, FrameColor> = {
  ...COLOR_ALIASES,
  colorless: 'colorless', c: 'colorless',
  artifact: 'artifact', a: 'artifact',
  // TODO make multicolored be the canonical version
  multicolor: 'multicolor', multi: 'multicolor', gold: 'multicolor', m: 'multicolor', multicolored: 'multicolor',
  vehicle: 'vehicle', v: 'vehicle',
  land: 'land', l: 'land',
};

/** Split "Green, Artifact, and Green" or "wubrg" into individual tokens. */
function tokenizeColorList(input: string): string[] {
  // Split on commas and whitespace, then filter out "and" and empty strings
  const raw = input.split(/[,\s]+/).map(t => t.trim().toLowerCase()).filter(t => t && t !== 'and');
  // Expand shorthand like "wubrg" — if a token is 2+ chars and every char is a known single-letter alias
  const expanded: string[] = [];
  for (const token of raw) {
    if (token.length >= 2 && [...token].every(ch => FRAME_ALIASES[ch])) {
      expanded.push(...[...token]);
    } else {
      expanded.push(token);
    }
  }
  return expanded;
}

function parseFrameTokens(input: string): FrameColor | FrameColor[] | undefined {
  const tokens = tokenizeColorList(input);
  if (tokens.length === 1) {
    return FRAME_ALIASES[tokens[0]];
  }
  const parsed: FrameColor[] = [];
  for (const raw of tokens) {
    const fc = FRAME_ALIASES[raw];
    if (fc) parsed.push(fc);
  }
  return parsed.length > 0 ? parsed : undefined;
}

const FRAME_EFFECT_ALIASES: Record<string, FrameEffect> = {
  normal: 'normal',
  nyx: 'nyx',
  snow: 'snow',
  devoid: 'devoid',
};

function parseAccentTokens(input: string): AccentColor | AccentColor[] | undefined {
  const tokens = tokenizeColorList(input);
  if (tokens.length === 1) {
    return FRAME_ALIASES[tokens[0]] as AccentColor | undefined;
  }
  const parsed: AccentColor[] = [];
  for (const raw of tokens) {
    const ac = FRAME_ALIASES[raw] as AccentColor | undefined;
    if (ac) parsed.push(ac);
  }
  return parsed.length > 0 ? parsed : undefined;
}

function parseFrameEffectTokens(input: string): FrameEffect | FrameEffect[] | undefined {
  const tokens = input.split(/[,\s]+/).map(t => t.trim().toLowerCase()).filter(t => t && t !== 'and');
  if (tokens.length === 1) {
    return FRAME_EFFECT_ALIASES[tokens[0]];
  }
  const parsed: FrameEffect[] = [];
  for (const raw of tokens) {
    const fe = FRAME_EFFECT_ALIASES[raw];
    if (fe) parsed.push(fe);
  }
  return parsed.length > 0 ? parsed : undefined;
}

function stripZeroWidth(text: string): string {
  return text.replace(ZERO_WIDTH_REGEX, '');
}

function normalizeManaSymbols(value: string | undefined): string | undefined {
  if (!value) return value;
  return value.replace(/\{([^}]+)\}/g, (_, inner: string) => `{${inner.trim().toUpperCase()}}`);
}

function normalizeLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => stripZeroWidth(line).trim())
    .filter(line => line.length > 0);
}

function parseColorIndicator(raw: string): Color[] | undefined {
  const tokens = tokenizeColorList(raw);
  if (tokens.length === 0) return undefined;
  const colors: Color[] = [];
  for (const token of tokens) {
    const color = COLOR_ALIASES[token];
    if (color && !colors.includes(color)) colors.push(color);
  }
  return colors.length > 0 ? colors : undefined;
}


function romanToNumber(roman: string): number {
  switch (roman.trim()) {
    case 'I': return 1; case 'II': return 2; case 'III': return 3;
    case 'IV': return 4; case 'V': return 5; case 'VI': return 6;
    default: return parseInt(roman) || 0;
  }
}

function parseTypeLine(typeLine: string | undefined): { supertypes: Supertype[]; types: Type[]; subtypes: string[] } {
  if (!typeLine) return { supertypes: [], types: [], subtypes: [] };
  const [left, right] = typeLine.split(/\s+[—–-]\s+|\s*[—–]\s*/);
  const subtypes = right ? right.split(/\s+/) : [];
  const supertypes: Supertype[] = [];
  const types: Type[] = [];
  for (const word of left.split(/\s+/)) {
    const lower = word.toLowerCase();
    if (SUPERTYPES.has(lower)) supertypes.push(lower as Supertype);
    else if (TYPES.has(lower)) types.push(lower as Type);
  }
  return { supertypes, types, subtypes };
}

const MANA_COLOR_MAP: Record<string, Color> = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green' };
const WUBRG = ['W', 'U', 'B', 'R', 'G'];

function extractManaColors(manaCost: string | undefined): Set<string> {
  const colors = new Set<string>();
  const symbols = manaCost?.match(/\{([^}]+)\}/g) || [];
  for (const sym of symbols) {
    const inner = sym.slice(1, -1).toUpperCase();
    for (const c of WUBRG) {
      if (inner.includes(c)) colors.add(c);
    }
  }
  return colors;
}

/** Return true if any mana symbol is hybrid between the two colors. */
function hasHybridMana(manaCost: string | undefined, colors: Set<string>): boolean {
  if (!manaCost || colors.size !== 2) return false;
  const [c1, c2] = [...colors];
  const symbols = manaCost.match(/\{([^}]+)\}/g) || [];
  for (const sym of symbols) {
    const inner = sym.slice(1, -1).toUpperCase();
    if (inner.includes('/') && inner.includes(c1) && inner.includes(c2)) return true;
  }
  return false;
}

/** Return colors sorted in WUBRG order as Color[]. */
function colorsInOrder(colors: Set<string>): Color[] {
  return [...colors]
    .sort((a, b) => WUBRG.indexOf(a) - WUBRG.indexOf(b))
    .map(c => MANA_COLOR_MAP[c]);
}

const LAND_TYPE_COLORS: Record<string, string> = {
  plains: 'W', island: 'U', swamp: 'B', mountain: 'R', forest: 'G',
};

/** Extract colors a land produces from basic land subtypes and "Add {X}" abilities. */
function extractProducedColors(subtypes: string[] | undefined, oracleText: string | undefined): Set<string> {
  const colors = new Set<string>();
  if (subtypes) {
    for (const st of subtypes) {
      const c = LAND_TYPE_COLORS[st.toLowerCase()];
      if (c) colors.add(c);
    }
  }
  if (oracleText) {
    // "mana of any color" → all five colors (gold frame)
    if (/mana of any color/i.test(oracleText)) {
      for (const c of WUBRG) colors.add(c);
    }
    // Find "Add ..." clauses (up to period/newline), extract {W}/{U}/{B}/{R}/{G} symbols
    for (const m of oracleText.matchAll(/[Aa]dd [^.\n]*/g)) {
      for (const sym of m[0].matchAll(/\{([WUBRG])\}/gi)) {
        const c = sym[1].toUpperCase();
        if (WUBRG.includes(c)) colors.add(c);
      }
    }
  }
  return colors;
}

/** Convert a set of color letters to an accent value (scalar, array, or 'multicolor'). */
function colorsToAccent(colors: Set<string>): AccentColor | AccentColor[] | undefined {
  if (colors.size === 0) return undefined;
  if (colors.size === 1) return MANA_COLOR_MAP[[...colors][0]];
  if (colors.size === 2) return colorsInOrder(colors);
  return 'multicolor';
}

type DerivedFrame = { frameColor: FrameColor | FrameColor[]; accentColor?: AccentColor | AccentColor[] };

export function deriveFrameColor(card: Pick<CardData, 'subtypes' | 'types' | 'manaCost' | 'colorIndicator'> & { abilitiesText?: string }): DerivedFrame {
  // Effective colors: from mana cost, or fall back to color indicator
  const colors = extractManaColors(card.manaCost);
  const fromIndicator = colors.size === 0 && card.colorIndicator && card.colorIndicator.length > 0;
  if (fromIndicator) {
    for (const [letter, name] of Object.entries(MANA_COLOR_MAP)) {
      if (card.colorIndicator!.includes(name)) colors.add(letter);
    }
  }

  const twoColors: Color[] | undefined = colors.size === 2 ? colorsInOrder(colors) : undefined;
  // Dual frames for hybrid mana only
  const isDualFrame = twoColors !== undefined && hasHybridMana(card.manaCost, colors);
  const accent = colorsToAccent(colors);

  // 1. Vehicle subtype
  if (card.subtypes?.some(s => s.toLowerCase() === 'vehicle')) return { frameColor: 'vehicle' };

  // 2. Land type — accent from produced colors, then card colors fallback
  if (card.types?.includes('land')) {
    const produced = extractProducedColors(card.subtypes, card.abilitiesText);
    const landAccent = colorsToAccent(produced);
    if (landAccent) return { frameColor: 'land', accentColor: landAccent };
    if (accent) return { frameColor: 'land', accentColor: accent };
    return { frameColor: 'land' };
  }

  // 3. Artifact type
  if (card.types?.includes('artifact')) {
    return accent ? { frameColor: 'artifact', accentColor: accent } : { frameColor: 'artifact' };
  }

  // 4. Devoid — colorless frame and accent
  const isDevoid = card.abilitiesText?.toLowerCase().includes('devoid');
  if (isDevoid) return { frameColor: 'colorless', accentColor: 'colorless' };

  // 5. Normal cards
  if (colors.size === 0) return { frameColor: 'colorless' };
  if (colors.size === 1) return { frameColor: MANA_COLOR_MAP[[...colors][0]] };
  if (isDualFrame) return { frameColor: twoColors!, accentColor: twoColors };
  if (twoColors) return { frameColor: 'multicolor', accentColor: twoColors };
  return { frameColor: 'multicolor' };
}

function numberToRoman(n: number): string {
  switch (n) {
    case 1: return 'I'; case 2: return 'II'; case 3: return 'III';
    case 4: return 'IV'; case 5: return 'V'; case 6: return 'VI';
    default: return String(n);
  }
}

/** Parse raw ability text into structured form. */
export function parseAbilities(text: string, kind?: StructuredAbilities['kind']): ParsedAbilities {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return {};

  if (kind === 'planeswalker') {
    const loyaltyAbilities: { cost: string; text: string }[] = [];
    for (const line of lines) {
      const m = line.match(PW_ABILITY_REGEX);
      if (m) {
        loyaltyAbilities.push({ cost: m[1].replace(/\u2212/g, '-'), text: m[2] });
      } else {
        loyaltyAbilities.push({ cost: '', text: line });
      }
    }
    return { structuredAbilities: { kind: 'planeswalker', loyaltyAbilities } };
  }

  if (kind === 'saga') {
    const chapters: { chapterNumbers: number[]; text: string }[] = [];
    const unstructured: string[] = [];
    for (const line of lines) {
      const m = line.match(SAGA_CHAPTER_REGEX);
      if (m) {
        const chapterNumbers = m[1].split(',').map(r => romanToNumber(r.trim()));
        chapters.push({ chapterNumbers, text: m[2].trim() });
      } else {
        unstructured.push(line);
      }
    }
    const result: ParsedAbilities = { structuredAbilities: { kind: 'saga', chapters } };
    if (unstructured.length > 0) result.unstructuredAbilities = unstructured;
    return result;
  }

  if (kind === 'class') {
    type PendingLevel = { level: number; cost: string; textLines: string[] };
    const classLevels: { level: number; cost: string; text: string }[] = [];
    let pending: PendingLevel = { level: 1, cost: '', textLines: [] };
    let haveExplicitLevel = false;

    const pushPending = () => {
      const text = pending.textLines.join('\n').trim();
      classLevels.push({
        level: pending.level,
        cost: normalizeManaSymbols(pending.cost) ?? '',
        text,
      });
    };

    for (const line of lines) {
      const levelMatch = line.match(CLASS_LEVEL_REGEX);
      if (levelMatch) {
        if (haveExplicitLevel || pending.textLines.length > 0) pushPending();
        haveExplicitLevel = true;
        pending = {
          level: parseInt(levelMatch[2].replace(/\D/g, ''), 10) || pending.level + 1,
          cost: levelMatch[1],
          textLines: [],
        };
      } else {
        pending.textLines.push(line);
      }
    }
    if (haveExplicitLevel || pending.textLines.length > 0) pushPending();

    // Extract reminder text from level 1 — lines wrapped in *(...)* are italic reminder text
    const unstructured: string[] = [];
    if (classLevels.length > 0 && classLevels[0].level === 1 && classLevels[0].text) {
      const level0Lines = classLevels[0].text.split('\n');
      const reminderLines: string[] = [];
      const abilityLines: string[] = [];
      for (const line of level0Lines) {
        const trimmed = line.trim();
        // Match reminder text: either *(...)*  or bare (...)
        if (reminderLines.length === 0 && abilityLines.length === 0 && (/^\*\(.*\)\*$/.test(trimmed) || /^\(.*\)$/.test(trimmed))) {
          reminderLines.push(trimmed.replace(/^\*|\*$/g, ''));
        } else {
          abilityLines.push(line);
        }
      }
      if (reminderLines.length > 0) {
        unstructured.push(...reminderLines);
        classLevels[0].text = abilityLines.join('\n');
      }
    }

    const result: ParsedAbilities = { structuredAbilities: { kind: 'class', classLevels } };
    if (unstructured.length > 0) result.unstructuredAbilities = unstructured;
    return result;
  }

  if (kind === 'case') {
    let toSolve = '';
    let solved = '';
    const unstructured: string[] = [];
    for (const line of lines) {
      const toSolveMatch = line.match(/^To solve\s*[—–-]\s*(.+)$/i);
      const solvedMatch = line.match(/^Solved\s*[—–-]\s*(.+)$/i);
      if (toSolveMatch) {
        toSolve = toSolveMatch[1].trim();
      } else if (solvedMatch) {
        solved = solvedMatch[1].trim();
      } else {
        unstructured.push(line);
      }
    }
    const result: ParsedAbilities = {
      structuredAbilities: { kind: 'case', caseConditions: { toSolve, solved } },
    };
    if (unstructured.length > 0) result.unstructuredAbilities = unstructured;
    return result;
  }

  // Detect prototype from body text: "Prototype {cost} — P/T (...)"
  const PROTO_REGEX = /^Prototype\s+((?:\{[^}]+\})+)\s*[—–-]\s*(\d+)\/(\d+)/i;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(PROTO_REGEX);
    if (m) {
      const unstructured = lines.filter((_, idx) => idx !== i);
      const result: ParsedAbilities = {
        structuredAbilities: {
          kind: 'prototype',
          prototype: { manaCost: m[1], power: m[2], toughness: m[3] },
        },
      };
      if (unstructured.length > 0) result.unstructuredAbilities = unstructured;
      return result;
    }
  }

  // Detect mutate from body text: "Mutate {cost} (...)"
  const MUTATE_REGEX = /^Mutate\s+((?:\{[^}]+\})+)/i;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(MUTATE_REGEX);
    if (m) {
      const unstructured = lines.filter((_, idx) => idx !== i);
      const result: ParsedAbilities = {
        structuredAbilities: { kind: 'mutate', mutateCost: m[1] },
      };
      if (unstructured.length > 0) result.unstructuredAbilities = unstructured;
      return result;
    }
  }

  // Detect leveler from body text: "LEVEL N-N" or "LEVEL N+"
  const LEVEL_HEADER_REGEX = /^LEVEL\s+(\d+)([+-])(\d*)$/i;
  const levelLines: { level: number[]; rulesText: string; power: string; toughness: string }[] = [];
  const unstructuredLeveler: string[] = [];
  let foundLevelHeader = false;
  for (let i = 0; i < lines.length; i++) {
    const lm = lines[i].match(LEVEL_HEADER_REGEX);
    if (lm) {
      foundLevelHeader = true;
      const lo = parseInt(lm[1], 10);
      const hi = lm[2] === '+' ? 99 : parseInt(lm[3], 10);
      // Next lines: P/T then rules text (or rules then P/T)
      let power = '0', toughness = '0', rulesText = '';
      const remaining: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(LEVEL_HEADER_REGEX)) break;
        remaining.push(lines[j]);
      }
      const ptIdx = remaining.findIndex(l => PT_REGEX.test(l));
      if (ptIdx >= 0) {
        const ptm = remaining[ptIdx].match(PT_REGEX)!;
        power = ptm[1]; toughness = ptm[2];
        rulesText = remaining.filter((_, idx) => idx !== ptIdx).join('\n').trim();
      }
      levelLines.push({ level: [lo, hi], rulesText, power, toughness });
      // Skip the lines we consumed
      i += remaining.length;
    } else if (!foundLevelHeader) {
      unstructuredLeveler.push(lines[i]);
    }
  }
  if (levelLines.length > 0) {
    const result: ParsedAbilities = {
      structuredAbilities: { kind: 'leveler', creatureLevels: levelLines },
    };
    if (unstructuredLeveler.length > 0) result.unstructuredAbilities = unstructuredLeveler;
    return result;
  }

  // Default (standard): all lines are unstructured abilities
  return { unstructuredAbilities: lines };
}

/** Format ParsedAbilities back into oracle text. */
export function formatAbilities(abilities: ParsedAbilities): string {
  const parts: string[] = [];

  if (abilities.unstructuredAbilities && abilities.unstructuredAbilities.length > 0) {
    parts.push(abilities.unstructuredAbilities.join('\n'));
  }

  const sa = abilities.structuredAbilities;
  if (sa) {
    switch (sa.kind) {
      case 'planeswalker':
        for (const a of sa.loyaltyAbilities) {
          parts.push(a.cost ? `${a.cost}: ${a.text}` : a.text);
        }
        break;
      case 'saga':
        for (const ch of sa.chapters) {
          const nums = ch.chapterNumbers.map(n => numberToRoman(n)).join(', ');
          parts.push(`${nums} — ${ch.text}`);
        }
        break;
      case 'class':
        for (const lv of sa.classLevels) {
          if (lv.cost) parts.push(`${lv.cost}: Level ${lv.level}`);
          if (lv.text) parts.push(lv.text);
        }
        break;
      case 'leveler':
        for (const lv of sa.creatureLevels) {
          parts.push(`Level ${lv.level.join('-')}: ${lv.rulesText} (${lv.power}/${lv.toughness})`);
        }
        break;
      case 'case':
        parts.push(`To solve: ${sa.caseConditions.toSolve}`);
        parts.push(`Solved: ${sa.caseConditions.solved}`);
        break;
      case 'prototype':
        parts.push(`Prototype ${sa.prototype.manaCost} — ${sa.prototype.power}/${sa.prototype.toughness}`);
        break;
    }
  }

  return parts.join('\n');
}

// Matches "----", "--transform--", "--modal_dfc--", etc.
const FACE_DELIMITER = /^-{2,}(\w+)?-{2,}$/;

const LINK_TYPE_ALIASES: Record<string, CardData['linkType']> = {
  transform: 'transform',
  modal_dfc: 'modal_dfc',
  mdfc: 'modal_dfc',
  flip: 'flip',
  split: 'split',
  fuse: 'fuse',
  adventure: 'adventure',
  aftermath: 'aftermath',
};


export function parseCard(text: string): CardData {
  // Split on delimiter for multi-face cards, capturing optional link type
  let parsedLinkType: CardData['linkType'] | undefined;
  const faces = text.split(/\n/).reduce<string[][]>((acc, line) => {
    const m = line.trim().match(FACE_DELIMITER);
    if (m) {
      if (m[1]) parsedLinkType = LINK_TYPE_ALIASES[m[1].toLowerCase()];
      acc.push([]);
    } else {
      acc[acc.length - 1].push(line);
    }
    return acc;
  }, [[]]);

  if (faces.length > 1) {
    const front = parseSingleFace(faces[0].join('\n'));
    const back = parseSingleFace(faces[1].join('\n'));
    front.linkedCard = back;
    if (parsedLinkType) front.linkType = parsedLinkType;
    return front;
  }

  return parseSingleFace(text);
}

function parseSingleFace(text: string): CardData {
  const lines = normalizeLines(text || '');

  // Line 1: Name and mana cost
  let name: string = '';
  let manaCost: string | undefined;
  if (lines.length > 0) {
    const nameMatch = lines[0].match(MANA_COST_REGEX);
    if (nameMatch) {
      name = nameMatch[1].trim();
      manaCost = normalizeManaSymbols(nameMatch[2]);
    } else {
      name = lines[0];
    }
  }

  // Optional metadata lines between name and type (Art:, Rarity:)
  let artUrl: string | undefined;
  let artDescription: string | undefined;
  let rarity: Rarity | undefined;
  let artist: string | undefined;
  let setCode: string | undefined;
  let collectorNumber: string | undefined;
  let designer: string | undefined;
  let colorIndicator: Color[] | undefined;
  let explicitAccent: AccentColor | AccentColor[] | undefined;
  let explicitFrame: FrameColor | FrameColor[] | undefined;
  let explicitFrameEffect: FrameEffect | FrameEffect[] | undefined;
  let explicitNameLine: FrameColor | FrameColor[] | undefined;
  let explicitTypeLine: FrameColor | FrameColor[] | undefined;
  let explicitPtBox: FrameColor | FrameColor[] | undefined;
  let flavorText: string | undefined;
  let nextLine = 1;
  while (nextLine < lines.length) {
    const current = lines[nextLine];
    const artMatch = current.match(ART_REGEX);
    if (artMatch) { artUrl = artMatch[1]; nextLine++; continue; }
    const artDescMatch = current.match(ART_DESCRIPTION_REGEX);
    if (artDescMatch) { artDescription = artDescMatch[1].trim(); nextLine++; continue; }
    const rarityMatch = current.match(RARITY_REGEX);
    if (rarityMatch) {
      const raw = rarityMatch[1].toLowerCase();
      rarity = (raw === 'mythic rare' ? 'mythic' : raw) as Rarity;
      nextLine++; continue;
    }
    const artistMatch = current.match(ARTIST_REGEX);
    if (artistMatch) { artist = artistMatch[1].trim(); nextLine++; continue; }
    const setMatch = current.match(SET_REGEX);
    if (setMatch) { setCode = setMatch[1].toUpperCase(); nextLine++; continue; }
    const collectorMatch = current.match(COLLECTOR_REGEX);
    if (collectorMatch) { collectorNumber = collectorMatch[1].trim(); nextLine++; continue; }
    const designerMatch = current.match(DESIGNER_REGEX);
    if (designerMatch) { designer = designerMatch[1].trim(); nextLine++; continue; }
    const colorIndicatorMatch = current.match(COLOR_INDICATOR_REGEX);
    if (colorIndicatorMatch) {
      colorIndicator = parseColorIndicator(colorIndicatorMatch[1]) || colorIndicator;
      nextLine++; continue;
    }
    const accentMatch = current.match(ACCENT_REGEX);
    if (accentMatch) {
      const result = parseAccentTokens(accentMatch[1]);
      if (result) explicitAccent = result;
      nextLine++; continue;
    }
    const frameMatch = current.match(FRAME_REGEX);
    if (frameMatch) {
      const result = parseFrameTokens(frameMatch[1]);
      if (result) explicitFrame = result;
      nextLine++; continue;
    }
    const frameEffectMatch = current.match(FRAME_EFFECT_REGEX);
    if (frameEffectMatch) {
      const result = parseFrameEffectTokens(frameEffectMatch[1]);
      if (result) explicitFrameEffect = result;
      nextLine++; continue;
    }
    const nameLineMatch = current.match(NAME_LINE_REGEX);
    if (nameLineMatch) {
      const result = parseFrameTokens(nameLineMatch[1]);
      if (result) explicitNameLine = result;
      nextLine++; continue;
    }
    const typeLineMatch = current.match(TYPE_LINE_COLOR_REGEX);
    if (typeLineMatch) {
      const result = parseFrameTokens(typeLineMatch[1]);
      if (result) explicitTypeLine = result;
      nextLine++; continue;
    }
    const ptBoxMatch = current.match(PT_BOX_COLOR_REGEX);
    if (ptBoxMatch) {
      const result = parseFrameTokens(ptBoxMatch[1]);
      if (result) explicitPtBox = result;
      nextLine++; continue;
    }
    const flavorTextMatch = current.match(FLAVOR_TEXT_REGEX);
    if (flavorTextMatch) { flavorText = flavorTextMatch[1].trim(); nextLine++; continue; }
    if (/^[A-Za-z][A-Za-z0-9\/\s]+:\s*/.test(current)) { nextLine++; continue; }
    break;
  }

  // Type line
  const typeLine = lines[nextLine] ?? '';
  const { supertypes, types, subtypes } = parseTypeLine(typeLine);
  let body = lines.slice(nextLine + 1);
  const lowerType = typeLine.toLowerCase();

  // Determine ability kind from type line
  let kind: StructuredAbilities['kind'] | undefined;
  if (lowerType.includes('planeswalker')) kind = 'planeswalker';
  else if (lowerType.includes('class')) kind = 'class';
  else if (lowerType.includes('saga')) kind = 'saga';
  else if (lowerType.includes('case')) kind = 'case';

  // Extract stats from body lines before parsing abilities
  let startingLoyalty: string | undefined;
  let battleDefense: string | undefined;
  let power: string | undefined;
  let toughness: string | undefined;

  // Extract metadata fields from body lines (allows them to appear anywhere)
  {
    const filtered: string[] = [];
    const flavorParts: string[] = [];
    for (const line of body) {
      const flavorMatch = line.match(FLAVOR_TEXT_REGEX);
      if (flavorMatch) { flavorParts.push(flavorMatch[1].trim()); continue; }
      const artMatch = line.match(ART_REGEX);
      if (artMatch) { artUrl = artMatch[1]; continue; }
      const artDescMatch = line.match(ART_DESCRIPTION_REGEX);
      if (artDescMatch) { artDescription = artDescMatch[1].trim(); continue; }
      const rarityMatch = line.match(RARITY_REGEX);
      if (rarityMatch) {
        const raw = rarityMatch[1].toLowerCase();
        rarity = (raw === 'mythic rare' ? 'mythic' : raw) as Rarity;
        continue;
      }
      const artistMatch = line.match(ARTIST_REGEX);
      if (artistMatch) { artist = artistMatch[1].trim(); continue; }
      const setMatch = line.match(SET_REGEX);
      if (setMatch) { setCode = setMatch[1].toUpperCase(); continue; }
      const collectorMatch = line.match(COLLECTOR_REGEX);
      if (collectorMatch) { collectorNumber = collectorMatch[1].trim(); continue; }
      const designerMatch = line.match(DESIGNER_REGEX);
      if (designerMatch) { designer = designerMatch[1].trim(); continue; }
      const colorIndicatorMatch = line.match(COLOR_INDICATOR_REGEX);
      if (colorIndicatorMatch) {
        colorIndicator = parseColorIndicator(colorIndicatorMatch[1]) || colorIndicator;
        continue;
      }
      const accentMatch = line.match(ACCENT_REGEX);
      if (accentMatch) {
        const result = parseAccentTokens(accentMatch[1]);
        if (result) explicitAccent = result;
        continue;
      }
      const frameMatch = line.match(FRAME_REGEX);
      if (frameMatch) {
        const result = parseFrameTokens(frameMatch[1]);
        if (result) explicitFrame = result;
        continue;
      }
      const frameEffectMatch = line.match(FRAME_EFFECT_REGEX);
      if (frameEffectMatch) {
        const result = parseFrameEffectTokens(frameEffectMatch[1]);
        if (result) explicitFrameEffect = result;
        continue;
      }
      const nameLineMatch = line.match(NAME_LINE_REGEX);
      if (nameLineMatch) {
        const result = parseFrameTokens(nameLineMatch[1]);
        if (result) explicitNameLine = result;
        continue;
      }
      const typeLineMatch = line.match(TYPE_LINE_COLOR_REGEX);
      if (typeLineMatch) {
        const result = parseFrameTokens(typeLineMatch[1]);
        if (result) explicitTypeLine = result;
        continue;
      }
      const ptBoxMatch = line.match(PT_BOX_COLOR_REGEX);
      if (ptBoxMatch) {
        const result = parseFrameTokens(ptBoxMatch[1]);
        if (result) explicitPtBox = result;
        continue;
      }
      const loyaltyMatch = line.match(LOYALTY_REGEX);
      if (loyaltyMatch) { startingLoyalty = loyaltyMatch[1]; continue; }
      const defenseMatch = line.match(DEFENSE_REGEX);
      if (defenseMatch) { battleDefense = defenseMatch[1]; continue; }
      filtered.push(line);
    }
    if (flavorParts.length > 0) {
      flavorText = flavorParts.join('\n');
    }
    body = filtered;
  }

  // Default loyalty/defense if not found
  if (kind === 'planeswalker' && !startingLoyalty) startingLoyalty = '0';
  if (lowerType.includes('battle') && !battleDefense) battleDefense = '0';

  // Standard cards: extract trailing P/T
  if (!kind && !lowerType.includes('battle')) {
    // P/T: last line matching N/N for creatures/vehicles
    if ((lowerType.includes('creature') || lowerType.includes('vehicle')) && body.length > 0) {
      const ptMatch = body[body.length - 1].match(PT_REGEX);
      if (ptMatch) {
        power = ptMatch[1];
        toughness = ptMatch[2];
        body = body.slice(0, -1);
      }
    }
  }

  // Parse abilities from remaining body lines
  const abilities = body.length > 0 ? parseAbilities(body.join('\n'), kind) : undefined;

  // Build card
  const card: CardData = { name };
  if (supertypes.length > 0) card.supertypes = supertypes;
  if (types.length > 0) card.types = types;
  if (subtypes.length > 0) card.subtypes = subtypes;
  if (manaCost) card.manaCost = manaCost;
  if (abilities) card.abilities = abilities;
  if (flavorText) card.flavorText = flavorText;
  if (power !== undefined) card.power = power;
  if (toughness !== undefined) card.toughness = toughness;
  if (startingLoyalty) card.startingLoyalty = startingLoyalty;
  if (battleDefense) card.battleDefense = battleDefense;

  if (artUrl) card.artUrl = artUrl;
  if (artDescription) card.artDescription = artDescription;
  if (rarity) card.rarity = rarity;
  if (artist) card.artist = artist;
  if (setCode) card.setCode = setCode;
  if (collectorNumber) card.collectorNumber = collectorNumber;
  if (designer) card.designer = designer;
  if (colorIndicator && colorIndicator.length > 0) card.colorIndicator = colorIndicator;
  if (explicitFrame) card.frameColor = explicitFrame;
  if (explicitFrameEffect) card.frameEffect = explicitFrameEffect;
  if (explicitAccent) card.accentColor = explicitAccent;
  if (explicitNameLine) card.nameLineColor = explicitNameLine;
  if (explicitTypeLine) card.typeLineColor = explicitTypeLine;
  if (explicitPtBox) card.ptBoxColor = explicitPtBox;
  return card;
}

/** Format a list as "Red", "Red and Blue", or "Red, Blue, and Green". */
function formatList(items: string[]): string {
  const capitalized = items.map(s => s.charAt(0).toUpperCase() + s.slice(1));
  if (capitalized.length <= 1) return capitalized[0] ?? '';
  if (capitalized.length === 2) return `${capitalized[0]} and ${capitalized[1]}`;
  return capitalized.slice(0, -1).join(', ') + ', and ' + capitalized[capitalized.length - 1];
}

/** Format CardData back into Crucible extended text format (reverse of parseCard). */
export function formatCard(card: CardData): string {
  const lines: string[] = [];

  // Line 1: Name {ManaCost}
  let nameLine = card.name ?? '';
  if (card.manaCost) nameLine += ` ${card.manaCost}`;
  lines.push(nameLine);
  if (card.colorIndicator && card.colorIndicator.length > 0) {
    lines.push(`Color Indicator: ${formatList(card.colorIndicator)}`);
  }

  // Type line
  lines.push(buildTypeLine(card));

  // Abilities
  const oracleText = getOracleText(card);
  if (oracleText) lines.push(oracleText);

  // Stats that go before abilities for pw/battle, after for creatures
  if (card.startingLoyalty) lines.push(`Loyalty: ${card.startingLoyalty}`);
  if (card.battleDefense) lines.push(`Defense: ${card.battleDefense}`);
  // P/T for creatures
  if (card.power && card.toughness) {
    lines.push(`${card.power}/${card.toughness}`);
  }

  if (card.rarity) {
    const rarityDisplay = card.rarity === 'mythic' ? 'Mythic Rare' : card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1);
    lines.push(`Rarity: ${rarityDisplay}`);
  }

  // Flavor text
  if (card.flavorText) {
    for (const fl of card.flavorText.split('\n')) {
      lines.push(`Flavor Text: ${fl}`);
    }
  }

  // Metadata lines
  if (card.artUrl) lines.push(`Art URL: ${card.artUrl}`);
  if (card.artDescription) lines.push(`Art Description: ${card.artDescription}`);
  if (card.artist) lines.push(`Artist: ${card.artist}`);
  if (card.setCode) lines.push(`Set: ${card.setCode}`);
  if (card.collectorNumber) lines.push(`Collector Number: ${card.collectorNumber}`);
  if (card.designer) lines.push(`Designer: ${card.designer}`);
  if (card.frameColor) {
    const frames = Array.isArray(card.frameColor) ? card.frameColor : [card.frameColor];
    lines.push(`Frame Color: ${formatList(frames)}`);
  }
  if (card.frameEffect) {
    const effects = Array.isArray(card.frameEffect) ? card.frameEffect : [card.frameEffect];
    if (effects.length > 0) {
      lines.push(`Frame Effect: ${formatList(effects)}`);
    }
  }
  if (card.accentColor) {
    const accents = Array.isArray(card.accentColor) ? card.accentColor : [card.accentColor];
    if (accents.length > 0) {
      lines.push(`Accent Color: ${formatList(accents)}`);
    }
  }
  if (card.nameLineColor) {
    const colors = Array.isArray(card.nameLineColor) ? card.nameLineColor : [card.nameLineColor];
    if (colors.length > 0) {
      lines.push(`Name Line Color: ${formatList(colors)}`);
    }
  }
  if (card.typeLineColor) {
    const colors = Array.isArray(card.typeLineColor) ? card.typeLineColor : [card.typeLineColor];
    if (colors.length > 0) {
      lines.push(`Type Line Color: ${formatList(colors)}`);
    }
  }
  if (card.ptBoxColor) {
    const colors = Array.isArray(card.ptBoxColor) ? card.ptBoxColor : [card.ptBoxColor];
    if (colors.length > 0) {
      lines.push(`PT Box Color: ${formatList(colors)}`);
    }
  }

  if (card.linkedCard) {
    lines.push(card.linkType ? `--${card.linkType}--` : '----');
    lines.push(formatCard(card.linkedCard));
  }

  return lines.join('\n');
}

// --- Scryfall conversion helpers ---

const COLOR_TO_LETTER: Record<Color, string> = {
  white: 'W',
  blue: 'U',
  black: 'B',
  red: 'R',
  green: 'G',
};

const MANA_COLOR_LETTERS = new Set(['W', 'U', 'B', 'R', 'G']);

/** Extract colors from a mana cost string like "{2}{U}{R}" */
function colorsFromManaCost(manaCost: string | undefined): string[] {
  if (!manaCost) return [];
  const colors: string[] = [];
  const symbols = manaCost.match(/\{([^}]+)\}/g) || [];
  for (const sym of symbols) {
    const inner = sym.slice(1, -1).toUpperCase();
    for (const ch of inner) {
      if (MANA_COLOR_LETTERS.has(ch) && !colors.includes(ch)) {
        colors.push(ch);
      }
    }
  }
  const order = ['W', 'U', 'B', 'R', 'G'];
  return colors.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** Calculate converted mana cost from a mana cost string */
function calcCmc(manaCost: string | undefined): number {
  if (!manaCost) return 0;
  let total = 0;
  const symbols = manaCost.match(/\{([^}]+)\}/g) || [];
  for (const sym of symbols) {
    const inner = sym.slice(1, -1).toUpperCase();
    if (inner === 'X') continue;
    const num = parseInt(inner, 10);
    if (!isNaN(num)) {
      total += num;
    } else {
      total += 1;
    }
  }
  return total;
}

/** Build the type line string like "Legendary Creature — Human Wizard" */
function buildTypeLine(card: CardData): string {
  const parts: string[] = [];
  if (card.supertypes) parts.push(...card.supertypes.map(s => s.charAt(0).toUpperCase() + s.slice(1)));
  if (card.types) parts.push(...card.types.map(t => t.charAt(0).toUpperCase() + t.slice(1)));
  let line = parts.join(' ');
  if (card.subtypes && card.subtypes.length > 0) {
    line += ' \u2014 ' + card.subtypes.join(' ');
  }
  return line;
}

export function getOracleText(card: CardData): string {
  if (!card.abilities) return '';
  if (typeof card.abilities === 'string') return card.abilities;
  return formatAbilities(card.abilities);
}

/** Map LinkType to Scryfall layout string */
function scryfallLayout(card: CardData): string {
  if (card.linkType) {
    switch (card.linkType) {
      case 'transform': return 'transform';
      case 'modal_dfc': return 'modal_dfc';
      case 'flip': return 'flip';
      case 'split': case 'fuse': return 'split';
      case 'adventure': return 'adventure';
      case 'aftermath': return 'aftermath';
    }
  }
  return 'normal';
}

/** Build a Scryfall-like card face object */
function buildScryfallFace(card: CardData): Record<string, any> {
  const face: Record<string, any> = {};
  face.name = card.name ?? '';
  if (card.manaCost) face.mana_cost = card.manaCost;
  face.type_line = buildTypeLine(card);

  const oracleText = getOracleText(card);
  if (oracleText) face.oracle_text = oracleText;

  if (card.power) face.power = card.power;
  if (card.toughness) face.toughness = card.toughness;
  if (card.startingLoyalty) face.loyalty = card.startingLoyalty;
  if (card.battleDefense) face.defense = card.battleDefense;
  if (card.flavorText) face.flavor_text = card.flavorText;
  if (card.artist) face.artist = card.artist;
  if (card.colorIndicator) {
    face.color_indicator = card.colorIndicator.map(c => COLOR_TO_LETTER[c]);
  }
  if (card.artUrl) {
    face.image_uris = { art_crop: card.artUrl };
  }

  const colors = card.colorIndicator
    ? card.colorIndicator.map(c => COLOR_TO_LETTER[c])
    : colorsFromManaCost(card.manaCost);
  face.colors = colors;

  return face;
}

/** Convert CardData to a Scryfall-compatible JSON string */
export function toScryfallJson(card: CardData): string {
  const obj: Record<string, any> = {};

  obj.layout = scryfallLayout(card);
  obj.name = card.name ?? '';

  if (card.linkedCard) {
    obj.name = `${card.name ?? ''} // ${card.linkedCard.name ?? ''}`;
    obj.card_faces = [buildScryfallFace(card), buildScryfallFace(card.linkedCard)];
  } else {
    Object.assign(obj, buildScryfallFace(card));
  }

  if (card.manaCost) obj.mana_cost = card.manaCost;
  obj.cmc = calcCmc(card.manaCost);
  obj.type_line = buildTypeLine(card);

  const colors = card.colorIndicator
    ? card.colorIndicator.map(c => COLOR_TO_LETTER[c])
    : colorsFromManaCost(card.manaCost);
  obj.colors = colors;
  obj.color_identity = colors;

  if (card.rarity) obj.rarity = card.rarity;
  if (card.setCode) obj.set = card.setCode.toLowerCase();
  if (card.collectorNumber) obj.collector_number = card.collectorNumber;

  return JSON.stringify(obj);
}

/** Format a single face as Scryfall spoiler text */
function formatScryfallFaceText(card: CardData): string {
  const lines: string[] = [];

  let nameLine = card.name ?? '';
  if (card.manaCost) nameLine += ` ${card.manaCost}`;
  lines.push(nameLine);

  lines.push(buildTypeLine(card));

  const oracleText = getOracleText(card);
  if (oracleText) lines.push(oracleText);

  if (card.power && card.toughness) {
    lines.push(`${card.power}/${card.toughness}`);
  } else if (card.startingLoyalty) {
    lines.push(`Loyalty: ${card.startingLoyalty}`);
  } else if (card.battleDefense) {
    lines.push(`Defense: ${card.battleDefense}`);
  }

  return lines.join('\n');
}

/** Convert CardData to Scryfall-style spoiler text */
export function toScryfallText(card: CardData): string {
  const parts = [formatScryfallFaceText(card)];
  if (card.linkedCard) {
    parts.push('----');
    parts.push(formatScryfallFaceText(card.linkedCard));
  }
  return parts.join('\n');
}

/** Compute rotation steps for card face presentation */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TEMPLATE_CONFIGS: Record<TemplateName, { layout: Record<string, any>; w: number; h: number; linkedLayout?: Record<string, any> }> = {
  standard:           { layout: STD_LAYOUT, w: STD_W, h: STD_H },
  planeswalker:       { layout: PW_LAYOUT, w: PW_W, h: PW_H },
  planeswalker_tall:  { layout: PW_TALL_LAYOUT, w: PW_W, h: PW_H },
  saga:               { layout: SAGA_LAYOUT, w: PW_W, h: PW_H },
  class:              { layout: CLASS_LAYOUT, w: PW_W, h: PW_H },
  battle:             { layout: BTL_LAYOUT, w: BTL_W, h: BTL_H },
  adventure:          { layout: ADV_LAYOUT, w: PW_W, h: PW_H },
  transform_front:    { layout: TF_FRONT_LAYOUT, w: PW_W, h: PW_H },
  transform_back:     { layout: TF_BACK_LAYOUT, w: PW_W, h: PW_H },
  mdfc_front:         { layout: MDFC_FRONT_LAYOUT, w: PW_W, h: PW_H },
  mdfc_back:          { layout: MDFC_BACK_LAYOUT, w: PW_W, h: PW_H },
  split:              { layout: SPLIT_RIGHT_LAYOUT, w: PW_W, h: PW_H, linkedLayout: SPLIT_LEFT_LAYOUT },
  fuse:               { layout: SPLIT_RIGHT_LAYOUT, w: PW_W, h: PW_H, linkedLayout: SPLIT_LEFT_LAYOUT },
  aftermath:          { layout: AFTERMATH_TOP_LAYOUT, w: PW_W, h: PW_H, linkedLayout: AFTERMATH_BOTTOM_LAYOUT },
  flip:               { layout: FLIP_LAYOUT, w: PW_W, h: PW_H },
  mutate:             { layout: MUTATE_LAYOUT, w: PW_W, h: PW_H },
  prototype:          { layout: PROTO_LAYOUT, w: PW_W, h: PW_H },
  leveler:            { layout: LEVELER_LAYOUT, w: PW_W, h: PW_H },
};

export function getParsedAbilities(card: CardData): ParsedAbilities {
  if (card.abilities && typeof card.abilities === 'object') return card.abilities;
  return {};
}

export function resolveTemplate(card: CardData): TemplateName {
  if (card.cardTemplate) return card.cardTemplate;
  const pa = getParsedAbilities(card);
  if (pa.structuredAbilities?.kind === 'planeswalker') {
    const pw = pa.structuredAbilities as PlaneswalkerAbilities;
    const totalAbilities = (pa.unstructuredAbilities?.length ?? 0) + pw.loyaltyAbilities.length;
    return totalAbilities >= 4 ? 'planeswalker_tall' : 'planeswalker';
  }
  if (pa.structuredAbilities?.kind === 'saga') return 'saga';
  if (pa.structuredAbilities?.kind === 'class') return 'class';
  if (card.battleDefense) return 'battle';
  if (card.linkType === 'adventure') return 'adventure';
  if (card.linkType === 'aftermath') return 'aftermath';
  if (card.linkType === 'fuse') return 'fuse';
  if (card.linkType === 'split') {
    const text = getOracleText(card) + (card.linkedCard ? '\n' + getOracleText(card.linkedCard) : '');
    return /\bFuse\b/.test(text) ? 'fuse' : 'split';
  }
  if (card.linkType === 'flip') return 'flip';
  if (pa.structuredAbilities?.kind === 'leveler') return 'leveler';
  if (pa.structuredAbilities?.kind === 'prototype') return 'prototype';
  if (pa.structuredAbilities?.kind === 'mutate') return 'mutate';
  return 'standard';
}

export function getArtDimensions(card: CardData, templateOverride?: TemplateName, linked?: boolean): { width: number; height: number } {
  const templateKey = templateOverride ?? resolveTemplate(card);
  const config = TEMPLATE_CONFIGS[templateKey] ?? TEMPLATE_CONFIGS.standard;
  const { w: cw, h: ch } = config;
  const L = (linked && config.linkedLayout) ? config.linkedLayout : config.layout;

  // Colorless and devoid frames are full-bleed — art fills the entire card
  const fc = Array.isArray(card.frameColor) ? card.frameColor[0] : card.frameColor;
  const fe = Array.isArray(card.frameEffect) ? card.frameEffect : card.frameEffect ? [card.frameEffect] : [];
  const isFullBleed = (fc === 'colorless' || fe.includes('devoid')) && templateKey === 'standard';
  if (isFullBleed) {
    return { width: 1500, height: 2100 };
  }

  const artW = Math.round(L.art.w * cw);
  const artH = Math.round(L.art.h * ch);
  // Rotated art: user supplies landscape, renderer rotates 90° into portrait box
  const ROTATED_TEMPLATES = new Set(['split', 'fuse']);
  if ((linked && templateKey === 'aftermath') || ROTATED_TEMPLATES.has(templateKey)) {
    return { width: artH, height: artW };
  }
  return { width: artW, height: artH };
}

export function inferLinkType(card: CardData): CardData['linkType'] {
  if (!card.linkedCard) return undefined;
  if (card.linkType) return card.linkType;

  const frontText = getOracleText(card);
  const backText = getOracleText(card.linkedCard);
  const bothHaveManaCost = !!card.manaCost && !!card.linkedCard.manaCost;
  const isSpell = (types?: Type[]) => !!types?.length && types.some(t => t === 'instant' || t === 'sorcery');

  if (bothHaveManaCost) {
    const fullText = frontText + '\n' + backText;
    if (/\bFuse\b/.test(fullText)) return 'fuse';
    if (/\bAftermath\b/.test(fullText)) return 'aftermath';
    if (isSpell(card.types) && isSpell(card.linkedCard.types)) return 'split';
    return 'modal_dfc';
  }
  // Battles always transform
  if (card.types?.includes('battle') || card.battleDefense) return 'transform';
  if (/\bflip\b/i.test(frontText)) return 'flip';
  const fullText = frontText + '\n' + backText;
  if (/\btransform\b/i.test(fullText)) return 'transform';
  return 'modal_dfc';
}

export function computeRotations(card: CardData): Rotation[] {
  const identity: Rotation = { x: 0, y: 0, z: 0 };

  if (!card.linkedCard || !card.linkType) {
    // Battles always get the 90° rotation even without a back face
    if (card.cardTemplate === 'battle') return [identity, { x: 0, y: 0, z: 90 }];
    return [identity];
  }

  switch (card.linkType) {
    case 'transform':
    case 'modal_dfc':
      // Battle transforms: rotate 90° then flip across y=x
      if (card.cardTemplate === 'battle') {
        return [identity, {x:0, y:0, z:90}, { x: 0, y: 180, z: 0 }];
      }
      return [identity, { x: 0, y: 180, z: 0 }];
    case 'flip':
      return [identity, { x: 0, y: 0, z: 180 }];
    case 'split':
    case 'fuse':
      return [identity, { x: 0, y: 0, z: 90 }];
    case 'aftermath':
      return [identity, { x: 0, y: 0, z: -90 }];
    default:
      return [identity];
  }
}
