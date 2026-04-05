import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { Plus, Trash2, Pencil, Check, X, Dumbbell, Search, ChevronLeft, ChevronRight, TrendingUp, BookOpen, FileText } from 'lucide-react';
import { CATEGORY_COLORS, MUSCLE_GROUPS } from '../lib/categories';

// FILTER_TABS is just MUSCLE_GROUPS — alias so the sheet component still works
const FILTER_TABS = MUSCLE_GROUPS;

// Returns today's date as a yyyy-MM-dd string, evaluated fresh each call
function getTodayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

// ─── Templates bottom sheet ───────────────────────────────────────────────────
function TemplatesSheet({ templates, currentExercises, onLoad, onDelete, onSave, onClose }) {
  const [saveName, setSaveName] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900" onClick={onClose}>
      <div className="flex flex-col h-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-12 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-teal-400" />
            <h2 className="text-zinc-100 font-semibold text-base">Templates</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 pb-8 space-y-4">
          {/* Save current workout as a template */}
          {currentExercises.length > 0 && (
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-4">
              <p className="text-zinc-400 text-xs font-medium mb-3">Save today's exercises as a template</p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. Push Day"
                  className="flex-1 bg-zinc-700 border border-zinc-600 text-zinc-100 placeholder-zinc-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  onClick={() => { if (saveName.trim()) { onSave(saveName); setSaveName(''); } }}
                  disabled={!saveName.trim()}
                  className="bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  Save
                </button>
              </div>
              <p className="text-zinc-600 text-xs">{currentExercises.join(' · ')}</p>
            </div>
          )}

          {/* Saved templates list */}
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-600">
              <BookOpen className="w-8 h-8 opacity-40" />
              <p className="text-sm text-center">No templates saved yet.<br />Log a workout, then save it as a template.</p>
            </div>
          ) : (
            templates.map((t) => (
              <div key={t.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-zinc-100 font-semibold text-sm">{t.name}</span>
                  <button onClick={() => onDelete(t.id)} className="text-zinc-600 hover:text-red-400 p-1 rounded transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-zinc-500 text-xs mb-3">{t.exercises.join(' · ')}</p>
                <button
                  onClick={() => onLoad(t)}
                  className="w-full bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/40 text-teal-300 text-sm font-semibold py-2 rounded-xl transition-colors"
                >
                  Load template
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

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
      const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const nameLower = ex.name.toLowerCase();
      const matchesSearch = words.length === 0 || words.every((w) => nameLower.includes(w));
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
      className="fixed inset-0 z-50 flex flex-col bg-zinc-900"
      onClick={onClose}
    >
      <div
        className="flex flex-col h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title + close — pt accounts for phone notch/status bar */}
        <div className="flex items-center justify-between px-5 pt-12 pb-3">
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
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                      ? 'bg-teal-600 text-white border-teal-600'
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
        <div className="overflow-y-auto flex-1 px-2 pb-8">
          {canCreate && (
            <button
              onClick={() => onSelect(search.trim())}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-800 transition-colors text-left ring-1 ring-teal-500/40"
            >
              <div className="w-7 h-7 rounded-full bg-teal-600/20 border border-teal-500/40 flex items-center justify-center flex-shrink-0">
                <Plus className="w-3.5 h-3.5 text-teal-400" />
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // The date being viewed — defaults to today, can be changed via arrows
  const selectedDate = searchParams.get('date') || getTodayStr();
  const isToday = selectedDate === getTodayStr();
  const dateObj = parseISO(selectedDate + 'T00:00:00');
  const heading = isToday ? 'Today' : format(dateObj, 'EEEE');
  const subheading = format(dateObj, 'd MMMM yyyy');

  const [sets, setSets] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);

  const [addingTo, setAddingTo] = useState(null);
  const [addForm, setAddForm] = useState({ weightKg: '', reps: '', setType: 'normal' });
  const [tappedSetId, setTappedSetId] = useState(null);
  const [editingSetId, setEditingSetId] = useState(null);
  const [editValues, setEditValues] = useState({ weightKg: '', reps: '', setType: 'normal' });
  const [saving, setSaving] = useState(false);
  /** Which exercise row is "focused" — drives sidebar highlight and scroll-into-view after add. */
  const [activeExercise, setActiveExercise] = useState(null);

  // Cached historical stats per exercise: { lastSet, bestE1RM, lastSessionVolume, lastSessionDate }
  const [exerciseStats, setExerciseStats] = useState({});
  // ID of the set that was just saved — drives a brief green flash
  const [flashSetId, setFlashSetId] = useState(null);
  // Set IDs that beat the user's all-time e1RM at the moment they were logged
  const [prSetIds, setPrSetIds] = useState(new Set());
  // Random motivational line for the empty state — picked once on mount
  const [motivational] = useState(() => {
    const lines = [
      "Every rep counts. Let's go.",
      "Dive in. Your best set is waiting.",
      "The ocean wasn't built in a day.",
      "Make today's workout count.",
      "Strong starts here.",
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  });

  // Per-set notes — stored in localStorage under fittrack_set_notes as { [setId]: string }
  const [setNotes, setSetNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fittrack_set_notes') || '{}'); }
    catch { return {}; }
  });

  function saveSetNote(setId, value) {
    setSetNotes((prev) => {
      const next = { ...prev };
      if (value.trim()) next[setId] = value.trim();
      else delete next[setId];
      localStorage.setItem('fittrack_set_notes', JSON.stringify(next));
      return next;
    });
  }

  // Session note — one text note per workout date, saved to localStorage
  const [note, setNote] = useState('');
  const [noteExpanded, setNoteExpanded] = useState(false);

  // Workout templates — stored in localStorage
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fittrack_templates') || '[]'); }
    catch { return []; }
  });

  // Exercises added from a template but with no sets yet — shown as empty cards
  const [pendingExercises, setPendingExercises] = useState([]);
  const cardRefs = useRef({});

  const categoryMap = useMemo(
    () => Object.fromEntries(exercises.map((ex) => [ex.name.toLowerCase(), ex.category || ''])),
    [exercises]
  );

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
    // Show a card for the exercise being added even if it has no sets yet
    if (addingTo && !map[addingTo]) {
      order.push(addingTo);
      map[addingTo] = [];
    }
    // Show cards for template exercises loaded but not yet having sets
    pendingExercises.forEach((name) => {
      if (!map[name]) { order.push(name); map[name] = []; }
    });
    return order.map((name) => ({ name, sets: map[name] }));
  }, [sets, addingTo, pendingExercises]);

  // After picking an exercise or tapping the sidebar, scroll its card into view (smooth, doesn't resize the Safari window).
  useEffect(() => {
    if (!activeExercise) return;
    const el = cardRefs.current[activeExercise];
    if (el) {
      const t = requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      return () => cancelAnimationFrame(t);
    }
  }, [activeExercise, selectedDate]);

  // Fetch exercise library once on login
  useEffect(() => {
    if (!user) return;
    supabase.from('exercises').select('id, name, category').eq('user_id', user.id).order('name')
      .then(({ data }) => setExercises(data || []));
  }, [user]);

  // Fetch sets whenever the viewed date changes
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setAddingTo(null);
    setActiveExercise(null);
    setEditingSetId(null);
    setTappedSetId(null);
    setPendingExercises([]);
    try {
      const allNotes = JSON.parse(localStorage.getItem('fittrack_notes') || '{}');
      const dateNote = allNotes[selectedDate] || '';
      setNote(dateNote);
      setNoteExpanded(!!dateNote);
    } catch { setNote(''); setNoteExpanded(false); }
    supabase.from('workouts').select('id').eq('user_id', user.id).eq('date', selectedDate).maybeSingle()
      .then(async ({ data: workout }) => {
        if (!workout) { setSets([]); setLoading(false); return; }
        const { data: setsData } = await supabase
          .from('workout_sets').select('*').eq('workout_id', workout.id).order('set_order');
        setSets(setsData || []);
        setLoading(false);
        // Pre-fetch stats for exercises already in today's workout (background)
        const names = [...new Set((setsData || []).map((s) => s.exercise_name))];
        names.forEach((n) => fetchExerciseStats(n));
      });
  }, [user, selectedDate]);

  function goToPrevDay() {
    setSearchParams({ date: format(subDays(dateObj, 1), 'yyyy-MM-dd') });
  }
  function goToNextDay() {
    const next = addDays(dateObj, 1);
    if (format(next, 'yyyy-MM-dd') <= getTodayStr()) {
      setSearchParams({ date: format(next, 'yyyy-MM-dd') });
    }
  }
  function goToToday() {
    setSearchParams({});
  }

  async function ensureWorkout() {
    const { data: existing } = await supabase
      .from('workouts').select('id').eq('user_id', user.id).eq('date', selectedDate).maybeSingle();
    if (existing) return existing.id;
    const { data: created } = await supabase
      .from('workouts').insert({ user_id: user.id, date: selectedDate }).select().single();
    return created.id;
  }

  // Fetch and cache historical stats for an exercise (last set, best e1RM, last session volume).
  // Returns the stats object so callers can use it immediately.
  async function fetchExerciseStats(name) {
    if (exerciseStats[name]) return exerciseStats[name];
    try {
      const { data: workouts } = await supabase
        .from('workouts').select('id, date').eq('user_id', user.id).order('date', { ascending: false });
      if (!workouts || workouts.length === 0) return null;

      const workoutDateMap = Object.fromEntries(workouts.map((w) => [w.id, w.date]));
      const { data: historySets } = await supabase
        .from('workout_sets').select('workout_id, weight_kg, reps, set_type')
        .in('workout_id', workouts.map((w) => w.id))
        .eq('exercise_name', name);

      if (!historySets || historySets.length === 0) return null;

      const withDates = historySets
        .map((s) => ({ ...s, date: workoutDateMap[s.workout_id] }))
        .filter((s) => s.date && s.date !== selectedDate)
        .sort((a, b) => b.date.localeCompare(a.date));

      if (withDates.length === 0) return null;

      // Most recent set for pre-fill
      const lastSet = withDates[0];

      // Best e1RM ever (historical)
      let bestE1RM = 0;
      withDates.forEach((s) => {
        if (s.weight_kg > 0 && s.reps > 0) {
          const e1rm = Math.round(s.weight_kg * (1 + s.reps / 30) * 10) / 10;
          if (e1rm > bestE1RM) bestE1RM = e1rm;
        }
      });

      // Last session volume
      const byDate = {};
      withDates.forEach((s) => {
        if (!byDate[s.date]) byDate[s.date] = [];
        byDate[s.date].push(s);
      });
      const sessionDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
      const lastSessionDate = sessionDates[0];
      const lastSessionVolume = lastSessionDate
        ? byDate[lastSessionDate].reduce((sum, s) => sum + (s.weight_kg || 0) * (s.reps || 0), 0)
        : 0;

      const stats = { lastSet, bestE1RM, lastSessionVolume, lastSessionDate };
      setExerciseStats((prev) => ({ ...prev, [name]: stats }));
      return stats;
    } catch { return null; }
  }

  async function handlePickExercise(name) {
    setShowSheet(false);
    const alreadyExists = exercises.some((ex) => ex.name.toLowerCase() === name.toLowerCase());
    if (!alreadyExists) {
      const { data: newEx } = await supabase
        .from('exercises')
        .upsert({ user_id: user.id, name, category: '' }, { onConflict: 'user_id,name' })
        .select('id, name, category').single();
      if (newEx) setExercises((prev) => [...prev, newEx].sort((a, b) => a.name.localeCompare(b.name)));
    }
    // Pre-fill: today's last set takes priority, fall back to historical
    const todayLast = [...sets].reverse().find((s) => s.exercise_name.toLowerCase() === name.toLowerCase());
    const stats = todayLast ? exerciseStats[name] || null : await fetchExerciseStats(name);
    const prefill = todayLast || stats?.lastSet;
    setAddForm({
      weightKg: prefill?.weight_kg > 0 ? String(prefill.weight_kg) : '',
      reps: prefill?.reps > 0 ? String(prefill.reps) : '',
      setType: prefill?.set_type || 'normal',
    });
    setAddingTo(name);
    setActiveExercise(name);
    setEditingSetId(null);
    setTappedSetId(null);
    // Fetch stats in background even if we had a today-set (needed for volume delta + PR checks)
    if (!exerciseStats[name]) fetchExerciseStats(name);
  }

  function handleStartAdd(exerciseName) {
    setActiveExercise(exerciseName);
    if (addingTo === exerciseName) { setAddingTo(null); return; }
    const todayLast = [...sets].reverse().find((s) => s.exercise_name === exerciseName);
    const histLast = exerciseStats[exerciseName]?.lastSet;
    const prefill = todayLast || histLast;
    setAddForm({
      weightKg: prefill?.weight_kg > 0 ? String(prefill.weight_kg) : '',
      reps: prefill?.reps > 0 ? String(prefill.reps) : '',
      setType: prefill?.set_type || 'normal',
    });
    setAddingTo(exerciseName);
    setEditingSetId(null);
    if (!exerciseStats[exerciseName]) fetchExerciseStats(exerciseName);
  }

  async function handleSaveSet() {
    if (!addingTo) return;
    setSaving(true);
    try {
      const workoutId = await ensureWorkout();
      const maxOrder = sets.length > 0 ? Math.max(...sets.map((s) => s.set_order)) : 0;
      const weight = parseFloat(addForm.weightKg) || 0;
      const reps = parseInt(addForm.reps, 10) || 0;
      const { data: newSet, error } = await supabase.from('workout_sets').insert({
        workout_id: workoutId, exercise_name: addingTo,
        weight_kg: weight, reps,
        set_order: maxOrder + 1, set_type: addForm.setType,
        distance: 0, distance_unit: 'km', duration_seconds: 0,
      }).select().single();
      if (error) throw error;
      setSets((prev) => [...prev, newSet]);

      // Flash the row green briefly
      setFlashSetId(newSet.id);
      setTimeout(() => setFlashSetId(null), 1200);

      // Check for personal record
      if (weight > 0 && reps > 0) {
        const e1rm = Math.round(weight * (1 + reps / 30) * 10) / 10;
        const prevBest = exerciseStats[addingTo]?.bestE1RM || 0;
        if (e1rm > prevBest) {
          setPrSetIds((prev) => new Set([...prev, newSet.id]));
          setExerciseStats((prev) => ({
            ...prev,
            [addingTo]: { ...(prev[addingTo] || {}), bestE1RM: e1rm },
          }));
        }
      }

      // Keep form open for next set — do NOT call setAddingTo(null)
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function handleDeleteSet(setId) {
    try {
      await supabase.from('workout_sets').delete().eq('id', setId);
      setSets((prev) => prev.filter((s) => s.id !== setId));
      if (tappedSetId === setId) setTappedSetId(null);
    } catch (err) { console.error(err); }
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

  function handleSaveNote(value) {
    try {
      const allNotes = JSON.parse(localStorage.getItem('fittrack_notes') || '{}');
      if (value.trim()) allNotes[selectedDate] = value.trim();
      else delete allNotes[selectedDate];
      localStorage.setItem('fittrack_notes', JSON.stringify(allNotes));
    } catch {}
  }

  function handleLoadTemplate(template) {
    setShowTemplates(false);
    const newPending = template.exercises.filter(
      (name) => !sets.some((s) => s.exercise_name.toLowerCase() === name.toLowerCase())
    );
    setPendingExercises(newPending);
    if (newPending.length > 0) setActiveExercise(newPending[0]);
  }

  function handleSaveTemplate(name) {
    const exerciseNames = groupedExercises.map((g) => g.name);
    const newTemplate = { id: Date.now().toString(), name: name.trim(), exercises: exerciseNames };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    localStorage.setItem('fittrack_templates', JSON.stringify(updated));
  }

  function handleDeleteTemplate(id) {
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated);
    localStorage.setItem('fittrack_templates', JSON.stringify(updated));
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
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-zinc-400 text-sm">Loading…</div>;
  }

  return (
    <div className="max-w-6xl mx-auto pb-8">

      {/* ── Date navigation header ── */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-2 max-w-lg mx-auto">
        <button
          onClick={goToPrevDay}
          className="text-zinc-500 hover:text-zinc-200 p-2 rounded-xl hover:bg-zinc-800 transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-zinc-100 leading-tight">{heading}</h1>
          <p className="text-zinc-500 text-sm">{subheading}</p>
        </div>
        <button
          onClick={() => setShowTemplates(true)}
          title="Workout templates"
          className="text-zinc-500 hover:text-teal-400 p-2 rounded-xl hover:bg-zinc-800 transition-colors flex-shrink-0"
        >
          <BookOpen className="w-5 h-5" />
        </button>
        <button
          onClick={goToNextDay}
          disabled={isToday}
          className="text-zinc-500 hover:text-zinc-200 disabled:opacity-20 p-2 rounded-xl hover:bg-zinc-800 disabled:hover:bg-transparent transition-colors flex-shrink-0"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* "Back to today" link when browsing past dates */}
      {!isToday && (
        <div className="flex justify-center pb-2 max-w-lg mx-auto px-4">
          <button
            onClick={goToToday}
            className="text-xs text-teal-400 hover:text-teal-300 font-medium px-3 py-1 rounded-lg hover:bg-teal-500/10 transition-colors"
          >
            ↩ Back to today
          </button>
        </div>
      )}

      {/* Session note */}
      <div className="max-w-lg mx-auto px-4 pb-2">
        {noteExpanded ? (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={(e) => handleSaveNote(e.target.value)}
            placeholder="Session note…"
            rows={2}
            className="w-full bg-zinc-800/50 border border-zinc-700/50 text-zinc-300 placeholder-zinc-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 resize-none"
          />
        ) : (
          <button
            onClick={() => setNoteExpanded(true)}
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1"
          >
            <FileText className="w-3.5 h-3.5" />
            Add session note
          </button>
        )}
      </div>

      {/* Sidebar (Today list) + main column: on md+ they sit side by side; on phones the list is a horizontal strip above the cards */}
      <div className="px-4 md:px-6">
        <div
          className={
            groupedExercises.length > 0
              ? 'md:flex md:flex-row md:gap-6 md:items-start'
              : ''
          }
        >
          {groupedExercises.length > 0 && (
            <aside className="mb-4 md:mb-0 md:w-52 flex-shrink-0 md:sticky md:top-2 md:self-start">
              <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2 px-0.5">Today</p>
              <div className="flex md:flex-col gap-2 overflow-x-auto pb-1 md:overflow-y-auto md:max-h-[70vh] [-webkit-overflow-scrolling:touch]">
                {/* Add exercise button — first so it's always immediately visible */}
                <button
                  type="button"
                  onClick={() => { setShowSheet(true); setAddingTo(null); }}
                  className="flex-shrink-0 md:w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold min-h-[48px] transition-colors bg-teal-600/20 border border-teal-500/40 text-teal-400 hover:bg-teal-600/30 hover:border-teal-500/70"
                >
                  <Plus className="w-4 h-4" />
                  <span className="md:inline">Add</span>
                </button>
                {groupedExercises.map(({ name }) => {
                  const cat = (categoryMap[name.toLowerCase()] || '').toLowerCase();
                  const color = CATEGORY_COLORS[cat] || null;
                  const isActive = activeExercise === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        setActiveExercise(name);
                        setAddingTo(null);
                        setEditingSetId(null);
                      }}
                      className={`flex-shrink-0 text-left md:w-full flex items-center gap-2 px-3.5 py-3 rounded-2xl text-sm font-medium min-h-[48px] transition-colors border ${
                        isActive
                          ? 'bg-teal-600 text-white border-teal-500 shadow-md shadow-teal-900/30'
                          : 'bg-zinc-900/80 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color ? color.dot : 'bg-zinc-600'}`} />
                      <span className="truncate max-w-[10rem] md:max-w-none">{name}</span>
                    </button>
                  );
                })}
              </div>
            </aside>
          )}

          <div className="flex-1 min-w-0 max-w-lg mx-auto w-full">
            {/* Empty state */}
            {groupedExercises.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-5 px-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-teal-500/20 to-cyan-500/10 border border-teal-500/20 flex items-center justify-center animate-pulse">
                    <Dumbbell className="w-9 h-9 text-teal-500/60" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-zinc-300 font-semibold text-base mb-1">
                    {isToday ? 'Ready to train?' : 'No workout on this day.'}
                  </p>
                  {isToday && (
                    <p className="text-zinc-600 text-sm">{motivational}</p>
                  )}
                </div>
                {isToday && (
                  <button
                    type="button"
                    onClick={() => setShowSheet(true)}
                    className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-500 hover:to-cyan-400 active:from-teal-700 active:to-cyan-600 text-white font-semibold px-8 py-4 rounded-2xl text-sm transition-all shadow-lg shadow-teal-900/40 min-h-[52px]"
                  >
                    <Plus className="w-4 h-4" />
                    Start Workout
                  </button>
                )}
              </div>
            )}

            {/* Exercise cards */}
            <div className="space-y-3">
        {groupedExercises.map(({ name, sets: exSets }) => {
          const cat = (categoryMap[name.toLowerCase()] || '').toLowerCase();
          const color = CATEGORY_COLORS[cat] || null;
          const isAdding = addingTo === name;
          const isActive = activeExercise === name;

          return (
            <div
              key={name}
              ref={(el) => {
                if (el) cardRefs.current[name] = el;
                else delete cardRefs.current[name];
              }}
              className={`bg-zinc-900 border rounded-2xl overflow-hidden transition-shadow ${
                isActive ? 'border-teal-500 ring-2 ring-teal-500/35 shadow-lg shadow-teal-950/40' : 'border-zinc-800'
              }`}
            >
              {/* Card header */}
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-800/60">
                {color
                  ? <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color.dot}`} />
                  : <span className="w-2 h-2 rounded-full flex-shrink-0 bg-zinc-700" />}
                <span className="text-zinc-100 font-semibold text-sm flex-1 truncate">{name}</span>
                {/* Set count */}
                {exSets.length > 0 && (
                  <span className="text-zinc-600 text-xs flex-shrink-0">
                    {exSets.length} set{exSets.length !== 1 ? 's' : ''}
                  </span>
                )}
                {/* Volume delta vs last session */}
                {(() => {
                  const todayVol = exSets.reduce((sum, s) => sum + (s.weight_kg || 0) * (s.reps || 0), 0);
                  const lastVol = exerciseStats[name]?.lastSessionVolume;
                  if (!lastVol || todayVol === 0) return null;
                  const delta = Math.round(((todayVol - lastVol) / lastVol) * 100);
                  return (
                    <span className={`text-xs font-medium flex-shrink-0 ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {delta >= 0 ? '↑' : '↓'}{Math.abs(delta)}%
                    </span>
                  );
                })()}
                {color && (
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${color.badge} font-medium flex-shrink-0`}>
                    {color.label}
                  </span>
                )}
                <button
                  onClick={() => navigate(`/exercises/${encodeURIComponent(name)}`)}
                  title="View exercise history"
                  className="text-zinc-600 hover:text-teal-400 p-2 rounded-lg transition-colors flex-shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
                >
                  <TrendingUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleStartAdd(name)}
                  className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 min-h-[32px] ${
                    isAdding
                      ? 'bg-zinc-800 text-zinc-500'
                      : 'bg-teal-600/20 text-teal-400 hover:bg-teal-600/30'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Set
                </button>
              </div>

              {/* Set rows */}
              <div className="divide-y divide-zinc-800/40">
                {exSets.map((set, i) => (
                  <div key={set.id}>
                    {editingSetId === set.id ? (
                      <div className="px-4 py-3 flex items-center gap-2 bg-zinc-800/30">
                        <span className="text-zinc-600 text-xs w-5 text-center flex-shrink-0">{i + 1}</span>
                        <input autoFocus type="number" inputMode="decimal" value={editValues.weightKg}
                          onChange={(e) => setEditValues((v) => ({ ...v, weightKg: e.target.value }))}
                          placeholder="kg"
                          className="w-20 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <span className="text-zinc-600 text-xs">×</span>
                        <input type="number" inputMode="numeric" value={editValues.reps}
                          onChange={(e) => setEditValues((v) => ({ ...v, reps: e.target.value }))}
                          placeholder="reps"
                          className="w-20 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                        <div className="flex-1" />
                        <button onClick={handleSaveEdit} disabled={saving}
                          className="text-green-400 hover:text-green-300 disabled:opacity-50 p-1.5 rounded transition-colors">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingSetId(null)}
                          className="text-zinc-600 hover:text-zinc-300 p-1.5 rounded transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div
                          onClick={() => setTappedSetId(tappedSetId === set.id ? null : set.id)}
                          className={`px-4 py-3 flex items-center gap-3 cursor-pointer select-none transition-colors duration-700 ${
                            flashSetId === set.id ? 'bg-emerald-500/15' : 'active:bg-zinc-800/40'
                          }`}
                        >
                          <span className="text-zinc-600 text-xs w-5 text-center flex-shrink-0">{i + 1}</span>
                          <span className="text-zinc-300 text-sm flex-1">
                            {set.weight_kg > 0 ? `${set.weight_kg} kg` : set.reps > 0 ? <span className="text-teal-400 font-medium">BW</span> : null}
                            {set.weight_kg > 0 && set.reps > 0 ? ' × ' : ''}
                            {set.reps > 0 ? `${set.reps} reps` : ''}
                            {!set.weight_kg && !set.reps && set.distance > 0 ? `${set.distance} ${set.distance_unit || 'km'}` : ''}
                            {set.duration_seconds > 0 ? ` · ${Math.floor(set.duration_seconds / 60)}:${String(set.duration_seconds % 60).padStart(2, '0')}` : ''}
                          </span>
                          {set.set_type === 'dropset' && <span className="text-xs px-1.5 py-0.5 rounded border bg-orange-500/20 text-orange-300 border-orange-500/40 flex-shrink-0">Drop</span>}
                          {set.set_type === 'superset' && <span className="text-xs px-1.5 py-0.5 rounded border bg-cyan-500/20 text-cyan-300 border-cyan-500/40 flex-shrink-0">Super</span>}
                          {prSetIds.has(set.id) && <span className="text-xs px-1.5 py-0.5 rounded border bg-amber-500/20 text-amber-300 border-amber-500/40 flex-shrink-0 font-semibold">PR!</span>}
                          {tappedSetId === set.id && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); handleStartEdit(set); }}
                                className="text-zinc-500 hover:text-teal-400 p-1.5 rounded transition-colors flex-shrink-0">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteSet(set.id); }}
                                className="text-zinc-500 hover:text-red-400 p-1.5 rounded transition-colors flex-shrink-0">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                        {/* Saved note preview (shown when not tapped) */}
                        {setNotes[set.id] && tappedSetId !== set.id && (
                          <p className="text-zinc-500 text-xs px-4 pb-2 pl-12">{setNotes[set.id]}</p>
                        )}
                        {/* Note textarea (shown when tapped) */}
                        {tappedSetId === set.id && (
                          <div className="px-4 pb-3 pl-12">
                            <textarea
                              defaultValue={setNotes[set.id] || ''}
                              onBlur={(e) => saveSetNote(set.id, e.target.value)}
                              placeholder="Add note\u2026"
                              rows={1}
                              className="w-full bg-zinc-800/50 border border-zinc-700/50 text-zinc-300 placeholder-zinc-600 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500/50 resize-none"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add set form */}
              {isAdding && (
                <div className="px-4 py-3 border-t border-zinc-800/60 bg-zinc-800/20">
                  <div className="flex items-center gap-2">
                    <input autoFocus type="number" inputMode="decimal" value={addForm.weightKg}
                      onChange={(e) => setAddForm((f) => ({ ...f, weightKg: e.target.value }))}
                      placeholder="Weight (kg)"
                      className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="text-zinc-600 text-xs flex-shrink-0">×</span>
                    <input type="number" inputMode="numeric" value={addForm.reps}
                      onChange={(e) => setAddForm((f) => ({ ...f, reps: e.target.value }))}
                      placeholder="Reps"
                      className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <button onClick={handleSaveSet} disabled={saving}
                      className="bg-teal-600 hover:bg-teal-500 active:bg-teal-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex-shrink-0">
                      {saving ? '…' : 'Add'}
                    </button>
                    <button onClick={() => setAddingTo(null)}
                      className="text-zinc-600 hover:text-zinc-300 p-2 rounded flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-1.5 mt-2.5">
                    {[['normal', 'Normal'], ['dropset', 'Drop set'], ['superset', 'Super set']].map(([val, label]) => (
                      <button key={val} onClick={() => setAddForm((f) => ({ ...f, setType: val }))}
                        className={`text-xs px-3 py-1 rounded-lg border font-medium transition-colors ${
                          addForm.setType === val
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-zinc-900 text-zinc-500 border-zinc-700 hover:text-zinc-300'
                        }`}>
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
          </div>
        </div>
      </div>


      {showSheet && (
        <AddExerciseSheet
          exercises={exercises}
          onSelect={handlePickExercise}
          onClose={() => setShowSheet(false)}
        />
      )}

      {showTemplates && (
        <TemplatesSheet
          templates={templates}
          currentExercises={groupedExercises.map((g) => g.name)}
          onLoad={handleLoadTemplate}
          onDelete={handleDeleteTemplate}
          onSave={handleSaveTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </div>
  );
}
