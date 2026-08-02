// Single source of truth for muscle-group colours and config.
// Import from here instead of re-defining locally in each page.

export const CATEGORY_COLORS = {
  chest:     { dot: 'bg-rose-500',   badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',     label: 'Chest' },
  back:      { dot: 'bg-blue-500',   badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',     label: 'Back' },
  abs:       { dot: 'bg-amber-400',  badge: 'bg-amber-400/20 text-amber-300 border-amber-400/40',  label: 'Abs' },
  legs:      { dot: 'bg-green-500',  badge: 'bg-green-500/20 text-green-300 border-green-500/40',  label: 'Legs' },
  triceps:   { dot: 'bg-orange-500', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40', label: 'Triceps' },
  biceps:    { dot: 'bg-violet-500', badge: 'bg-violet-500/20 text-violet-300 border-violet-500/40', label: 'Biceps' },
  shoulders: { dot: 'bg-sky-500',    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',         label: 'Shoulders' },
  mobility:  { dot: 'bg-teal-500',   badge: 'bg-teal-500/20 text-teal-300 border-teal-500/40',     label: 'Mobility' },
  full_body: { dot: 'bg-white',      badge: 'bg-white/20 text-white border-white/40',             label: 'Full Body' },
};

export const MUSCLE_GROUPS = [
  { label: 'All',       categories: null },
  { label: 'Chest',     categories: ['chest'] },
  { label: 'Back',      categories: ['back'] },
  { label: 'Arms',      categories: ['biceps', 'triceps'] },
  { label: 'Legs',      categories: ['legs'] },
  { label: 'Shoulders', categories: ['shoulders'] },
  { label: 'Abs',       categories: ['abs'] },
  { label: 'Mobility',  categories: ['mobility'] },
  { label: 'Full Body', categories: ['full_body'] },
];

export const CATEGORY_OPTIONS = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'abs', 'mobility', 'full_body'];

// The display name for a category key — 'full_body' reads as 'Full Body' rather
// than the raw key, which is why callers should never capitalize keys themselves.
export function categoryLabel(category) {
  return CATEGORY_COLORS[category]?.label
    || (category ? category.charAt(0).toUpperCase() + category.slice(1) : '');
}

// Keys stripped to letters and digits, so a category written any reasonable way
// still finds its canonical form: 'Full Body', 'full-body' and 'fullbody' all
// resolve to 'full_body'.
const CANONICAL_BY_SQUASHED = Object.fromEntries(
  CATEGORY_OPTIONS.map((c) => [c.replace(/[^a-z0-9]/g, ''), c])
);

// Matches a raw category string (any case/spacing) against the canonical
// CATEGORY_OPTIONS list. Anything that doesn't match collapses to '' (uncategorized) —
// this is what stops "Abs" and "abs" forming two separate groups on the Exercises page.
export function normalizeCategory(category) {
  const squashed = (category || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return CANONICAL_BY_SQUASHED[squashed] || '';
}
