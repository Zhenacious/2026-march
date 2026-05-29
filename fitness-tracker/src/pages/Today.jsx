import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, addDays, subDays, parseISO } from 'date-fns';
import { Plus, Trash2, Pencil, Check, X, Dumbbell, Search, ChevronLeft, ChevronRight, TrendingUp, BookOpen, FileText, Share } from 'lucide-react';
import { CATEGORY_COLORS, MUSCLE_GROUPS } from '../lib/categories';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';

// FILTER_TABS is just MUSCLE_GROUPS — alias so the sheet component still works
const FILTER_TABS = MUSCLE_GROUPS;

// Returns today's date as a yyyy-MM-dd string, evaluated fresh each call
function getTodayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

function adjustWeight(current, delta) {
  const n = parseFloat(current);
  const base = Number.isFinite(n) ? n : 0;
  return String(Math.max(0, Math.round((base + delta) * 100) / 100));
}

function adjustReps(current, delta) {
  const n = parseInt(current, 10);
  const base = Number.isFinite(n) ? n : 0;
  return String(Math.max(0, base + delta));
}

// Renders the weight × reps (or bodyweight / distance / duration) summary for a set
function setSummary(set) {
  return (
    <>
      {set.weight_kg > 0 ? `${set.weight_kg} kg` : set.reps > 0 ? <span className="text-teal-400 font-medium">BW</span> : null}
      {set.weight_kg > 0 && set.reps > 0 ? ' × ' : ''}
      {set.reps > 0 ? `${set.reps} reps` : ''}
      {!set.weight_kg && !set.reps && set.distance > 0 ? `${set.distance} ${set.distance_unit || 'km'}` : ''}
      {set.duration_seconds > 0 ? ` · ${Math.floor(set.duration_seconds / 60)}:${String(set.duration_seconds % 60).padStart(2, '0')}` : ''}
    </>
  );
}

// ─── Weight + Reps stepper pair (shared by the entry pad and the edit form) ────
function StepperPair({ values, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="text-[10px] text-zinc-500 text-center mb-1">Weight (kg)</p>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onChange({ ...values, weightKg: adjustWeight(values.weightKg, -2.5) })}
            className="w-11 h-11 flex-shrink-0 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white hover:border-zinc-600 text-lg font-bold">−</button>
          <input type="number" inputMode="decimal" value={values.weightKg}
            onChange={(e) => onChange({ ...values, weightKg: e.target.value })} placeholder="0"
            className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-xl px-2 py-2.5 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-center" />
          <button type="button" onClick={() => onChange({ ...values, weightKg: adjustWeight(values.weightKg, 2.5) })}
            className="w-11 h-11 flex-shrink-0 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white hover:border-zinc-600 text-lg font-bold">+</button>
        </div>
      </div>
      <div>
        <p className="text-[10px] text-zinc-500 text-center mb-1">Reps</p>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onChange({ ...values, reps: adjustReps(values.reps, -1) })}
            className="w-11 h-11 flex-shrink-0 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white hover:border-zinc-600 text-lg font-bold">−</button>
          <input type="number" inputMode="numeric" value={values.reps}
            onChange={(e) => onChange({ ...values, reps: e.target.value })} placeholder="0"
            className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-xl px-2 py-2.5 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-center" />
          <button type="button" onClick={() => onChange({ ...values, reps: adjustReps(values.reps, 1) })}
            className="w-11 h-11 flex-shrink-0 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white hover:border-zinc-600 text-lg font-bold">+</button>
        </div>
      </div>
    </div>
  );
}

