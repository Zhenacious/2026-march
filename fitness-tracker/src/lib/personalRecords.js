// Estimated one-rep max, and which sets earn the "PR!" badge on Today.
//
// This is the one place the front end works out an e1RM. The pages used to
// each carry their own copy of the formula and they disagreed about singles.

// Epley: weight x (1 + reps / 30), to one decimal place.
// A set of one rep IS a one-rep max, so it is never estimated upwards -
// Epley would report a 140 kg single as 144.7 kg.
export function estimate1RM(weightKg, reps) {
  const weight = Number(weightKg) || 0;
  const count = Number(reps) || 0;
  if (weight <= 0 || count <= 0) return 0;
  if (count === 1) return Math.round(weight * 10) / 10;
  return Math.round(weight * (1 + count / 30) * 10) / 10;
}

export function e1rmOf(set) {
  return estimate1RM(set?.weight_kg, set?.reps);
}

// A set is a personal record when its estimated one-rep max beats EVERY other
// set of that exercise the user has ever logged - including the sets already
// logged on the day being viewed. Matching a record is not beating it, so a
// repeat of the record set is second best, not a new record.
//
// `statsByName[name].bestE1RM` is the best e1RM from every OTHER day (the day
// being viewed is excluded from that query so the entry pad can show the last
// session). Today's sets are added back in here.
//
// sets          - the day's sets, in the order they were logged
// statsByName   - history stats keyed by exercise name (see loadStats)
// trackTypeOf   - (name) => track type; only 'weight_reps' can set a record
export function computePrSetIds(sets, statsByName, trackTypeOf) {
  const prIds = new Set();
  const bestSoFar = {};

  for (const set of sets || []) {
    const name = set?.exercise_name;
    const stats = statsByName?.[name];
    // History for this exercise hasn't loaded, or the exercise has none at
    // all: don't announce a record we can't actually compare against.
    if (!name || !stats) continue;
    if (trackTypeOf(name) !== 'weight_reps') continue;

    const e1rm = e1rmOf(set);
    if (e1rm <= 0) continue;

    const best = name in bestSoFar ? bestSoFar[name] : Number(stats.bestE1RM) || 0;
    if (e1rm > best) {
      prIds.add(set.id);
      bestSoFar[name] = e1rm;
    } else {
      bestSoFar[name] = best;
    }
  }

  return prIds;
}
