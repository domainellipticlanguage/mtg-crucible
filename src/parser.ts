import type { CardData, AccentColor, Color, FrameColor, Rarity, Supertype, Type, ParsedAbilities, StructuredAbilities } from './types';

const MANA_COST_REGEX = /^(.+?)\s+((?:\{[^}]+\})+)$/;
const ART_REGEX = /^Art:\s*(https?:\/\/\S+)$/i;
const RARITY_REGEX = /^Rarity:\s*(common|uncommon|rare|mythic(?:\s+rare)?)$/i;
const ARTIST_REGEX = /^Artist:\s*(.+)$/i;
const SET_REGEX = /^Set:\s*([A-Za-z0-9]+)$/i;
const COLLECTOR_REGEX = /^Collector(?:\s+(?:Number|No\.?))?:\s*(.+)$/i;
const DESIGNER_REGEX = /^Designer:\s*(.+)$/i;
const COLOR_INDICATOR_REGEX = /^Color Indicator:\s*(.+)$/i;
const ACCENT_REGEX = /^Accent:\s*(.+)$/i;
const FRAME_REGEX = /^Frame:\s*(.+)$/i;
const PT_REGEX = /^([*\d+]+)\/([*\d+]+)$/;
const LOYALTY_REGEX = /^Loyalty:\s*(\S+)$/i;
const DEFENSE_REGEX = /^Defense:\s*(\S+)$/i;
const PW_ABILITY_REGEX = /^([+-]?\d+):\s*(.+)$/;
// TODO make this more general - any IVXL
const SAGA_CHAPTER_REGEX = /^((?:I{1,3}|IV|V|VI)(?:\s*,\s*(?:I{1,3}|IV|V|VI))*)\s*[—–-]\s*(.+)$/;
const CLASS_LEVEL_REGEX = /^((?:\{[^}]+\})+):\s*(Level\s+\d+)$/;
// TODO Use an explicit Flavor Text: instead
const FLAVOR_REGEX = /^\*(.+)\*$/;

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
  const tokens = raw
    .split(/[\s,\/]+/)
    .map(token => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return undefined;
  const colors: Color[] = [];
  for (const token of tokens) {
    const color = COLOR_ALIASES[token];
    if (color && !colors.includes(color)) colors.push(color);
  }
  return colors.length > 0 ? colors : undefined;
}

function isFlavorLine(line: string): boolean {
  const m = line.match(FLAVOR_REGEX);
  return m !== null && /[a-zA-Z]/.test(m[1]);
}

function romanToNumber(roman: string): number {
  switch (roman.trim()) {
    case 'I': return 1; case 'II': return 2; case 'III': return 3;
    case 'IV': return 4; case 'V': return 5; case 'VI': return 6;
    default: return parseInt(roman) || 0;
  }
}