function SetTypePills({ value, onChange }) {
  return (
    <div className="flex gap-1.5">
      {[['normal', 'Normal'], ['dropset', 'Drop'], ['superset', 'Super']].map(([val, label]) => (
        <button key={val} type="button" onClick={() => onChange(val)}
          className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
            value === val ? 'bg-teal-600 text-white border-teal-600' : 'bg-zinc-900 text-zinc-500 border-zinc-700 hover:text-zinc-300'
          }`}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Full-screen log sheet for a single exercise (option C) ────────────────────
// Shows the exercise's sets and a docked entry pad. Covers the whole screen so
// — once the app is added to the iOS Home Screen — it fills the device edge to edge.
function ExerciseLogSheet({
  name, color, categoryLabel, sets, stats, prSetIds, flashSetId,
  setNotes, onSaveNote, prefill, saving,
  onAddSet, onUpdateSet, onDeleteSet, onCycleSetType, onViewHistory, onClose,
}) {
  const [entry, setEntry] = useState(prefill || { weightKg: '', reps: '', setType: 'normal' });
  const [editingSetId, setEditingSetId] = useState(null);
  const [editValues, setEditValues] = useState({ weightKg: '', reps: '', setType: 'normal' });
  const [tappedSetId, setTappedSetId] = useState(null);

  const todayVol = sets.reduce((sum, s) => sum + (s.weight_kg || 0) * (s.reps || 0), 0);
  const lastVol = stats?.lastSessionVolume;
  const delta = lastVol && todayVol > 0 ? Math.round(((todayVol - lastVol) / lastVol) * 100) : null;

  function startEdit(set) {
    setTappedSetId(null);
    setEditingSetId(set.id);
    setEditValues({
      weightKg: set.weight_kg > 0 ? String(set.weight_kg) : '',
      reps: set.reps > 0 ? String(set.reps) : '',
      setType: set.set_type || 'normal',
    });
  }

  async function saveEdit() {
    await onUpdateSet(editingSetId, editValues);
    setEditingSetId(null);
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 32, stiffness: 320 }}
    >
      <div className="flex flex-col h-full max-w-lg mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-1 px-2 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3 border-b border-zinc-800/70 flex-shrink-0">
          <button onClick={onClose}
            className="flex items-center gap-0.5 text-zinc-300 hover:text-zinc-100 text-sm font-medium px-2 py-2 rounded-xl hover:bg-zinc-800 transition-colors flex-shrink-0">
            <ChevronLeft className="w-5 h-5" /> Done
          </button>
          <div className="flex-1 min-w-0 text-center px-1">
            <div className="flex items-center justify-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color ? color.dot : 'bg-zinc-600'}`} />
              <h2 className="text-zinc-100 font-bold text-lg truncate">{name}</h2>
            </div>
            <p className="text-zinc-500 text-xs">
              {categoryLabel || 'Uncategorized'}
              {delta != null && (
                <span className={`ml-1.5 font-medium ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {delta >= 0 ? '↑' : '↓'}{Math.abs(delta)}% vs last
                </span>
              )}
            </p>
          </div>
          <button onClick={onViewHistory} title="View exercise history"
            className="text-zinc-500 hover:text-teal-400 p-2 rounded-xl hover:bg-zinc-800 transition-colors flex-shrink-0">
            <TrendingUp className="w-5 h-5" />
          </button>
        </div>

        {/* Sets list */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {sets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-600 pb-10">
              <Dumbbell className="w-8 h-8 opacity-40" />
              <p className="text-sm">No sets yet. Add your first set below.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/50">
              {sets.map((set, i) => (
                <div key={set.id}>
                  {editingSetId === set.id ? (
                    <div className="py-3 space-y-2.5">
                      <StepperPair values={editValues} onChange={setEditValues} />
                      <div className="flex justify-end gap-2">
                        <button onClick={saveEdit} disabled={saving}
                          className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                          <Check className="w-4 h-4" /> Save
                        </button>
                        <button onClick={() => setEditingSetId(null)}
                          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 text-sm px-4 py-2 rounded-xl hover:bg-zinc-800 transition-colors">
                          <X className="w-4 h-4" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        onClick={() => setTappedSetId(tappedSetId === set.id ? null : set.id)}
                        className={`py-3 px-1 flex items-center gap-3 cursor-pointer select-none transition-colors duration-700 ${
                          flashSetId === set.id ? 'bg-emerald-500/15' : 'active:bg-zinc-800/40'
                        }`}
                      >
                        <span className="text-zinc-600 text-xs w-5 text-center flex-shrink-0">{i + 1}</span>
                        <span className="text-zinc-200 text-sm flex-1">{setSummary(set)}</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); onCycleSetType(set); }}
                          title="Tap to change set type"
                          className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${
                            set.set_type === 'dropset' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                              : set.set_type === 'superset' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                : 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                          }`}>
                          {set.set_type === 'dropset' ? 'Drop' : set.set_type === 'superset' ? 'Super' : 'Normal'}
                        </button>
                        {prSetIds.has(set.id) && <span className="text-xs px-1.5 py-0.5 rounded border bg-amber-500/20 text-amber-300 border-amber-500/40 flex-shrink-0 font-semibold">PR!</span>}
                        <button onClick={(e) => { e.stopPropagation(); startEdit(set); }}
                          className="text-zinc-500 hover:text-teal-400 p-1.5 rounded transition-colors flex-shrink-0">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteSet(set.id); }}
                          className="text-zinc-500 hover:text-red-400 p-1.5 rounded transition-colors flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {setNotes[set.id] && tappedSetId !== set.id && (
                        <p className="text-zinc-500 text-xs pb-2 pl-9">{setNotes[set.id]}</p>
                      )}
                      {tappedSetId === set.id && (
                        <div className="pb-3 pl-9">
                          <textarea
                            defaultValue={setNotes[set.id] || ''}
                            onBlur={(e) => onSaveNote(set.id, e.target.value)}
                            placeholder="Add note…"
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
          )}
        </div>

        {/* Docked entry pad */}
        <div className="border-t border-zinc-800 bg-zinc-900/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] space-y-2.5 flex-shrink-0">
          <StepperPair values={entry} onChange={setEntry} />
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <SetTypePills value={entry.setType} onChange={(v) => setEntry((e) => ({ ...e, setType: v }))} />
            </div>
            <button onClick={() => onAddSet(entry)} disabled={saving}
              className="bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-500 hover:to-cyan-400 active:from-teal-700 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors flex-shrink-0 flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> {saving ? 'Adding…' : 'Add Set'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Templates bottom sheet ───────────────────────────────────────────────────
function TemplatesSheet({ templates, currentExercises, onLoad, onDelete, onSave, onClose }) {
  const [saveName, setSaveName] = useState('');

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-zinc-900"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      onClick={onClose}
    >
      <div className="flex flex-col h-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-[max(2.5rem,env(safe-area-inset-top,0px))] pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-teal-400" />
            <h2 className="text-zinc-100 font-semibold text-base">Templates</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 pb-8 space-y-4">
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
    </motion.div>
  );
}

