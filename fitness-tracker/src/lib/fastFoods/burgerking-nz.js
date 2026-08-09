// Burger King New Zealand — published nutrition information.
// Source: burgerking.co.nz nutrition tables. Read 2026-08-03.
//
// Row shape: [name, portions, kcal, protein, carbs, fat] — nutrition per 100 g.

import { buildChain } from './_build.js';

const ROWS = [
  // ── Whoppers ─────────────────────────────────────────────────────────────
  ['Whopper', [['1 burger', 270]], 234, 10.4, 18.9, 12.6],
  ['Whopper with Cheese', [['1 burger', 295]], 251, 11.5, 17.6, 14.6],
  ['Double Whopper', [['1 burger', 375]], 259, 13.9, 13.9, 16.8],
  ['Whopper Junior', [['1 burger', 155]], 232, 10.3, 20.0, 12.3],
  ['Bacon & Cheese Whopper', [['1 burger', 310]], 261, 12.6, 16.8, 15.5],

  // ── Beef burgers ─────────────────────────────────────────────────────────
  ['Cheeseburger', [['1 burger', 125]], 248, 13.6, 24.0, 10.4],
  ['Double Cheeseburger', [['1 burger', 175]], 274, 16.6, 17.7, 14.9],
  ['Hamburger', [['1 burger', 112]], 232, 12.5, 26.8, 8.0],
  ['BK Angus Classic', [['1 burger', 285]], 246, 13.3, 17.5, 13.7],
  ['Bacon Deluxe', [['1 burger', 250]], 264, 13.2, 18.0, 15.2],

  // ── Chicken ──────────────────────────────────────────────────────────────
  ['Chicken Royale', [['1 burger', 215]], 251, 10.7, 24.2, 12.6],
  ['Crispy Chicken Jr', [['1 burger', 130]], 254, 10.8, 25.4, 12.3],
  ['Tendercrisp Chicken', [['1 burger', 265]], 245, 11.7, 22.3, 12.1],
  ['Chicken Nuggets', [['6 nuggets', 97], ['3 nuggets', 49], ['10 nuggets', 162], ['20 nuggets', 324]], 268, 14.4, 17.5, 15.5],
  ['Chicken Fries', [['1 regular', 105]], 267, 14.3, 21.0, 14.3],

  // ── Sides ────────────────────────────────────────────────────────────────
  ['Fries', [['Medium', 116], ['Small', 78], ['Large', 154]], 293, 3.4, 38.8, 13.8],
  ['Onion Rings', [['Medium', 91], ['Small', 63], ['Large', 124]], 330, 4.4, 41.8, 16.5],
  ['Hash Brown Bites', [['1 regular', 75]], 267, 2.7, 29.3, 15.3],
  ['Garden Salad', [['1 salad', 130]], 22, 1.2, 3.1, 0.4],

  // ── Breakfast ────────────────────────────────────────────────────────────
  ['BK Muffin, bacon & egg', [['1 muffin', 145]], 248, 13.8, 21.4, 11.7],
  ['BK Muffin, sausage & egg', [['1 muffin', 165]], 285, 13.3, 18.8, 17.0],

  // ── Desserts and drinks ──────────────────────────────────────────────────
  ['Sundae, chocolate', [['1 sundae', 155]], 187, 3.9, 30.3, 5.2],
  ['Thickshake, chocolate', [['1 medium', 400]], 118, 3.3, 20.0, 2.8],
  ['Apple Pie', [['1 pie', 77]], 299, 2.6, 40.3, 14.3],
];

const ALIASES = {
  'Whopper': 'bk whopper',
  'Whopper with Cheese': 'cheese whopper',
  'Chicken Royale': 'royale, chicken royal',
  'Fries': 'bk fries, chips, hot chips',
  'Onion Rings': 'onion ring',
};

export const BURGERKING_NZ = buildChain('Burger King', ROWS, ALIASES);
