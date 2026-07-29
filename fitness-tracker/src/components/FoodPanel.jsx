import React, { useState, useMemo } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { MEAL_TYPES, MEAL_LABELS, UNIT_TO_GRAMS } from '../lib/food';
import { defaultMealForNow } from '../lib/foodEntries';

const inputCls = 'bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';
const r1 = (v) => Math.round(v * 10) / 10;

/**
 * The single add/edit surface for a food entry — rendered inside the desktop
 * drawer and on the mobile /food/add route, and used for both logging a new
 * food and editing one already in the diary.
 *
 * Amounts are servings or a weight. A weight needs to know what 100 g contains,
 * so when a food arrives without that the serving weight can be typed in here
 * ("1 serving = 35 g") and the per-100g values are derived from it.
 */
export default function FoodPanel({ initial = {}, onSave, onCancel, onDelete, saveLabel = 'Add to log' }) {
  const [mealType, setMealType] = useState(initial.meal_type || defaultMealForNow());
  const [unit, setUnit] = useState(
    initial.quantity_mode === 'grams' ? (initial.input_unit || 'g') : 'servings'
  );
  const [servings, setServings] = useState(String(initial.servings ?? 1));
  const [amount, setAmount] = useState(
    String(initial.input_amount ?? initial.grams ?? initial.serving_grams ?? 100)
  );
  const [servingSize, setServingSize] = useState(initial.serving_size || '');
  const [servingGrams, setServingGrams] = useState(String(initial.serving_grams ?? ''));
  const [name, setName] = useState(initial.food_name || '');
  const [cal, setCal] = useState(String(initial.calories ?? 0));
  const [protein, setProtein] = useState(String(initial.protein_g ?? 0));
  const [carbs, setCarbs] = useState(String(initial.carbs_g ?? 0));
  const [fat, setFat] = useState(String(initial.fat_g ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const sg = parseFloat(servingGrams);

  // Either the food came with per-100g data, or we can work it out from the
  // serving weight the user typed in.
  const per100 = useMemo(() => {
    if (initial.cal_per_100g != null) {
      return {
        calories: initial.cal_per_100g,
        protein_g: initial.protein_per_100g ?? 0,
        carbs_g: initial.carbs_per_100g ?? 0,
        fat_g: initial.fat_per_100g ?? 0,
      };
    }
    if (sg > 0) {
      const f = 100 / sg;
      return {
        calories: r1((parseFloat(cal) || 0) * f),
        protein_g: r1((parseFloat(protein) || 0) * f),
        carbs_g: r1((parseFloat(carbs) || 0) * f),
        fat_g: r1((parseFloat(fat) || 0) * f),
      };
    }
    return null;
  }, [initial, sg, cal, protein, carbs, fat]);

  const canWeigh = per100 != null;
  const gramsValue = unit === 'servings' ? null : (parseFloat(amount) || 0) * UNIT_TO_GRAMS[unit];

  const totals = useMemo(() => {
    if (unit !== 'servings' && per100) {
      const f = gramsValue / 100;
      return {
        calories: per100.calories * f,
        protein: per100.protein_g * f,
        carbs: per100.carbs_g * f,
        fat: per100.fat_g * f,
      };
    }
    const s = parseFloat(servings) || 1;
    return {
      calories: (parseFloat(cal) || 0) * s,
      protein: (parseFloat(protein) || 0) * s,
      carbs: (parseFloat(carbs) || 0) * s,
      fat: (parseFloat(fat) || 0) * s,
    };
  }, [unit, per100, gramsValue, servings, cal, protein, carbs, fat]);

  async function handleSave() {
    setError('');
    if (!name.trim()) { setError('Give the food a name.'); return; }
    setSaving(true);
    try {
      await onSave({
        food_name: name.trim(),
        barcode: initial.barcode || '',
        meal_type: mealType,
        quantity_mode: unit === 'servings' ? 'servings' : 'grams',
        servings: parseFloat(servings) || 1,
        grams: gramsValue,
        input_unit: unit === 'servings' ? 'g' : unit,
        input_amount: unit === 'servings' ? null : parseFloat(amount) || 0,
        serving_size: servingSize,
        serving_grams: sg > 0 ? sg : null,
        calories: parseFloat(cal) || 0,
        protein_g: parseFloat(protein) || 0,
        carbs_g: parseFloat(carbs) || 0,
        fat_g: parseFloat(fat) || 0,
        cal_per_100g: per100 ? per100.calories : null,
        protein_per_100g: per100 ? per100.protein_g : null,
        carbs_per_100g: per100 ? per100.carbs_g : null,
        fat_per_100g: per100 ? per100.fat_g : null,
      });
    } catch (err) {
      setError(err.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Name */}
      <div className="flex flex-col gap-1">
        <label className="text-zinc-400 text-xs">Food</label>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        {initial.brand && <p className="text-zinc-500 text-xs">{initial.brand}</p>}
      </div>

      {/* Meal */}
      <div className="flex flex-col gap-2">
        <label className="text-zinc-400 text-xs">Meal</label>
        <div className="flex gap-2 flex-wrap">
          {MEAL_TYPES.map((meal) => (
            <button key={meal} onClick={() => setMealType(meal)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mealType === meal ? 'bg-teal-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}>
              {MEAL_LABELS[meal]}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div className="flex flex-col gap-2">
        <label className="text-zinc-400 text-xs">Amount</label>
        <div className="flex gap-2 flex-wrap">
          {[['servings', 'Servings'], ['g', 'g'], ['oz', 'oz'], ['ml', 'ml']].map(([key, label]) => {
            const disabled = key !== 'servings' && !canWeigh;
            return (
              <button key={key} onClick={() => !disabled && setUnit(key)} disabled={disabled}
                title={disabled ? 'Set the serving weight below to log by weight' : ''}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
                  unit === key ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-800/60 text-zinc-500 hover:text-zinc-300'
                }`}>
                {label}
              </button>
            );
          })}
        </div>

        {unit === 'servings' ? (
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-zinc-500 text-[10px]">How many</label>
              <input className={`${inputCls} w-24`} type="number" step="0.5" min="0"
                value={servings} onChange={(e) => setServings(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-32">
              <label className="text-zinc-500 text-[10px]">A serving is</label>
              <input className={inputCls} placeholder="e.g. 2 biscuits" value={servingSize}
                onChange={(e) => setServingSize(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-[10px]">Amount in {unit}</label>
            <input className={`${inputCls} w-28`} type="number" step={unit === 'oz' ? '0.1' : '1'} min="0"
              value={amount} onChange={(e) => setAmount(e.target.value)} />
            {unit === 'oz' && gramsValue > 0 && (
              <p className="text-zinc-600 text-[10px]">= {r1(gramsValue)} g</p>
            )}
          </div>
        )}

        {/* Defining the serving weight is what unlocks logging by weight */}
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-zinc-500 text-[10px]">One serving weighs (g)</label>
            <input className={`${inputCls} w-28`} type="number" step="0.1" min="0" placeholder="e.g. 35"
              value={servingGrams} onChange={(e) => setServingGrams(e.target.value)} />
          </div>
          {!canWeigh && (
            <p className="text-zinc-600 text-[11px] pb-2">Fill this in to log this food by weight.</p>
          )}
        </div>
      </div>

      {/* Nutrition */}
      <div className="flex flex-col gap-2">
        <label className="text-zinc-400 text-xs">
          Nutrition per serving{servingSize ? ` (${servingSize})` : ''}
        </label>
        <div className="grid grid-cols-4 gap-2">
          {[['kcal', cal, setCal], ['Protein', protein, setProtein], ['Carbs', carbs, setCarbs], ['Fat', fat, setFat]].map(
            ([label, value, set]) => (
              <div key={label} className="flex flex-col gap-1">
                <label className="text-zinc-500 text-[10px]">{label}</label>
                <input className={`${inputCls} px-2`} type="number" step="0.1" min="0"
                  value={value} onChange={(e) => set(e.target.value)} />
              </div>
            )
          )}
        </div>
        {per100 && (
          <p className="text-zinc-600 text-[11px]">
            Per 100 g: {per100.calories} kcal · P {per100.protein_g} · C {per100.carbs_g} · F {per100.fat_g}
          </p>
        )}
      </div>

      {/* Live total */}
      <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-3">
        <p className="text-zinc-500 text-xs mb-1">This entry</p>
        <p className="text-zinc-100 text-2xl font-bold leading-none">
          {Math.round(totals.calories)}<span className="text-zinc-400 text-sm font-medium ml-1">kcal</span>
        </p>
        <p className="text-zinc-500 text-xs mt-1.5">
          Protein {Math.round(totals.protein)} g · Carbs {Math.round(totals.carbs)} g · Fat {Math.round(totals.fat)} g
        </p>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 items-center">
        {onDelete && (
          <button onClick={onDelete}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-red-400 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        )}
        <button onClick={onCancel}
          className="ml-auto bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors">
          <Check className="w-4 h-4" /> {saving ? 'Saving…' : saveLabel}
        </button>
      </div>
    </div>
  );
}
