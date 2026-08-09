// KFC New Zealand — published nutrition information.
// Source: kfc.co.nz nutrition tables. Read 2026-08-03.
//
// Chicken piece weights are as served, bone in, which is how KFC publishes
// them. Because the per-100g figure is then "per 100 g of the piece as served",
// logging 2 drumsticks and logging 180 g both land on the same numbers.
//
// Row shape: [name, portions, kcal, protein, carbs, fat] — nutrition per 100 g.

import { buildChain } from './_build.js';

const ROWS = [
  // ── Original Recipe pieces ───────────────────────────────────────────────
  ['Original Recipe Chicken, Drumstick', [['1 drumstick', 60], ['2 drumsticks', 120], ['3 drumsticks', 180]], 245, 21.7, 6.7, 15.0],
  ['Original Recipe Chicken, Wing', [['1 wing', 45], ['2 wings', 90]], 269, 20.0, 8.9, 17.8],
  ['Original Recipe Chicken, Thigh', [['1 thigh', 90], ['2 thighs', 180]], 278, 18.9, 6.7, 20.0],
  ['Original Recipe Chicken, Rib', [['1 rib', 85], ['2 ribs', 170]], 235, 21.2, 8.2, 13.5],
  ['Original Recipe Chicken, Keel', [['1 keel', 115]], 209, 22.6, 7.0, 10.4],

  // ── Wings and bites ──────────────────────────────────────────────────────
  ['Wicked Wings', [['3 wings', 105], ['1 wing', 35], ['6 wings', 210], ['10 wings', 350]], 260, 17.1, 12.4, 16.2],
  ['Popcorn Chicken', [['Regular', 100], ['Large', 190], ['Snack', 60]], 279, 17.0, 21.0, 14.0],
  ['Hot & Spicy Chicken, Drumstick', [['1 drumstick', 62], ['2 drumsticks', 124]], 258, 20.9, 9.7, 15.3],
  ['Nuggets', [['6 nuggets', 96], ['10 nuggets', 160], ['20 nuggets', 320]], 271, 15.6, 17.7, 15.6],
  ['Tenders', [['3 tenders', 130]], 231, 19.2, 15.4, 10.0],

  // ── Burgers and wraps ────────────────────────────────────────────────────
  ['Zinger Burger', [['1 burger', 200]], 233, 12.5, 22.5, 10.5],
  ['Zinger Stacker', [['1 burger', 260]], 265, 14.2, 20.0, 14.2],
  ['Colonel Burger', [['1 burger', 195]], 231, 12.3, 23.1, 10.3],
  ['Original Recipe Burger', [['1 burger', 190]], 226, 12.6, 22.6, 9.5],
  ['Twister Wrap', [['1 wrap', 220]], 232, 11.4, 22.7, 10.9],
  ['Zinger Twister Wrap', [['1 wrap', 225]], 236, 11.6, 22.2, 11.1],
  ['Snack Burger', [['1 burger', 120]], 242, 11.7, 25.0, 10.8],

  // ── Sides ────────────────────────────────────────────────────────────────
  ['Chips', [['Regular', 110], ['Large', 175], ['Snack', 70]], 245, 3.6, 33.6, 10.5],
  ['Potato & Gravy', [['Regular', 130], ['Large', 220]], 85, 1.8, 11.5, 3.5],
  ['Coleslaw', [['Regular', 110], ['Large', 220]], 145, 1.2, 12.7, 10.0],
  ['Corn Cobbette', [['1 cob', 85]], 106, 3.5, 20.0, 1.5],
  ['Bread Roll', [['1 roll', 35]], 286, 8.6, 51.4, 3.4],
  ['Gravy', [['1 tub', 60]], 58, 1.7, 8.3, 1.8],

  // ── Desserts ─────────────────────────────────────────────────────────────
  ['Krushers, Mint Chocolate', [['1 regular', 400]], 148, 3.0, 22.5, 5.3],
  ['Sundae, chocolate', [['1 sundae', 155]], 190, 3.9, 31.0, 5.5],
];

const ALIASES = {
  'Original Recipe Chicken, Drumstick': 'kfc drumstick, original recipe drummy',
  'Original Recipe Chicken, Wing': 'kfc wing',
  'Original Recipe Chicken, Thigh': 'kfc thigh',
  'Wicked Wings': 'wicked wing, hot wings',
  'Popcorn Chicken': 'popcorn',
  'Zinger Burger': 'zinger',
  'Potato & Gravy': 'potato and gravy, mash and gravy',
  'Chips': 'kfc chips, fries, hot chips',
};

export const KFC_NZ = buildChain('KFC', ROWS, ALIASES);