// ─── Add Exercise bottom sheet ──────────────────────────────────────────────
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
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-zinc-900"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      onClick={onClose}
    >
      <div className="flex flex-col h-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-[max(2.5rem,env(safe-area-inset-top,0px))] pb-3">
          <h2 className="text-zinc-100 font-semibold text-base">Add Exercise</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X className="w-5 h-5" />
          </button>
        </div>

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
                    isActive ? 'bg-teal-600 text-white border-teal-600' : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  {color && !isActive && <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

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
    </motion.div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function Today() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedDate = searchParams.get('date') || getTodayStr();
  const isToday = selectedDate === getTodayStr();
  const dateObj = parseISO(selectedDate + 'T00:00:00');
  const heading = isToday ? 'Today' : format(dateObj, 'EEEE');
  const subheading = format(dateObj, 'd MMMM yyyy');

  const [sets, setSets] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  // Which exercise's full-screen log sheet is open (null = day list view)
  const [openExercise, setOpenExercise] = useState(null);
  const [saving, setSaving] = useState(false);

  const [exerciseStats, setExerciseStats] = useState({});
  const [flashSetId, setFlashSetId] = useState(null);
  const [prSetIds, setPrSetIds] = useState(new Set());
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

  const [note, setNote] = useState('');
  const [noteExpanded, setNoteExpanded] = useState(false);

  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fittrack_templates') || '[]'); }
    catch { return []; }
  });

  const [pendingExercises, setPendingExercises] = useState([]);

  // One-time "Add to Home Screen" hint — only on iOS Safari when not already
  // installed, and only until the user dismisses it.
  const [showInstallHint, setShowInstallHint] = useState(false);
  useEffect(() => {
    try {
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const isStandalone = window.navigator.standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches;
      const dismissed = localStorage.getItem('fittrack_install_hint_dismissed') === '1';
      setShowInstallHint(isIOS && !isStandalone && !dismissed);
    } catch { /* ignore */ }
  }, []);

  function dismissInstallHint() {
    setShowInstallHint(false);
    try { localStorage.setItem('fittrack_install_hint_dismissed', '1'); } catch { /* ignore */ }
  }

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
    pendingExercises.forEach((name) => {
      if (!map[name]) { order.push(name); map[name] = []; }
    });
    return order.map((name) => ({ name, sets: map[name] }));
  }, [sets, pendingExercises]);

  // Sets belonging to the currently-open exercise (case-insensitive match)
  const openSets = openExercise
    ? sets.filter((s) => s.exercise_name.toLowerCase() === openExercise.toLowerCase())
    : [];

  useEffect(() => {
    if (!user) return;
    supabase.from('exercises').select('id, name, category').eq('user_id', user.id).order('name')
      .then(({ data }) => setExercises(data || []));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setOpenExercise(null);
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

      const lastSet = withDates[0];

      let bestE1RM = 0;
      withDates.forEach((s) => {
        if (s.weight_kg > 0 && s.reps > 0) {
          const e1rm = Math.round(s.weight_kg * (1 + s.reps / 30) * 10) / 10;
          if (e1rm > bestE1RM) bestE1RM = e1rm;
        }
      });

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

  // Builds the entry pad's starting values: today's last set for this exercise,
  // else the most recent historical set.
  function getPrefillFor(name) {
    const todayLast = [...sets].reverse().find((s) => s.exercise_name.toLowerCase() === name.toLowerCase());
    const histLast = exerciseStats[name]?.lastSet;
    const prefill = todayLast || histLast;
    return {
      weightKg: prefill?.weight_kg > 0 ? String(prefill.weight_kg) : '',
      reps: prefill?.reps > 0 ? String(prefill.reps) : '',
      setType: prefill?.set_type || 'normal',
    };
  }

  // Opens the full-screen log sheet for an exercise, fetching its stats first
  // so the entry pad can pre-fill from history.
  async function openLog(name) {
    if (!exerciseStats[name]) await fetchExerciseStats(name);
    setOpenExercise(name);
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
    await openLog(name);
  }

  async function addSetFor(name, values) {
    if (!name) return;
    setSaving(true);
    try {
      const workoutId = await ensureWorkout();
      const maxOrder = sets.length > 0 ? Math.max(...sets.map((s) => s.set_order)) : 0;
      const weight = parseFloat(values.weightKg) || 0;
      const reps = parseInt(values.reps, 10) || 0;
      const { data: newSet, error } = await supabase.from('workout_sets').insert({
        workout_id: workoutId, exercise_name: name,
        weight_kg: weight, reps,
        set_order: maxOrder + 1, set_type: values.setType,
        distance: 0, distance_unit: 'km', duration_seconds: 0,
      }).select().single();
      if (error) throw error;
      setSets((prev) => [...prev, newSet]);

      setFlashSetId(newSet.id);
      setTimeout(() => setFlashSetId(null), 1200);

      if (weight > 0 && reps > 0) {
        const e1rm = Math.round(weight * (1 + reps / 30) * 10) / 10;
        const prevBest = exerciseStats[name]?.bestE1RM || 0;
        if (e1rm > prevBest) {
          setPrSetIds((prev) => new Set([...prev, newSet.id]));
          setExerciseStats((prev) => ({
            ...prev,
            [name]: { ...(prev[name] || {}), bestE1RM: e1rm },
          }));
        }
      }
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function updateSetFor(setId, values) {
    setSaving(true);
    try {
      const { data: updated, error } = await supabase.from('workout_sets').update({
        weight_kg: parseFloat(values.weightKg) || 0,
        reps: parseInt(values.reps, 10) || 0,
        set_type: values.setType,
      }).eq('id', setId).select().single();
      if (error) throw error;
      setSets((prev) => prev.map((s) => s.id === setId ? updated : s));
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function handleDeleteSet(setId) {
    try {
      await supabase.from('workout_sets').delete().eq('id', setId);
      setSets((prev) => prev.filter((s) => s.id !== setId));
    } catch (err) { console.error(err); }
  }

  async function handleCycleSetType(set) {
    const types = ['normal', 'dropset', 'superset'];
    const current = set.set_type || 'normal';
    const next = types[(types.indexOf(current) + 1) % types.length];
    try {
      const { error } = await supabase.from('workout_sets').update({ set_type: next }).eq('id', set.id);
      if (error) throw error;
      setSets((prev) => prev.map((s) => (s.id === set.id ? { ...s, set_type: next } : s)));
    } catch (err) { console.error(err); }
  }

  function handleSaveNote(value) {
    try {
      const allNotes = JSON.parse(localStorage.getItem('fittrack_notes') || '{}');
      if (value.trim()) allNotes[selectedDate] = value.trim();
      else delete allNotes[selectedDate];
      localStorage.setItem('fittrack_notes', JSON.stringify(allNotes));
    } catch { /* ignore */ }
  }

  function handleLoadTemplate(template) {
    setShowTemplates(false);
    const newPending = template.exercises.filter(
      (name) => !sets.some((s) => s.exercise_name.toLowerCase() === name.toLowerCase())
    );
    setPendingExercises(newPending);
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

  // ⚠️ All hooks must be called above this line.
  const bind = useDrag(
    ({ swipe: [swipeX] }) => {
      if (openExercise) return; // don't swipe-change days while logging
      if (swipeX === 1) goToPrevDay();
      if (swipeX === -1 && !isToday) goToNextDay();
    },
    { axis: 'x', swipe: { distance: 50, velocity: 0.3 } }
  );

  if (loading) {
    return (
      <SkeletonTheme baseColor="#27272a" highlightColor="#3f3f46">
        <div className="max-w-lg mx-auto px-4 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-8">
          <div className="flex items-center justify-between mb-6">
            <Skeleton circle width={36} height={36} />
            <div className="text-center flex-1 mx-4">
              <Skeleton height={28} width={100} />
              <Skeleton height={14} width={120} />
            </div>
            <Skeleton circle width={36} height={36} />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="mb-3">
              <Skeleton height={64} borderRadius={16} />
            </div>
          ))}
        </div>
      </SkeletonTheme>
    );
  }

  const openColor = openExercise ? CATEGORY_COLORS[(categoryMap[openExercise.toLowerCase()] || '').toLowerCase()] || null : null;

  return (
    <div {...bind()} style={{ touchAction: 'pan-y' }} className="max-w-lg mx-auto pb-8">

      {/* Date navigation header — top padding clears the iOS status bar/notch now that
          the app's logo bar is hidden on this route */}
      <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-3 flex items-center gap-2">
        <button onClick={goToPrevDay}
          className="text-zinc-500 hover:text-zinc-200 p-2 rounded-xl hover:bg-zinc-800 transition-colors flex-shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-zinc-100 leading-tight">{heading}</h1>
          <p className="text-zinc-500 text-sm">{subheading}</p>
        </div>
        <button onClick={() => setShowTemplates(true)} title="Workout templates"
          className="text-zinc-500 hover:text-teal-400 p-2 rounded-xl hover:bg-zinc-800 transition-colors flex-shrink-0">
          <BookOpen className="w-5 h-5" />
        </button>
        <button onClick={goToNextDay} disabled={isToday}
          className="text-zinc-500 hover:text-zinc-200 disabled:opacity-20 p-2 rounded-xl hover:bg-zinc-800 disabled:hover:bg-transparent transition-colors flex-shrink-0">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {!isToday && (
        <div className="flex justify-center pb-2 px-4">
          <button onClick={goToToday}
            className="text-xs text-teal-400 hover:text-teal-300 font-medium px-3 py-1 rounded-lg hover:bg-teal-500/10 transition-colors">
            ↩ Back to today
          </button>
        </div>
      )}

      {/* Add to Home Screen hint (iOS Safari only) */}
      {showInstallHint && (
        <div className="px-4 pb-2">
          <div className="flex items-start gap-3 bg-teal-600/10 border border-teal-500/30 rounded-2xl px-4 py-3">
            <Share className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-zinc-200 text-sm font-medium">Install for full-screen mode</p>
              <p className="text-zinc-500 text-xs mt-0.5">
                Tap the Share button in Safari, then "Add to Home Screen" — the app then runs edge to edge with no browser bars.
              </p>
            </div>
            <button onClick={dismissInstallHint} className="text-zinc-500 hover:text-zinc-200 p-1 rounded-lg flex-shrink-0" aria-label="Dismiss">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Session note */}
      <div className="px-4 pb-3">
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
          <button onClick={() => setNoteExpanded(true)}
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1">
            <FileText className="w-3.5 h-3.5" />
            Add session note
          </button>
        )}
      </div>

      {/* Day list */}
      <div className="px-4">
        {/* Add exercise */}
        <button onClick={() => setShowSheet(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 mb-3 rounded-2xl text-sm font-semibold min-h-[52px] transition-colors bg-teal-600/15 border border-teal-500/40 text-teal-300 hover:bg-teal-600/25 hover:border-teal-500/60">
          <Plus className="w-4 h-4" /> Add exercise
        </button>

        {groupedExercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-4 px-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-teal-500/20 to-cyan-500/10 border border-teal-500/20 flex items-center justify-center">
              <Dumbbell className="w-9 h-9 text-teal-500/60" />
            </div>
            <div className="text-center">
              <p className="text-zinc-300 font-semibold text-base mb-1">
                {isToday ? 'Ready to train?' : 'No workout logged.'}
              </p>
              {isToday && <p className="text-zinc-600 text-sm">{motivational}</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {groupedExercises.map(({ name, sets: exSets }) => {
              const cat = (categoryMap[name.toLowerCase()] || '').toLowerCase();
              const color = CATEGORY_COLORS[cat] || null;
              const lastSet = exSets[exSets.length - 1];
              const todayVol = exSets.reduce((sum, s) => sum + (s.weight_kg || 0) * (s.reps || 0), 0);
              const lastVol = exerciseStats[name]?.lastSessionVolume;
              const delta = lastVol && todayVol > 0 ? Math.round(((todayVol - lastVol) / lastVol) * 100) : null;
              return (
                <button key={name} onClick={() => openLog(name)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60 transition-colors text-left min-h-[60px]">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color ? color.dot : 'bg-zinc-600'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-100 font-semibold text-sm leading-snug truncate">{name}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {exSets.length === 0
                        ? 'No sets yet — tap to add'
                        : <>{exSets.length} set{exSets.length !== 1 ? 's' : ''}{lastSet ? <span className="text-zinc-600"> · {setSummary(lastSet)}</span> : null}</>}
                    </p>
                  </div>
                  {delta != null && (
                    <span className={`text-xs font-medium flex-shrink-0 ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {delta >= 0 ? '↑' : '↓'}{Math.abs(delta)}%
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {openExercise && (
          <ExerciseLogSheet
            key={`log-${openExercise}`}
            name={openExercise}
            color={openColor}
            categoryLabel={openColor?.label}
            sets={openSets}
            stats={exerciseStats[openExercise]}
            prSetIds={prSetIds}
            flashSetId={flashSetId}
            setNotes={setNotes}
            onSaveNote={saveSetNote}
            prefill={getPrefillFor(openExercise)}
            saving={saving}
            onAddSet={(vals) => addSetFor(openExercise, vals)}
            onUpdateSet={(id, vals) => updateSetFor(id, vals)}
            onDeleteSet={handleDeleteSet}
            onCycleSetType={handleCycleSetType}
            onViewHistory={() => navigate(`/exercises/${encodeURIComponent(openExercise)}`)}
            onClose={() => setOpenExercise(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSheet && (
          <AddExerciseSheet
            key="add-exercise-sheet"
            exercises={exercises}
            onSelect={handlePickExercise}
            onClose={() => setShowSheet(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTemplates && (
          <TemplatesSheet
            key="templates-sheet"
            templates={templates}
            currentExercises={groupedExercises.map((g) => g.name)}
            onLoad={handleLoadTemplate}
            onDelete={handleDeleteTemplate}
            onSave={handleSaveTemplate}
            onClose={() => setShowTemplates(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
