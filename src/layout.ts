// Layout values live in JSON files under src/layouts/. Edit them via the dev-server's
// editor UI (which writes JSON directly), or by hand. This file just re-exports them
// alongside the canvas-dimension constants.

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

import standardJson from './layouts/standard.json';
import planeswalkerJson from './layouts/planeswalker.json';
import planeswalkerTallJson from './layouts/planeswalker_tall.json';
import sagaJson from './layouts/saga.json';
import classJson from './layouts/class.json';
import battleJson from './layouts/battle.json';
import adventureJson from './layouts/adventure.json';
import transformFrontJson from './layouts/transform_front.json';
import transformBackJson from './layouts/transform_back.json';
import mdfcFrontJson from './layouts/mdfc_front.json';
import mdfcBackJson from './layouts/mdfc_back.json';
import splitRightJson from './layouts/split_right.json';
import splitLeftJson from './layouts/split_left.json';
import flipJson from './layouts/flip.json';
import mutateJson from './layouts/mutate.json';
import prototypeJson from './layouts/prototype.json';
import levelerJson from './layouts/leveler.json';
import aftermathTopJson from './layouts/aftermath_top.json';
import aftermathBottomJson from './layouts/aftermath_bottom.json';
import prepareJson from './layouts/prepare.json';
import roomJson from './layouts/room.json';
import omenJson from './layouts/omen.json';

// Re-export each layout. The JSON imports are inferred as their literal types,
// which is too strict for runtime mutation by the dev-server's editor. Cast to
// a permissive Record so consumers (renderers, tests) can index into them freely.
type AnyLayout = Record<string, any>;

export const STD_LAYOUT: AnyLayout = standardJson;
export const PW_LAYOUT: AnyLayout = planeswalkerJson;
export const PW_TALL_LAYOUT: AnyLayout = planeswalkerTallJson;
export const SAGA_LAYOUT: AnyLayout = sagaJson;
export const CLASS_LAYOUT: AnyLayout = classJson;
export const BTL_LAYOUT: AnyLayout = battleJson;
export const ADV_LAYOUT: AnyLayout = adventureJson;
export const TF_FRONT_LAYOUT: AnyLayout = transformFrontJson;
export const TF_BACK_LAYOUT: AnyLayout = transformBackJson;
export const MDFC_FRONT_LAYOUT: AnyLayout = mdfcFrontJson;
export const MDFC_BACK_LAYOUT: AnyLayout = mdfcBackJson;
export const SPLIT_RIGHT_LAYOUT: AnyLayout = splitRightJson;
export const SPLIT_LEFT_LAYOUT: AnyLayout = splitLeftJson;
export const FLIP_LAYOUT: AnyLayout = flipJson;
export const MUTATE_LAYOUT: AnyLayout = mutateJson;
export const PROTO_LAYOUT: AnyLayout = prototypeJson;
export const LEVELER_LAYOUT: AnyLayout = levelerJson;
export const AFTERMATH_TOP_LAYOUT: AnyLayout = aftermathTopJson;
export const AFTERMATH_BOTTOM_LAYOUT: AnyLayout = aftermathBottomJson;
export const PREPARE_LAYOUT: AnyLayout = prepareJson;
export const ROOM_LAYOUT: AnyLayout = roomJson;
export const OMEN_LAYOUT: AnyLayout = omenJson;
