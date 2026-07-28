import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { MEAL_TYPES, MEAL_LABELS, UNIT_TO_GRAMS } from '../lib/food';

/**
 * Shared add/edit form for a food entry. Amount can be entered as servings of
 * the (editable) serving size, or as grams when per-100g data exists. The four
 * macro numbers are editable overrides.
 */
export default function FoodEntryForm({ initial = {}, onSave, onCancel, saveLabel = 'Save' }) {
  const [mealType, setMealType] = useState(initial.meal_type || 'breakfast');
  // 'servings' | 'g' | 'oz' | 'ml'
  const [unit, setUnit] = useState(
    initial.quantity_mode === 'grams' ? (initial.input_unit || 'g') : 'servings'
  );
  const [servings, setServings] = useState(String(initial.servings ?? 1));
  const [amount, setAmount] = useState(
    String(initial.input_amount ?? initial.grams ?? initial.serving_grams ?? 100)
  );
  const [servingSize, setServingSize] = useState(initial.serving_size || '');
  const [name, setName] = useState(initial.food_name || '');
  const [cal, setCal] = useState(String(initial.calories ?? 0));
  const [protein, setProtein] = useState(String(initial.protein_g ?? 0));
  const [carbs, setCarbs] = useState(String(initial.carbs_g ?? 0));
  const [fat, setFat] = useState(String(initial.fat_g ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const hasPer100g = initial.cal_per_100g != null;

  // Every unit except servings converts to grams, which is what the math uses.
  const gramsValue = unit === 'servings' ? null : (parseFloat(amount) || 0) * UNIT_TO_GRAMS[unit];

  const preview = (() => {
    if (unit !== 'servings' && hasPer100g) {
      return Math.round(((initial.cal_per_100g || 0) * gramsValue) / 100);
    }
    return Math.round((parseFloat(cal) || 0) * (parseFloat(servings) || 1));
  })();

  async function handleSave() {
    setError('');
    if (!name.trim()) { setError('Name is required.'); return; }
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
        serving_grams: initial.serving_grams ?? null,
        calories: parseFloat(cal) || 0,
        protein_g: parseFloat(protein) || 0,
        carbs_g: parseFloat(carbs) || 0,
        fat_g: parseFloat(fat) || 0,
        cal_per_100g: initial.cal_per_100g ?? null,
        protein_per_100g: initial.protein_per_100g ?? null,
        carbs_per_100g: initial.carbs_per_100g ?? null,
        fat_per_100g: initial.fat_per_100g ?? null,
      });
    } catch (err) {
      setError(err.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-zinc-400 text-xs">Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </div>

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

      {/* Amount: servings, or a weight/volume unit (needs per-100g label data) */}
      <div>
        <div className="flex gap-2 mb-2 flex-wrap">
          {[['servings', 'Servings'], ['g', 'g'], ['oz', 'oz'], ['ml', 'ml']].map(([key, label]) => {
            const disabled = key !== 'servings' && !hasPer100g;
            return (
              <button key={key} onClick={() => !disabled && setUnit(key)} disabled={disabled}
                title={disabled ? 'No per-100g data for this food' : ''}
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
              <label className="text-zinc-400 text-xs">Servings</label>
              <input type="number" step="0.5" min="0" value={servings}
                onChange={(e) => setServings(e.target.value)} className={`${inputCls} w-24`} />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-32">
              <label className="text-zinc-400 text-xs">Serving size</label>
              <input type="text" placeholder="e.g. 1 slice (30 g)" value={servingSize}
                onChange={(e) => setServingSize(e.target.value)} className={inputCls} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-zinc-400 text-xs">Amount ({unit})</label>
            <input type="number" step={unit === 'oz' ? '0.1' : '1'} min="0" value={amount}
              onChange={(e) => setAmount(e.target.value)} className={`${inputCls} w-28`} />
            {unit === 'oz' && gramsValue > 0 && (
              <p className="text-zinc-600 text-[10px]">= {Math.round(gramsValue * 10) / 10} g</p>
            )}
          </div>
        )}
      </div>

      {/* Macro values (per one serving; fixed per-100g label data in grams mode) */}
      <div>
        <p className="text-zinc-400 text-xs mb-2">
          Nutrition per {unit !== 'servings' ? '100 g (from label data)' : `serving${servingSize ? ` (${servingSize})` : ''}`}
        </p>
        {unit !== 'servings' ? (
          <p className="text-zinc-500 text-xs">
            {initial.cal_per_100g ?? 0} kcal · P {initial.protein_per_100g ?? 0} g · C {initial.carbs_per_100g ?? 0} g · F {initial.fat_per_100g ?? 0} g
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {[['kcal', cal, setCal], ['Protein', protein, setProtein], ['Carbs', carbs, setCarbs], ['Fat', fat, setFat]].map(([label, val, set]) => (
              <div key={label} className="flex flex-col gap-1">
                <label className="text-zinc-500 text-[10px]">{label}</label>
                <input type="number" step="0.1" min="0" value={val}
                  onChange={(e) => set(e.target.value)} className={`${inputCls} px-2`} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <p className="text-zinc-400 text-sm">= <span className="text-zinc-100 font-semibold">{preview}</span> kcal</p>
        <div className="flex gap-2 ml-auto">
          <button onClick={onCancel}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            <X className="w-4 h-4" /> Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Check className="w-4 h-4" /> {saving ? 'Saving…' : saveLabel}
          </button>
        </div>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
