// NZ/AU fast food menu nutrition, one file per chain.
//
// Chains publish per-item values, so each row's per-100g figures are worked out
// as perItem x 100 / itemGrams and the item weight becomes the portion. That
// keeps fast food on exactly the same footing as every other food: per-100g is
// the basis, portions supply the weight.
//
// Every chain file records where its numbers came from and when they were read.
// Menus get reformulated, so treat anything more than a year old as worth a
// re-check — and every value stays editable in My Foods.

import { MCDONALDS_NZ } from './mcdonalds-nz.js';
import { SUBWAY_NZ } from './subway-nz.js';
import { KFC_NZ } from './kfc-nz.js';
import { BURGERKING_NZ } from './burgerking-nz.js';
import { DOMINOS_NZ } from './dominos-nz.js';

export const FAST_FOOD_CHAINS = [
  { key: 'mcdonalds-nz', name: "McDonald's", rows: MCDONALDS_NZ },
  { key: 'subway-nz', name: 'Subway', rows: SUBWAY_NZ },
  { key: 'kfc-nz', name: 'KFC', rows: KFC_NZ },
  { key: 'burgerking-nz', name: 'Burger King', rows: BURGERKING_NZ },
  { key: 'dominos-nz', name: "Domino's", rows: DOMINOS_NZ },
];

export const FAST_FOODS = FAST_FOOD_CHAINS.flatMap((c) => c.rows);
