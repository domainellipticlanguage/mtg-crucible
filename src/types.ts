export interface CardData {
  name: string;
  manaCost?: string;
  typeLine: string;
  rulesText?: string;
  flavorText?: string;
  power?: string;
  toughness?: string;
  frameColor: string;
  artUrl?: string;
  rarity?: 'common' | 'uncommon' | 'rare' | 'mythic';
  artist?: string;
  collectorNumber?: string;
  setCode?: string;
  isLegendary?: boolean;
}

export interface PlaneswalkerData extends CardData {
  abilities: { cost: string; text: string }[];
  startingLoyalty: string;
}

export interface SagaData extends CardData {
  chapters: { count: number; text: string }[];
}

export interface BattleData extends CardData {
  defense: string;
}

export type RichToken =
  | { type: 'text'; value: string }
  | { type: 'symbol'; value: string };

export type CardInput = CardData | PlaneswalkerData | SagaData | BattleData;
