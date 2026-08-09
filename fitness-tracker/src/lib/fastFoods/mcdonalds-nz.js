// McDonald's New Zealand — published nutrition information.
// Source: mcdonalds.co.nz nutrition tables. Read 2026-08-03.
//
// Per-100g figures are worked out from the published per-item values and the
// published item weight (perItem x 100 / itemGrams), then rounded to one
// decimal. The item weight is the portion, so "1 Big Mac" logs the whole item
// and the maths still runs off per-100g like every other food.
//
// Rows marked ESTIMATE have a weight McDonald's does not publish; the nutrition
// is the published figure and only the weight is inferred, so per-item totals
// are right and only the per-100g view is approximate.
//
// Row shape: [name, portions, kcal, protein, carbs, fat] — nutrition per 100 g.

import { buildChain } from './_build.js';

const ROWS = [
  // ── Burgers ──────────────────────────────────────────────────────────────
  ['Big Mac', [['1 burger', 215]], 249, 12.6, 19.5, 13.0],
  ['Quarter Pounder with Cheese', [['1 burger', 199]], 259, 14.6, 15.6, 15.1],
  ['Double Quarter Pounder with Cheese', [['1 burger', 280]], 282, 17.5, 11.4, 18.6],
  ['Cheeseburger', [['1 burger', 118]], 254, 13.6, 25.4, 10.2],
  ['Double Cheeseburger', [['1 burger', 165]], 273, 16.4, 18.8, 14.5],
  ['Hamburger', [['1 burger', 105]], 238, 12.4, 28.6, 8.1],
  ['McChicken', [['1 burger', 173]], 260, 10.4, 26.0, 12.7],
  ['Filet-O-Fish', [['1 burger', 139]], 245, 10.8, 27.3, 10.1],
  ['McSpicy', [['1 burger', 218]], 248, 11.5, 22.9, 12.4],
  ['Chicken McFeast', [['1 burger', 226]], 221, 10.6, 22.1, 10.2],
  ['Georgie Pie, Steak Mince n Cheese', [['1 pie', 170]], 253, 8.8, 22.4, 14.1],

  // ── Chicken ──────────────────────────────────────────────────────────────
  ['Chicken McNuggets', [['6 nuggets', 96], ['3 nuggets', 48], ['9 nuggets', 144], ['12 nuggets', 192], ['20 nuggets', 320]], 271, 15.6, 16.7, 16.1],
  ['Chicken Selects', [['3 pieces', 156]], 244, 16.0, 17.3, 12.2],

  // ── Sides ────────────────────────────────────────────────────────────────
  ['Fries', [['Medium', 110], ['Small', 77], ['Large', 150]], 300, 3.6, 39.1, 14.0],
  ['Hash Brown', [['1 hash brown', 55]], 265, 2.5, 27.3, 16.0],
  ['Garden Salad', [['1 salad', 120]], 17, 1.1, 2.0, 0.3],

  // ── Breakfast ────────────────────────────────────────────────────────────
  ['Sausage McMuffin', [['1 muffin', 113]], 292, 13.6, 23.5, 15.9],
  ['Sausage & Egg McMuffin', [['1 muffin', 163]], 271, 14.7, 17.2, 15.8],
  ['Bacon & Egg McMuffin', [['1 muffin', 148]], 236, 14.9, 20.3, 10.6],
  ['Hotcakes with syrup', [['3 hotcakes', 221]], 262, 5.4, 47.5, 5.7],
  ['Big Breakfast', [['1 serve', 285]], 274, 11.2, 21.1, 16.1],

  // ── Desserts and McCafé ──────────────────────────────────────────────────
  ['Sundae, hot fudge', [['1 sundae', 179]], 190, 3.9, 30.7, 5.6],
  ['McFlurry, Oreo', [['1 regular', 253]], 194, 4.3, 29.6, 6.3],
  ['McFlurry, Crunchie', [['1 regular', 253]], 209, 4.1, 33.2, 6.5],
  ['Soft Serve Cone', [['1 cone', 105]], 181, 4.3, 30.5, 4.4],
  ['Apple Pie', [['1 pie', 80]], 305, 2.9, 41.3, 14.1],
  ['Thick Shake, chocolate', [['1 medium', 475]], 111, 3.2, 19.4, 2.4],
  ['Frozen Coke', [['1 medium', 400]], 43, 0, 10.8, 0],
  ['Flat White', [['1 regular', 250]], 61, 3.2, 4.6, 3.3],
  ['Cappuccino', [['1 regular', 250]], 50, 2.7, 3.9, 2.7],
  ['Latte', [['1 regular', 250]], 55, 3.0, 4.4, 2.9],
  ['Long Black', [['1 regular', 250]], 2, 0.2, 0.2, 0],
];

const ALIASES = {
  'Big Mac': 'maccas big mac, bigmac',
  'Quarter Pounder with Cheese': 'qp, quarter pounder, qpc',
  'Chicken McNuggets': 'nuggets, mcnuggets, chicken nuggets',
  'Fries': 'chips, hot chips, french fries',
  'McChicken': 'mc chicken',
  'Filet-O-Fish': 'fillet o fish, fish burger',
  'Hash Brown': 'hashbrown',
  'Soft Serve Cone': 'ice cream cone, cone',
};

export const MCDONALDS_NZ = buildChain("McDonald's", ROWS, ALIASES);
