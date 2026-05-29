import { supabase } from './supabase';
import { SEED_EXERCISES } from './seedExercises';
import { defaultTrackTypeForCategory } from './trackTypes';

// Tracks users we've already attempted to seed during this page load, so the
// routine can't run twice if multiple auth events fire in quick succession.
const attempted = new Set();

// Seeds a brand-new user's exercise library with the curated starter list.
// Runs at most once per user (guarded by a flag stored on the user's account).
// Existing users — who already have exercises — are flagged but NOT seeded;
// they top up their library via the button on the Exercises page instead.
export async function maybeSeedExercises(user) {
  if (!user) return;
  if (user.user_metadata?.exercises_seeded) return;
  if (attempted.has(user.id)) return;
  attempted.add(user.id);

  try {
    const { count, error: countErr } = await supabase
      .from('exercises')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if (countErr) throw countErr;

    if ((count ?? 0) === 0) {
      const rows = SEED_EXERCISES.map((ex) => ({
        user_id: user.id,
        name: ex.name,
        category: ex.category,
        track_type: defaultTrackTypeForCategory(ex.category),
      }));
      const { error: insertErr } = await supabase
        .from('exercises')
        .upsert(rows, { onConflict: 'user_id,name', ignoreDuplicates: true });
      if (insertErr) throw insertErr;
    }

    // Mark as seeded so we never auto-seed this account again, even across
    // devices or after they delete exercises on purpose.
    await supabase.auth.updateUser({ data: { exercises_seeded: true } });
  } catch (err) {
    // Seeding is best-effort — never block sign-in if it fails. Allow a retry
    // on the next page load by clearing the in-memory guard.
    attempted.delete(user.id);
    console.error('Exercise library seeding failed:', err.message);
  }
}
