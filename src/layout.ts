import * as path from 'path';

export const ASSETS_DIR = process.env.ASSETS_DIR
  ? path.resolve(process.env.ASSETS_DIR)
  : path.resolve(__dirname, '..', 'assets');

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
  art:       { x: 154/2010, y: 318/2814, w: 1704/2010, h: 1246/2814 },
  name:      { x: 168/2010, y: 145/2814, w: 0.8292, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 176/2814, w: 1864/2010, size: 70.5/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 168/2010, y: 1588/2814, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  rules:     { x: 0.086, y: 1780/2814, w: 0.828, h: 0.2875, size: 0.0362, font: 'MPlantin' },
  pt:        { x: 0.7928, y: 0.902, w: 0.1367, h: 0.0372, size: 0.0372, font: 'Beleren Bold SmCaps' },
  ptBox:     { x: 0.7573, y: 0.8848, w: 0.188, h: 0.0733 },
  setSymbol: { x: 1862/2010, y: 0.5910, w: 0.12, h: 0.0700 },
  crown:     { x: 44/2010, y: 53/2814, w: 1922/2010, h: 493/2814 },
};

// Planeswalker layout (packPlaneswalkerRegular.js)
export const PW_LAYOUT = {
  art:       { x: 100/1500, y: 208/2100, w: 1298/1500, h: 1716/2100 },
  name:      { x: 0.0867, y: 0.0372, w: 0.8267, h: 0.0548, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0481, w: 0.9292, size: 71/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.0867, y: 0.5625, w: 0.8267, h: 0.0548, size: 0.0324, font: 'Beleren Bold' },
  ability:   { x: 0.18, y: 0.6239, w: 0.7467, h: 0.0972, size: 0.0284, font: 'MPlantin' },
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
  crown:     { x: 44/2010, y: 53/2814, w: 1922/2010, h: 493/2814 },
  setSymbol: { x: 0.9227, y: 0.5899, w: 0.12, h: 0.0700 },
};

// Planeswalker Tall layout (packPlaneswalkerTall.js)
export const PW_TALL_LAYOUT = {
  art:       { x: 115/1500, y: 105/2100, w: 1271/1500, h: 1673/2100 },
  name:      { x: 0.0867, y: 0.0372, w: 0.8267, h: 0.0548, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0481, w: 0.9292, size: 71/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.0867, y: 0.4967, w: 0.8267, h: 0.0548, size: 0.0324, font: 'Beleren Bold' },
  ability:   { x: 0.18, y: 0.5581, w: 0.7467, h: 0.0896, size: 0.0260, font: 'MPlantin' },
  loyalty:   { x: 0.806, y: 0.902, w: 0.14, h: 0.0372, size: 0.0372, font: 'Beleren Bold SmCaps' },
  abilityIconY: {
    1: [0.72],
    2: [0.6391, 0.801],
    3: [0.5986, 0.72, 0.8415],
    4: [0.5986, 0.6796, 0.7605, 0.8415],
  } as Record<number, number[]>,
  plusIcon:    { x: 0.0294, yOff: -0.0258, w: 0.14, h: 0.0724 },
  minusIcon:  { x: 0.028, yOff: -0.0153, w: 0.1414, h: 0.0705 },
  neutralIcon:{ x: 0.028, yOff: -0.0153, w: 0.1414, h: 0.061 },
  iconTextX:  0.1027,
  iconTextSize: 0.0286,
  abilityBox: { x: 0.1167, w: 0.8094 },
  totalAbilityH: 0.3574,
  crown:     { x: 44/2010, y: 53/2814, w: 1922/2010, h: 493/2814 },
  setSymbol: { x: 0.9227, y: 0.5234, w: 0.12, h: 0.0700 },
};

