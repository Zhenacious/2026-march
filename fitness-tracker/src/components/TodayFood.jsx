import React, { useState, useEffect, useMemo } from 'react';
import { ScanBarcode, Search, Pencil, Trash2, Target, Utensils, PlusCircle, Check, BookmarkPlus, Library } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { entryTotals, dayTotals, recentFoods, amountLabel, MEAL_TYPES, MEAL_LABELS } from '../lib/food';
import FoodEntryForm from './FoodEntryForm';
import BarcodeScanner from './BarcodeScanner';

/** Strips DB row keys that must not be reused when re-logging a recent food. */
function asFormInitial(row) {
  const { id, created_at, user_id, date, ...rest } = row;
  return rest;
}

export default function TodayFood({ date }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [allRecent, setAllRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [settings, setSettings] = useState(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalCal, setGoalCal] = useState('');
  const [goalProtein, setGoalProtein] = useState('');

  const [scanning, setScanning] = useState(false);
  const [barcode, setBarcode] = useState('');
  const [results, setResults] = useState(null); // null = no search run yet
  const [savedIds, setSavedIds] = useState([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [pendingFood, setPendingFood] = useState(null); // FoodEntryForm initial for a new entry
  const [editingEntry, setEditingEntry] = useState(null); // existing row being edited

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
      const { data } = await supabase
        .from('food_entries').select('*')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
      setAllRecent(data || []);
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
  const recents = useMemo(() => recentFoods(allRecent), [allRecent]);
  const byMeal = useMemo(() => {
    const g = {};
    for (const m of MEAL_TYPES) {
      const list = entries.filter((e) => e.meal_type === m);
      if (list.length) g[m] = list;
    }
    return g;
  }, [entries]);

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

  /** Maps an API/library result into the shape FoodEntryForm expects. */
  function toFormInitial(f) {
    return {
      food_name: f.brand ? `${f.name} (${String(f.brand).split(',')[0].trim()})` : f.name,
      barcode: f.barcode || '',
      serving_size: f.serving_size,
      serving_grams: f.serving_grams,
      calories: f.calories,
      protein_g: f.protein_g,
      carbs_g: f.carbs_g,
      fat_g: f.fat_g,
      cal_per_100g: f.per_100g?.calories ?? f.cal_per_100g ?? null,
      protein_per_100g: f.per_100g?.protein_g ?? f.protein_per_100g ?? null,
      carbs_per_100g: f.per_100g?.carbs_g ?? f.carbs_per_100g ?? null,
      fat_per_100g: f.per_100g?.fat_g ?? f.fat_per_100g ?? null,
    };
  }

  /** One box for both: digits are treated as a barcode, anything else as a name. */
  async function handleSearch(input) {
    const q = String(input).trim();
    if (!q) return;
    setError('');
    setResults(null);
    setLookupLoading(true);
    try {
      if (/^\d{8,14}$/.test(q)) {
        const resp = await fetch(`/api/food-lookup?barcode=${encodeURIComponent(q)}`);
        const json = await resp.json();
        if (!resp.ok) {
          setError(resp.status === 404
            ? 'Barcode not found in any database — try searching by name, or add it manually.'
            : json.error || 'Lookup failed.');
          return;
        }
        setPendingFood(toFormInitial({ ...json, barcode: q }));
        return;
      }

      // Your own library first — instant, and never rate-limited
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
        setError(`No matches for "${q}". The food databases are thin in some regions — add it manually and it will be saved for next time.`);
      }
    } catch {
      setError('Search failed. Check your connection.');
    } finally {
      setLookupLoading(false);
    }
  }

  /** Keeps a found food in your own library so it is searchable instantly later. */
  async function saveToLibrary(f, key) {
    const { error: err } = await supabase.from('custom_foods').insert({
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
    });
    if (err) { setError(`Could not save to your foods: ${err.message}`); return; }
    setSavedIds((prev) => [...prev, key]);
  }

  async function insertEntry(values) {
    const { data, error: err } = await supabase
      .from('food_entries')
      .insert({ ...values, user_id: user.id, date })
      .select().single();
    if (err) throw new Error(err.message);
    setEntries((prev) => [...prev, data]);
    setAllRecent((prev) => [data, ...prev]);
    setPendingFood(null);
    setBarcode('');
  }

  async function updateEntry(id, values) {
    const { data, error: err } = await supabase
      .from('food_entries').update(values).eq('id', id).select().single();
    if (err) throw new Error(err.message);
    setEntries((prev) => prev.map((e) => (e.id === id ? data : e)));
    setEditingEntry(null);
  }

  async function deleteEntry(id) {
    const { error: err } = await supabase.from('food_entries').delete().eq('id', id);
    if (err) { setError(`Could not delete: ${err.message}`); return; }
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

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

      {/* Goal card */}
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

      {/* Add food */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <button onClick={() => { setError(''); setScanning((s) => !s); }}
          className="flex items-center justify-center gap-2 w-full bg-teal-600 hover:bg-teal-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors mb-4">
          <ScanBarcode className="w-4 h-4" />
          {scanning ? 'Stop scanning' : 'Scan barcode'}
        </button>
        {scanning && (
          <BarcodeScanner
            onScan={(code) => { setScanning(false); setBarcode(code); handleSearch(code); }}
            onClose={() => setScanning(false)}
          />
        )}
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-40">
            <label className="text-zinc-400 text-xs">Search a food or barcode</label>
            <input type="text" placeholder="e.g. tim tam, or 5449000000996" value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(barcode); }}
              className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <button onClick={() => handleSearch(barcode)} disabled={lookupLoading || !barcode}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Search className="w-4 h-4" />
            {lookupLoading ? 'Searching…' : 'Search'}
          </button>
        </div>

        {results && results.length > 0 && (
          <div className="mt-4 border border-zinc-800 rounded-xl divide-y divide-zinc-800 overflow-hidden">
            {results.map((f, i) => {
              const key = `${f.source}-${f.id || f.barcode || i}`;
              return (
                <div key={key} className="flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-800/50 transition-colors">
                  <button onClick={() => { setPendingFood(toFormInitial(f)); setResults(null); }}
                    className="flex-1 min-w-0 text-left">
                    <p className="text-zinc-100 text-sm font-medium truncate">
                      {f.name}
                      {f.source === 'mine' && (
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-teal-400 font-semibold">My foods</span>
                      )}
                    </p>
                    <p className="text-zinc-500 text-xs truncate">
                      {f.brand ? `${String(f.brand).split(',')[0].trim()} · ` : ''}
                      {Math.round(f.calories)} kcal / {f.serving_size || 'serving'}
                    </p>
                  </button>
                  {f.source !== 'mine' && (
                    <button
                      onClick={() => saveToLibrary(f, key)}
                      disabled={savedIds.includes(key)}
                      title="Save to my foods"
                      className="text-zinc-600 hover:text-teal-400 disabled:text-teal-500 p-1.5 rounded transition-colors shrink-0"
                    >
                      {savedIds.includes(key) ? <Check className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {recents.length > 0 && (
          <div className="mt-4">
            <p className="text-zinc-500 text-xs mb-2">Recent foods</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recents.map((r) => (
                <button key={r.id} onClick={() => setPendingFood(asFormInitial(r))}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full px-3 py-1.5 text-xs whitespace-nowrap transition-colors">
                  {r.food_name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          <button onClick={() => setPendingFood({ food_name: '', serving_size: '1 serving' })}
            className="flex items-center gap-1.5 text-teal-400 hover:text-teal-300 text-xs transition-colors">
            <PlusCircle className="w-3.5 h-3.5" />
            Can't find it? Add manually
          </button>
          <Link to="/foods"
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-xs transition-colors">
            <Library className="w-3.5 h-3.5" />
            My foods
          </Link>
        </div>
      </div>

      {/* New-entry form */}
      {pendingFood && (
        <div className="bg-zinc-900 border border-teal-800/50 rounded-2xl p-5">
          <FoodEntryForm
            initial={pendingFood}
            saveLabel="Add to log"
            onSave={insertEntry}
            onCancel={() => setPendingFood(null)}
          />
        </div>
      )}

      {/* Meals */}
      {loading ? (
        <div className="flex items-center justify-center h-24 text-zinc-500 text-sm">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-zinc-500 gap-2">
          <Utensils className="w-8 h-8 opacity-40" />
          <p className="text-sm">No foods logged. Scan a barcode or add manually.</p>
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
              {byMeal[meal].map((entry) =>
                editingEntry?.id === entry.id ? (
                  <div key={entry.id} className="px-5 py-4">
                    <FoodEntryForm
                      initial={editingEntry}
                      saveLabel="Save changes"
                      onSave={(v) => updateEntry(entry.id, v)}
                      onCancel={() => setEditingEntry(null)}
                    />
                  </div>
                ) : (
                  <div key={entry.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-zinc-100 text-sm font-medium truncate">{entry.food_name}</p>
                      <p className="text-zinc-500 text-xs">
                        {amountLabel(entry)} · {Math.round(entryTotals(entry).calories)} kcal
                        · P {Math.round(entryTotals(entry).protein)} · C {Math.round(entryTotals(entry).carbs)} · F {Math.round(entryTotals(entry).fat)}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <button onClick={() => setEditingEntry(entry)}
                        className="text-zinc-600 hover:text-teal-400 p-1.5 rounded transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteEntry(entry.id)}
                        className="text-zinc-600 hover:text-red-400 p-1.5 rounded transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
