import { supabase } from './supabase';

// Notes used to live only in this browser's localStorage. This pushes any
// that are still there into the database, once per device, and never
// overwrites a note that already exists on the server. The local copies are
// left in place as a harmless backup.
const FLAG = 'fittrack_notes_migrated_v1';

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}

export async function migrateLocalNotes(userId) {
  try { if (localStorage.getItem(FLAG)) return null; } catch { return null; }

  const sessionNotes = readJson('fittrack_notes');
  const setNotes = readJson('fittrack_set_notes');
  const dates = Object.keys(sessionNotes).filter((d) => String(sessionNotes[d] || '').trim());
  const setIds = Object.keys(setNotes).filter((id) => String(setNotes[id] || '').trim());

  try {
    if (dates.length) {
      const { data: rows, error } = await supabase
        .from('workouts').select('id, date, notes').eq('user_id', userId).in('date', dates);
      if (error) throw error;
      const byDate = new Map((rows || []).map((r) => [r.date, r]));
      for (const date of dates) {
        const notes = String(sessionNotes[date]).trim();
        const row = byDate.get(date);
        if (row) {
          if (row.notes) continue; // server already has a note for that day
          const { error: upErr } = await supabase.from('workouts').update({ notes }).eq('id', row.id);
          if (upErr) throw upErr;
        } else {
          const { error: insErr } = await supabase
            .from('workouts')
            .upsert({ user_id: userId, date, notes }, { onConflict: 'user_id,date' });
          if (insErr) throw insErr;
        }
      }
    }

    // Set notes: only fill rows whose note is still empty. A few at a time so
    // a phone with many notes isn't hammered with hundreds of requests at once.
    for (let i = 0; i < setIds.length; i += 10) {
      const chunk = setIds.slice(i, i + 10);
      const results = await Promise.all(chunk.map((id) =>
        supabase.from('workout_sets')
          .update({ notes: String(setNotes[id]).trim() })
          .eq('id', id)
          .eq('notes', '')
      ));
      const failed = results.find((r) => r.error);
      if (failed) throw failed.error;
    }

    try { localStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
    return { sessions: dates.length, sets: setIds.length };
  } catch (err) {
    // Flag stays unset so it is retried next time
    console.warn('Notes migration did not finish:', err?.message || err);
    return null;
  }
}
