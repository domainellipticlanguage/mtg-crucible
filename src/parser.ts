import type { CardData, AccentColor, Color, FrameColor, Rarity, Supertype, Type } from './types';

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
const SAGA_CHAPTER_REGEX = /^((?:I{1,3}|IV|V|VI)(?:\s*,\s*(?:I{1,3}|IV|V|VI))*)\s*[—–-]\s*(.+)$/;
const CLASS_LEVEL_REGEX = /^((?:\{[^}]+\})+):\s*(Level\s+\d+)$/;
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

function extractManaColors(manaCost: string | undefined): Set<string> {
  const colors = new Set<string>();
  const symbols = manaCost?.match(/\{([^}]+)\}/g) || [];
  for (const sym of symbols) {
    const inner = sym.slice(1, -1).toUpperCase();
    for (const c of ['W', 'U', 'B', 'R', 'G']) {
      if (inner.includes(c)) colors.add(c);
    }
  }
  return colors;
}

function colorsToFrameColor(colors: Set<string>): { frameColor: FrameColor; accentColor?: AccentColor } {
  if (colors.size === 0) return { frameColor: 'artifact' };
  if (colors.size === 1) return { frameColor: MANA_COLOR_MAP[[...colors][0]] };
  return { frameColor: 'multicolor' };
}

