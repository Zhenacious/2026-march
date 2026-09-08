// Supabase silently caps every request at 1000 rows. Anything that reads "all
// sets" (export, records, dashboard totals) must page through in chunks or it
// quietly loses everything past the first thousand. Pass a function that
// builds the query (filters, select, order); this adds a stable tiebreak order
// and keeps asking for the next page until a short page comes back.
const PAGE = 1000;

export async function fetchAllRows(makeQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await makeQuery().order('id').range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < PAGE) return rows;
  }
}
