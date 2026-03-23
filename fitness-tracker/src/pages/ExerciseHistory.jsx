import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const CATEGORY_COLORS = {
  chest:     { dot: 'bg-rose-500',   badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  back:      { dot: 'bg-blue-500',   badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  abs:       { dot: 'bg-amber-400',  badge: 'bg-amber-400/20 text-amber-300 border-amber-400/40' },
  legs:      { dot: 'bg-green-500',  badge: 'bg-green-500/20 text-green-300 border-green-500/40' },
  triceps:   { dot: 'bg-orange-500', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  biceps:    { dot: 'bg-violet-500', badge: 'bg-violet-500/20 text-violet-300 border-violet-500/40' },
  shoulders: { dot: 'bg-sky-500',    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  mobility:  { dot: 'bg-teal-500',   badge: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
        <p className="text-zinc-300 font-medium mb-1">{label}</p>
        {payload.map((entry) => (
          <p key={entry.dataKey} style={{ color: entry.color }}>
            {entry.name}: {entry.value} kg
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ExerciseHistory() {
  const { name } = useParams();
  const exerciseName = decodeURIComponent(name);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [exercise, setExercise] = useState(null);
  const [sessions, setSessions] = useState([]); // [{ date, sets: [] }]
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchHistory() {
      if (!user) return;
      setLoading(true);
      setError('');
      try {
        // Fetch exercise metadata
        const { data: exData } = await supabase
          .from('exercises')
          .select('name, category')
          .eq('user_id', user.id)
          .eq('name', exerciseName)
          .maybeSingle();
        setExercise(exData || { name: exerciseName, category: '' });

        // Fetch all workouts for this user
        const { data: workouts, error: wErr } = await supabase
          .from('workouts')
          .select('id, date')
          .eq('user_id', user.id)
          .order('date', { ascending: false });
        if (wErr) throw wErr;
        if (!workouts || workouts.length === 0) { setSessions([]); return; }

        const workoutIds = workouts.map((w) => w.id);
        const workoutDateMap = {};
        workouts.forEach((w) => { workoutDateMap[w.id] = w.date; });

        // Fetch all sets for this exercise
        const { data: sets, error: sErr } = await supabase
          .from('workout_sets')
          .select('*')
          .in('workout_id', workoutIds)
          .eq('exercise_name', exerciseName)
          .order('set_order');
        if (sErr) throw sErr;
        if (!sets || sets.length === 0) { setSessions([]); return; }

        // Group sets by workout date
        const byDate = {};
        sets.forEach((s) => {
          const date = workoutDateMap[s.workout_id];
          if (!date) return;
          if (!byDate[date]) byDate[date] = [];
          byDate[date].push(s);
        });

        // Sort dates descending
        const sorted = Object.entries(byDate)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, dateSets]) => ({ date, sets: dateSets }));
        setSessions(sorted);

        // Chart: e1RM per session (ascending for chart)
        const chart = Object.entries(byDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, dateSets]) => {
            const maxE1RM = Math.max(...dateSets.map((s) =>
              (s.reps || 0) > 0
                ? Math.round((s.weight_kg || 0) * (1 + (s.reps || 0) / 30) * 10) / 10
                : (s.weight_kg || 0)
            ));
            return { date: format(parseISO(date), 'MMM d yy'), 'Est. 1RM': maxE1RM };
          });
        setChartData(chart);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [user, exerciseName]);

  const color = exercise ? CATEGORY_COLORS[(exercise.category || '').toLowerCase()] : null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <button
        onClick={() => navigate('/exercises')}
        className="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 text-sm mb-5 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Exercise Library
      </button>

      <div className="flex items-center gap-3 mb-6">
        {color && <span className={`w-3 h-3 rounded-full flex-shrink-0 ${color.dot}`} />}
        <h1 className="text-2xl font-bold text-zinc-100">{exerciseName}</h1>
        {exercise?.category && color && (
          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${color.badge}`}>
            {exercise.category}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-zinc-400">Loading…</div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-zinc-500 gap-2">
          <TrendingUp className="w-8 h-8 opacity-40" />
          <p className="text-sm">No sets logged for this exercise yet</p>
        </div>
      ) : (
        <>
          {/* e1RM chart */}
          {chartData.length > 1 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
              <h2 className="text-zinc-100 font-semibold mb-1">Estimated 1RM Progress</h2>
              <p className="text-zinc-500 text-xs mb-4">{sessions.length} sessions</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                  <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={{ stroke: '#3f3f46' }} tickLine={false} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={{ stroke: '#3f3f46' }} tickLine={false} unit=" kg" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="Est. 1RM"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Session history */}
          <div className="space-y-4">
            {sessions.map(({ date, sets }) => {
              const bestE1RM = Math.max(...sets.map((s) =>
                (s.reps || 0) > 0
                  ? Math.round((s.weight_kg || 0) * (1 + (s.reps || 0) / 30) * 10) / 10
                  : (s.weight_kg || 0)
              ));
              return (
                <div key={date} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
                    <div>
                      <p className="text-zinc-100 font-semibold text-sm">
                        {format(parseISO(date), 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className="text-zinc-500 text-xs mt-0.5">{sets.length} set{sets.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-zinc-500 text-xs">Est. 1RM</p>
                      <p className="text-violet-400 font-semibold text-sm">{bestE1RM} kg</p>
                    </div>
                  </div>
                  <div className="divide-y divide-zinc-800">
                    {sets.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                        <span className="text-zinc-600 text-xs w-10">Set {i + 1}</span>
                        <div className="flex items-center gap-2 flex-wrap flex-1">
                          {s.weight_kg > 0 && (
                            <span className="text-zinc-200 text-sm font-medium">{s.weight_kg} kg</span>
                          )}
                          {s.reps > 0 && (
                            <span className="text-zinc-400 text-sm">× {s.reps} reps</span>
                          )}
                          {s.distance > 0 && (
                            <span className="text-zinc-400 text-sm">{s.distance} {s.distance_unit || 'km'}</span>
                          )}
                          {s.duration_seconds > 0 && (
                            <span className="text-zinc-400 text-sm">
                              {Math.floor(s.duration_seconds / 60)}:{String(s.duration_seconds % 60).padStart(2, '0')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {s.set_type === 'dropset' && (
                            <span className="text-xs px-1.5 py-0.5 rounded border bg-orange-500/20 text-orange-300 border-orange-500/40">Drop</span>
                          )}
                          {s.set_type === 'superset' && (
                            <span className="text-xs px-1.5 py-0.5 rounded border bg-cyan-500/20 text-cyan-300 border-cyan-500/40">Super</span>
                          )}
                        </div>
                        <button
                          onClick={() => navigate(`/workouts?date=${date}`)}
                          className="text-zinc-600 hover:text-violet-400 transition-colors text-xs ml-auto"
                        >
                          Open
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