export function deriveFrameColor(card: Pick<CardData, 'subtypes' | 'types' | 'manaCost' | 'colorIndicator'>): { frameColor: FrameColor; accentColor?: AccentColor } {
  if (card.subtypes?.some(s => s.toLowerCase() === 'vehicle')) return { frameColor: 'vehicle' };

  // Land with no mana cost — land frame always wins, colorIndicator becomes accent
  if (card.types?.includes('land') && !card.manaCost) {
    if (card.colorIndicator && card.colorIndicator.length === 1) {
      return { frameColor: 'land', accentColor: card.colorIndicator[0] };
    }
    if (card.colorIndicator && card.colorIndicator.length > 1) {
      return { frameColor: 'land', accentColor: 'multicolor' };
    }
    return { frameColor: 'land' };
  }

  const colors = extractManaColors(card.manaCost);

  // Artifact type — use artifact frame with color accent
  if (card.types?.includes('artifact')) {
    if (colors.size === 0) return { frameColor: 'artifact' };
    if (colors.size === 1) return { frameColor: 'artifact', accentColor: MANA_COLOR_MAP[[...colors][0]] };
    return { frameColor: 'artifact', accentColor: 'multicolor' };
  }

  return colorsToFrameColor(colors);
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
      rarity = (raw === 'mythic rare' ? 'mythic' : raw) as typeof rarity;
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
  const { frameColor, accentColor } = deriveFrameColor({ subtypes, types, manaCost, colorIndicator });

  // Remaining lines: body
  const bodyLines = lines.slice(nextLine + 1);
  const lowerType = typeLine.toLowerCase();

  let card: CardData;
  if (lowerType.includes('planeswalker')) {
    card = parsePlaneswalker(name, manaCost, supertypes, types, subtypes, frameColor, bodyLines);
  } else if (lowerType.includes('class')) {
    card = parseClass(name, manaCost, supertypes, types, subtypes, frameColor, bodyLines);
  } else if (lowerType.includes('saga')) {
    card = parseSaga(name, manaCost, supertypes, types, subtypes, frameColor, bodyLines);
  } else if (lowerType.includes('battle')) {
    card = parseBattle(name, manaCost, types, subtypes, frameColor, bodyLines);
  } else {
    card = parseStandard(name, manaCost, supertypes, types, subtypes, typeLine, frameColor, bodyLines);
  }

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

function parseStandard(
  name: string, manaCost: string | undefined,
  supertypes: Supertype[], types: Type[], subtypes: string[],
  typeLine: string, frameColor: FrameColor, bodyLines: string[],
): CardData {
  let power: string | undefined;
  let toughness: string | undefined;
  let oracleText: string | undefined;
  let flavorText: string | undefined;
  let lines = [...bodyLines];

  // Scan from end: consecutive *...*-wrapped lines are flavor text
  let flavorStart = lines.length;
  while (flavorStart > 0 && isFlavorLine(lines[flavorStart - 1])) {
    flavorStart--;
  }
  const flavorLines = lines.slice(flavorStart);
  lines = lines.slice(0, flavorStart);

  // Only check P/T if type line suggests a creature/vehicle
  const lowerType = typeLine.toLowerCase();
  if ((lowerType.includes('creature') || lowerType.includes('vehicle')) && lines.length > 0) {
    const ptMatch = lines[lines.length - 1].match(PT_REGEX);
    if (ptMatch) {
      power = ptMatch[1];
      toughness = ptMatch[2];
      lines = lines.slice(0, -1);
    }
  }

  const rulesLines = lines;
  if (rulesLines.length > 0) oracleText = rulesLines.join('\n');
  if (flavorLines.length > 0) {
    flavorText = flavorLines.map(l => l.match(FLAVOR_REGEX)![1]).join('\n');
  }

  const card: CardData = { name, frameColor };
  if (supertypes.length > 0) card.supertypes = supertypes;
  if (types.length > 0) card.types = types;
  if (subtypes.length > 0) card.subtypes = subtypes;
  if (manaCost) card.manaCost = manaCost;
  if (oracleText) card.oracleText = oracleText;
  if (flavorText) card.flavorText = flavorText;
  if (power !== undefined) card.power = power;
  if (toughness !== undefined) card.toughness = toughness;
  return card;
}

function parsePlaneswalker(
  name: string, manaCost: string | undefined,
  supertypes: Supertype[], types: Type[], subtypes: string[],
  frameColor: FrameColor, bodyLines: string[],
): CardData {
  const loyaltyAbilities: { cost: string; text: string }[] = [];
  let startingLoyalty = '0';

  for (const line of bodyLines) {
    const loyaltyMatch = line.match(LOYALTY_REGEX);
    if (loyaltyMatch) { startingLoyalty = loyaltyMatch[1]; continue; }

    const abilityMatch = line.match(PW_ABILITY_REGEX);
    if (abilityMatch) {
      loyaltyAbilities.push({ cost: abilityMatch[1], text: abilityMatch[2] });
    } else {
      loyaltyAbilities.push({ cost: '', text: line });
    }
  }

  const card: CardData = {
    name, frameColor, startingLoyalty,
    structuredAbilities: { kind: 'planeswalker', loyaltyAbilities },
  };
  if (supertypes.length > 0) card.supertypes = supertypes;
  if (types.length > 0) card.types = types;
  if (subtypes.length > 0) card.subtypes = subtypes;
  if (manaCost) card.manaCost = manaCost;
  return card;
}

function parseSaga(
  name: string, manaCost: string | undefined,
  supertypes: Supertype[], types: Type[], subtypes: string[],
  frameColor: FrameColor, bodyLines: string[],
): CardData {
  const chapters: { chapterNumbers: number[]; text: string }[] = [];

  for (const line of bodyLines) {
    const chapterMatch = line.match(SAGA_CHAPTER_REGEX);
    if (chapterMatch) {
      const chapterNumbers = chapterMatch[1].split(',').map(r => romanToNumber(r.trim()));
      chapters.push({ chapterNumbers, text: chapterMatch[2].trim() });
    }
  }

  const card: CardData = {
    name, frameColor,
    structuredAbilities: { kind: 'saga', chapters },
  };
  if (supertypes.length > 0) card.supertypes = supertypes;
  if (types.length > 0) card.types = types;
  if (subtypes.length > 0) card.subtypes = subtypes;
  if (manaCost) card.manaCost = manaCost;
  return card;
}

function parseBattle(
  name: string, manaCost: string | undefined,
  types: Type[], subtypes: string[],
  frameColor: FrameColor, bodyLines: string[],
): CardData {
  let battleDefense = '0';
  const rulesLines: string[] = [];

  for (const line of bodyLines) {
    const defenseMatch = line.match(DEFENSE_REGEX);
    if (defenseMatch) { battleDefense = defenseMatch[1]; continue; }
    rulesLines.push(line);
  }

  const card: CardData = { name, frameColor, battleDefense };
  if (types.length > 0) card.types = types;
  if (subtypes.length > 0) card.subtypes = subtypes;
  if (manaCost) card.manaCost = manaCost;
  if (rulesLines.length > 0) card.oracleText = rulesLines.join('\n');
  return card;
}

function parseClass(
  name: string, manaCost: string | undefined,
  supertypes: Supertype[], types: Type[], subtypes: string[],
  frameColor: FrameColor, bodyLines: string[],
): CardData {
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

  for (const line of bodyLines) {
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

  if (haveExplicitLevel || pending.textLines.length > 0) {
    pushPending();
  }

  // Extract reminder text from level 1 — lines wrapped in *(...)* are italic reminder text
  let unstructuredAbilities: string | undefined;
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
      unstructuredAbilities = reminderLines.join('\n');
      classLevels[0].text = abilityLines.join('\n');
    }
  }

  const card: CardData = {
    name, frameColor,
    structuredAbilities: { kind: 'class', classLevels },
  };
  if (supertypes.length > 0) card.supertypes = supertypes;
  if (types.length > 0) card.types = types;
  if (subtypes.length > 0) card.subtypes = subtypes;
  if (manaCost) card.manaCost = manaCost;
  if (unstructuredAbilities) card.unstructuredAbilities = unstructuredAbilities;
  return card;
}
