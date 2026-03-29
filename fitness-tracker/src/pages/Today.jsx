import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { Plus, Trash2, Pencil, Check, X, Dumbbell, Search } from 'lucide-react';

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

const TODAY = format(new Date(), 'yyyy-MM-dd');
const TODAY_DISPLAY = format(new Date(), 'EEEE, d MMMM');

const FILTER_TABS = [
  { label: 'All',       categories: null },
  { label: 'Chest',     categories: ['chest'] },
  { label: 'Back',      categories: ['back'] },
  { label: 'Arms',      categories: ['biceps', 'triceps'] },
  { label: 'Legs',      categories: ['legs'] },
  { label: 'Shoulders', categories: ['shoulders'] },
  { label: 'Abs',       categories: ['abs'] },
  { label: 'Mobility',  categories: ['mobility'] },
];

// ─── Add Exercise bottom sheet ──────────────────────────────────────────────
// Shows a search field, muscle-group filter tabs, and a scrollable list.
// Typing something that doesn't exist shows a "Create" option.
function AddExerciseSheet({ exercises, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const inputRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    const tab = FILTER_TABS.find((t) => t.label === activeTab);
    return exercises.filter((ex) => {
      const cat = (ex.category || '').toLowerCase();
      const matchesSearch = !search.trim() || ex.name.toLowerCase().includes(search.trim().toLowerCase());
      const matchesTab = !tab.categories || tab.categories.includes(cat);
      return matchesSearch && matchesTab;
    });
  }, [exercises, search, activeTab]);

  const exactMatch = exercises.some(
    (ex) => ex.name.toLowerCase() === search.trim().toLowerCase()
  );
  const canCreate = search.trim().length > 0 && !exactMatch;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 rounded-t-3xl border-t border-zinc-800 flex flex-col"
        style={{ maxHeight: '82vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title + close */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 className="text-zinc-100 font-semibold text-base">Add Exercise</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or type new exercise…"
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* Muscle-group filter tabs — scrollable row */}
        <div className="px-4 pb-2 overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            {FILTER_TABS.map((tab) => {
              const color = tab.categories ? CATEGORY_COLORS[tab.categories[0]] : null;
              const isActive = activeTab === tab.label;
              return (
                <button
                  key={tab.label}
                  onClick={() => setActiveTab(tab.label)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex-shrink-0 ${
                    isActive
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {color && !isActive && (
                    <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
                  )}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Exercise list */}
        <div className="overflow-y-auto flex-1 px-2 pb-6">
          {canCreate && (
            <button
              onClick={() => onSelect(search.trim())}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-800 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-500/40 flex items-center justify-center flex-shrink-0">
                <Plus className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <div>
                <p className="text-zinc-100 text-sm font-medium">Create &ldquo;{search.trim()}&rdquo;</p>
                <p className="text-zinc-500 text-xs">Add as a new exercise</p>
              </div>
            </button>
          )}

          {filtered.length === 0 && !canCreate && (
            <p className="text-zinc-600 text-sm text-center py-8">No exercises found</p>
          )}

          {filtered.map((ex) => {
            const cat = (ex.category || '').toLowerCase();
            const color = CATEGORY_COLORS[cat] || null;
            return (
              <button
                key={ex.id}
                onClick={() => onSelect(ex.name)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-800 transition-colors text-left"
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color ? color.dot : 'bg-zinc-600'}`} />
                <span className="text-zinc-200 text-sm flex-1">{ex.name}</span>
                {color && (
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${color.badge} font-medium`}>
                    {color.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function Today() {
  const { user } = useAuth();
  const [sets, setSets] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);

  // Which exercise currently has its "add set" form open
  const [addingTo, setAddingTo] = useState(null);
  const [addForm, setAddForm] = useState({ weightKg: '', reps: '', setType: 'normal' });

  // Which set is tapped (shows edit/delete buttons)
  const [tappedSetId, setTappedSetId] = useState(null);

  // Which set is being edited inline
  const [editingSetId, setEditingSetId] = useState(null);
  const [editValues, setEditValues] = useState({ weightKg: '', reps: '', setType: 'normal' });
  const [saving, setSaving] = useState(false);

  // Map exercise name → category for colour coding
  const categoryMap = useMemo(
    () => Object.fromEntries(exercises.map((ex) => [ex.name.toLowerCase(), ex.category || ''])),
    [exercises]
  );

  // Group today's sets by exercise name, preserving the order first seen.
  // Also includes `addingTo` so a card appears immediately after picking an
  // exercise, even before the first set has been saved.
  const groupedExercises = useMemo(() => {
    const order = [];
    const map = {};
    sets.forEach((s) => {
      if (!map[s.exercise_name]) {
        order.push(s.exercise_name);
        map[s.exercise_name] = [];
      }
      map[s.exercise_name].push(s);
    });
    if (addingTo && !map[addingTo]) {
      order.push(addingTo);
      map[addingTo] = [];
    }
    return order.map((name) => ({ name, sets: map[name] }));
  }, [sets, addingTo]);

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [exResult, workoutResult] = await Promise.all([
        supabase.from('exercises').select('id, name, category').eq('user_id', user.id).order('name'),
        supabase.from('workouts').select('id').eq('user_id', user.id).eq('date', TODAY).maybeSingle(),
      ]);
      setExercises(exResult.data || []);
      if (workoutResult.data) {
        const { data: setsData } = await supabase
          .from('workout_sets').select('*').eq('workout_id', workoutResult.data.id).order('set_order');
        setSets(setsData || []);
      } else {
        setSets([]);
      }
    } finally {
      setLoading(false);
    }
  }

  // Get today's workout id, creating the row if it doesn't exist yet
  async function ensureWorkout() {
    const { data: existing } = await supabase
      .from('workouts').select('id').eq('user_id', user.id).eq('date', TODAY).maybeSingle();
    if (existing) return existing.id;
    const { data: created } = await supabase
      .from('workouts').insert({ user_id: user.id, date: TODAY }).select().single();
    return created.id;
  }

  // Called when user picks or creates an exercise from the sheet
  async function handlePickExercise(name) {
    setShowSheet(false);

    // If it's a brand-new exercise, add it to the library
    const alreadyExists = exercises.some(
      (ex) => ex.name.toLowerCase() === name.toLowerCase()
    );
    if (!alreadyExists) {
      const { data: newEx } = await supabase
        .from('exercises')
        .upsert({ user_id: user.id, name, category: '' }, { onConflict: 'user_id,name' })
        .select('id, name, category')
        .single();
      if (newEx) setExercises((prev) => [...prev, newEx].sort((a, b) => a.name.localeCompare(b.name)));
    }

    // Pre-fill from the last set of this exercise logged today (if any)
    const lastSet = [...sets].reverse().find(
      (s) => s.exercise_name.toLowerCase() === name.toLowerCase()
    );
    setAddForm({
      weightKg: lastSet?.weight_kg > 0 ? String(lastSet.weight_kg) : '',
      reps: lastSet?.reps > 0 ? String(lastSet.reps) : '',
      setType: lastSet?.set_type || 'normal',
    });
    setAddingTo(name);
    setEditingSetId(null);
    setTappedSetId(null);
  }

  // Called when user taps "+ set" on an existing exercise card
  function handleStartAdd(exerciseName) {
    if (addingTo === exerciseName) {
      setAddingTo(null);
      return;
    }
    const lastSet = [...sets].reverse().find((s) => s.exercise_name === exerciseName);
    setAddForm({
      weightKg: lastSet?.weight_kg > 0 ? String(lastSet.weight_kg) : '',
      reps: lastSet?.reps > 0 ? String(lastSet.reps) : '',
      setType: lastSet?.set_type || 'normal',
    });
    setAddingTo(exerciseName);
    setEditingSetId(null);
  }

  async function handleSaveSet() {
    if (!addingTo) return;
    setSaving(true);
    try {
      const workoutId = await ensureWorkout();
      const maxOrder = sets.length > 0 ? Math.max(...sets.map((s) => s.set_order)) : 0;
      const { data: newSet, error } = await supabase.from('workout_sets').insert({
        workout_id: workoutId,
        exercise_name: addingTo,
        weight_kg: parseFloat(addForm.weightKg) || 0,
        reps: parseInt(addForm.reps, 10) || 0,
        set_order: maxOrder + 1,
        set_type: addForm.setType,
        distance: 0,
        distance_unit: 'km',
        duration_seconds: 0,
      }).select().single();
      if (error) throw error;
      setSets((prev) => [...prev, newSet]);
      setAddingTo(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSet(setId) {
    try {
      await supabase.from('workout_sets').delete().eq('id', setId);
      setSets((prev) => prev.filter((s) => s.id !== setId));
      if (tappedSetId === setId) setTappedSetId(null);
    } catch (err) {
      console.error(err);
    }
  }

  function handleStartEdit(set) {
    setEditingSetId(set.id);
    setEditValues({
      weightKg: set.weight_kg > 0 ? String(set.weight_kg) : '',
      reps: set.reps > 0 ? String(set.reps) : '',
      setType: set.set_type || 'normal',
    });
    setAddingTo(null);
    setTappedSetId(null);
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      const { data: updated, error } = await supabase.from('workout_sets').update({
        weight_kg: parseFloat(editValues.weightKg) || 0,
        reps: parseInt(editValues.reps, 10) || 0,
        set_type: editValues.setType,
      }).eq('id', editingSetId).select().single();
      if (error) throw error;
      setSets((prev) => prev.map((s) => s.id === editingSetId ? updated : s));
      setEditingSetId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-28">
      {/* Page header */}
      <div className="px-4 pt-5 pb-4">
        <h1 className="text-2xl font-bold text-zinc-100">Today</h1>
        <p className="text-zinc-500 text-sm mt-0.5">{TODAY_DISPLAY}</p>
      </div>

      {/* Empty state */}
      {groupedExercises.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-600 gap-3 px-8">
          <Dumbbell className="w-10 h-10 opacity-30" />
          <p className="text-sm text-center leading-relaxed">
            Nothing logged yet.<br />
            Tap <span className="text-zinc-400 font-medium">Add Exercise</span> below to start.
          </p>
        </div>
      )}

      {/* Exercise cards */}
      <div className="px-4 space-y-3">
        {groupedExercises.map(({ name, sets: exSets }) => {
          const cat = (categoryMap[name.toLowerCase()] || '').toLowerCase();
          const color = CATEGORY_COLORS[cat] || null;
          const isAdding = addingTo === name;

          return (
            <div key={name} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">

              {/* Card header: exercise name + category badge + add-set button */}
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-800/60">
                {color
                  ? <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />
                  : <span className="w-2 h-2 rounded-full flex-shrink-0 bg-zinc-700" />
                }
                <span className="text-zinc-100 font-semibold text-sm flex-1 truncate">{name}</span>
                {color && (
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${color.badge} font-medium flex-shrink-0`}>
                    {color.label}
                  </span>
                )}
                <button
                  onClick={() => handleStartAdd(name)}
                  className={`flex items-center gap-1 text-xs font-medium ml-1 transition-colors flex-shrink-0 ${
                    isAdding ? 'text-zinc-500' : 'text-violet-400 hover:text-violet-300'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  set
                </button>
              </div>

              {/* Set rows */}
              <div className="divide-y divide-zinc-800/40">
                {exSets.map((set, i) => (
                  <div key={set.id}>
                    {editingSetId === set.id ? (
                      // ── Inline edit form ──
                      <div className="px-4 py-3 flex items-center gap-2 bg-zinc-800/30">
                        <span className="text-zinc-600 text-xs w-5 text-center flex-shrink-0">{i + 1}</span>
                        <input
                          autoFocus
                          type="number"
                          inputMode="decimal"
                          value={editValues.weightKg}
                          onChange={(e) => setEditValues((v) => ({ ...v, weightKg: e.target.value }))}
                          placeholder="kg"
                          className="w-20 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                        <span className="text-zinc-600 text-xs">×</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={editValues.reps}
                          onChange={(e) => setEditValues((v) => ({ ...v, reps: e.target.value }))}
                          placeholder="reps"
                          className="w-20 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                        />
                        <div className="flex-1" />
                        <button
                          onClick={handleSaveEdit}
                          disabled={saving}
                          className="text-green-400 hover:text-green-300 disabled:opacity-50 p-1.5 rounded transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingSetId(null)}
                          className="text-zinc-600 hover:text-zinc-300 p-1.5 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      // ── Set row (tap to reveal edit/delete) ──
                      <div
                        onClick={() => setTappedSetId(tappedSetId === set.id ? null : set.id)}
                        className="px-4 py-3 flex items-center gap-3 cursor-pointer select-none active:bg-zinc-800/40 transition-colors"
                      >
                        <span className="text-zinc-600 text-xs w-5 text-center flex-shrink-0">{i + 1}</span>
                        <span className="text-zinc-300 text-sm flex-1">
                          {set.weight_kg > 0
                            ? `${set.weight_kg} kg`
                            : set.reps > 0
                            ? <span className="text-teal-400 font-medium">BW</span>
                            : null}
                          {set.weight_kg > 0 && set.reps > 0 ? ' × ' : ''}
                          {set.reps > 0 ? `${set.reps} reps` : ''}
                          {!set.weight_kg && !set.reps && set.distance > 0
                            ? `${set.distance} ${set.distance_unit || 'km'}`
                            : ''}
                          {set.duration_seconds > 0
                            ? ` · ${Math.floor(set.duration_seconds / 60)}:${String(set.duration_seconds % 60).padStart(2, '0')}`
                            : ''}
                        </span>
                        {set.set_type === 'dropset' && (
                          <span className="text-xs px-1.5 py-0.5 rounded border bg-orange-500/20 text-orange-300 border-orange-500/40 flex-shrink-0">
                            Drop
                          </span>
                        )}
                        {set.set_type === 'superset' && (
                          <span className="text-xs px-1.5 py-0.5 rounded border bg-cyan-500/20 text-cyan-300 border-cyan-500/40 flex-shrink-0">
                            Super
                          </span>
                        )}
                        {tappedSetId === set.id && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStartEdit(set); }}
                              className="text-zinc-500 hover:text-violet-400 p-1.5 rounded transition-colors flex-shrink-0"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteSet(set.id); }}
                              className="text-zinc-500 hover:text-red-400 p-1.5 rounded transition-colors flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add set form (shown when this exercise's "+ set" was tapped) */}
              {isAdding && (
                <div className="px-4 py-3 border-t border-zinc-800/60 bg-zinc-800/20">
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="number"
                      inputMode="decimal"
                      value={addForm.weightKg}
                      onChange={(e) => setAddForm((f) => ({ ...f, weightKg: e.target.value }))}
                      placeholder="Weight (kg)"
                      className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <span className="text-zinc-600 text-xs flex-shrink-0">×</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={addForm.reps}
                      onChange={(e) => setAddForm((f) => ({ ...f, reps: e.target.value }))}
                      placeholder="Reps"
                      className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <button
                      onClick={handleSaveSet}
                      disabled={saving}
                      className="bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex-shrink-0"
                    >
                      {saving ? '…' : 'Add'}
                    </button>
                    <button
                      onClick={() => setAddingTo(null)}
                      className="text-zinc-600 hover:text-zinc-300 p-2 rounded flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Set type selector */}
                  <div className="flex gap-1.5 mt-2.5">
                    {[['normal', 'Normal'], ['dropset', 'Drop set'], ['superset', 'Super set']].map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setAddForm((f) => ({ ...f, setType: val }))}
                        className={`text-xs px-3 py-1 rounded-lg border font-medium transition-colors ${
                          addForm.setType === val
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-zinc-900 text-zinc-500 border-zinc-700 hover:text-zinc-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky "Add Exercise" button */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-4 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent pointer-events-none">
        <button
          onClick={() => { setShowSheet(true); setAddingTo(null); }}
          className="pointer-events-auto w-full max-w-lg mx-auto flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-semibold py-4 rounded-2xl text-base transition-colors shadow-xl shadow-violet-900/30"
        >
          <Plus className="w-5 h-5" />
          Add Exercise
        </button>
      </div>

      {/* Add exercise bottom sheet */}
      {showSheet && (
        <AddExerciseSheet
          exercises={exercises}
          onSelect={handlePickExercise}
          onClose={() => setShowSheet(false)}
        />
      )}
    </div>
  );
}
