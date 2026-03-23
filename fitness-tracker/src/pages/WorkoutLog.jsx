import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Save } from 'lucide-react';
import { format } from 'date-fns';

function SetRow({ set, onDelete }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-zinc-200 text-sm font-medium truncate">{set.exercise_name}</p>
        <p className="text-zinc-500 text-xs mt-0.5">
          {set.weight_kg > 0 && `${set.weight_kg} kg`}
          {set.weight_kg > 0 && set.reps > 0 && ' × '}
          {set.reps > 0 && `${set.reps} reps`}
          {set.distance > 0 && ` · ${set.distance} ${set.distance_unit || 'km'}`}
          {set.duration_seconds > 0 &&
            ` · ${Math.floor(set.duration_seconds / 60)}:${String(set.duration_seconds % 60).padStart(2, '0')}`}
        </p>
      </div>
      <button
        onClick={() => onDelete(set.id)}
        className="text-zinc-600 hover:text-red-400 transition-colors p-1 rounded ml-3"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function WorkoutLog() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exercises, setExercises] = useState([]);
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [exerciseInput, setExerciseInput] = useState('');
  const [exerciseSuggestions, setExerciseSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [weightKg, setWeightKg] = useState('');
  const [reps, setReps] = useState('');
  const [distance, setDistance] = useState('');
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [durationMin, setDurationMin] = useState('');
  const [durationSec, setDurationSec] = useState('');
  const [saving, setSaving] = useState(false);

  async function fetchExercises() {
    const { data } = await supabase
      .from('exercises')
      .select('name, category')
      .eq('user_id', user.id)
      .order('name');
    setExercises(data || []);
  }

  const fetchSets = useCallback(async () => {
    if (!selectedDate || !user) return;
    setLoading(true);
    setError('');
    try {
      const { data: workout } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .maybeSingle();

      if (!workout) {
        setSets([]);
        return;
      }

      const { data: setData, error: sErr } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('workout_id', workout.id)
        .order('set_order');

      if (sErr) throw sErr;
      setSets(setData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, user]);

  useEffect(() => {
    if (user) {
      fetchExercises();
    }
  }, [user]);

  useEffect(() => {
    fetchSets();
  }, [fetchSets]);

  function handleExerciseInput(val) {
    setExerciseInput(val);
    if (val.trim().length > 0) {
      const filtered = exercises.filter((ex) =>
        ex.name.toLowerCase().includes(val.toLowerCase())
      );
      setExerciseSuggestions(filtered.slice(0, 8));
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }

  async function handleAddSet(e) {
    e.preventDefault();
    if (!exerciseInput.trim()) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      let { data: workout, error: wErr } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .maybeSingle();

      if (wErr) throw wErr;

      if (!workout) {
        const { data: newWorkout, error: createErr } = await supabase
          .from('workouts')
          .insert({ user_id: user.id, date: selectedDate })
          .select()
          .single();
        if (createErr) throw createErr;
        workout = newWorkout;
      }

      const exerciseName = exerciseInput.trim();
      const exerciseExists = exercises.some(
        (ex) => ex.name.toLowerCase() === exerciseName.toLowerCase()
      );
      if (!exerciseExists) {
        await supabase
          .from('exercises')
          .upsert({ user_id: user.id, name: exerciseName, category: '' }, { onConflict: 'user_id,name' });
        await fetchExercises();
      }

      const maxOrder = sets.length > 0 ? Math.max(...sets.map((s) => s.set_order)) : 0;
      const duration_seconds =
        (parseInt(durationMin, 10) || 0) * 60 + (parseInt(durationSec, 10) || 0);

      const { error: insertErr } = await supabase.from('workout_sets').insert({
        workout_id: workout.id,
        exercise_name: exerciseName,
        weight_kg: parseFloat(weightKg) || 0,
        reps: parseInt(reps, 10) || 0,
        distance: parseFloat(distance) || 0,
        distance_unit: distanceUnit || '',
        duration_seconds,
        set_order: maxOrder + 1,
      });

      if (insertErr) throw insertErr;

      setSuccess('Set added!');
      setTimeout(() => setSuccess(''), 2000);
      await fetchSets();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSet(setId) {
    try {
      const { error: err } = await supabase.from('workout_sets').delete().eq('id', setId);
      if (err) throw err;
      setSets((prev) => prev.filter((s) => s.id !== setId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Workout Log</h1>
      <p className="text-zinc-400 text-sm mb-6">Log your sets for any day</p>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
        <label className="block text-xs font-medium text-zinc-400 mb-1">Date</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-950 border border-green-800 text-green-300 px-4 py-3 rounded-lg mb-4 text-sm">
          {success}
        </div>
      )}

      <form
        onSubmit={handleAddSet}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6"
      >
        <h2 className="text-zinc-100 font-semibold mb-4">Add Set</h2>

        <div className="relative mb-4">
          <label className="block text-xs font-medium text-zinc-400 mb-1">Exercise *</label>
          <input
            type="text"
            value={exerciseInput}
            onChange={(e) => handleExerciseInput(e.target.value)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => exerciseInput && setShowSuggestions(true)}
            placeholder="Search or enter exercise name"
            required
            className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
          {showSuggestions && exerciseSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
              {exerciseSuggestions.map((ex) => (
                <button
                  key={ex.name}
                  type="button"
                  onMouseDown={() => {
                    setExerciseInput(ex.name);
                    setShowSuggestions(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 flex items-center justify-between"
                >
                  <span>{ex.name}</span>
                  {ex.category && (
                    <span className="text-xs text-zinc-500">{ex.category}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Weight (kg)</label>
            <input
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="0"
              min="0"
              step="0.5"
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Reps</label>
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="0"
              min="0"
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Distance</label>
            <div className="flex gap-1">
              <input
                type="number"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                placeholder="0"
                min="0"
                step="0.1"
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              <select
                value={distanceUnit}
                onChange={(e) => setDistanceUnit(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="km">km</option>
                <option value="mi">mi</option>
                <option value="m">m</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Duration</label>
            <div className="flex gap-1 items-center">
              <input
                type="number"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                placeholder="min"
                min="0"
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              <span className="text-zinc-500 text-xs">:</span>
              <input
                type="number"
                value={durationSec}
                onChange={(e) => setDurationSec(e.target.value)}
                placeholder="sec"
                min="0"
                max="59"
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {saving ? 'Saving…' : 'Add Set'}
        </button>
      </form>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-zinc-100 font-semibold">
            Sets for {selectedDate ? format(new Date(selectedDate + 'T00:00:00'), 'MMMM d, yyyy') : ''}
          </h2>
          <span className="text-zinc-500 text-xs">{sets.length} sets</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-24 text-zinc-400 text-sm">
            Loading…
          </div>
        ) : sets.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-zinc-500 text-sm">
            No sets logged for this day yet
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {sets.map((set) => (
              <SetRow key={set.id} set={set} onDelete={handleDeleteSet} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
