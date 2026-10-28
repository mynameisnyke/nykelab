// Where things are on the desk, in metres. The axes come from a Polycam scan of the desk the layout was first measured from: y up,
// x away from the seat (toward the wall), z to the right; the desk top is DESK_Y. The positions of the things that have moved since
// (the deck, the book, the stick, the lamp...) are taken from the Sony a7R overhead photograph of 27 Oct, scaled against the
// keyboard and mouse, which have not moved.
import * as THREE from "three";

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const DESK_Y = -0.328;
export const DESK = { x0: -0.385, x1: 0.43, z0: -0.78, z1: 0.78, thick: 0.03 }; // front edge, the wall, the sides (a 60 x 30 inch desk)
export const SHELF = { x0: 0.05, x1: 0.3, z0: -0.47, z1: 0.5, top: -0.23, thick: 0.03 }; // the oak riser under the monitor
export const DRAWER = { w: 0.24, d: 0.205, h: 0.066, z: 0.08, closedFront: 0.05, travel: 0.15 };
export const MONITOR = { x: 0.134, y0: -0.105, y1: 0.255, z: 0.015, halfW: 0.445, radius: 3.4 };
export const TAPE = { w: 0.066, h: 0.048, t: 0.0122 }; // a Mini DV cassette: 66 x 48 x 12 mm
export const CASE = { w: 0.071, h: 0.056, t: 0.0155 };

// the Sony deck: straight on the desk, its front edge 5 cm from the desk's edge. Its top panel (the controls) lifts on a hinge at the
// back to open the cassette bay; its screen flap stands tipped back behind it.
export const LATERAL = V(0, 0, 1); // along the deck's front edge
export const INTO = V(1, 0, 0); // from the deck's front into it
export const DECK = { w: 0.16, h: 0.045, d: 0.135 };
export const DECK_FRONT = V(-0.33, DESK_Y, 0.34); // middle of the deck's front edge, on the desk
export const DECK_TOP_Y = DESK_Y + DECK.h;
/** the cassette bay's floor, where a cassette sits when it is in */
export const DECK_BAY_Y = DESK_Y + 0.024;
export const FLAP = { w: 0.134, h: 0.115, t: 0.016, tilt: (22 * Math.PI) / 180, hingeDepth: 0.09 };
/** faces the seat (and a little up: the screen is tipped back) */
export const LCD_NORMAL = V(-Math.cos(FLAP.tilt), Math.sin(FLAP.tilt), 0);
export const LCD_RIGHT = V(0, 0, 1);
export const LCD_UP = new THREE.Vector3().crossVectors(LCD_NORMAL, LCD_RIGHT).normalize();
export const LCD_SIZE = { w: 0.103, h: 0.0773 }; // the screen's glass: 4:3
/** the middle of the screen (5 mm left of the flap's middle: the hinge side is wider) */
export const LCD_CENTRE = DECK_FRONT.clone()
  .addScaledVector(INTO, FLAP.hingeDepth)
  .add(V(0, DECK.h, 0))
  .addScaledVector(LCD_UP, FLAP.h / 2)
  .addScaledVector(LCD_RIGHT, -0.005);
/** the screen, as an exact 4:3 rectangle: TL, TR, BR, BL */
export const LCD = [
  LCD_CENTRE.clone().addScaledVector(LCD_RIGHT, -LCD_SIZE.w / 2).addScaledVector(LCD_UP, LCD_SIZE.h / 2),
  LCD_CENTRE.clone().addScaledVector(LCD_RIGHT, LCD_SIZE.w / 2).addScaledVector(LCD_UP, LCD_SIZE.h / 2),
  LCD_CENTRE.clone().addScaledVector(LCD_RIGHT, LCD_SIZE.w / 2).addScaledVector(LCD_UP, -LCD_SIZE.h / 2),
  LCD_CENTRE.clone().addScaledVector(LCD_RIGHT, -LCD_SIZE.w / 2).addScaledVector(LCD_UP, -LCD_SIZE.h / 2),
];

// the rest, from the overhead photograph
export const STICK = { x: -0.226, z: -0.44, deg: 25 };
export const BOOK = { x: -0.27, z: 0.625, deg: 3 };
export const LAMP = { x: 0.15, z: 0.54, bulb: V(0.2, DESK_Y + 0.27, 0.585) };

/** a flat arrangement: x along `dir`, y up (angle about y so that local +x points along (dx, dz)) */
export const yawFor = (dx: number, dz: number) => Math.atan2(-dz, dx);
