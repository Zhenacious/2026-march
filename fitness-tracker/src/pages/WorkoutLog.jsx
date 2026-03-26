import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Plus, Trash2, ChevronDown, ChevronUp, List, Layers, Pencil, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import ExercisePicker from '../components/ExercisePicker';

const CATEGORY_COLORS = {
  chest:     { dot: 'bg-rose-500',   badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',   label: 'Chest' },
  back:      { dot: 'bg-blue-500',   badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',   label: 'Back' },
  abs:       { dot: 'bg-amber-400',  badge: 'bg-amber-400/20 text-amber-300 border-amber-400/40', label: 'Abs' },
  legs:      { dot: 'bg-green-500',  badge: 'bg-green-500/20 text-green-300 border-green-500/40', label: 'Legs' },
  triceps:   { dot: 'bg-orange-500', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40', label: 'Triceps' },
  biceps:    { dot: 'bg-violet-500', badge: 'bg-violet-500/20 text-violet-300 border-violet-500/40', label: 'Biceps' },
  shoulders: { dot: 'bg-sky-500',    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',       label: 'Shoulders' },
  mobility:  { dot: 'bg-teal-500',   badge: 'bg-teal-500/20 text-teal-300 border-teal-500/40',   label: 'Mobility' },
};

function getCategoryColor(category) {
  if (!category) return null;
  return CATEGORY_COLORS[category.toLowerCase()] || null;
}

const SET_TYPE_OPTIONS = [
  { value: 'normal',   label: 'Normal' },
  { value: 'dropset',  label: 'Drop' },
  { value: 'superset', label: 'Super' },
];

function SetRow({
  set, categoryMap, showExerciseName = true,
  canMoveUp, canMoveDown,
  onMoveUp, onMoveDown, onDelete, onEditStart,
}) {
  const category = categoryMap[set.exercise_name.toLowerCase()];
  const color = getCategoryColor(category);

  return (
    <div className="flex items-center gap-2 px-3 py-3 hover:bg-zinc-800/50 transition-colors group">
      {/* Reorder buttons */}
      <div className="flex flex-col gap-0.5 flex-shrink-0">
        <button onClick={onMoveUp} disabled={!canMoveUp}
          className="text-zinc-700 hover:text-zinc-400 disabled:opacity-0 transition-colors p-0.5 rounded"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
        <button onClick={onMoveDown} disabled={!canMoveDown}
          className="text-zinc-700 hover:text-zinc-400 disabled:opacity-0 transition-colors p-0.5 rounded"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${color ? color.dot : 'bg-zinc-700'}`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {showExerciseName && (
            <p className="text-zinc-200 text-sm font-medium truncate">{set.exercise_name}</p>
          )}
          {set.set_type === 'dropset' && (
            <span className="text-xs px-1.5 py-0.5 rounded border bg-orange-500/20 text-orange-300 border-orange-500/40 font-medium">Drop</span>
          )}
          {set.set_type === 'superset' && (
            <span className="text-xs px-1.5 py-0.5 rounded border bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-medium">Super</span>
          )}
          {showExerciseName && color && (
            <span className={`text-xs px-1.5 py-0.5 rounded border ${color.badge} font-medium`}>{color.label}</span>
          )}
        </div>
        <p className="text-zinc-500 text-xs mt-0.5">
          {set.weight_kg > 0 && `${set.weight_kg} kg`}
          {set.weight_kg > 0 && set.reps > 0 && ' × '}
          {set.reps > 0 && `${set.reps} reps`}
          {set.distance > 0 && ` · ${set.distance} ${set.distance_unit || 'km'}`}
          {set.duration_seconds > 0 &&
            ` · ${Math.floor(set.duration_seconds / 60)}:${String(set.duration_seconds % 60).padStart(2, '0')}`}
        </p>
      </div>

      <button onClick={onEditStart}
        className="text-zinc-700 hover:text-violet-400 transition-colors p-1 rounded opacity-0 group-hover:opacity-100"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => onDelete(set.id)}
        className="text-zinc-700 hover:text-red-400 transition-colors p-1 rounded opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

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

export default function WorkoutLog() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(
    searchParams.get('date') || format(new Date(), 'yyyy-MM-dd')
  );
  const [exercises, setExercises] = useState([]);
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add-set form
  const [exerciseInput, setExerciseInput] = useState('');
  const [exerciseSuggestions, setExerciseSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [weightKg, setWeightKg] = useState('');
  const [reps, setReps] = useState('');
  const [distance, setDistance] = useState('');
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [durationMin, setDurationMin] = useState('');
  const [durationSec, setDurationSec] = useState('');
  const [setType, setSetType] = useState('normal');
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Sets view
  const [activeGroup, setActiveGroup] = useState('All');
  const [viewMode, setViewMode] = useState('chrono');

  // Edit state
  const [editingSetId, setEditingSetId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const categoryMap = useMemo(
    () => Object.fromEntries(exercises.map((ex) => [ex.name.toLowerCase(), ex.category || ''])),
    [exercises]
  );

  const { recentExerciseNames, exerciseLastSet } = useMemo(() => {
    const seenNames = new Set();
    const lastSet = {};
    const names = [];
    sets.forEach((s) => {
      lastSet[s.exercise_name] = s;
      if (!seenNames.has(s.exercise_name)) { seenNames.add(s.exercise_name); names.push(s.exercise_name); }
    });
    return { recentExerciseNames: names, exerciseLastSet: lastSet };
  }, [sets]);

  async function fetchExercises() {
    const { data } = await supabase.from('exercises').select('name, category').eq('user_id', user.id).order('name');
    setExercises(data || []);
  }

  const fetchSets = useCallback(async () => {
    if (!selectedDate || !user) return;
    setLoading(true);
    setError('');
    try {
      const { data: workout } = await supabase
        .from('workouts').select('id').eq('user_id', user.id).eq('date', selectedDate).maybeSingle();
      if (!workout) { setSets([]); return; }
      const { data: setData, error: sErr } = await supabase
        .from('workout_sets').select('*').eq('workout_id', workout.id).order('set_order');
      if (sErr) throw sErr;
      setSets(setData || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [selectedDate, user]);

  useEffect(() => { if (user) fetchExercises(); }, [user]);
  useEffect(() => { fetchSets(); }, [fetchSets]);

  function fillFromRecent(exerciseName) {
    const last = exerciseLastSet[exerciseName];
    setExerciseInput(exerciseName);
    setWeightKg(last.weight_kg > 0 ? String(last.weight_kg) : '');
    setReps(last.reps > 0 ? String(last.reps) : '');
    setSetType(last.set_type || 'normal');
    if (last.distance > 0) setDistance(String(last.distance));
    if (last.distance_unit) setDistanceUnit(last.distance_unit);
  }

  function handleExerciseInput(val) {
    setExerciseInput(val);
    if (val.trim().length > 0) {
      setExerciseSuggestions(exercises.filter((ex) => ex.name.toLowerCase().includes(val.toLowerCase())).slice(0, 8));
      setShowSuggestions(true);
    } else { setShowSuggestions(false); }
  }

  async function handleAddSet(e) {
    e.preventDefault();
    if (!exerciseInput.trim()) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      let { data: workout, error: wErr } = await supabase
        .from('workouts').select('id').eq('user_id', user.id).eq('date', selectedDate).maybeSingle();
      if (wErr) throw wErr;
      if (!workout) {
        const { data: newWorkout, error: createErr } = await supabase
          .from('workouts').insert({ user_id: user.id, date: selectedDate }).select().single();
        if (createErr) throw createErr;
        workout = newWorkout;
      }
      const exerciseName = exerciseInput.trim();
      if (!exercises.some((ex) => ex.name.toLowerCase() === exerciseName.toLowerCase())) {
        await supabase.from('exercises').upsert({ user_id: user.id, name: exerciseName, category: '' }, { onConflict: 'user_id,name' });
        await fetchExercises();
      }
      const maxOrder = sets.length > 0 ? Math.max(...sets.map((s) => s.set_order)) : 0;
      const duration_seconds = (parseInt(durationMin, 10) || 0) * 60 + (parseInt(durationSec, 10) || 0);
      const { error: insertErr } = await supabase.from('workout_sets').insert({
        workout_id: workout.id, exercise_name: exerciseName,
        weight_kg: parseFloat(weightKg) || 0, reps: parseInt(reps, 10) || 0,
        distance: parseFloat(distance) || 0, distance_unit: distanceUnit || '',
        duration_seconds, set_order: maxOrder + 1, set_type: setType,
      });
      if (insertErr) throw insertErr;
      setSuccess('Set added!'); setTimeout(() => setSuccess(''), 2000);
      await fetchSets();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function handleDeleteSet(setId) {
    try {
      const { error: err } = await supabase.from('workout_sets').delete().eq('id', setId);
      if (err) throw err;
      setSets((prev) => prev.filter((s) => s.id !== setId));
    } catch (err) { setError(err.message); }
  }

  // Reorder: swap set_order between two sets in the full sorted array
  async function handleReorder(setId, orderedList, direction) {
    const idx = orderedList.findIndex((s) => s.id === setId);
    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (neighborIdx < 0 || neighborIdx >= orderedList.length) return;
    const setA = orderedList[idx];
    const setB = orderedList[neighborIdx];
    try {
      await supabase.from('workout_sets').update({ set_order: setB.set_order }).eq('id', setA.id);
      await supabase.from('workout_sets').update({ set_order: setA.set_order }).eq('id', setB.id);
      setSets((prev) => {
        const next = prev.map((s) => {
          if (s.id === setA.id) return { ...s, set_order: setB.set_order };
          if (s.id === setB.id) return { ...s, set_order: setA.set_order };
          return s;
        });
        return next.sort((a, b) => a.set_order - b.set_order);
      });
    } catch (err) { setError(err.message); }
  }

  // Edit handlers
  function startEdit(set) {
    setEditingSetId(set.id);
    setEditValues({
      weight_kg: set.weight_kg > 0 ? String(set.weight_kg) : '',
      reps: set.reps > 0 ? String(set.reps) : '',
      distance: set.distance > 0 ? String(set.distance) : '',
      distance_unit: set.distance_unit || 'km',
      duration_min: set.duration_seconds > 0 ? String(Math.floor(set.duration_seconds / 60)) : '',
      duration_sec: set.duration_seconds > 0 ? String(set.duration_seconds % 60) : '',
      set_type: set.set_type || 'normal',
    });
  }

  function cancelEdit() { setEditingSetId(null); setEditValues({}); }

  async function saveEdit(setId) {
    const duration_seconds = (parseInt(editValues.duration_min, 10) || 0) * 60 + (parseInt(editValues.duration_sec, 10) || 0);
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
      setSets((prev) => prev.map((s) => s.id === setId ? { ...s, ...updates } : s));
      cancelEdit();
    } catch (err) { setError(err.message); }
  }

  function applyGroupFilter(setList) {
    const group = MUSCLE_GROUPS.find((g) => g.label === activeGroup);
    if (!group || group.categories === null) return setList;
    return setList.filter((s) => group.categories.includes((categoryMap[s.exercise_name.toLowerCase()] || '').toLowerCase()));
  }

  const filteredSets = applyGroupFilter(sets);

  const groupedByExercise = useMemo(() => {
    const names = [];
    const seen = new Set();
    filteredSets.forEach((s) => { if (!seen.has(s.exercise_name)) { seen.add(s.exercise_name); names.push(s.exercise_name); } });
    return names.map((name) => ({ name, sets: filteredSets.filter((s) => s.exercise_name === name) }));
  }, [filteredSets]);

  // Render a single set row with edit/reorder wired up
  function renderSetRow(set, orderedList, showExerciseName = true) {
    const idx = orderedList.findIndex((s) => s.id === set.id);
    return (
      <SetRow
        key={set.id}
        set={set}
        categoryMap={categoryMap}
        showExerciseName={showExerciseName}
        canMoveUp={idx > 0}
        canMoveDown={idx < orderedList.length - 1}
        onMoveUp={() => handleReorder(set.id, orderedList, 'up')}
        onMoveDown={() => handleReorder(set.id, orderedList, 'down')}
        onDelete={handleDeleteSet}
        onEditStart={() => startEdit(set)}
      />
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Workout Log</h1>
      <p className="text-zinc-400 text-sm mb-6">Log your sets for any day</p>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
        <label className="block text-xs font-medium text-zinc-400 mb-1">Date</label>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </div>

      {error && <div className="bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-950 border border-green-800 text-green-300 px-4 py-3 rounded-lg mb-4 text-sm">{success}</div>}

      <form onSubmit={handleAddSet} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
        <h2 className="text-zinc-100 font-semibold mb-3">Add Set</h2>

        {/* Recently used tabs */}
        {recentExerciseNames.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-zinc-500 mb-2">Recently used today</p>
            <div className="flex gap-1.5 flex-wrap">
              {recentExerciseNames.map((name) => {
                const last = exerciseLastSet[name];
                const color = getCategoryColor(categoryMap[name.toLowerCase()]);
                const isActive = exerciseInput === name;
                return (
                  <button key={name} type="button" onClick={() => fillFromRecent(name)}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                      isActive ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-600 hover:text-zinc-100'
                    }`}
                  >
                    {color && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color.dot}`} />}
                    <span>{name}</span>
                    {last.weight_kg > 0 && (
                      <span className={isActive ? 'text-white/70' : 'text-zinc-500'}>
                        {last.weight_kg}kg{last.reps > 0 && `×${last.reps}`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Exercise input */}
        <div className="relative mb-4">
          <label className="block text-xs font-medium text-zinc-400 mb-1">Exercise *</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input type="text" value={exerciseInput} onChange={(e) => handleExerciseInput(e.target.value)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onFocus={() => exerciseInput && setShowSuggestions(true)}
                placeholder="Search or enter exercise name" required
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              {showSuggestions && exerciseSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden">
                  {exerciseSuggestions.map((ex) => {
                    const color = getCategoryColor(ex.category);
                    return (
                      <button key={ex.name} type="button"
                        onMouseDown={() => { setExerciseInput(ex.name); setShowSuggestions(false); }}
                        className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 flex items-center gap-2"
                      >
                        {color && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />}
                        <span className="flex-1">{ex.name}</span>
                        {ex.category && <span className="text-xs text-zinc-500">{ex.category}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button type="button" onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm px-3 py-2 rounded-lg transition-colors flex-shrink-0"
            >
              Browse <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {showPicker && (
          <ExercisePicker exercises={exercises} onSelect={(name) => setExerciseInput(name)} onClose={() => setShowPicker(false)} />
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Weight (kg)</label>
            <input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="0" min="0" step="0.5"
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Reps</label>
            <input type="number" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="0" min="0"
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Distance</label>
            <div className="flex gap-1">
              <input type="number" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="0" min="0" step="0.1"
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              <select value={distanceUnit} onChange={(e) => setDistanceUnit(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="km">km</option><option value="mi">mi</option><option value="m">m</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Duration</label>
            <div className="flex gap-1 items-center">
              <input type="number" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} placeholder="min" min="0"
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              <span className="text-zinc-500 text-xs">:</span>
              <input type="number" value={durationSec} onChange={(e) => setDurationSec(e.target.value)} placeholder="sec" min="0" max="59"
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs font-medium text-zinc-400 mr-1">Set type:</span>
          {SET_TYPE_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setSetType(opt.value)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                setType === opt.value
                  ? opt.value === 'dropset' ? 'bg-orange-500/20 text-orange-300 border-orange-500/60'
                  : opt.value === 'superset' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60'
                  : 'bg-violet-500/20 text-violet-300 border-violet-500/60'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {saving ? 'Saving…' : 'Add Set'}
        </button>
      </form>

      {/* Sets list */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-zinc-100 font-semibold">
              Sets for {selectedDate ? format(new Date(selectedDate + 'T00:00:00'), 'MMMM d, yyyy') : ''}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 text-xs">{sets.length} sets</span>
              <div className="flex bg-zinc-800 rounded-lg p-0.5 border border-zinc-700">
                <button onClick={() => setViewMode('chrono')} title="Chronological"
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'chrono' ? 'bg-zinc-600 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setViewMode('grouped')} title="Group by exercise"
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'grouped' ? 'bg-zinc-600 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Layers className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {MUSCLE_GROUPS.map((g) => (
              <button key={g.label} onClick={() => setActiveGroup(g.label)}
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
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-24 text-zinc-400 text-sm">Loading…</div>
        ) : sets.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-zinc-500 text-sm">No sets logged for this day yet</div>
        ) : filteredSets.length === 0 ? (
          <div className="flex items-center justify-center h-16 text-zinc-500 text-sm">No {activeGroup} sets today</div>
        ) : viewMode === 'chrono' ? (
          <div className="divide-y divide-zinc-800">
            {filteredSets.map((set) => renderSetRow(set, filteredSets, true))}
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {groupedByExercise.map(({ name, sets: exSets }) => {
              const color = getCategoryColor(categoryMap[name.toLowerCase()]);
              const totalVol = exSets.reduce((sum, s) => sum + (s.weight_kg || 0) * (s.reps || 0), 0);
              return (
                <div key={name}>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800/60">
                    {color && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />}
                    <span className="text-zinc-100 text-sm font-semibold flex-1">{name}</span>
                    <span className="text-zinc-500 text-xs">{exSets.length} set{exSets.length !== 1 ? 's' : ''}</span>
                    {totalVol > 0 && <span className="text-zinc-500 text-xs">{totalVol.toLocaleString()} kg vol</span>}
                    {color && <span className={`text-xs px-1.5 py-0.5 rounded border ${color.badge}`}>{color.label}</span>}
                  </div>
                  <div className="divide-y divide-zinc-800/60">
                    {exSets.map((set) => renderSetRow(set, exSets, false))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit set modal */}
      {editingSetId && (() => {
        const editingSet = sets.find((s) => s.id === editingSetId);
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
                <div>
                  <h2 className="text-zinc-100 font-semibold text-sm">Edit Set</h2>
                  {editingSet && (
                    <p className="text-zinc-500 text-xs mt-0.5">{editingSet.exercise_name}</p>
                  )}
                </div>
                <button onClick={cancelEdit} className="text-zinc-500 hover:text-zinc-200 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-400 text-xs font-medium block mb-1">Weight (kg)</label>
                    <input type="number" value={editValues.weight_kg} min="0" step="0.5"
                      onChange={(e) => setEditValues((p) => ({ ...p, weight_kg: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs font-medium block mb-1">Reps</label>
                    <input type="number" value={editValues.reps} min="0"
                      onChange={(e) => setEditValues((p) => ({ ...p, reps: e.target.value }))}
                      className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs font-medium block mb-1">Distance</label>
                    <div className="flex gap-1">
                      <input type="number" value={editValues.distance} min="0" step="0.1"
                        onChange={(e) => setEditValues((p) => ({ ...p, distance: e.target.value }))}
                        className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <select value={editValues.distance_unit}
                        onChange={(e) => setEditValues((p) => ({ ...p, distance_unit: e.target.value }))}
                        className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-2 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        <option value="km">km</option>
                        <option value="mi">mi</option>
                        <option value="m">m</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs font-medium block mb-1">Duration</label>
                    <div className="flex gap-1 items-center">
                      <input type="number" value={editValues.duration_min} min="0" placeholder="min"
                        onChange={(e) => setEditValues((p) => ({ ...p, duration_min: e.target.value }))}
                        className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <span className="text-zinc-500 text-xs">:</span>
                      <input type="number" value={editValues.duration_sec} min="0" max="59" placeholder="sec"
                        onChange={(e) => setEditValues((p) => ({ ...p, duration_sec: e.target.value }))}
                        className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 text-xs font-medium block mb-2">Set Type</label>
                  <div className="flex gap-2">
                    {SET_TYPE_OPTIONS.map((opt) => (
                      <button key={opt.value} type="button"
                        onClick={() => setEditValues((p) => ({ ...p, set_type: opt.value }))}
                        className={`flex-1 text-xs py-2 rounded-lg border font-medium transition-colors ${
                          editValues.set_type === opt.value
                            ? opt.value === 'dropset' ? 'bg-orange-500/20 text-orange-300 border-orange-500/60'
                            : opt.value === 'superset' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60'
                            : 'bg-violet-500/20 text-violet-300 border-violet-500/60'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
                        }`}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-zinc-800 flex gap-2">
                <button onClick={cancelEdit}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium py-2 rounded-lg transition-colors"
                >Cancel</button>
                <button onClick={() => saveEdit(editingSetId)}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                >Save</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
