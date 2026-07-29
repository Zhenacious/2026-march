import React, { useState, useEffect, useMemo } from 'react';
import { ScanBarcode, Plus, Pencil, Trash2, Target, Utensils, Check, BookmarkPlus, Library } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { entryTotals, dayTotals, recentFoods, amountLabel, MEAL_TYPES, MEAL_LABELS } from '../lib/food';
import BarcodeScanner from './BarcodeScanner';
import AddFoodModal from './AddFoodModal';
import FoodPanel from './FoodPanel';
import { insertFoodEntry, updateFoodEntry, deleteFoodEntry, toPanelFood } from '../lib/foodEntries';

export default function TodayFood({ date }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [allRecent, setAllRecent] = useState([]);
  const [myFoods, setMyFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [settings, setSettings] = useState(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalCal, setGoalCal] = useState('');
  const [goalProtein, setGoalProtein] = useState('');

  const [scanning, setScanning] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [initialDetail, setInitialDetail] = useState(null);

  // Search lives here so its results survive closing and reopening the modal
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [savedIds, setSavedIds] = useState([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('food_entries').select('*')
        .eq('user_id', user.id).eq('date', date).order('created_at');
      if (!cancelled) {
        if (err) setError(`Could not load food: ${err.message}`);
        else setEntries(data || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, date]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: recent } = await supabase
        .from('food_entries').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(200);
      setAllRecent(recent || []);

      const { data: mine } = await supabase
        .from('custom_foods').select('*').eq('user_id', user.id).order('name');
      setMyFoods(mine || []);

      const { data: s } = await supabase
        .from('user_settings').select('*').eq('user_id', user.id).maybeSingle();
      if (s) {
        setSettings(s);
        setGoalCal(String(s.goal_calories ?? ''));
        setGoalProtein(String(s.goal_protein_g ?? ''));
      }
    })();
  }, [user]);

  const totals = useMemo(() => dayTotals(entries), [entries]);
  const byMeal = useMemo(() => {
    const g = {};
    for (const m of MEAL_TYPES) {
      const list = entries.filter((e) => e.meal_type === m);
      if (list.length) g[m] = list;
    }
    return g;
  }, [entries]);

  /** Distinct foods logged before, newest first — the "Previous" tab. */
  const previousFoods = useMemo(
    () => recentFoods(allRecent, 40).map((e) => ({
      ...e,
      name: e.food_name,
      brand: '',
    })),
    [allRecent]
  );

  async function saveGoal() {
    const payload = {
      user_id: user.id,
      goal_calories: parseInt(goalCal, 10) || null,
      goal_protein_g: parseInt(goalProtein, 10) || null,
      updated_at: new Date().toISOString(),
    };
    const { error: err } = await supabase.from('user_settings').upsert(payload);
    if (err) { setError(`Could not save goal: ${err.message}`); return; }
    setSettings(payload);
    setEditingGoal(false);
  }

  /** One box for both: digits are treated as a barcode, anything else as a name. */
  async function runSearch(input) {
    const q = String(input).trim();
    if (!q) return;
    setSearchError('');
    setResults(null);
    setSearchLoading(true);
    try {
      if (/^\d{8,14}$/.test(q)) {
        const resp = await fetch(`/api/food-lookup?barcode=${encodeURIComponent(q)}`);
        const json = await resp.json();
        if (!resp.ok) {
          setSearchError(resp.status === 404
            ? 'Barcode not found in any database — try the name, or use Create.'
            : json.error || 'Lookup failed.');
          return;
        }
        setResults([{ ...json, barcode: q }]);
        return;
      }

      // Your own foods first — instant, and never rate-limited
      const { data: mine } = await supabase
        .from('custom_foods').select('*')
        .eq('user_id', user.id).ilike('name', `%${q}%`).limit(10);

      const resp = await fetch(`/api/food-search?q=${encodeURIComponent(q)}`);
      const json = await resp.json().catch(() => ({}));
      const external = resp.ok ? (json.results || []) : [];

      const combined = [
        ...(mine || []).map((f) => ({ ...f, source: 'mine' })),
        ...external,
      ];
      setResults(combined);
      if (combined.length === 0) {
        setSearchError(`No matches for "${q}". Use Create to add it yourself — it'll be saved for next time.`);
      }
    } catch {
      setSearchError('Search failed. Check your connection.');
    } finally {
      setSearchLoading(false);
    }
  }

  /** Keeps a found food in your own library so it is searchable instantly later. */
  async function saveToLibrary(f, key) {
    const row = {
      user_id: user.id,
      name: f.name,
      brand: String(f.brand || ''),
      barcode: f.barcode || '',
      serving_size: f.serving_size || '',
      serving_grams: f.serving_grams ?? null,
      calories: f.calories || 0,
      protein_g: f.protein_g || 0,
      carbs_g: f.carbs_g || 0,
      fat_g: f.fat_g || 0,
      cal_per_100g: f.per_100g?.calories ?? null,
      protein_per_100g: f.per_100g?.protein_g ?? null,
      carbs_per_100g: f.per_100g?.carbs_g ?? null,
      fat_per_100g: f.per_100g?.fat_g ?? null,
    };
    const { data, error: err } = await supabase.from('custom_foods').insert(row).select().single();
    if (err) { setError(`Could not save to your foods: ${err.message}`); return; }
    setMyFoods((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setSavedIds((prev) => [...prev, key]);
  }

  async function savePanel(values, entryId) {
    if (entryId) {
      const data = await updateFoodEntry(entryId, values);
      setEntries((prev) => prev.map((e) => (e.id === entryId ? data : e)));
    } else {
      const data = await insertFoodEntry(user.id, date, values);
      setEntries((prev) => [...prev, data]);
      setAllRecent((prev) => [data, ...prev]);
    }
    closeModal();
  }

  /** Create tab: log the food and keep it in the library in one go. */
  async function createAndLog(values) {
    await savePanel(values, null);
    const { data } = await supabase.from('custom_foods').insert({
      user_id: user.id,
      name: values.food_name,
      brand: '',
      barcode: values.barcode || '',
      serving_size: values.serving_size || '',
      serving_grams: values.serving_grams ?? null,
      calories: values.calories, protein_g: values.protein_g,
      carbs_g: values.carbs_g, fat_g: values.fat_g,
      cal_per_100g: values.cal_per_100g, protein_per_100g: values.protein_per_100g,
      carbs_per_100g: values.carbs_per_100g, fat_per_100g: values.fat_per_100g,
    }).select().single();
    if (data) setMyFoods((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function removeEntry(id) {
    try {
      await deleteFoodEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      closeModal();
    } catch (err) {
      setError(`Could not delete: ${err.message}`);
    }
  }

  function openAdd() { setInitialDetail(null); setModalOpen(true); }
  function openEdit(entry) { setInitialDetail({ food: entry, entryId: entry.id }); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setInitialDetail(null); }

  const goalPct = settings?.goal_calories
    ? Math.min(100, (totals.calories / settings.goal_calories) * 100)
    : 0;

  return (
    <div className="px-4 flex flex-col gap-4">
      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Goal + day totals */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        {editingGoal ? (
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 text-xs">Daily calories</label>
              <input type="number" min="0" value={goalCal} onChange={(e) => setGoalCal(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 text-xs">Daily protein (g)</label>
              <input type="number" min="0" value={goalProtein} onChange={(e) => setGoalProtein(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <button onClick={saveGoal}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Check className="w-4 h-4" /> Save
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-zinc-500 text-xs mb-1">Today</p>
                <p className="text-3xl font-bold text-zinc-100">
                  {Math.round(totals.calories)}
                  <span className="text-lg text-zinc-400 font-medium"> / {settings?.goal_calories ?? '—'} kcal</span>
                </p>
              </div>
              <button onClick={() => setEditingGoal(true)}
                className="flex items-center gap-1.5 text-zinc-500 hover:text-teal-400 text-xs p-1.5 rounded-lg transition-colors">
                <Target className="w-4 h-4" />
                {settings?.goal_calories ? 'Edit goal' : 'Set a goal'}
              </button>
            </div>
            {settings?.goal_calories && (
              <div className="bg-zinc-800 h-2 rounded-full mt-3 overflow-hidden">
                <div className="bg-teal-500 h-full rounded-full transition-all" style={{ width: `${goalPct}%` }} />
              </div>
            )}
            <div className="flex gap-6 text-sm mt-3">
              <p className="text-zinc-400">Protein <span className="text-zinc-100 font-medium">{Math.round(totals.protein)}{settings?.goal_protein_g ? ` / ${settings.goal_protein_g}` : ''} g</span></p>
              <p className="text-zinc-400">Carbs <span className="text-zinc-100 font-medium">{Math.round(totals.carbs)} g</span></p>
              <p className="text-zinc-400">Fat <span className="text-zinc-100 font-medium">{Math.round(totals.fat)} g</span></p>
            </div>
          </>
        )}
      </div>

      {/* Add */}
      <div className="flex gap-2">
        <button onClick={openAdd}
          className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> Add Food
        </button>
        <button onClick={() => { setError(''); setScanning((s) => !s); }} aria-label="Scan barcode"
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-3 rounded-xl transition-colors">
          <ScanBarcode className="w-5 h-5" />
        </button>
      </div>

      {scanning && (
        <BarcodeScanner
          onScan={(code) => {
            setScanning(false);
            setQuery(code);
            setModalOpen(true);
            runSearch(code);
          }}
          onClose={() => setScanning(false)}
        />
      )}

      <Link to="/foods" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-xs transition-colors -mt-1">
        <Library className="w-3.5 h-3.5" /> Manage my foods
      </Link>

      {/* Meals */}
      {loading ? (
        <div className="flex items-center justify-center h-24 text-zinc-500 text-sm">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-zinc-500 gap-2">
          <Utensils className="w-8 h-8 opacity-40" />
          <p className="text-sm">No foods logged yet.</p>
        </div>
      ) : (
        MEAL_TYPES.filter((m) => byMeal[m]).map((meal) => (
          <div key={meal} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-zinc-100 font-semibold">{MEAL_LABELS[meal]}</h2>
              <p className="text-zinc-500 text-xs">
                {Math.round(byMeal[meal].reduce((sum, e) => sum + entryTotals(e).calories, 0))} kcal
              </p>
            </div>
            <div className="divide-y divide-zinc-800">
              {byMeal[meal].map((entry) => (
                <div key={entry.id} className="flex items-center justify-between px-5 py-3">
                  {/* Tapping an entry reopens the same modal on its detail step */}
                  <button onClick={() => openEdit(entry)} className="min-w-0 text-left flex-1">
                    <p className="text-zinc-100 text-sm font-medium truncate">{entry.food_name}</p>
                    <p className="text-zinc-500 text-xs">
                      {amountLabel(entry)} · {Math.round(entryTotals(entry).calories)} kcal
                      · P {Math.round(entryTotals(entry).protein)} · C {Math.round(entryTotals(entry).carbs)} · F {Math.round(entryTotals(entry).fat)}
                    </p>
                  </button>
                  <div className="flex gap-1 shrink-0 ml-2">
                    <button onClick={() => openEdit(entry)} aria-label="Edit entry"
                      className="text-zinc-600 hover:text-teal-400 p-1.5 rounded transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeEntry(entry.id)} aria-label="Delete entry"
                      className="text-zinc-600 hover:text-red-400 p-1.5 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <AddFoodModal
        open={modalOpen}
        onClose={closeModal}
        onSave={savePanel}
        onDelete={removeEntry}
        initialDetail={initialDetail}
        myFoods={myFoods}
        previousFoods={previousFoods}
        searchState={{
          query, setQuery, run: runSearch,
          loading: searchLoading, error: searchError, results,
          rowAction: (f, i) => {
            if (f.source === 'mine' || !f.name) return null;
            const key = `${f.source}-${f.barcode || i}`;
            return (
              <button onClick={() => saveToLibrary(f, key)} disabled={savedIds.includes(key)}
                title="Save to my foods"
                className="text-zinc-600 hover:text-teal-400 disabled:text-teal-500 p-1.5 rounded transition-colors shrink-0">
                {savedIds.includes(key) ? <Check className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
              </button>
            );
          },
        }}
        createForm={
          <FoodPanel
            initial={{ food_name: '', serving_size: '1 serving' }}
            saveLabel="Create and log"
            onSave={createAndLog}
            onCancel={closeModal}
          />
        }
      />
    </div>
  );
}
