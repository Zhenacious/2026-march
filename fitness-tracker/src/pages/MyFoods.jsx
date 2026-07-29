import React, { useState, useEffect, useMemo } from 'react';
import { Library, Plus, Pencil, Trash2, Search, Check, X, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { STARTER_FOODS, STARTER_FOOD_COUNT } from '../lib/starterFoods';
import { friendlyDbError } from '../lib/foodEntries';

const BLANK = {
  name: '', brand: '', barcode: '', serving_size: '1 serving', serving_grams: '',
  calories: '', protein_g: '', carbs_g: '', fat_g: '',
};

const inputCls = 'bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

/** Add/edit form for one saved food. Macros are per one serving. */
function FoodForm({ initial, onSave, onCancel }) {
  const [v, setV] = useState(() => ({ ...BLANK, ...initial }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function set(field, value) { setV((prev) => ({ ...prev, [field]: value })); }

  async function submit() {
    if (!String(v.name).trim()) { setErr('Give the food a name.'); return; }
    setErr('');
    setSaving(true);
    try {
      const grams = parseFloat(v.serving_grams);
      const cal = parseFloat(v.calories) || 0;
      const p = parseFloat(v.protein_g) || 0;
      const c = parseFloat(v.carbs_g) || 0;
      const f = parseFloat(v.fat_g) || 0;
      // Knowing the serving weight lets the log screen offer grams/oz amounts
      const factor = grams > 0 ? 100 / grams : null;
      await onSave({
        name: String(v.name).trim(),
        brand: String(v.brand || '').trim(),
        barcode: String(v.barcode || '').trim(),
        serving_size: String(v.serving_size || '').trim(),
        serving_grams: grams > 0 ? grams : null,
        calories: cal, protein_g: p, carbs_g: c, fat_g: f,
        cal_per_100g: factor ? Math.round(cal * factor * 10) / 10 : null,
        protein_per_100g: factor ? Math.round(p * factor * 10) / 10 : null,
        carbs_per_100g: factor ? Math.round(c * factor * 10) / 10 : null,
        fat_per_100g: factor ? Math.round(f * factor * 10) / 10 : null,
      });
    } catch (e) {
      setErr(e.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-zinc-400 text-xs">Name</label>
          <input className={inputCls} value={v.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-zinc-400 text-xs">Brand (optional)</label>
          <input className={inputCls} value={v.brand} onChange={(e) => set('brand', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-zinc-400 text-xs">Serving description</label>
          <input className={inputCls} placeholder="e.g. 2 biscuits" value={v.serving_size}
            onChange={(e) => set('serving_size', e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-zinc-400 text-xs">Serving weight in grams (optional)</label>
          <input className={inputCls} type="number" step="0.1" min="0" placeholder="e.g. 35"
            value={v.serving_grams} onChange={(e) => set('serving_grams', e.target.value)} />
        </div>
      </div>

      <p className="text-zinc-400 text-xs">Nutrition per serving</p>
      <div className="grid grid-cols-4 gap-2">
        {[['kcal', 'calories'], ['Protein', 'protein_g'], ['Carbs', 'carbs_g'], ['Fat', 'fat_g']].map(([label, field]) => (
          <div key={field} className="flex flex-col gap-1">
            <label className="text-zinc-500 text-[10px]">{label}</label>
            <input className={`${inputCls} px-2`} type="number" step="0.1" min="0"
              value={v[field]} onChange={(e) => set(field, e.target.value)} />
          </div>
        ))}
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel}
          className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
          <X className="w-4 h-4" /> Cancel
        </button>
        <button onClick={submit} disabled={saving}
          className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Check className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {err && <p className="text-red-400 text-xs">{err}</p>}
    </div>
  );
}

export default function MyFoods() {
  const { user } = useAuth();
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('custom_foods').select('*')
        .eq('user_id', user.id).order('name');
      if (cancelled) return;
      if (err) setError(friendlyDbError(err, 'your saved foods'));
      else setFoods(data || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return foods;
    return foods.filter((f) =>
      f.name.toLowerCase().includes(q) || (f.brand || '').toLowerCase().includes(q));
  }, [foods, search]);

  async function addFood(values) {
    const { data, error: err } = await supabase
      .from('custom_foods').insert({ ...values, user_id: user.id }).select().single();
    if (err) throw new Error(err.message);
    setFoods((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setAdding(false);
  }

  async function updateFood(id, values) {
    const { data, error: err } = await supabase
      .from('custom_foods').update(values).eq('id', id).select().single();
    if (err) throw new Error(err.message);
    setFoods((prev) => prev.map((f) => (f.id === id ? data : f))
      .sort((a, b) => a.name.localeCompare(b.name)));
    setEditing(null);
  }

  /** Fills an empty library with common foods so browsing is useful from day one. */
  async function loadStarterFoods() {
    setSeeding(true);
    setError('');
    try {
      const have = new Set(foods.map((f) => f.name.toLowerCase()));
      const toAdd = STARTER_FOODS
        .filter((f) => !have.has(f.name.toLowerCase()))
        .map((f) => ({ ...f, user_id: user.id, barcode: '' }));
      if (toAdd.length === 0) { setSeeding(false); return; }

      // Chunked so one oversized request can't fail the whole import
      const added = [];
      for (let i = 0; i < toAdd.length; i += 100) {
        const { data, error: err } = await supabase
          .from('custom_foods').insert(toAdd.slice(i, i + 100)).select();
        if (err) throw new Error(err.message);
        added.push(...(data || []));
      }
      setFoods((prev) => [...prev, ...added].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setError(friendlyDbError(err, 'your saved foods'));
    } finally {
      setSeeding(false);
    }
  }

  async function deleteFood(id) {
    const { error: err } = await supabase.from('custom_foods').delete().eq('id', id);
    if (err) { setError(`Could not delete: ${err.message}`); return; }
    setFoods((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <div className="bg-teal-600/20 p-2 rounded-xl">
          <Library className="w-5 h-5 text-teal-400" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-100">My Foods</h1>
      </div>
      <p className="text-zinc-400 text-sm mb-6">
        Your own food list. Anything saved here shows up first when you search on the Food tab,
        and you can correct the numbers whenever a database gets them wrong.
      </p>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-xl mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-40 bg-zinc-800 border border-zinc-700 rounded-lg px-3">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your foods"
            className="bg-transparent text-zinc-100 py-2 text-sm w-full focus:outline-none" />
        </div>
        <button onClick={() => { setAdding(true); setEditing(null); }}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add food
        </button>
        <button onClick={loadStarterFoods} disabled={seeding}
          title={`Adds ${STARTER_FOOD_COUNT} common foods, skipping any you already have`}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Download className="w-4 h-4" />
          {seeding ? 'Loading…' : 'Load starter foods'}
        </button>
      </div>

      {adding && (
        <div className="bg-zinc-900 border border-teal-800/50 rounded-2xl p-5 mb-4">
          <FoodForm initial={BLANK} onSave={addFood} onCancel={() => setAdding(false)} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-24 text-zinc-500 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-2">
          <Library className="w-8 h-8 opacity-40" />
          <p className="text-sm">
            {foods.length === 0
              ? 'No saved foods yet. Add one here, or save a search result from the Food tab.'
              : 'Nothing matches that search.'}
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800 overflow-hidden">
          {filtered.map((f) => (
            editing?.id === f.id ? (
              <div key={f.id} className="p-5">
                <FoodForm
                  initial={{
                    ...f,
                    serving_grams: f.serving_grams ?? '',
                    calories: f.calories ?? '',
                    protein_g: f.protein_g ?? '',
                    carbs_g: f.carbs_g ?? '',
                    fat_g: f.fat_g ?? '',
                  }}
                  onSave={(values) => updateFood(f.id, values)}
                  onCancel={() => setEditing(null)}
                />
              </div>
            ) : (
              <div key={f.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="text-zinc-100 text-sm font-medium truncate">
                    {f.name}
                    {f.brand && <span className="text-zinc-500 font-normal"> · {f.brand}</span>}
                  </p>
                  <p className="text-zinc-500 text-xs">
                    {Math.round(f.calories)} kcal / {f.serving_size || 'serving'}
                    {f.serving_grams ? ` (${f.serving_grams} g)` : ''}
                    {' · '}P {Math.round(f.protein_g)} · C {Math.round(f.carbs_g)} · F {Math.round(f.fat_g)}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <button onClick={() => { setEditing(f); setAdding(false); }}
                    className="text-zinc-600 hover:text-teal-400 p-1.5 rounded transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteFood(f.id)}
                    className="text-zinc-600 hover:text-red-400 p-1.5 rounded transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