function parseTypeLine(typeLine: string): { supertypes: Supertype[]; types: Type[]; subtypes: string[] } {
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
  const colors = extractManaColors(card.manaCost);
  const twoColors: Color[] | undefined = colors.size === 2 ? colorsInOrder(colors) : undefined;
  const isHybrid = twoColors !== undefined && hasHybridMana(card.manaCost, colors);

  // Mana-cost-derived accent (universal: 2 colors → array, 1 → scalar, 3+ → 'multicolor')
  const manaAccent = colorsToAccent(colors);

  // 1. Vehicle subtype
  if (card.subtypes?.some(s => s.toLowerCase() === 'vehicle')) return { frameColor: 'vehicle' };

  // 2. Land type — accent from produced colors, then colorIndicator fallback
  if (card.types?.includes('land')) {
    const produced = extractProducedColors(card.subtypes, card.abilitiesText);
    const landAccent = colorsToAccent(produced);
    if (landAccent) return { frameColor: 'land', accentColor: landAccent };
    if (manaAccent) return { frameColor: 'land', accentColor: manaAccent };
    if (card.colorIndicator?.length === 1) return { frameColor: 'land', accentColor: card.colorIndicator[0] };
    if (card.colorIndicator && card.colorIndicator.length > 1) return { frameColor: 'land', accentColor: 'multicolor' };
    return { frameColor: 'land' };
  }

  // 3. Artifact type
  if (card.types?.includes('artifact')) {
    return manaAccent
      ? { frameColor: 'artifact', accentColor: manaAccent }
      : { frameColor: 'artifact' };
  }

  // 4. Normal cards
  if (colors.size === 0) return { frameColor: 'artifact' };
  if (colors.size === 1) return { frameColor: MANA_COLOR_MAP[[...colors][0]] };
  if (isHybrid) return { frameColor: twoColors!, accentColor: twoColors };
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
        loyaltyAbilities.push({ cost: m[1], text: m[2] });
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
        if (reminderLines.length === 0 && abilityLines.length === 0 && /^\*\(.*\)\*$/.test(line.trim())) {
          reminderLines.push(line.trim().slice(1, -1));
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

export function parseCard(text: string): CardData {
  const lines = normalizeLines(text);

  if (lines.length < 2) {
    throw new Error('Card text must have at least a name line and type line');
  }

  // Line 1: Name and mana cost
  let name: string;
  let manaCost: string | undefined;
  const nameMatch = lines[0].match(MANA_COST_REGEX);
  if (nameMatch) {
    name = nameMatch[1].trim();
    manaCost = normalizeManaSymbols(nameMatch[2]);
  } else {
    name = lines[0];
  }

  // Optional metadata lines between name and type (Art:, Rarity:)
  let artUrl: string | undefined;
  let rarity: Rarity | undefined;
  let artist: string | undefined;
  let setCode: string | undefined;
  let collectorNumber: string | undefined;
  let designer: string | undefined;
  let colorIndicator: Color[] | undefined;
  let explicitAccent: AccentColor | AccentColor[] | undefined;
  let explicitFrame: FrameColor | FrameColor[] | undefined;
  let nextLine = 1;
  while (nextLine < lines.length) {
    const current = lines[nextLine];
    const artMatch = current.match(ART_REGEX);
    if (artMatch) { artUrl = artMatch[1]; nextLine++; continue; }
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
      const tokens = accentMatch[1].split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      if (tokens.length === 1) {
        const raw = tokens[0];
        if (raw === 'multicolor' || raw === 'multi' || raw === 'gold') {
          explicitAccent = 'multicolor';
        } else {
          const c = COLOR_ALIASES[raw];
          if (c) explicitAccent = c;
        }
      } else if (tokens.length > 1) {
        const parsed: AccentColor[] = [];
        for (const raw of tokens) {
          if (raw === 'multicolor' || raw === 'multi' || raw === 'gold') {
            parsed.push('multicolor');
          } else {
            const c = COLOR_ALIASES[raw];
            if (c) parsed.push(c);
          }
        }
        if (parsed.length > 0) explicitAccent = parsed;
      }
      nextLine++; continue;
    }
    const frameMatch = current.match(FRAME_REGEX);
    if (frameMatch) {
      const tokens = frameMatch[1].split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      const FRAME_ALIASES: Record<string, FrameColor> = {
        ...COLOR_ALIASES,
        artifact: 'artifact', a: 'artifact',
        multicolor: 'multicolor', multi: 'multicolor', gold: 'multicolor', m: 'multicolor',
        vehicle: 'vehicle', v: 'vehicle',
        land: 'land', l: 'land',
      };
      if (tokens.length === 1) {
        const fc = FRAME_ALIASES[tokens[0]];
        if (fc) explicitFrame = fc;
      } else if (tokens.length > 1) {
        const parsed: FrameColor[] = [];
        for (const raw of tokens) {
          const fc = FRAME_ALIASES[raw];
          if (fc) parsed.push(fc);
        }
        if (parsed.length > 0) explicitFrame = parsed;
      }
      nextLine++; continue;
    }
    if (/^[A-Za-z][A-Za-z0-9\/\s]+:\s*/.test(current)) { nextLine++; continue; }
    break;
  }

  // Type line
  const typeLine = lines[nextLine];
  const { supertypes, types, subtypes } = parseTypeLine(typeLine);
  let body = lines.slice(nextLine + 1);
  const lowerType = typeLine.toLowerCase();
  const { frameColor, accentColor } = deriveFrameColor({ subtypes, types, manaCost, colorIndicator, abilitiesText: body.join('\n') });

  // Determine ability kind from type line
  let kind: StructuredAbilities['kind'] | undefined;
  if (lowerType.includes('planeswalker')) kind = 'planeswalker';
  else if (lowerType.includes('class')) kind = 'class';
  else if (lowerType.includes('saga')) kind = 'saga';

  // Extract stats from body lines before parsing abilities
  let startingLoyalty: string | undefined;
  let battleDefense: string | undefined;
  let power: string | undefined;
  let toughness: string | undefined;
  let flavorText: string | undefined;

  // Planeswalker: extract Loyalty: N
  if (kind === 'planeswalker') {
    const filtered: string[] = [];
    for (const line of body) {
      const m = line.match(LOYALTY_REGEX);
      if (m) { startingLoyalty = m[1]; }
      else filtered.push(line);
    }
    body = filtered;
    if (!startingLoyalty) startingLoyalty = '0';
  }

  // Battle: extract Defense: N
  if (lowerType.includes('battle')) {
    const filtered: string[] = [];
    for (const line of body) {
      const m = line.match(DEFENSE_REGEX);
      if (m) { battleDefense = m[1]; }
      else filtered.push(line);
    }
    body = filtered;
    if (!battleDefense) battleDefense = '0';
  }

  // Standard cards: extract trailing flavor text (*...*) and P/T
  if (!kind && !lowerType.includes('battle')) {
    // Flavor text: trailing *...* lines
    let flavorStart = body.length;
    while (flavorStart > 0 && isFlavorLine(body[flavorStart - 1])) {
      flavorStart--;
    }
    if (flavorStart < body.length) {
      const flavorLines = body.slice(flavorStart);
      body = body.slice(0, flavorStart);
      flavorText = flavorLines.map(l => l.match(FLAVOR_REGEX)![1]).join('\n');
    }

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
  const card: CardData = { name, frameColor };
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
  card.rarity = rarity ?? 'rare';
  if (artist) card.artist = artist;
  if (setCode) card.setCode = setCode;
  if (collectorNumber) card.collectorNumber = collectorNumber;
  if (designer) card.designer = designer;
  if (colorIndicator && colorIndicator.length > 0) card.colorIndicator = colorIndicator;
  if (explicitFrame) card.frameColor = explicitFrame;
  if (explicitAccent) card.accentColor = explicitAccent;
  else if (accentColor) card.accentColor = accentColor;
  return card;
}
