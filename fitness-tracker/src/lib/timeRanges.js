// Shared time-range options for every chart in the app, so the buttons and
// their meaning stay identical on the Progress and Exercise History pages.
export const TIME_RANGES = [
  { label: '1 Month', value: 'month' },
  { label: '3 Months', value: 'quarter' },
  { label: '1 Year', value: 'year' },
  { label: 'All Time', value: 'all' },
];

// The earliest date to include for a given range value, as a Date object.
// Returns null for 'all' (no cutoff — show everything).
export function rangeCutoff(value, from = new Date()) {
  const d = new Date(from);
  if (value === 'month') { d.setMonth(d.getMonth() - 1); return d; }
  if (value === 'quarter') { d.setMonth(d.getMonth() - 3); return d; }
  if (value === 'year') { d.setFullYear(d.getFullYear() - 1); return d; }
  return null;
}

// Charts use compact "MMM d" labels for short ranges and add the year for
// longer ones so the axis stays readable.
export function rangeDateFormat(value) {
  return value === 'month' || value === 'quarter' ? 'MMM d' : 'MMM d yy';
}
