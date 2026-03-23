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

export default function Progress() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState('');
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

      const unique = [...new Set(sets.map((s) => s.exercise_name))].sort();
      setExercises(unique);
      if (unique.length > 0) setSelectedExercise(unique[0]);
    }
    fetchExercises();
  }, [user]);

  const fetchChartData = useCallback(async () => {
    if (!user || !selectedExercise) return;
    setLoading(true);
    setError('');

    try {
      const { data: workouts, error: wErr } = await supabase
        .from('workouts')
        .select('id, date')
        .eq('user_id', user.id)
        .order('date');

      if (wErr) throw wErr;
      if (!workouts || workouts.length === 0) {
        setChartData([]);
        return;
      }

      const workoutIds = workouts.map((w) => w.id);
      const workoutMap = {};
      workouts.forEach((w) => { workoutMap[w.id] = w.date; });

      const { data: sets, error: sErr } = await supabase
        .from('workout_sets')
        .select('workout_id, weight_kg, reps')
        .in('workout_id', workoutIds)
        .eq('exercise_name', selectedExercise);

      if (sErr) throw sErr;
      if (!sets || sets.length === 0) {
        setChartData([]);
        return;
      }

      const byDate = {};
      sets.forEach((s) => {
        const date = workoutMap[s.workout_id];
        if (!date) return;
        if (!byDate[date]) byDate[date] = { maxWeight: 0, totalVolume: 0 };
        if (s.weight_kg > byDate[date].maxWeight) byDate[date].maxWeight = s.weight_kg;
        byDate[date].totalVolume += (s.weight_kg || 0) * (s.reps || 0);
      });

      const data = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({
          date: format(parseISO(date), 'MMM d'),
          'Max Weight (kg)': vals.maxWeight,
          'Total Volume (kg)': Math.round(vals.totalVolume),
        }));

      setChartData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, selectedExercise]);

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

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
        <label className="block text-xs font-medium text-zinc-400 mb-1">Exercise</label>
        {exercises.length === 0 ? (
          <p className="text-zinc-500 text-sm">No exercises found. Log some workouts first.</p>
        ) : (
          <select
            value={selectedExercise}
            onChange={(e) => setSelectedExercise(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-48"
          >
            {exercises.map((ex) => (
              <option key={ex} value={ex}>
                {ex}
              </option>
            ))}
          </select>
        )}
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
            <h2 className="text-zinc-100 font-semibold mb-5">Max Weight per Session</h2>
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
                  dataKey="Max Weight (kg)"
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
