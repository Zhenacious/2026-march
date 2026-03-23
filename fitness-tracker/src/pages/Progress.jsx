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
import { TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';

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

const MUSCLE_GROUPS = [
  { label: 'All',       categories: null },
  { label: 'Chest',     categories: ['chest'] },
  { label: 'Back',      categories: ['back'] },
  { label: 'Arms',      categories: ['biceps', 'triceps'] },
  { label: 'Legs',      categories: ['legs'] },
  { label: 'Shoulders', categories: ['shoulders'] },
  { label: 'Abs',       categories: ['abs'] },
  { label: 'Mobility',  categories: ['mobility'] },
];

export default function Progress() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState([]);      // [{ name, category }]
  const [selectedExercise, setSelectedExercise] = useState('');
  const [activeGroup, setActiveGroup] = useState('All');
  const [timeScale, setTimeScale] = useState('all');
  const [chartData, setChartData] = useState([]);
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

      // Fetch categories for these exercises
      const { data: exData } = await supabase
        .from('exercises')
        .select('name, category')
        .eq('user_id', user.id)
        .in('name', uniqueNames);

      const catMap = {};
      (exData || []).forEach((ex) => { catMap[ex.name] = ex.category || ''; });

      const withCats = uniqueNames.map((name) => ({ name, category: catMap[name] || '' }));
      setExercises(withCats);
      if (withCats.length > 0) setSelectedExercise(withCats[0].name);
    }
    fetchExercises();
  }, [user]);

  // When group changes, reset selected exercise to first in filtered list
  useEffect(() => {
    const group = MUSCLE_GROUPS.find((g) => g.label === activeGroup);
    const filtered = exercises.filter((ex) => {
      if (group.categories === null) return true;
      return group.categories.includes((ex.category || '').toLowerCase());
    });
    if (filtered.length > 0) setSelectedExercise(filtered[0].name);
    else setSelectedExercise('');
  }, [activeGroup, exercises]);

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
        // Epley formula: e1RM = weight × (1 + reps / 30)
        const e1rm = (s.reps || 0) > 0
          ? Math.round((s.weight_kg || 0) * (1 + (s.reps || 0) / 30) * 10) / 10
          : (s.weight_kg || 0);
        if (!byDate[date]) byDate[date] = { maxE1RM: 0, totalVolume: 0 };
        if (e1rm > byDate[date].maxE1RM) byDate[date].maxE1RM = e1rm;
        byDate[date].totalVolume += (s.weight_kg || 0) * (s.reps || 0);
      });

      const data = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({
          date: format(parseISO(date), timeScale === 'month' ? 'MMM d' : 'MMM d yy'),
          'Est. 1RM (kg)': vals.maxE1RM,
          'Total Volume (kg)': Math.round(vals.totalVolume),
        }));

      setChartData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, selectedExercise, timeScale]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

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
                ? 'bg-violet-600 text-white border-violet-600'
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
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600 hover:text-zinc-200'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <label className="block text-xs font-medium text-zinc-400 mb-1">Exercise</label>
        {exercises.length === 0 ? (
          <p className="text-zinc-500 text-sm">No exercises found. Log some workouts first.</p>
        ) : (() => {
          const group = MUSCLE_GROUPS.find((g) => g.label === activeGroup);
          const filtered = exercises.filter((ex) => {
            if (group.categories === null) return true;
            return group.categories.includes((ex.category || '').toLowerCase());
          });
          return filtered.length === 0 ? (
            <p className="text-zinc-500 text-sm">No {activeGroup} exercises logged yet.</p>
          ) : (
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-48"
            >
              {filtered.map((ex) => (
                <option key={ex.name} value={ex.name}>{ex.name}</option>
              ))}
            </select>
          );
        })()}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-zinc-400">Loading chart…</div>
      ) : chartData.length === 0 ? (
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
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="Est. 1RM (kg)"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <h2 className="text-zinc-100 font-semibold mb-5">Total Volume per Session</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="Total Volume (kg)"
                  fill="#6d28d9"
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
