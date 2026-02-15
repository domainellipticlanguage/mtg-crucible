import type { CardData, PlaneswalkerData, SagaData, BattleData, CardInput } from './types';

const MANA_COST_REGEX = /^(.+?)\s+((?:\{[^}]+\})+)$/;
const PT_REGEX = /^([*\d+]+)\/([*\d+]+)$/;
const LOYALTY_REGEX = /^Loyalty:\s*(\S+)$/i;
const DEFENSE_REGEX = /^Defense:\s*(\S+)$/i;
const PW_ABILITY_REGEX = /^([+-]?\d+):\s*(.+)$/;
const SAGA_CHAPTER_REGEX = /^((?:I{1,3}|IV|V|VI)(?:\s*,\s*(?:I{1,3}|IV|V|VI))*)\s*[—–-]\s*(.+)$/;
const FLAVOR_SEPARATOR = '---';

function deriveFrameColor(manaCost: string | undefined, typeLine: string): string {
  const lower = typeLine.toLowerCase();
  if (lower.includes('vehicle')) return 'v';
  if (lower.includes('land') && !manaCost) return 'l';

  const colors = new Set<string>();
  const symbols = manaCost?.match(/\{([^}]+)\}/g) || [];
  for (const sym of symbols) {
    const inner = sym.slice(1, -1).toUpperCase();
    for (const c of ['W', 'U', 'B', 'R', 'G']) {
      if (inner.includes(c)) colors.add(c.toLowerCase());
    }
  }

  if (colors.size === 0) return 'a';
  if (colors.size === 1) return [...colors][0];
  return 'm';
}

export function parseCard(text: string): CardInput {
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

  // Line 2: Type line
  const typeLine = lines[1];
  const isLegendary = typeLine.toLowerCase().includes('legendary');
  const frameColor = deriveFrameColor(manaCost, typeLine);

  // Remaining lines: body
  const bodyLines = lines.slice(2);
  const lowerType = typeLine.toLowerCase();

  if (lowerType.includes('planeswalker')) {
    return parsePlaneswalker(name, manaCost, typeLine, isLegendary, frameColor, bodyLines);
  }
  if (lowerType.includes('saga')) {
    return parseSaga(name, manaCost, typeLine, isLegendary, frameColor, bodyLines);
  }
  if (lowerType.includes('battle')) {
    return parseBattle(name, manaCost, typeLine, frameColor, bodyLines);
  }
  return parseStandard(name, manaCost, typeLine, isLegendary, frameColor, bodyLines);
}

function parseStandard(
  name: string, manaCost: string | undefined, typeLine: string,
  isLegendary: boolean, frameColor: string, bodyLines: string[],
): CardData {
  let power: string | undefined;
  let toughness: string | undefined;
  let rulesText: string | undefined;
  let flavorText: string | undefined;
  let lines = [...bodyLines];

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

  // Check for flavor separator
  const sepIdx = lines.indexOf(FLAVOR_SEPARATOR);
  if (sepIdx !== -1) {
    const rulesLines = lines.slice(0, sepIdx);
    const flavorLines = lines.slice(sepIdx + 1);
    if (rulesLines.length > 0) rulesText = rulesLines.join('\n');
    if (flavorLines.length > 0) flavorText = flavorLines.join('\n');
  } else if (lines.length > 0) {
    rulesText = lines.join('\n');
  }

  const card: CardData = { name, typeLine, frameColor };
  if (manaCost) card.manaCost = manaCost;
  if (isLegendary) card.isLegendary = true;
  if (rulesText) card.rulesText = rulesText;
  if (flavorText) card.flavorText = flavorText;
  if (power !== undefined) card.power = power;
  if (toughness !== undefined) card.toughness = toughness;
  return card;
}

function parsePlaneswalker(
  name: string, manaCost: string | undefined, typeLine: string,
  isLegendary: boolean, frameColor: string, bodyLines: string[],
): PlaneswalkerData {
  const abilities: { cost: string; text: string }[] = [];
  let startingLoyalty = '0';

  for (const line of bodyLines) {
    const loyaltyMatch = line.match(LOYALTY_REGEX);
    if (loyaltyMatch) { startingLoyalty = loyaltyMatch[1]; continue; }

    const abilityMatch = line.match(PW_ABILITY_REGEX);
    if (abilityMatch) {
      abilities.push({ cost: abilityMatch[1], text: abilityMatch[2] });
    } else {
      // Static ability — empty cost
      abilities.push({ cost: '', text: line });
    }
  }

  const card: PlaneswalkerData = { name, typeLine, frameColor, startingLoyalty, abilities };
  if (manaCost) card.manaCost = manaCost;
  if (isLegendary) card.isLegendary = true;
  return card;
}

function parseSaga(
  name: string, manaCost: string | undefined, typeLine: string,
  isLegendary: boolean, frameColor: string, bodyLines: string[],
): SagaData {
  const chapters: { count: number; text: string }[] = [];

  for (const line of bodyLines) {
    const chapterMatch = line.match(SAGA_CHAPTER_REGEX);
    if (chapterMatch) {
      const count = chapterMatch[1].split(',').length;
      chapters.push({ count, text: chapterMatch[2].trim() });
    }
  }

  const card: SagaData = { name, typeLine, frameColor, chapters };
  if (manaCost) card.manaCost = manaCost;
  if (isLegendary) card.isLegendary = true;
  return card;
}

function parseBattle(
  name: string, manaCost: string | undefined, typeLine: string,
  frameColor: string, bodyLines: string[],
): BattleData {
  let defense = '0';
  const rulesLines: string[] = [];

  for (const line of bodyLines) {
    const defenseMatch = line.match(DEFENSE_REGEX);
    if (defenseMatch) { defense = defenseMatch[1]; continue; }
    rulesLines.push(line);
  }

  const card: BattleData = { name, typeLine, frameColor, defense };
  if (manaCost) card.manaCost = manaCost;
  if (rulesLines.length > 0) card.rulesText = rulesLines.join('\n');
  return card;
}
