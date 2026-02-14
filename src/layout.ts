import * as path from 'path';

export const ASSETS_DIR = path.resolve(__dirname, '..', 'assets');

export const FONT_HEIGHT_RATIO = 0.7;

// Standard card: 2010x2814
export const STD_W = 2010;
export const STD_H = 2814;

// Planeswalker / Saga: 1500x2100
export const PW_W = 1500;
export const PW_H = 2100;

// Battle: 2814x2010 (landscape)
export const BTL_W = 2814;
export const BTL_H = 2010;

// Standard layout (packM15RegularNew.js)
export const STD_LAYOUT = {
  art:       { x: 0.0767, y: 0.1129, w: 0.8476, h: 0.4429 },
  name:      { x: 168/2010, y: 145/2814, w: 0.8292, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 176/2814, w: 1864/2010, size: 70.5/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 168/2010, y: 1588/2814, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  rules:     { x: 0.086, y: 1780/2814, w: 0.828, h: 0.2875, size: 0.0362, font: 'MPlantin' },
  pt:        { x: 0.7928, y: 0.902, w: 0.1367, h: 0.0372, size: 0.0372, font: 'Beleren Bold SmCaps' },
  ptBox:     { x: 0.7573, y: 0.8848, w: 0.188, h: 0.0733 },
  setSymbol: { x: 1862/2010, y: 0.5910, w: 0.12, h: 0.0410 },
  crown:     { x: 44/2010, y: 53/2814, w: 1922/2010, h: 493/2814 },
};

// Planeswalker layout (packPlaneswalkerRegular.js)
export const PW_LAYOUT = {
  art:       { x: 0.0767, y: 0.1129, w: 0.8476, h: 0.4429 },
  name:      { x: 0.0867, y: 0.0372, w: 0.8267, h: 0.0548, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0481, w: 0.9292, size: 71/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.0867, y: 0.5625, w: 0.8267, h: 0.0548, size: 0.0324, font: 'Beleren Bold' },
  ability:   { x: 0.18, y: 0.6239, w: 0.7467, h: 0.0972, size: 0.0353, font: 'MPlantin' },
  loyalty:   { x: 0.806, y: 0.902, w: 0.14, h: 0.0372, size: 0.0372, font: 'Beleren Bold SmCaps' },
  abilityIconY: {
    1: [0.7467],
    2: [0.6953, 0.822],
    3: [0.6639, 0.7467, 0.8362],
    4: [0.6505, 0.72, 0.7905, 0.861],
  } as Record<number, number[]>,
  plusIcon:    { x: 0.0294, yOff: -0.0258, w: 0.14, h: 0.0724 },
  minusIcon:  { x: 0.028, yOff: -0.0153, w: 0.1414, h: 0.0705 },
  neutralIcon:{ x: 0.028, yOff: -0.0153, w: 0.1414, h: 0.061 },
  iconTextX:  0.1027,
  iconTextSize: 0.0286,
  abilityBox: { x: 0.1167, w: 0.8094 },
  totalAbilityH: 0.2916,
};

// Saga layout (packSagaRegular.js)
export const SAGA_LAYOUT = {
  art:       { x: 0.5, y: 0.1124, w: 0.4247, h: 0.7253 },
  name:      { x: 0.0854, y: 0.0522, w: 0.8292, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0613, w: 0.9292, size: 71/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.0854, y: 0.8481, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  ability:   { x: 0.1334, y: 0.2896, w: 0.35, h: 0.1786, size: 0.0305, font: 'MPlantin' },
  saga:      { x: 0.1, w: 0.3947 },
  chapter:   { w: 0.0787, h: 0.0629, textOffX: 0.0394, textOffY: 0.0429, xOff: -0.0614 },
  divider:   { h: 0.0029 },
  chapterSpread: 0.0358,
  chapterFont: 0.0324,
};

// Battle layout (packBattle.js)
export const BTL_LAYOUT = {
  art:     { x: 167/2100, y: 60/1500, w: 1873/2100, h: 1371/1500 },
  name:    { x: 387/2100, y: 81/1500, w: 1547/2100, h: 114/1500, size: (0.0381*2100)/1500, font: 'Beleren Bold' },
  mana:    { y: 100/1500, w: 1957/2100, size: ((71/1638)*2100)/1500, shadowX: -0.001, shadowY: 0.0029 },
  type:    { x: 268/2100, y: 873/1500, w: 1667/2100, h: 114/1500, size: (0.0324*2100)/1500, font: 'Beleren Bold' },
  rules:   { x: 272/2100, y: 1008/1500, w: 1661/2100, h: 414/1500, size: (0.0362*2100)/1500, font: 'MPlantin' },
  defense: { x: 1920/2100, y: 1320/1500, w: 86/2100, h: 123/1500, size: (0.0372*2100)/1500, font: 'Beleren Bold SmCaps' },
};
