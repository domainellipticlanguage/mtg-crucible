import type { CardData, FrameColor, Supertype, Type } from './types';

const MANA_COST_REGEX = /^(.+?)\s+((?:\{[^}]+\})+)$/;
const ART_REGEX = /^Art:\s*(https?:\/\/\S+)$/i;
const RARITY_REGEX = /^Rarity:\s*(common|uncommon|rare|mythic(?:\s+rare)?)$/i;
const PT_REGEX = /^([*\d+]+)\/([*\d+]+)$/;
const LOYALTY_REGEX = /^Loyalty:\s*(\S+)$/i;
const DEFENSE_REGEX = /^Defense:\s*(\S+)$/i;
const PW_ABILITY_REGEX = /^([+-]?\d+):\s*(.+)$/;
const SAGA_CHAPTER_REGEX = /^((?:I{1,3}|IV|V|VI)(?:\s*,\s*(?:I{1,3}|IV|V|VI))*)\s*[—–-]\s*(.+)$/;
const CLASS_LEVEL_REGEX = /^((?:\{[^}]+\})+):\s*(Level\s+\d+)$/;
const FLAVOR_REGEX = /^\*(.+)\*$/;

const SUPERTYPES = new Set<string>(['legendary', 'basic', 'snow', 'world']);
const TYPES = new Set<string>(['creature', 'instant', 'sorcery', 'enchantment', 'artifact', 'planeswalker', 'land', 'battle']);

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
  const [left, right] = typeLine.split(/\s*[—–]\s*/);
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

function deriveFrameColor(manaCost: string | undefined, typeLine: string): FrameColor {
  const lower = typeLine.toLowerCase();
  if (lower.includes('vehicle')) return 'vehicle';
  if (lower.includes('land') && !manaCost) return 'land';

  const colors = new Set<string>();
  const symbols = manaCost?.match(/\{([^}]+)\}/g) || [];
  for (const sym of symbols) {
    const inner = sym.slice(1, -1).toUpperCase();
    for (const c of ['W', 'U', 'B', 'R', 'G']) {
      if (inner.includes(c)) colors.add(c);
    }
  }

  if (colors.size === 0) return 'artifact';
  if (colors.size === 1) {
    const c = [...colors][0];
    const map: Record<string, FrameColor> = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green' };
    return map[c];
  }
  return 'multicolor';
}

export function parseCard(text: string): CardData {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length < 2) {
    throw new Error('Card text must have at least a name line and type line');
  }

  // Line 1: Name and mana cost
  let name: string;
  let manaCost: string | undefined;
  const nameMatch = lines[0].match(MANA_COST_REGEX);
  if (nameMatch) {
    name = nameMatch[1].trim();
    manaCost = nameMatch[2];
  } else {
    name = lines[0];
  }

  // Optional metadata lines between name and type (Art:, Rarity:)
  let artUrl: string | undefined;
  let rarity: 'common' | 'uncommon' | 'rare' | 'mythic' | undefined;
  let nextLine = 1;
  while (nextLine < lines.length) {
    const artMatch = lines[nextLine].match(ART_REGEX);
    if (artMatch) { artUrl = artMatch[1]; nextLine++; continue; }
    const rarityMatch = lines[nextLine].match(RARITY_REGEX);
    if (rarityMatch) {
      const raw = rarityMatch[1].toLowerCase();
      rarity = (raw === 'mythic rare' ? 'mythic' : raw) as typeof rarity;
      nextLine++; continue;
    }
    break;
  }

  // Type line
  const typeLine = lines[nextLine];
  const { supertypes, types, subtypes } = parseTypeLine(typeLine);
  const frameColor = deriveFrameColor(manaCost, typeLine);

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
  const classLevels: { level: number; cost: string; text: string }[] = [];
  let currentCost = '';
  let currentLevel = 1;
  let currentTextLines: string[] = [];

  for (const line of bodyLines) {
    const levelMatch = line.match(CLASS_LEVEL_REGEX);
    if (levelMatch) {
      // Flush previous level
      classLevels.push({ level: currentLevel, cost: currentCost, text: currentTextLines.join('\n') });
      currentCost = levelMatch[1];
      currentLevel = parseInt(levelMatch[2].replace(/\D/g, '')) || currentLevel + 1;
      currentTextLines = [];
    } else {
      currentTextLines.push(line);
    }
  }

  // Flush final level
  classLevels.push({ level: currentLevel, cost: currentCost, text: currentTextLines.join('\n') });

  // Extract reminder text from level 1 — lines wrapped in *(...)* are italic reminder text
  let unstructuredAbilities: string | undefined;
  if (classLevels.length > 0) {
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
