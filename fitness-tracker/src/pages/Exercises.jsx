import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Search, Dumbbell } from 'lucide-react';

export default function Exercises() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

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

  const filtered = exercises.filter(
    (ex) =>
      ex.name.toLowerCase().includes(search.toLowerCase()) ||
      (ex.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce((acc, ex) => {
    const cat = ex.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ex);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Exercise Library</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{exercises.length} exercises total</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Exercise
        </button>
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
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Exercise Name *
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Bench Press"
                required
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Category
              </label>
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. Chest, Legs"
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={adding}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises…"
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-zinc-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-zinc-500 gap-2">
          <Dumbbell className="w-8 h-8 opacity-40" />
          <p className="text-sm">
            {search ? 'No exercises match your search' : 'No exercises yet. Add your first one!'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([category, exList]) => (
              <div key={category}>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  {category}
                </h3>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-800">
                  {exList.map((ex) => (
                    <div
                      key={ex.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors"
                    >
                      <span className="text-zinc-200 text-sm">{ex.name}</span>
                      <button
                        onClick={() => handleDelete(ex.id)}
                        className="text-zinc-600 hover:text-red-400 transition-colors p-1 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
