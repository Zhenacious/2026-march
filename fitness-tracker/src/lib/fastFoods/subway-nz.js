// Subway New Zealand — published nutrition information.
// Source: subway.co.nz nutrition guide. Read 2026-08-03.
//
// Values are for the sub as Subway lists it: 9-grain wheat bread, the standard
// meat/filling, and the salad vegetables — no cheese, no sauce, no extras.
// Cheese and sauces are listed separately below so they can be added as their
// own entries, which is how Subway publishes them too.
//
// A footlong is exactly two 6-inch subs, so it is a second portion on the same
// row rather than a separate food.
//
// Row shape: [name, portions, kcal, protein, carbs, fat] — nutrition per 100 g.

import { buildChain } from './_build.js';

const ROWS = [
  // ── Subs (no cheese, no sauce) ───────────────────────────────────────────
  ['Chicken Teriyaki Sub', [['6 inch', 245], ['Footlong', 490]], 155, 10.6, 22.0, 2.4],
  ['Meatball Marinara Sub', [['6 inch', 285], ['Footlong', 570]], 168, 8.4, 19.6, 6.3],
  ['BLT Sub', [['6 inch', 205], ['Footlong', 410]], 156, 8.8, 21.5, 3.7],
  ['Veggie Delite Sub', [['6 inch', 165], ['Footlong', 330]], 130, 5.5, 24.2, 1.2],
  ['Italian B.M.T. Sub', [['6 inch', 232], ['Footlong', 464]], 187, 9.9, 19.4, 7.8],
  ['Steak & Cheese Sub', [['6 inch', 258], ['Footlong', 516]], 154, 11.6, 19.0, 3.5],
  ['Chicken Fillet Sub', [['6 inch', 238], ['Footlong', 476]], 143, 11.3, 19.7, 2.3],
  ['Turkey Sub', [['6 inch', 219], ['Footlong', 438]], 128, 8.2, 20.5, 1.6],
  ['Ham Sub', [['6 inch', 219], ['Footlong', 438]], 128, 8.0, 20.8, 1.6],
  ['Tuna Sub', [['6 inch', 225], ['Footlong', 450]], 205, 9.2, 19.4, 10.2],
  ['Roast Beef Sub', [['6 inch', 219], ['Footlong', 438]], 131, 9.6, 20.3, 1.5],
  ['Chicken Bacon Ranch Sub', [['6 inch', 268], ['Footlong', 536]], 209, 12.1, 17.9, 10.1],
  ['Veggie Patty Sub', [['6 inch', 236], ['Footlong', 472]], 152, 8.5, 23.3, 2.8],

  // ── Wraps and salads ─────────────────────────────────────────────────────
  ['Chicken Teriyaki Wrap', [['1 wrap', 245]], 174, 10.9, 23.6, 3.7],
  ['Chicken Teriyaki Salad', [['1 salad', 320]], 66, 6.6, 8.1, 1.0],
  ['Garden Salad', [['1 salad', 240]], 28, 1.5, 5.0, 0.3],

  // ── Bread on its own, for building a custom sub ──────────────────────────
  ['9-Grain Wheat Bread', [['6 inch', 71], ['Footlong', 142]], 253, 9.9, 45.1, 3.1],
  ['Italian White Bread', [['6 inch', 68], ['Footlong', 136]], 250, 8.8, 47.1, 2.6],
  ['Italian Herbs & Cheese Bread', [['6 inch', 79], ['Footlong', 158]], 278, 11.4, 43.0, 6.3],

  // ── Add-ons ──────────────────────────────────────────────────────────────
  ['Cheese slices, processed', [['6 inch serve', 12], ['Footlong serve', 24]], 292, 16.7, 8.3, 20.8],
  ['Mayonnaise', [['6 inch serve', 15]], 680, 1.0, 1.3, 75.0],
  ['Sweet Onion Sauce', [['6 inch serve', 21]], 190, 0.5, 45.7, 0.2],
  ['Chipotle Southwest Sauce', [['6 inch serve', 21]], 500, 1.0, 9.5, 51.4],
  ['Ranch Dressing', [['6 inch serve', 21]], 524, 1.0, 4.8, 55.2],
  ['Sweet Chilli Sauce', [['6 inch serve', 21]], 190, 0.5, 46.7, 0.2],

  // ── Cookies and sides ────────────────────────────────────────────────────
  ['Cookie, Choc Chip', [['1 cookie', 45]], 467, 4.4, 62.2, 22.2],
  ['Cookie, Double Choc Chip', [['1 cookie', 45]], 467, 4.4, 60.0, 22.2],
  ['Cookie, White Choc Macadamia', [['1 cookie', 45]], 489, 4.4, 60.0, 24.4],
  ['Hash Browns', [['1 serve', 70]], 271, 2.9, 30.0, 15.7],
];

const ALIASES = {
  'Chicken Teriyaki Sub': 'teriyaki, sweet onion chicken teriyaki',
  'Italian B.M.T. Sub': 'bmt, italian bmt',
  'Veggie Delite Sub': 'veggie delight, vegetarian sub',
  'Meatball Marinara Sub': 'meatball sub, meatballs',
  'BLT Sub': 'bacon lettuce tomato',
  '9-Grain Wheat Bread': 'wheat bread, brown bread',
};

export const SUBWAY_NZ = buildChain('Subway', ROWS, ALIASES);
