import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, TrendingUp, Pencil, Check, X, Trash2, Trophy } from 'lucide-react';
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

  // Inline edit state
  const [editingSetId, setEditingSetId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);

  function buildChartFromSessions(sessionList) {
    const ascending = [...sessionList].reverse();
    return ascending.map(({ date, sets }) => {
      const maxE1RM = Math.max(...sets.map((s) =>
        (s.reps || 0) > 0
          ? Math.round((s.weight_kg || 0) * (1 + (s.reps || 0) / 30) * 10) / 10
          : (s.weight_kg || 0)
      ));
      return { date: format(parseISO(date), 'MMM d yy'), 'Est. 1RM': maxE1RM };
    });
  }

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

        setChartData(buildChartFromSessions(sorted));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [user, exerciseName]);

  function startEdit(s) {
    setEditingSetId(s.id);
    setEditValues({
      weight_kg: s.weight_kg > 0 ? String(s.weight_kg) : '',
      reps: s.reps > 0 ? String(s.reps) : '',
      distance: s.distance > 0 ? String(s.distance) : '',
      distance_unit: s.distance_unit || 'km',
      duration_min: s.duration_seconds > 0 ? String(Math.floor(s.duration_seconds / 60)) : '',
      duration_sec: s.duration_seconds > 0 ? String(s.duration_seconds % 60) : '',
      set_type: s.set_type || 'normal',
    });
  }

  function cancelEdit() {
    setEditingSetId(null);
    setEditValues({});
  }

  async function saveEdit(setId) {
    setSaving(true);
    const duration_seconds =
      (parseInt(editValues.duration_min, 10) || 0) * 60 +
      (parseInt(editValues.duration_sec, 10) || 0);
    const updates = {
      weight_kg: parseFloat(editValues.weight_kg) || 0,
      reps: parseInt(editValues.reps, 10) || 0,
      distance: parseFloat(editValues.distance) || 0,
      distance_unit: editValues.distance_unit || '',
      duration_seconds,
      set_type: editValues.set_type,
    };
    try {
      const { error: err } = await supabase.from('workout_sets').update(updates).eq('id', setId);
      if (err) throw err;
      const updated = sessions.map((sess) => ({
        ...sess,
        sets: sess.sets.map((s) => (s.id === setId ? { ...s, ...updates } : s)),
      }));
      setSessions(updated);
      setChartData(buildChartFromSessions(updated));
      cancelEdit();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSet(setId, date) {
    try {
      const { error: err } = await supabase.from('workout_sets').delete().eq('id', setId);
      if (err) throw err;
      const updated = sessions
        .map((sess) =>
          sess.date === date
            ? { ...sess, sets: sess.sets.filter((s) => s.id !== setId) }
            : sess
        )
        .filter((sess) => sess.sets.length > 0);
      setSessions(updated);
      setChartData(buildChartFromSessions(updated));
    } catch (err) {
      setError(err.message);
    }
  }

  const SET_TYPE_OPTIONS = [
    { value: 'normal', label: 'Normal' },
    { value: 'dropset', label: 'Drop' },
    { value: 'superset', label: 'Super' },
  ];

  const prs = useMemo(() => {
    if (!sessions.length) return null;
    let bestE1RM = { value: 0, weight: 0, reps: 0, date: null };
    let best1RM = { value: 0, date: null };
    sessions.forEach(({ date, sets }) => {
      sets.forEach((s) => {
        const w = s.weight_kg || 0;
        const r = s.reps || 0;
        if (w > 0 && r > 0) {
          const e1rm = Math.round(w * (1 + r / 30) * 10) / 10;
          if (e1rm > bestE1RM.value) bestE1RM = { value: e1rm, weight: w, reps: r, date };
        }
        if (r === 1 && w > best1RM.value) best1RM = { value: w, date };
      });
    });
    return { e1rm: bestE1RM, actual1rm: best1RM };
  }, [sessions]);

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
          {/* Personal Records */}
          {prs && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              {/* Best e1RM */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Best e1RM</span>
                </div>
                {prs.e1rm.value > 0 ? (
                  <>
                    <p className="text-amber-400 text-2xl font-bold leading-none mb-1">
                      {prs.e1rm.value}<span className="text-sm font-normal text-zinc-500 ml-1">kg</span>
                    </p>
                    <p className="text-zinc-400 text-xs mb-1">
                      {prs.e1rm.weight} kg × {prs.e1rm.reps} reps
                    </p>
                    <p className="text-zinc-600 text-xs">
                      {format(parseISO(prs.e1rm.date), 'MMM d, yyyy')}
                    </p>
                  </>
                ) : (
                  <p className="text-zinc-600 text-sm">No data yet</p>
                )}
              </div>

              {/* Best actual 1RM */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <Trophy className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Best 1RM</span>
                </div>
                {prs.actual1rm.value > 0 ? (
                  <>
                    <p className="text-violet-400 text-2xl font-bold leading-none mb-1">
                      {prs.actual1rm.value}<span className="text-sm font-normal text-zinc-500 ml-1">kg</span>
                    </p>
                    <p className="text-zinc-400 text-xs mb-1">1 rep</p>
                    <p className="text-zinc-600 text-xs">
                      {format(parseISO(prs.actual1rm.date), 'MMM d, yyyy')}
                    </p>
                  </>
                ) : (
                  <p className="text-zinc-600 text-sm">No 1-rep sets logged</p>
                )}
              </div>
            </div>
          )}

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
                    {sets.map((s, i) => {
                      if (editingSetId === s.id) {
                        return (
                          <div key={s.id} className="px-5 py-3 bg-zinc-800/80 border-l-2 border-violet-500">
                            <p className="text-zinc-500 text-xs mb-2">Set {i + 1}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                              <div>
                                <label className="text-zinc-500 text-xs block mb-0.5">Weight (kg)</label>
                                <input type="number" value={editValues.weight_kg} min="0" step="0.5"
                                  onChange={(e) => setEditValues((p) => ({ ...p, weight_kg: e.target.value }))}
                                  className="w-full bg-zinc-700 border border-zinc-600 text-zinc-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                              </div>
                              <div>
                                <label className="text-zinc-500 text-xs block mb-0.5">Reps</label>
                                <input type="number" value={editValues.reps} min="0"
                                  onChange={(e) => setEditValues((p) => ({ ...p, reps: e.target.value }))}
                                  className="w-full bg-zinc-700 border border-zinc-600 text-zinc-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                              </div>
                              <div>
                                <label className="text-zinc-500 text-xs block mb-0.5">Distance</label>
                                <div className="flex gap-1">
                                  <input type="number" value={editValues.distance} min="0" step="0.1"
                                    onChange={(e) => setEditValues((p) => ({ ...p, distance: e.target.value }))}
                                    className="w-full bg-zinc-700 border border-zinc-600 text-zinc-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                  />
                                  <select value={editValues.distance_unit}
                                    onChange={(e) => setEditValues((p) => ({ ...p, distance_unit: e.target.value }))}
                                    className="bg-zinc-700 border border-zinc-600 text-zinc-300 rounded-lg px-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                                  >
                                    <option value="km">km</option>
                                    <option value="mi">mi</option>
                                    <option value="m">m</option>
                                  </select>
                                </div>
                              </div>
                              <div>
                                <label className="text-zinc-500 text-xs block mb-0.5">Duration</label>
                                <div className="flex gap-1 items-center">
                                  <input type="number" value={editValues.duration_min} min="0" placeholder="min"
                                    onChange={(e) => setEditValues((p) => ({ ...p, duration_min: e.target.value }))}
                                    className="w-full bg-zinc-700 border border-zinc-600 text-zinc-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                  />
                                  <span className="text-zinc-500 text-xs">:</span>
                                  <input type="number" value={editValues.duration_sec} min="0" max="59" placeholder="sec"
                                    onChange={(e) => setEditValues((p) => ({ ...p, duration_sec: e.target.value }))}
                                    className="w-full bg-zinc-700 border border-zinc-600 text-zinc-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {SET_TYPE_OPTIONS.map((opt) => (
                                <button key={opt.value} type="button"
                                  onClick={() => setEditValues((p) => ({ ...p, set_type: opt.value }))}
                                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                                    editValues.set_type === opt.value
                                      ? opt.value === 'dropset' ? 'bg-orange-500/20 text-orange-300 border-orange-500/60'
                                      : opt.value === 'superset' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60'
                                      : 'bg-violet-500/20 text-violet-300 border-violet-500/60'
                                      : 'bg-zinc-700 text-zinc-400 border-zinc-600'
                                  }`}
                                >{opt.label}</button>
                              ))}
                              <div className="flex items-center gap-1 ml-auto">
                                <button onClick={() => saveEdit(s.id)} disabled={saving}
                                  className="text-green-400 hover:text-green-300 disabled:opacity-50 p-1.5 rounded transition-colors"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button onClick={cancelEdit}
                                  className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={s.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-zinc-800/40 transition-colors group">
                          <span className="text-zinc-600 text-xs w-10 flex-shrink-0">Set {i + 1}</span>
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
                            {s.set_type === 'dropset' && (
                              <span className="text-xs px-1.5 py-0.5 rounded border bg-orange-500/20 text-orange-300 border-orange-500/40">Drop</span>
                            )}
                            {s.set_type === 'superset' && (
                              <span className="text-xs px-1.5 py-0.5 rounded border bg-cyan-500/20 text-cyan-300 border-cyan-500/40">Super</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(s)}
                              className="text-zinc-600 hover:text-violet-400 transition-colors p-1 rounded"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteSet(s.id, date)}
                              className="text-zinc-600 hover:text-red-400 transition-colors p-1 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