// Saga layout (packSagaRegular.js)
export const SAGA_LAYOUT = {
  art:       { x: 750/1500, y: 236/2100, w: 637/1500, h: 1523/2100 },
  name:      { x: 0.0854, y: 0.0522, w: 0.8292, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0613, w: 0.9292, size: 71/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.0854, y: 0.8481, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  ability:   { x: 0.1334, y: 0.14, w: 0.35, h: 0.1786, size: 0.0305, font: 'MPlantin' },
  saga:      { x: 0.1, w: 0.3947 },
  chapter:   { w: 0.0787, h: 0.0629, textOffX: 0.0394, textOffY: 0.0429, xOff: -0.0614 },
  divider:   { h: 0.0029 },
  chapterSpread: 0.0358,
  chapterFont: 0.0324,
  crown:     { x: 44/2010, y: 53/2814, w: 1922/2010, h: 493/2814 },
  setSymbol: { x: 0.9227, y: 0.8753, w: 0.12, h: 0.0700 },
};

// Class layout (packClass.js)
export const CLASS_LAYOUT = {
  art:       { x: 113/1500, y: 236/2100, w: 637/1500, h: 1523/2100 },
  name:      { x: 0.0854, y: 0.0522, w: 0.8292, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0613, w: 0.9292, size: 71/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.0854, y: 0.8481, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  level:     { x: 0.5093, y: 0.1129, w: 0.404, size: 0.0305 },
  levelCost: { size: 0.0277 },
  levelName: { size: 0.0281 },
  headerGap: 0.0481,
  maxY:      0.8368,
  setSymbol: { x: 0.9227, y: 0.8739, w: 0.12, h: 0.0700 },
  crown:     { x: 44/2010, y: 53/2814, w: 1922/2010, h: 493/2814 },
};

// Adventure layout (packAdventure.js)
// Uses PW canvas size (1500x2100) — same as the adventure frame images.
export const ADV_LAYOUT = {
  art:       { x: 115/1500, y: 237/2100, w: 1271/1500, h: 930/2100 },
  name:      { x: 0.0854, y: 0.0522, w: 0.8292, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0613, w: 0.9292, size: 71/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.0854, y: 0.5664, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  // Main creature rules (right side of the "book")
  rules:     { x: 0.5267, y: 0.65, w: 0.3867, h: 0.2358, size: 0.0353, font: 'MPlantin' },
  pt:        { x: 0.7928, y: 0.902, w: 0.1367, h: 0.0372, size: 0.0372, font: 'Beleren Bold SmCaps' },
  ptBox:     { x: 0.7573, y: 0.8848, w: 0.188, h: 0.0733 },
  setSymbol: { x: 0.9213, y: 0.5910, w: 0.12, h: 0.0700 },
  crown:     { x: 44/2010, y: 53/2814, w: 1922/2010, h: 493/2814 },
  // Adventure-specific areas
  advName:   { x: 0.0814, y: 0.6391, w: 0.4, h: 0.0296, size: 0.0296, font: 'Beleren Bold' },
  advMana:   { x: 0.0814, y: 0.6391, w: 0.4, size: 60/1638, shadowX: -0.001, shadowY: 0.0029 },
  advType:   { x: 0.0814, y: 0.6839, w: 0.4, h: 0.0296, size: 0.0296, font: 'Beleren Bold' },
  advRules:  { x: 0.0854, y: 0.7358, w: 0.3947, h: 0.15, size: 0.0353, font: 'MPlantin' },
};

// Transform front layout (packM15TransformFront.js)
// 1500x2100. Title shifted right for transform icon. Reverse PT hint at bottom.
export const TF_FRONT_LAYOUT = {
  art:       { x: 115/1500, y: 237/2100, w: 1271/1500, h: 930/2100 },
  name:      { x: 0.16, y: 0.0522, w: 0.7547, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0613, w: 0.9292, size: 71/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.0854, y: 0.5664, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  rules:     { x: 0.086, y: 0.6303, w: 0.828, h: 0.2875, size: 0.0362, font: 'MPlantin' },
  pt:        { x: 0.7928, y: 0.902, w: 0.1367, h: 0.0372, size: 0.0372, font: 'Beleren Bold SmCaps' },
  ptBox:     { x: 0.7573, y: 0.8848, w: 0.188, h: 0.0733 },
  setSymbol: { x: 0.9213, y: 0.5910, w: 0.12, h: 0.0700 },
  crown:     { x: 0.0274, y: 0.0191, w: 0.9454, h: 0.1667 },
  // Hint: back face P/T shown at bottom-right of rules
  reversePt: { x: 0.086, y: 0.842, w: 0.838, h: 0.0362, size: 0.0291, font: 'Beleren Bold SmCaps' },
};

// Transform back layout (packM15TransformBack.js)
// Same as front but with white text. Frame is mirrored horizontally.
export const TF_BACK_LAYOUT = {
  art:       { x: 115/1500, y: 237/2100, w: 1271/1500, h: 930/2100 },
  name:      { x: 0.16, y: 0.0522, w: 0.7547, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0613, w: 0.9292, size: 71/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.0854, y: 0.5664, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  rules:     { x: 0.086, y: 0.6303, w: 0.828, h: 0.2875, size: 0.0362, font: 'MPlantin' },
  pt:        { x: 0.7928, y: 0.902, w: 0.1367, h: 0.0372, size: 0.0372, font: 'Beleren Bold SmCaps' },
  ptBox:     { x: 0.7573, y: 0.8848, w: 0.188, h: 0.0733 },
  setSymbol: { x: 0.9213, y: 0.5910, w: 0.12, h: 0.0700 },
  crown:     { x: 0.0274, y: 0.0191, w: 0.9454, h: 0.1667 },
  textColor: 'white',
};

// Modal DFC front layout (packModalRegular.js)
// 1500x2100. Title shifted right for MDFC arrow. Flipside hint at bottom.
export const MDFC_FRONT_LAYOUT = {
  art:       { x: 115/1500, y: 237/2100, w: 1271/1500, h: 930/2100 },
  name:      { x: 0.1614, y: 0.0522, w: 0.7534, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0613, w: 0.9292, size: 71/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.0854, y: 0.5664, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  rules:     { x: 0.086, y: 0.6303, w: 0.828, h: 0.2875, size: 0.0362, font: 'MPlantin' },
  pt:        { x: 0.7928, y: 0.902, w: 0.1367, h: 0.0372, size: 0.0372, font: 'Beleren Bold SmCaps' },
  ptBox:     { x: 0.7573, y: 0.8848, w: 0.188, h: 0.0733 },
  setSymbol: { x: 0.9213, y: 0.5910, w: 0.12, h: 0.0700 },
  crown:     { x: 0.0274, y: 0.0191, w: 0.9454, h: 0.1667 },
  // Flipside hint at bottom — type on left, mana cost on right
  flipside: { x: 0.068, y: 0.892, w: 0.37, h: 0.0391, size: 0.031, font: 'MPlantin' },
};

// Modal DFC back layout — same as front (both faces show flipside hints)
export const MDFC_BACK_LAYOUT = {
  ...MDFC_FRONT_LAYOUT,
  flipside: { ...MDFC_FRONT_LAYOUT.flipside, color: 'black' },
  name: { ...MDFC_FRONT_LAYOUT.name, color: 'white' },
  type: { ...MDFC_FRONT_LAYOUT.type, color: 'white' },
};

// Split/Fuse layout (packSplit.js / packFuse.js)
// 1500x2100 canvas. Two mini-cards side by side, each rotated -90°.
// "right" = top half of card (first spell), "left" = bottom half (second spell).
// All text is drawn rotated -90° by the renderer hook.
// Right half (first spell) — card y ~ 0.44
export const SPLIT_RIGHT_LAYOUT = {
  art:       { x: 237/1500, y: 112/2100, w: 560/1500, h: 816/2100 },
  name:      { x: 0.072, y: 0.4381, w: 0.39, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0855, w: 0.39, size: 85/1500, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.55, y: 0.4381, w: 0.39, h: 0.0286, size: 0.0286, font: 'Beleren Bold' },
  rules:     { x: 0.6087, y: 0.44, w: 0.36, h: 0.2443, size: 0.0355, font: 'MPlantin' },
  setSymbol: { x: 0.40, y: 0.565, w: 0.12, h: 0.08 },
};
// Left half (second spell / linkedCard) — card y ~ 0.89
export const SPLIT_LEFT_LAYOUT = {
  art:       { x: 237/1500, y: 1070/2100, w: 560/1500, h: 816/2100 },
  name:      { x: 0.072, y: 0.8943, w: 0.39, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0855, w: 0.39, size: 85/1500, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.55, y: 0.8943, w: 0.39, h: 0.0286, size: 0.0286, font: 'Beleren Bold' },
  rules:     { x: 0.6087, y: 0.90, w: 0.36, h: 0.2443, size: 0.0355, font: 'MPlantin' },
  setSymbol: { x: 0.40, y: 0.565, w: 0.12, h: 0.08 },
};

// Flip layout (packFlip.js / Kamigawa)
// 1500x2100 canvas. Top half is normal, bottom half is rotated 180°.
// Shared art in the middle.
export const FLIP_LAYOUT = {
  art:       { x: 113/1500, y: 622/2100, w: 1274/1500, h: 696/2100 },
  // Top half (front face)
  name:      { x: 0.0854, y: 0.0386, w: 0.8292, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0477, w: 0.9292, size: 71/2100, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.0854, y: 0.2353, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  typePtInset: 120/1500,  // shrink type width by this when PT box is present
  rules:     { x: 0.086, y: 0.102, w: 0.828, h: 0.12, size: 0.0305, font: 'MPlantin' },
  pt:        { x: 0.8267, y: 0.2448, w: 0.0967, h: 0.0372, size: 0.0324, font: 'Beleren Bold SmCaps' },
  setSymbol: { x: 0.815, y: 0.26, w: 0.12, h: 0.0700 },
  // Bottom half (flipped face, rendered 180°)
  name2:     { x: 0.9147, y: 0.8848, w: 0.8292, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  type2:     { x: 0.9147, y: 0.6886, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  type2PtInset: 170/1500,
  rules2:    { x: 0.914, y: 0.821, w: 0.828, h: 0.12, size: 0.0305, font: 'MPlantin' },
  pt2:       { x: 0.1734, y: 0.6791, w: 0.0967, h: 0.0372, size: 0.0324, font: 'Beleren Bold SmCaps' },
  // Flip PT image bounds (single image containing both top and bottom PT boxes)
  flipPtBounds: { x: 0.0374, y: 0.2277, w: 0.9067, h: 0.4762 },
};

// Mutate layout (packM15Mutate.js)
// 1500x2100 canvas. Extended art, mutate cost bar between type and rules.
export const MUTATE_LAYOUT = {
  art:       { x: 115/1500, y: 237/2100, w: 1270/1500, h: 1348/2100 },
  name:      { x: 0.0854, y: 0.0522, w: 0.8292, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0613, w: 0.9292, size: 71/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.0854, y: 0.5664, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  // Mutate cost bar (between type and rules)
  mutateCost:{ x: 0.086, y: 0.6303, w: 0.828, h: 0.1215, size: 0.0291, font: 'MPlantin' },
  rules:     { x: 0.086, y: 0.7567, w: 0.828, h: 0.1615, size: 0.0291, font: 'MPlantin' },
  pt:        { x: 0.7928, y: 0.902, w: 0.1367, h: 0.0372, size: 0.0372, font: 'Beleren Bold SmCaps' },
  ptBox:     { x: 0.7573, y: 0.8848, w: 0.188, h: 0.0733 },
  setSymbol: { x: 0.9213, y: 0.5910, w: 0.12, h: 0.0700 },
  crown:     { x: 44/2010, y: 53/2814, w: 1922/2010, h: 493/2814 },
};

// Prototype layout (packPrototype.js)
// 1500x2100 canvas. Standard art, prototype bar between type and rules.
export const PROTO_LAYOUT = {
  art:       { x: 115/1500, y: 237/2100, w: 1271/1500, h: 930/2100 },
  name:      { x: 0.0854, y: 0.0522, w: 0.8292, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0613, w: 0.9292, size: 71/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.0854, y: 0.5664, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  // Prototype bar (between type and rules)
  protoRules:{ x: 129/1500, y: 1335/2100, w: 1041/1500, h: 193/2100, size: 0.0295, font: 'MPlantin' },
  protoMana: { y: 1347/2100, w: 0.915, size: 72/2100, shadowX: 0, shadowY: 0 },
  protoPt:   { x: 0.7928, y: 0.6935, w: 0.1367, h: 0.0372, size: 0.0372, font: 'Beleren Bold SmCaps' },
  rules:     { x: 129/1500, y: 1565/2100, w: 1242/1500, h: 359/2100, size: 0.0295, font: 'MPlantin' },
  pt:        { x: 0.7928, y: 0.902, w: 0.1367, h: 0.0372, size: 0.0372, font: 'Beleren Bold SmCaps' },
  ptBox:     { x: 0.7573, y: 0.8848, w: 0.188, h: 0.0733 },
  setSymbol: { x: 0.9213, y: 0.5910, w: 0.12, h: 0.0700 },
  crown:     { x: 44/2010, y: 53/2814, w: 1922/2010, h: 493/2814 },
};

// Leveler layout (packLevelers.js)
// 1500x2100 canvas. Three stacked level sections with level labels and P/T boxes.
export const LEVELER_LAYOUT = {
  art:       { x: 115/1500, y: 237/2100, w: 1271/1500, h: 930/2100 },
  name:      { x: 0.0854, y: 0.0522, w: 0.8292, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0613, w: 0.9292, size: 71/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.0854, y: 0.5664, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  setSymbol: { x: 0.9213, y: 0.5910, w: 0.12, h: 0.0700 },
  crown:     { x: 44/2010, y: 53/2814, w: 1922/2010, h: 493/2814 },
  // Level Up section (top)
  rules1:    { x: 0.086, y: 0.6303, w: 0.6834, h: 0.0905, size: 0.0296, font: 'MPlantin' },
  pt1:       { x: 0.7928, y: 0.6591, w: 0.1367, h: 0.0372, size: 0.0372, font: 'Beleren Bold SmCaps' },
  // Level section 2
  rules2:    { x: 0.2067, y: 0.7229, w: 0.5627, h: 0.0953, size: 0.0296, font: 'MPlantin' },
  pt2:       { x: 0.7928, y: 0.7524, w: 0.1367, h: 0.0372, size: 0.0372, font: 'Beleren Bold SmCaps' },
  levelLabel2: { x: 0.0727, y: 0.7420, w: 0.08, h: 0.0572, size: 0.0139, font: 'Beleren Bold SmCaps' },
  // Level section 3
  rules3:    { x: 0.2067, y: 0.8220, w: 0.5627, h: 0.0953, size: 0.0296, font: 'MPlantin' },
  pt3:       { x: 0.7928, y: 0.8515, w: 0.1367, h: 0.0372, size: 0.0372, font: 'Beleren Bold SmCaps' },
  levelLabel3: { x: 0.0727, y: 0.8448, w: 0.08, h: 0.0572, size: 0.0139, font: 'Beleren Bold SmCaps' },
};

// Aftermath layout (packAftermath.js)
// 1500x2100 canvas. Top half is normal upright card, bottom half is rotated 90°.
// Top half (first spell) — normal orientation
export const AFTERMATH_TOP_LAYOUT = {
  art:       { x: 114/1500, y: 236/2100, w: 1272/1500, h: 469/2100 },
  name:      { x: 0.0854, y: 0.0522, w: 0.8292, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.0613, w: 0.9292, size: 71/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.0854, y: 0.3467, w: 0.8292, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  rules:     { x: 0.086, y: 0.4139, w: 0.828, h: 0.12, size: 0.0362, font: 'MPlantin' },
  setSymbol: { x: 0.9213, y: 0.371, w: 0.12, h: 0.0615 },
  crown:     { x: 44/2010, y: 53/2814, w: 1922/2010, h: 493/2814 },
};
// Bottom half (second spell / linkedCard) — rotated 90° clockwise
export const AFTERMATH_BOTTOM_LAYOUT = {
  // 432x744
  art:       { x: 824/1500, y: 1177/2100, w: 432/1500, h: 744/2100 },
  name:      { x: 0.91, y: 0.5648, w: 0.42, h: 0.0543, size: 0.0381, font: 'Beleren Bold' },
  mana:      { y: 0.005, w: 0.35, size: 92/1638, shadowX: -0.001, shadowY: 0.0029 },
  type:      { x: 0.53, y: 0.5648, w: 0.42, h: 0.0543, size: 0.0324, font: 'Beleren Bold' },
  rules:     { x: 0.44, y: 0.57, w: 0.35, h: 0.35, size: 0.090, font: 'MPlantin' },
};

// Battle layout (packBattle.js)
export const BTL_LAYOUT = {
  art:     { x: 167/2100, y: 60/1500, w: 1873/2100, h: 1371/1500 },
  name:    { x: 387/2100, y: 81/1500, w: 1547/2100, h: 114/1500, size: (0.0381*2100)/1500, font: 'Beleren Bold' },
  mana:    { y: 100/1500, w: 1957/2100, size: ((71/1638)*2100)/1500, shadowX: -0.001, shadowY: 0.0029 },
  type:    { x: 268/2100, y: 873/1500, w: 1667/2100, h: 114/1500, size: (0.0324*2100)/1500, font: 'Beleren Bold' },
  rules:   { x: 272/2100, y: 1008/1500, w: 1661/2100, h: 414/1500, size: (0.0362*2100)/1500, font: 'MPlantin' },
  defense: { x: 1920/2100, y: 1320/1500, w: 86/2100, h: 123/1500, size: (0.0372*2100)/1500, font: 'Beleren Bold SmCaps' },
  backPt: { x: 1830/2100, y: 1180/1500, w: 140/2100, h: 123/1500, size: (0.0280*2100)/1500, font: 'Beleren Bold SmCaps' },
  setSymbol: { x: 0.93, y: 0.62, w: 0.12, h: 0.098 },
};
