import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Search, Dumbbell, Pencil, Check, X, ChevronRight } from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_OPTIONS, MUSCLE_GROUPS as BASE_MUSCLE_GROUPS } from '../lib/categories';

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
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [saving, setSaving] = useState(false);

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
        category: newCategory.trim(),
      });
      if (err) throw err;
      setNewName('');
      setNewCategory('');
      setShowForm(false);
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
    setEditName(ex.name);
    setEditCategory(ex.category || '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditCategory('');
  }

  async function handleSaveEdit(id) {
    if (!editName.trim()) return;
    setSaving(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('exercises')
        .update({ name: editName.trim(), category: editCategory })
        .eq('id', id)
        .eq('user_id', user.id);
      if (err) throw err;
      setExercises((prev) =>
        prev.map((ex) => ex.id === id ? { ...ex, name: editName.trim(), category: editCategory } : ex)
      );
      cancelEdit();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Filter by search + active muscle group tab — wrapped in useMemo so it only
  // recalculates when exercises, search term, or selected tab actually change.
  const { filtered, grouped, sortedCategories } = useMemo(() => {
    const group = MUSCLE_GROUPS.find((g) => g.label === activeGroup);
    const filtered = exercises.filter((ex) => {
      const cat = (ex.category || '').toLowerCase();
      const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
      const matchesGroup =
        group.categories === null ||
        (activeGroup === 'Uncategorized'
          ? !Object.keys(CATEGORY_COLORS).includes(cat)
          : group.categories.includes(cat));
      return matchesSearch && matchesGroup;
    });
    const grouped = filtered.reduce((acc, ex) => {
      const cat = ex.category || '';
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
    () => exercises.filter((ex) => !ex.category || ex.category.trim() === '').length,
    [exercises]
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Exercise Library</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{exercises.length} exercises total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Exercise
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6 space-y-4"
        >
          <h2 className="text-zinc-100 font-semibold">New Exercise</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Exercise Name *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Bench Press"
                required
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">Select category…</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={adding}
              className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {adding ? 'Adding…' : 'Add Exercise'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setNewName(''); setNewCategory(''); }}
              className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

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
      <div className="flex gap-1.5 flex-wrap mb-5">
        {MUSCLE_GROUPS.map((g) => (
          <button
            key={g.label}
            onClick={() => setActiveGroup(g.label)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
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
        <div className="space-y-6">
          {sortedCategories.map((cat) => {
            const color = CATEGORY_COLORS[cat.toLowerCase()];
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  {color && <span className={`w-2 h-2 rounded-full ${color.dot}`} />}
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    {cat || 'Uncategorized'}
                  </h3>
                  <span className="text-xs text-zinc-600">{grouped[cat].length}</span>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800">
                  {grouped[cat].map((ex) => (
                    <div key={ex.id} className="px-4 py-3 hover:bg-zinc-800/50 transition-colors">
                      {editingId === ex.id ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            autoFocus
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(ex.id); if (e.key === 'Escape') cancelEdit(); }}
                            className="flex-1 min-w-0 bg-zinc-700 border border-zinc-600 text-zinc-100 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="bg-zinc-700 border border-zinc-600 text-zinc-100 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          >
                            <option value="">Uncategorized</option>
                            {CATEGORY_OPTIONS.map((c) => (
                              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleSaveEdit(ex.id)}
                            disabled={saving}
                            className="text-green-400 hover:text-green-300 p-1 rounded transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-zinc-500 hover:text-zinc-200 p-1 rounded transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color ? color.dot : 'bg-zinc-600'}`} />
                          <button
                            onClick={() => navigate(`/exercises/${encodeURIComponent(ex.name)}`)}
                            className="text-zinc-200 text-sm flex-1 text-left hover:text-teal-300 transition-colors"
                          >
                            {ex.name}
                          </button>
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
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
