import React, { useState, useEffect, useMemo } from 'react';
import { Library, Plus, Pencil, Trash2, Search, Check, X, Download, Utensils } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { STARTER_FOODS, STARTER_FOOD_COUNT } from '../lib/starterFoods';
import { FAST_FOOD_CHAINS } from '../lib/fastFoods';
import { friendlyDbError } from '../lib/foodEntries';
import { parsePortions, portionLabel, defaultPortion, scaleTo, round1 } from '../lib/portions';
import AlphaList from '../components/AlphaList';
import PortionEditor from '../components/PortionEditor';

const BLANK = {
  name: '', brand: '', aliases: '', barcode: '', category: '',
  portions: [{ label: '1 serving', grams: 100 }],
  cal_per_100g: '', protein_per_100g: '', carbs_per_100g: '', fat_per_100g: '',
};

const inputCls = 'bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

/**
 * Add/edit form for one saved food.
 *
 * Nutrition is entered per 100 g here, because that is a food's definition —
 * the amounts it comes in are the portions below it, and every portion's
 * numbers are worked out from the per-100g figures. Entering an amount for a
 * specific portion happens on the log screen instead.
 */
function FoodForm({ initial, onSave, onCancel }) {
  const [v, setV] = useState(() => ({ ...BLANK, ...initial }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function set(field, value) { setV((prev) => ({ ...prev, [field]: value })); }

  const per100 = {
    calories: parseFloat(v.cal_per_100g) || 0,
    protein_g: parseFloat(v.protein_per_100g) || 0,
    carbs_g: parseFloat(v.carbs_per_100g) || 0,
    fat_g: parseFloat(v.fat_per_100g) || 0,
  };
  const portions = parsePortions(v.portions);
  const preview = portions.length ? scaleTo(per100, portions[0].grams) : null;

  async function submit() {
    if (!String(v.name).trim()) { setErr('Give the food a name.'); return; }
    setErr('');
    setSaving(true);
    try {
      const first = portions[0] || null;
      await onSave({
        name: String(v.name).trim(),
        brand: String(v.brand || '').trim(),
        aliases: String(v.aliases || '').trim(),
        barcode: String(v.barcode || '').trim(),
        category: String(v.category || '').trim(),
        portions,
        cal_per_100g: per100.calories,
        protein_per_100g: per100.protein_g,
        carbs_per_100g: per100.carbs_g,
        fat_per_100g: per100.fat_g,
        // The default portion's values, kept so a row is readable on its own
        serving_size: first ? portionLabel(first) : '',
        serving_grams: first ? first.grams : null,
        calories: first ? round1(scaleTo(per100, first.grams).calories) : 0,
        protein_g: first ? round1(scaleTo(per100, first.grams).protein_g) : 0,
        carbs_g: first ? round1(scaleTo(per100, first.grams).carbs_g) : 0,
        fat_g: first ? round1(scaleTo(per100, first.grams).fat_g) : 0,
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
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-zinc-400 text-xs">
            Also known as <span className="text-zinc-600">— other names to find it by, separated by commas</span>
          </label>
          <input className={inputCls} placeholder="e.g. 老干妈, laoganma, chilli crisp"
            value={v.aliases} onChange={(e) => set('aliases', e.target.value)} />
        </div>
      </div>

      <PortionEditor value={v.portions} onChange={(p) => set('portions', p)} />

      <p className="text-zinc-400 text-xs">
        Nutrition per 100 g <span className="text-zinc-600">— every portion is worked out from this</span>
      </p>
      <div className="grid grid-cols-4 gap-2">
        {[['kcal', 'cal_per_100g'], ['Protein', 'protein_per_100g'],
          ['Carbs', 'carbs_per_100g'], ['Fat', 'fat_per_100g']].map(([label, field]) => (
          <div key={field} className="flex flex-col gap-1">
            <label className="text-zinc-500 text-[10px]">{label}</label>
            <input className={`${inputCls} px-2`} type="number" step="0.1" min="0"
              value={v[field]} onChange={(e) => set(field, e.target.value)} />
          </div>
        ))}
      </div>
      {preview && (
        <p className="text-zinc-600 text-[11px]">
          {portionLabel(portions[0])} works out to {Math.round(preview.calories)} kcal ·
          {' '}P {round1(preview.protein_g)} · C {round1(preview.carbs_g)} · F {round1(preview.fat_g)}
        </p>
      )}

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
  const [category, setCategory] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [seeding, setSeeding] = useState('');

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

  const categories = useMemo(() => {
    const set = new Set(foods.map((f) => (f.category || '').trim()).filter(Boolean));
    return [...set].sort();
  }, [foods]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return foods.filter((f) => {
      if (category && (f.category || '') !== category) return false;
      if (!q) return true;
      return f.name.toLowerCase().includes(q)
        || (f.brand || '').toLowerCase().includes(q)
        || (f.aliases || '').toLowerCase().includes(q);
    });
  }, [foods, search, category]);

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

  /**
   * Bulk-adds a set of foods, skipping any already in the library. Used by both
   * the starter foods and each fast food chain.
   */
  async function loadFoods(key, rows) {
    setSeeding(key);
    setError('');
    try {
      const have = new Set(foods.map((f) => `${f.name.toLowerCase()}|${(f.brand || '').toLowerCase()}`));
      const toAdd = rows
        .filter((f) => !have.has(`${f.name.toLowerCase()}|${(f.brand || '').toLowerCase()}`))
        .map((f) => ({ ...f, user_id: user.id, barcode: '' }));
      if (toAdd.length === 0) { setSeeding(''); return; }

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
      setSeeding('');
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
        <button onClick={() => loadFoods('starter', STARTER_FOODS)} disabled={!!seeding}
          title={`Adds ${STARTER_FOOD_COUNT} common foods, skipping any you already have`}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Download className="w-4 h-4" />
          {seeding === 'starter' ? 'Loading…' : 'Load starter foods'}
        </button>
      </div>

      {/* Fast food, loaded a chain at a time so you only get the ones you eat at */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Utensils className="w-4 h-4 text-zinc-500" />
          <h2 className="text-zinc-200 text-sm font-semibold">Fast food menus</h2>
        </div>
        <p className="text-zinc-500 text-xs mb-3">
          New Zealand menu nutrition, taken from each chain&rsquo;s published figures. Add only the
          ones you want — everything stays editable afterwards.
        </p>
        <div className="flex gap-2 flex-wrap">
          {FAST_FOOD_CHAINS.map((chain) => (
            <button key={chain.key} onClick={() => loadFoods(chain.key, chain.rows)} disabled={!!seeding}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 px-3 py-2 rounded-lg text-xs font-medium transition-colors">
              <Download className="w-3.5 h-3.5" />
              {seeding === chain.key ? 'Loading…' : chain.name}
              <span className="text-zinc-600">{chain.rows.length}</span>
            </button>
          ))}
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-4">
          {[['', 'All'], ...categories.map((c) => [c, c])].map(([key, label]) => (
            <button key={key || 'all'} onClick={() => setCategory(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                category === key ? 'bg-teal-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}>
              {label}
            </button>
          ))}
        </div>
      )}

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
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <AlphaList
            className="max-h-[70vh]"
            items={filtered}
            getName={(f) => f.name}
            renderRow={(f) => (
            editing?.id === f.id ? (
              <div key={f.id} className="p-5">
                <FoodForm
                  initial={{
                    ...f,
                    portions: parsePortions(f.portions),
                    cal_per_100g: f.cal_per_100g ?? '',
                    protein_per_100g: f.protein_per_100g ?? '',
                    carbs_per_100g: f.carbs_per_100g ?? '',
                    fat_per_100g: f.fat_per_100g ?? '',
                  }}
                  onSave={(values) => updateFood(f.id, values)}
                  onCancel={() => setEditing(null)}
                />
              </div>
            ) : (
              <FoodRow key={f.id} food={f}
                onEdit={() => { setEditing(f); setAdding(false); }}
                onDelete={() => deleteFood(f.id)} />
            )
          )}
          />
        </div>
      )}
    </div>
  );
}

/** One saved food, summarised by its default portion. */
function FoodRow({ food, onEdit, onDelete }) {
  const portion = defaultPortion(food.portions);
  const per100 = {
    calories: food.cal_per_100g ?? 0, protein_g: food.protein_per_100g ?? 0,
    carbs_g: food.carbs_per_100g ?? 0, fat_g: food.fat_per_100g ?? 0,
  };
  const t = scaleTo(per100, portion.grams);
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div className="min-w-0">
        <p className="text-zinc-100 text-sm font-medium truncate">
          {food.name}
          {food.brand && <span className="text-zinc-500 font-normal"> · {food.brand}</span>}
        </p>
        <p className="text-zinc-500 text-xs">
          {Math.round(t.calories)} kcal / {portionLabel(portion)}
          {' · '}P {Math.round(t.protein_g)} · C {Math.round(t.carbs_g)} · F {Math.round(t.fat_g)}
        </p>
        <p className="text-zinc-600 text-[11px] truncate">
          {Math.round(per100.calories)} kcal/100 g
          {food.aliases ? ` · ${food.aliases}` : ''}
        </p>
      </div>
      <div className="flex gap-1 shrink-0 ml-2">
        <button onClick={onEdit} aria-label="Edit food"
          className="text-zinc-600 hover:text-teal-400 p-1.5 rounded transition-colors">
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={onDelete} aria-label="Delete food"
          className="text-zinc-600 hover:text-red-400 p-1.5 rounded transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
