import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Search, Dumbbell, Pencil, ChevronRight, Sparkles } from 'lucide-react';
import { CATEGORY_COLORS, MUSCLE_GROUPS as BASE_MUSCLE_GROUPS, normalizeCategory } from '../lib/categories';
import { SEED_EXERCISES } from '../lib/seedExercises';
import { DEFAULT_TRACK_TYPE, trackTypeShort, defaultTrackTypeForCategory } from '../lib/trackTypes';
import MuscleGroupPicker from '../components/MuscleGroupPicker';
import TrackTypePicker from '../components/TrackTypePicker';
import ExerciseEditDialog from '../components/ExerciseEditDialog';

const MUSCLE_GROUPS = [...BASE_MUSCLE_GROUPS, { label: 'Uncategorized', categories: [''] }];

export default function Exercises() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exercises, setExercises] = useState([]);
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newType, setNewType] = useState(DEFAULT_TRACK_TYPE);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toppingUp, setToppingUp] = useState(false);
  const [topUpMsg, setTopUpMsg] = useState(null);

  async function fetchExercises() {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('exercises')
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      if (err) throw err;
      setExercises(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) fetchExercises();
  }, [user]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError('');
    try {
      const { error: err } = await supabase.from('exercises').insert({
        user_id: user.id,
        name: newName.trim(),
        category: normalizeCategory(newCategory),
        track_type: newType,
      });
      if (err) throw err;
      setNewName('');
      setNewCategory('');
      setNewType(DEFAULT_TRACK_TYPE);
      await fetchExercises();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this exercise?')) return;
    try {
      const { error: err } = await supabase
        .from('exercises')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (err) throw err;
      setExercises((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(ex) {
    setEditingId(ex.id);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleSaveEdit(id, changes) {
    setSaving(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('exercises')
        .update(changes)
        .eq('id', id)
        .eq('user_id', user.id);
      if (err) throw err;
      setExercises((prev) =>
        prev.map((ex) => ex.id === id ? { ...ex, ...changes } : ex)
      );
      cancelEdit();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddStarter() {
    setToppingUp(true);
    setTopUpMsg(null);
    setError('');
    try {
      const categoryByName = Object.fromEntries(
        SEED_EXERCISES.map((ex) => [ex.name, ex.category])
      );
      const candidates = SEED_EXERCISES.map((ex) => ex.name);
      const existing = exercises.map((ex) => ex.name);

      let toAdd;
      if (existing.length === 0) {
        // Empty library — nothing to compare against, so add everything.
        toAdd = candidates;
      } else {
        // Ask the AI which starter exercises aren't already in the library.
        const res = await fetch('/api/match-exercises', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ existing, candidates }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed (${res.status})`);
        }
        const data = await res.json();
        toAdd = Array.isArray(data.toAdd) ? data.toAdd : [];
      }

      // Keep only names we recognise from the starter list.
      const records = toAdd
        .filter((name) => name in categoryByName)
        .map((name) => ({
          user_id: user.id,
          name,
          category: categoryByName[name],
          track_type: defaultTrackTypeForCategory(categoryByName[name]),
        }));

      if (records.length === 0) {
        setTopUpMsg({ type: 'info', text: 'Your library already covers the starter list.' });
        return;
      }

      const { error: err } = await supabase
        .from('exercises')
        .upsert(records, { onConflict: 'user_id,name', ignoreDuplicates: true });
      if (err) throw err;

      await fetchExercises();
      setTopUpMsg({
        type: 'success',
        text: `Added ${records.length} new exercise${records.length === 1 ? '' : 's'} to your library.`,
      });
    } catch (err) {
      setError('Could not add starter exercises: ' + err.message);
    } finally {
      setToppingUp(false);
    }
  }

  const { filtered, grouped, sortedCategories } = useMemo(() => {
    const group = MUSCLE_GROUPS.find((g) => g.label === activeGroup);
    const filtered = exercises.filter((ex) => {
      const cat = normalizeCategory(ex.category);
      const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
      const matchesGroup =
        group.categories === null ||
        (activeGroup === 'Uncategorized'
          ? !Object.keys(CATEGORY_COLORS).includes(cat)
          : group.categories.includes(cat));
      return matchesSearch && matchesGroup;
    });
    const grouped = filtered.reduce((acc, ex) => {
      const cat = normalizeCategory(ex.category);
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(ex);
      return acc;
    }, {});
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    });
    return { filtered, grouped, sortedCategories };
  }, [exercises, search, activeGroup]);

  const uncategorizedCount = useMemo(
    () => exercises.filter((ex) => !normalizeCategory(ex.category)).length,
    [exercises]
  );

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Exercise Library</h1>
          <p className="text-zinc-400 text-xs mt-0.5">{exercises.length} exercises</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Starter exercises — add common gym exercises you don't already have */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-zinc-100 font-semibold text-sm">Starter exercises</h2>
          <p className="text-zinc-500 text-xs mt-0.5">
            Add common gym exercises you don't already have.
          </p>
          {topUpMsg && (
            <p
              className={`text-xs mt-1.5 ${
                topUpMsg.type === 'success' ? 'text-green-400' : 'text-zinc-400'
              }`}
            >
              {topUpMsg.text}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddStarter}
          disabled={toppingUp || loading}
          className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-zinc-100 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 flex-shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          {toppingUp ? 'Checking…' : 'Add starter exercises'}
        </button>
      </div>

      {/* Add exercise — always visible, compact inline form */}
      <form onSubmit={handleAdd} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4">
        <h2 className="text-zinc-100 font-semibold text-sm mb-3">Add Exercise</h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Exercise name, e.g. Bench Press"
            required
            autoComplete="off"
            className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>

        {/* Category picker */}
        <div>
          <p className="text-xs text-zinc-500 mb-1.5">Category (optional)</p>
          <MuscleGroupPicker value={newCategory} onChange={setNewCategory} />
        </div>

        {/* Track type picker */}
        <div className="mt-3">
          <p className="text-xs text-zinc-500 mb-1.5">Tracks</p>
          <TrackTypePicker value={newType} onChange={setNewType} />
        </div>
      </form>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises…"
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
      </div>

      {/* Muscle group tabs */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {MUSCLE_GROUPS.map((g) => (
          <button
            key={g.label}
            onClick={() => setActiveGroup(g.label)}
            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
              activeGroup === g.label
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            {g.label}
            {g.label === 'Uncategorized' && uncategorizedCount > 0 && (
              <span className="ml-1.5 bg-amber-500/30 text-amber-300 text-xs px-1 rounded">
                {uncategorizedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-zinc-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-zinc-500 gap-2">
          <Dumbbell className="w-8 h-8 opacity-40" />
          <p className="text-sm">
            {search ? 'No exercises match your search' : 'No exercises in this group yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedCategories.map((cat) => {
            const color = CATEGORY_COLORS[cat.toLowerCase()];
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-1.5">
                  {color && <span className={`w-2 h-2 rounded-full ${color.dot}`} />}
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    {cat || 'Uncategorized'}
                  </h3>
                  <span className="text-xs text-zinc-600">{grouped[cat].length}</span>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800">
                  {grouped[cat].map((ex) => (
                    <div key={ex.id} className="px-4 py-2.5 hover:bg-zinc-800/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color ? color.dot : 'bg-zinc-600'}`} />
                        <button
                          onClick={() => navigate(`/exercises/${encodeURIComponent(ex.name)}`)}
                          className="text-zinc-200 text-sm flex-1 text-left hover:text-teal-300 transition-colors"
                        >
                          {ex.name}
                        </button>
                        {(ex.track_type || 'weight_reps') !== 'weight_reps' && (
                          <span className="text-[10px] uppercase tracking-wide text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5 flex-shrink-0">
                            {trackTypeShort(ex.track_type)}
                          </span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-700" />
                        <button
                          onClick={() => startEdit(ex)}
                          className="text-zinc-600 hover:text-teal-400 transition-colors p-1 rounded"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(ex.id)}
                          className="text-zinc-600 hover:text-red-400 transition-colors p-1 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Exercise edit dialog */}
      {editingId && (
        <ExerciseEditDialog
          exercise={exercises.find((e) => e.id === editingId)}
          onSave={(changes) => handleSaveEdit(editingId, changes)}
          onCancel={cancelEdit}
          isSaving={saving}
        />
      )}
    </div>
  );
}
