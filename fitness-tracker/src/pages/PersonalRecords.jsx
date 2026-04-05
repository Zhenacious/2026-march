import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Trophy, TrendingUp } from 'lucide-react';
import { CATEGORY_COLORS, MUSCLE_GROUPS } from '../lib/categories';
import { loadBodyWeights, effectiveWeight } from '../lib/bodyWeight';
import { format, parseISO } from 'date-fns';

export default function PersonalRecords() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState('All');
  const [bodyWeights] = useState(() => loadBodyWeights());

  useEffect(() => {
    async function fetchRecords() {
      if (!user) return;
      setLoading(true);
      try {
        const { data: workouts } = await supabase
          .from('workouts')
          .select('id, date')
          .eq('user_id', user.id);

        if (!workouts || workouts.length === 0) { setRecords([]); return; }

        const workoutDateMap = {};
        workouts.forEach((w) => { workoutDateMap[w.id] = w.date; });
        const workoutIds = workouts.map((w) => w.id);

        const { data: sets } = await supabase
          .from('workout_sets')
          .select('workout_id, exercise_name, weight_kg, reps')
          .in('workout_id', workoutIds);

        if (!sets || sets.length === 0) { setRecords([]); return; }

        const { data: exercises } = await supabase
          .from('exercises')
          .select('name, category')
          .eq('user_id', user.id);

        const catMap = {};
        (exercises || []).forEach((ex) => { catMap[ex.name.toLowerCase()] = ex.category || ''; });

        // Calculate best e1RM, best weight, best reps per exercise
        const byExercise = {};
        sets.forEach((s) => {
          const date = workoutDateMap[s.workout_id];
          if (!date) return;
          const name = s.exercise_name;
          if (!byExercise[name]) {
            byExercise[name] = { bestE1RM: 0, bestWeight: 0, bestReps: 0, bestE1RMDate: null };
          }
          const effW = effectiveWeight(s.weight_kg, s.reps, date, bodyWeights);
          const reps = s.reps || 0;
          const e1rm = reps > 0 ? Math.round(effW * (1 + reps / 30) * 10) / 10 : effW;
          if (e1rm > byExercise[name].bestE1RM) {
            byExercise[name].bestE1RM = e1rm;
            byExercise[name].bestE1RMDate = date;
          }
          if (effW > byExercise[name].bestWeight) byExercise[name].bestWeight = effW;
          if (reps > byExercise[name].bestReps) byExercise[name].bestReps = reps;
        });

        const result = Object.entries(byExercise)
          .map(([name, rec]) => ({
            name,
            category: catMap[name.toLowerCase()] || '',
            ...rec,
          }))
          .filter((r) => r.bestE1RM > 0)
          .sort((a, b) => b.bestE1RM - a.bestE1RM);

        setRecords(result);
      } finally {
        setLoading(false);
      }
    }
    fetchRecords();
  }, [user]);

  const filtered = useMemo(() => {
    const group = MUSCLE_GROUPS.find((g) => g.label === activeGroup);
    if (!group || !group.categories) return records;
    return records.filter((r) => group.categories.includes((r.category || '').toLowerCase()));
  }, [records, activeGroup]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Trophy className="w-5 h-5 text-amber-400" />
        <h1 className="text-2xl font-bold text-zinc-100">Personal Records</h1>
      </div>
      <p className="text-zinc-500 text-sm mb-6">All-time bests per exercise</p>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap mb-5 overflow-x-auto pb-1">
        {MUSCLE_GROUPS.map((g) => (
          <button
            key={g.label}
            onClick={() => setActiveGroup(g.label)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-shrink-0 ${
              activeGroup === g.label
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-zinc-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-zinc-500 gap-2">
          <TrendingUp className="w-8 h-8 opacity-40" />
          <p className="text-sm">No records yet — log some workouts first.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((rec, idx) => {
            const cat = (rec.category || '').toLowerCase();
            const color = CATEGORY_COLORS[cat] || null;
            return (
              <button
                key={rec.name}
                onClick={() => navigate(`/exercises/${encodeURIComponent(rec.name)}`)}
                className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 rounded-2xl px-4 py-3.5 text-left transition-colors"
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-zinc-600 text-xs w-5 text-center flex-shrink-0 font-medium">#{idx + 1}</span>
                  {color && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />}
                  <span className="text-zinc-100 font-semibold text-sm flex-1 truncate">{rec.name}</span>
                  {color && (
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${color.badge} font-medium flex-shrink-0`}>
                      {color.label}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 ml-7">
                  <div>
                    <p className="text-zinc-600 text-xs mb-0.5">Est. 1RM</p>
                    <p className="text-amber-400 font-bold text-base leading-none">
                      {rec.bestE1RM}<span className="text-zinc-500 text-xs font-normal ml-0.5">kg</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-600 text-xs mb-0.5">Best weight</p>
                    <p className="text-zinc-200 font-semibold text-base leading-none">
                      {rec.bestWeight}<span className="text-zinc-500 text-xs font-normal ml-0.5">kg</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-600 text-xs mb-0.5">Most reps</p>
                    <p className="text-zinc-200 font-semibold text-base leading-none">
                      {rec.bestReps}<span className="text-zinc-500 text-xs font-normal ml-0.5">reps</span>
                    </p>
                  </div>
                </div>
                {rec.bestE1RMDate && (
                  <p className="text-zinc-700 text-xs mt-2 ml-7">{format(parseISO(rec.bestE1RMDate), 'MMM d, yyyy')}</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
