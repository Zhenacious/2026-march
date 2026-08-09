// Domino's New Zealand — published nutrition information.
// Source: dominos.co.nz nutrition tables. Read 2026-08-03.
//
// Domino's publishes per 100 g and per slice for a large classic crust pizza,
// which is cut into 8 slices. So "1 slice" is the default portion here and a
// whole pizza is the 8-slice portion on the same row — logging half a pizza is
// a quantity of 4, not a separate food.
//
// Slice weights vary a little between toppings; the figures below are the
// published serve weights for a large classic crust.
//
// Row shape: [name, portions, kcal, protein, carbs, fat] — nutrition per 100 g.

import { buildChain } from './_build.js';

const ROWS = [
  // ── Value range ──────────────────────────────────────────────────────────
  ['Pizza, Hawaiian (Value)', [['1 slice', 82], ['Half pizza', 328], ['Whole pizza', 656]], 216, 10.5, 30.4, 5.4],
  ['Pizza, Simply Cheese (Value)', [['1 slice', 78], ['Half pizza', 312], ['Whole pizza', 624]], 244, 11.2, 31.6, 7.9],
  ['Pizza, Beef & Onion (Value)', [['1 slice', 85], ['Half pizza', 340], ['Whole pizza', 680]], 224, 11.0, 29.5, 6.5],
  ['Pizza, Ham & Cheese (Value)', [['1 slice', 80], ['Half pizza', 320], ['Whole pizza', 640]], 226, 11.5, 30.2, 6.1],
  ['Pizza, Pepperoni (Value)', [['1 slice', 80], ['Half pizza', 320], ['Whole pizza', 640]], 253, 11.8, 30.0, 9.3],

  // ── Traditional range ────────────────────────────────────────────────────
  ['Pizza, Meatlovers (Traditional)', [['1 slice', 105], ['Half pizza', 420], ['Whole pizza', 840]], 250, 12.9, 25.7, 10.5],
  ['Pizza, Supreme (Traditional)', [['1 slice', 103], ['Half pizza', 412], ['Whole pizza', 824]], 223, 10.7, 26.2, 8.3],
  ['Pizza, BBQ Meatlovers (Traditional)', [['1 slice', 108], ['Half pizza', 432], ['Whole pizza', 864]], 245, 12.5, 27.8, 9.3],
  ['Pizza, Chicken & Camembert (Traditional)', [['1 slice', 100], ['Half pizza', 400], ['Whole pizza', 800]], 235, 12.0, 26.0, 9.0],
  ['Pizza, Godfather (Traditional)', [['1 slice', 106], ['Half pizza', 424], ['Whole pizza', 848]], 240, 12.3, 26.4, 9.4],
  ['Pizza, Vegorama (Traditional)', [['1 slice', 98], ['Half pizza', 392], ['Whole pizza', 784]], 199, 9.2, 27.6, 5.6],
  ['Pizza, Cheesy Garlic Bread Pizza', [['1 slice', 75], ['Whole pizza', 600]], 267, 10.7, 34.7, 9.3],

  // ── Sides ────────────────────────────────────────────────────────────────
  ['Garlic Bread', [['1 piece', 43], ['1 serve', 172]], 314, 7.0, 41.9, 12.8],
  ['Cheesy Garlic Bread', [['1 piece', 50], ['1 serve', 200]], 320, 10.0, 36.0, 14.0],
  ['Chicken Wings, BBQ', [['3 wings', 120], ['6 wings', 240]], 233, 17.5, 10.8, 13.3],
  ['Chicken Tenders', [['3 tenders', 105]], 248, 16.2, 19.0, 11.4],
  ['Potato Gems', [['1 regular', 150]], 227, 3.3, 28.7, 11.3],
  ['Garlic Aioli Dip', [['1 tub', 25]], 640, 1.2, 4.0, 68.0],
  ['Chicken & Cranberry Salad', [['1 serve', 250]], 92, 7.6, 8.4, 3.2],

  // ── Desserts ─────────────────────────────────────────────────────────────
  ['Choc Lava Cake', [['1 cake', 90]], 344, 4.4, 47.8, 15.6],
  ['Cookies, Choc Chunk', [['1 cookie', 45]], 456, 5.3, 60.0, 21.1],
];

const ALIASES = {
  'Pizza, Meatlovers (Traditional)': 'meat lovers, meatlovers pizza',
  'Pizza, Hawaiian (Value)': 'hawaiian pizza, ham and pineapple',
  'Pizza, Pepperoni (Value)': 'pepperoni pizza',
  'Garlic Bread': 'garlic bread stick',
  'Potato Gems': 'potato gem, tater tots',
};

export const DOMINOS_NZ = buildChain("Domino's", ROWS, ALIASES);
