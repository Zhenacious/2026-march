import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { loadBodyWeights, effectiveWeight } from '../lib/bodyWeight';
import { format, parseISO } from 'date-fns';
import { MUSCLE_GROUPS } from '../lib/categories';
import { DEFAULT_TRACK_TYPE, trackTypeLabel } from '../lib/trackTypes';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
        <p className="text-zinc-300 font-medium mb-1">{label}</p>
        {payload.map((entry) => (
          <p key={entry.dataKey} style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};


export default function Progress() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exercises, setExercises] = useState([]);      // [{ name, category }]
  const [selectedExercise, setSelectedExercise] = useState('');
  const [activeGroup, setActiveGroup] = useState('All');
  // Keep a ref so the tab-change effect can read exercises without depending on them
  const exercisesRef = React.useRef([]);
  const [defaultExercise, setDefaultExercise] = useState(
    () => localStorage.getItem('progress_default_exercise') || ''
  );
  const [timeScale, setTimeScale] = useState('all');
  const [chartData, setChartData] = useState([]);
  const [bodyWeights] = useState(() => loadBodyWeights());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchExercises() {
      if (!user) return;
      const { data: workouts } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', user.id);

      if (!workouts || workouts.length === 0) return;

      const workoutIds = workouts.map((w) => w.id);
      const { data: sets } = await supabase
        .from('workout_sets')
        .select('exercise_name')
        .in('workout_id', workoutIds);

      if (!sets) return;

      const uniqueNames = [...new Set(sets.map((s) => s.exercise_name))].sort();

      // Fetch categories + track types for these exercises. select('*') keeps the
      // page working before the track_type migration is applied.
      const { data: exData } = await supabase
        .from('exercises')
        .select('*')
        .eq('user_id', user.id)
        .in('name', uniqueNames);

      const catMap = {};
      const typeMap = {};
      (exData || []).forEach((ex) => {
        catMap[ex.name] = ex.category || '';
        typeMap[ex.name] = ex.track_type || DEFAULT_TRACK_TYPE;
      });

      const withCats = uniqueNames.map((name) => ({
        name,
        category: catMap[name] || '',
        track_type: typeMap[name] || DEFAULT_TRACK_TYPE,
      }));
      exercisesRef.current = withCats;
      setExercises(withCats);
      // Preference: the exercise you last viewed > your starred default > first in list.
      const lastSel = localStorage.getItem('progress_last_exercise');
      const defaultEx = localStorage.getItem('progress_default_exercise');
      const initial = (lastSel && withCats.some((e) => e.name === lastSel)) ? lastSel
        : (defaultEx && withCats.some((e) => e.name === defaultEx)) ? defaultEx
          : withCats[0]?.name || '';
      setSelectedExercise(initial);
    }
    fetchExercises();
  }, [user]);

  // When the user switches group tabs, reset to first exercise in that group.
  // Reads exercises via ref so this effect only runs on tab changes, not on initial load —
  // that way fetchExercises can set the default without being overwritten.
  useEffect(() => {
    const group = MUSCLE_GROUPS.find((g) => g.label === activeGroup);
    const filtered = exercisesRef.current.filter((ex) => {
      if (group.categories === null) return true;
      return group.categories.includes((ex.category || '').toLowerCase());
    });
    if (filtered.length > 0) setSelectedExercise(filtered[0].name);
    else setSelectedExercise('');
  }, [activeGroup]); // exercises intentionally read via ref, not as a dependency

  const fetchChartData = useCallback(async () => {
    if (!user || !selectedExercise) return;
    setLoading(true);
    setError('');

    try {
      // Apply time scale cutoff
      const now = new Date();
      let cutoff = null;
      if (timeScale === 'year') { cutoff = new Date(now); cutoff.setFullYear(cutoff.getFullYear() - 1); }
      if (timeScale === 'month') { cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 1); }

      let query = supabase.from('workouts').select('id, date').eq('user_id', user.id).order('date');
      if (cutoff) query = query.gte('date', format(cutoff, 'yyyy-MM-dd'));

      const { data: workouts, error: wErr } = await query;
      if (wErr) throw wErr;
      if (!workouts || workouts.length === 0) { setChartData([]); return; }

      const workoutIds = workouts.map((w) => w.id);
      const workoutMap = {};
      workouts.forEach((w) => { workoutMap[w.id] = w.date; });

      const { data: sets, error: sErr } = await supabase
        .from('workout_sets')
        .select('workout_id, weight_kg, reps')
        .in('workout_id', workoutIds)
        .eq('exercise_name', selectedExercise);

      if (sErr) throw sErr;
      if (!sets || sets.length === 0) { setChartData([]); return; }

      const byDate = {};
      sets.forEach((s) => {
        const date = workoutMap[s.workout_id];
        if (!date) return;
        const effW = effectiveWeight(s.weight_kg, s.reps, date, bodyWeights);
        const e1rm = (s.reps || 0) > 0
          ? Math.round(effW * (1 + (s.reps || 0) / 30) * 10) / 10
          : effW;
        if (!byDate[date]) byDate[date] = { maxE1RM: 0, totalVolume: 0 };
        if (e1rm > byDate[date].maxE1RM) byDate[date].maxE1RM = e1rm;
        byDate[date].totalVolume += effW * (s.reps || 0);
      });

      const data = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({
          date: format(parseISO(date), timeScale === 'month' ? 'MMM d' : 'MMM d yy'),
          isoDate: date,
          'Est. 1RM (kg)': vals.maxE1RM,
          'Total Volume (kg)': Math.round(vals.totalVolume),
        }));

      setChartData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, selectedExercise, timeScale, bodyWeights]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  // Remember which exercise you last viewed so opening Progress again resumes
  // on it rather than jumping back to the first in the list.
  useEffect(() => {
    if (selectedExercise) {
      try { localStorage.setItem('progress_last_exercise', selectedExercise); } catch { /* ignore */ }
    }
  }, [selectedExercise]);

  function handleChartClick() {
    if (selectedExercise) navigate(`/exercises/${encodeURIComponent(selectedExercise)}`);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Progress</h1>
      <p className="text-zinc-400 text-sm mb-6">Track your strength gains over time</p>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Time scale */}
      <div className="flex gap-1.5 mb-6">
        {[{ label: 'All Time', value: 'all' }, { label: '1 Year', value: 'year' }, { label: '1 Month', value: 'month' }].map((t) => (
          <button
            key={t.value}
            onClick={() => setTimeScale(t.value)}
            className={`text-xs px-4 py-2 rounded-lg border font-medium transition-colors ${
              timeScale === t.value
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
        {/* Muscle group tabs */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          {MUSCLE_GROUPS.map((g) => (
            <button
              key={g.label}
              onClick={() => setActiveGroup(g.label)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                activeGroup === g.label
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600 hover:text-zinc-200'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-zinc-400">Exercise</label>
          <div className="flex items-center gap-2">
          {selectedExercise && (
            <button
              onClick={() => navigate(`/exercises/${encodeURIComponent(selectedExercise)}`)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border bg-zinc-800 hover:bg-zinc-700 border-zinc-700 hover:border-zinc-600 text-zinc-300 transition-colors"
            >
              <TrendingUp className="w-3 h-3" />
              View Exercise
            </button>
          )}
          {selectedExercise && (
            <button
              onClick={() => {
                const isDefault = defaultExercise === selectedExercise;
                const next = isDefault ? '' : selectedExercise;
                localStorage.setItem('progress_default_exercise', next);
                setDefaultExercise(next);
              }}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                defaultExercise === selectedExercise
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-200 hover:border-zinc-600'
              }`}
            >
              <Star className={`w-3 h-3 ${defaultExercise === selectedExercise ? 'fill-amber-400 text-amber-400' : ''}`} />
              {defaultExercise === selectedExercise ? 'Default' : 'Set as default'}
            </button>
          )}
          </div>
        </div>
        {exercises.length === 0 ? (
          <p className="text-zinc-500 text-sm">No exercises found. Log some workouts first.</p>
        ) : (() => {
          const group = MUSCLE_GROUPS.find((g) => g.label === activeGroup);
          const filtered = exercises.filter((ex) => {
            if (group.categories === null) return true;
            return group.categories.includes((ex.category || '').toLowerCase());
          });
          if (filtered.length === 0) {
            return <p className="text-zinc-500 text-sm">No {activeGroup} exercises logged yet.</p>;
          }
          const idx = filtered.findIndex((e) => e.name === selectedExercise);
          const prevName = idx > 0 ? filtered[idx - 1].name : null;
          const nextName = idx >= 0 && idx < filtered.length - 1 ? filtered[idx + 1].name : null;
          return (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => prevName && setSelectedExercise(prevName)}
                disabled={!prevName}
                title={prevName ? `Previous: ${prevName}` : 'No previous exercise'}
                className="text-zinc-500 hover:text-zinc-200 disabled:opacity-20 disabled:hover:text-zinc-500 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-48"
              >
                {filtered.map((ex) => (
                  <option key={ex.name} value={ex.name}>
                    {ex.name}{defaultExercise === ex.name ? ' ★' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => nextName && setSelectedExercise(nextName)}
                disabled={!nextName}
                title={nextName ? `Next: ${nextName}` : 'No next exercise'}
                className="text-zinc-500 hover:text-zinc-200 disabled:opacity-20 disabled:hover:text-zinc-500 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          );
        })()}
      </div>

      {(() => {
        const selectedType = (exercises.find((e) => e.name === selectedExercise) || {}).track_type || DEFAULT_TRACK_TYPE;
        if (loading) {
          return <div className="flex items-center justify-center h-48 text-zinc-400">Loading chart…</div>;
        }
        if (selectedExercise && selectedType !== 'weight_reps') {
          return (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <TrendingUp className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-300 font-semibold text-sm mb-1">
                {trackTypeLabel(selectedType)} exercise
              </p>
              <p className="text-zinc-500 text-xs mb-4 max-w-sm mx-auto">
                The kg-based 1RM and volume charts don't apply here. Type-aware charts for time and distance are coming in a follow-up — for now, view this exercise's history page for the full session list.
              </p>
              {selectedExercise && (
                <button
                  onClick={() => navigate(`/exercises/${encodeURIComponent(selectedExercise)}`)}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border bg-zinc-800 hover:bg-zinc-700 border-zinc-700 hover:border-zinc-600 text-zinc-300 transition-colors"
                >
                  <TrendingUp className="w-3 h-3" /> View history
                </button>
              )}
            </div>
          );
        }
        return null;
      })()}

      {loading ? null : ((exercises.find((e) => e.name === selectedExercise) || {}).track_type || DEFAULT_TRACK_TYPE) !== 'weight_reps' ? null : chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
          <TrendingUp className="w-8 h-8 opacity-40" />
          <p className="text-sm">No data for this exercise yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-zinc-100 font-semibold">Estimated 1 Rep Max</h2>
              <span className="text-zinc-500 text-xs">Epley formula: weight × (1 + reps/30)</span>
            </div>
            <p className="text-zinc-500 text-xs mb-5">Best set per session</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={{ stroke: '#3f3f46' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={{ stroke: '#3f3f46' }}
                  tickLine={false}
                  unit=" kg"
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="Est. 1RM (kg)"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={{ fill: '#14b8a6', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-zinc-100 font-semibold mb-5">Total Volume per Session</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} onClick={handleChartClick} style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={{ stroke: '#3f3f46' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={{ stroke: '#3f3f46' }}
                  tickLine={false}
                  unit=" kg"
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="Total Volume (kg)"
                  fill="#0d9488"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
