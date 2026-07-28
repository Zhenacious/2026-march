import React, { useState, useEffect, useMemo } from 'react';
import { Utensils, Search, Plus, Trash2, X, ScanBarcode } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import BarcodeScanner from '../components/BarcodeScanner';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

export default function FoodLog() {
  const { user } = useAuth();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Lookup flow
  const [manualBarcode, setManualBarcode] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [found, setFound] = useState(null); // { barcode, name, brand, serving_size, calories, protein_g, carbs_g, fat_g }
  const [mealType, setMealType] = useState('breakfast');
  const [servings, setServings] = useState('1');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .order('created_at');
      if (!cancelled) {
        if (!error) setEntries(data || []);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user, date]);

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, e) => {
        const s = e.servings || 1;
        acc.calories += (e.calories || 0) * s;
        acc.protein += (e.protein_g || 0) * s;
        acc.carbs += (e.carbs_g || 0) * s;
        acc.fat += (e.fat_g || 0) * s;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [entries]);

  const entriesByMeal = useMemo(() => {
    const groups = {};
    for (const meal of MEAL_TYPES) {
      const list = entries.filter((e) => e.meal_type === meal);
      if (list.length > 0) groups[meal] = list;
    }
    return groups;
  }, [entries]);

  async function handleLookup(barcode) {
    const code = barcode.trim();
    if (!code) return;
    setLookupError('');
    setFound(null);
    setLookupLoading(true);
    try {
      const resp = await fetch(`/api/food-lookup?barcode=${encodeURIComponent(code)}`);
      const json = await resp.json();
      if (!resp.ok) {
        setLookupError(
          resp.status === 404
            ? 'Product not found — check the barcode and try again.'
            : json.error || 'Lookup failed. Please try again.'
        );
        return;
      }
      setFound({ ...json, barcode: code });
      setServings('1');
    } catch {
      setLookupError('Lookup failed. Check your connection and try again.');
    } finally {
      setLookupLoading(false);
    }
  }

  async function handleSave() {
    if (!found) return;
    const servingsNum = parseFloat(servings) || 1;
    const { data, error } = await supabase
      .from('food_entries')
      .insert({
        user_id: user.id,
        date,
        meal_type: mealType,
        food_name: found.brand ? `${found.name} (${found.brand.split(',')[0].trim()})` : found.name,
        barcode: found.barcode,
        serving_size: found.serving_size,
        servings: servingsNum,
        calories: found.calories,
        protein_g: found.protein_g,
        carbs_g: found.carbs_g,
        fat_g: found.fat_g,
      })
      .select()
      .single();
    if (!error && data) {
      setEntries((prev) => [...prev, data]);
      setFound(null);
      setManualBarcode('');
    }
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('food_entries').delete().eq('id', id);
    if (!error) setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const previewServings = parseFloat(servings) || 1;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-teal-600/20 p-2 rounded-xl">
            <Utensils className="w-5 h-5 text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">Food Log</h1>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>
      <p className="text-zinc-400 text-sm mb-6">
        Scan or type a product barcode to log what you ate.
      </p>

      {/* Daily totals */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
        <p className="text-zinc-500 text-xs mb-1">Total for the day</p>
        <p className="text-3xl font-bold text-zinc-100 mb-3">
          {Math.round(totals.calories)} <span className="text-lg text-zinc-400 font-medium">kcal</span>
        </p>
        <div className="flex gap-6 text-sm">
          <p className="text-zinc-400">Protein <span className="text-zinc-100 font-medium">{Math.round(totals.protein)} g</span></p>
          <p className="text-zinc-400">Carbs <span className="text-zinc-100 font-medium">{Math.round(totals.carbs)} g</span></p>
          <p className="text-zinc-400">Fat <span className="text-zinc-100 font-medium">{Math.round(totals.fat)} g</span></p>
        </div>
      </div>

      {/* Add food */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
        <h2 className="text-zinc-100 font-semibold mb-4">Add Food</h2>
        <button
          onClick={() => { setLookupError(''); setScanning((s) => !s); }}
          className="flex items-center justify-center gap-2 w-full bg-teal-600 hover:bg-teal-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors mb-4"
        >
          <ScanBarcode className="w-4 h-4" />
          {scanning ? 'Stop scanning' : 'Scan barcode'}
        </button>
        {scanning && (
          <BarcodeScanner
            onScan={(code) => {
              // Unmount the scanner first so the same barcode can't fire twice
              setScanning(false);
              setManualBarcode(code);
              handleLookup(code);
            }}
            onClose={() => setScanning(false)}
          />
        )}
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-40">
            <label className="text-zinc-400 text-xs">Barcode</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 5449000000996"
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLookup(manualBarcode); }}
              className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <button
            onClick={() => handleLookup(manualBarcode)}
            disabled={lookupLoading || !manualBarcode}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Search className="w-4 h-4" />
            {lookupLoading ? 'Searching…' : 'Search'}
          </button>
        </div>
        {lookupError && <p className="text-red-400 text-xs mt-2">{lookupError}</p>}
      </div>

      {/* Found food */}
      {found && (
        <div className="bg-zinc-900 border border-teal-800/50 rounded-2xl p-5 mb-6">
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-zinc-100 font-semibold">{found.name}</h2>
            <button
              onClick={() => setFound(null)}
              className="text-zinc-500 hover:text-zinc-300 p-1 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {found.brand && <p className="text-zinc-500 text-xs mb-3">{found.brand}</p>}
          <p className="text-zinc-400 text-sm mb-4">
            Per {found.serving_size}: <span className="text-zinc-100">{found.calories} kcal</span> · P {found.protein_g} g · C {found.carbs_g} g · F {found.fat_g} g
          </p>

          <div className="flex gap-2 mb-4 flex-wrap">
            {MEAL_TYPES.map((meal) => (
              <button
                key={meal}
                onClick={() => setMealType(meal)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  mealType === meal
                    ? 'bg-teal-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {MEAL_LABELS[meal]}
              </button>
            ))}
          </div>

          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-zinc-400 text-xs">Servings</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <p className="text-zinc-500 text-sm pb-2">
              = {Math.round(found.calories * previewServings)} kcal
            </p>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ml-auto"
            >
              <Plus className="w-4 h-4" />
              Add to log
            </button>
          </div>
        </div>
      )}

      {/* Meal sections */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-zinc-500 gap-2">
          <Utensils className="w-8 h-8 opacity-40" />
          <p className="text-sm">No foods logged. Search a barcode above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {MEAL_TYPES.filter((meal) => entriesByMeal[meal]).map((meal) => (
            <div key={meal} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-zinc-100 font-semibold">{MEAL_LABELS[meal]}</h2>
                <p className="text-zinc-500 text-xs">
                  {Math.round(entriesByMeal[meal].reduce((sum, e) => sum + (e.calories || 0) * (e.servings || 1), 0))} kcal
                </p>
              </div>
              <div className="divide-y divide-zinc-800">
                {entriesByMeal[meal].map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-800/50 transition-colors group">
                    <div className="min-w-0">
                      <p className="text-zinc-100 text-sm font-medium truncate">{entry.food_name}</p>
                      <p className="text-zinc-500 text-xs">
                        {entry.servings} × {entry.serving_size || 'serving'} · {Math.round((entry.calories || 0) * (entry.servings || 1))} kcal
                        · P {Math.round((entry.protein_g || 0) * (entry.servings || 1))} · C {Math.round((entry.carbs_g || 0) * (entry.servings || 1))} · F {Math.round((entry.fat_g || 0) * (entry.servings || 1))}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded shrink-0"
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
