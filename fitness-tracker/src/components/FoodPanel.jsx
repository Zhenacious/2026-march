import React, { useState, useMemo } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { MEAL_TYPES, MEAL_LABELS, UNIT_TO_GRAMS } from '../lib/food';
import {
  parsePortions, portionOptions, portionLabel, defaultPortion,
  scaleTo, scaleFrom, unitPortion, round1,
} from '../lib/portions';
import { defaultMealForNow } from '../lib/foodEntries';
import PortionEditor from './PortionEditor';

const inputCls = 'bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';
const CUSTOM = '__custom__';

/**
 * The single add/edit surface for a food entry — the detail step of the add-food
 * modal, used both for logging a new food and for editing one already in the
 * diary.
 *
 * Per-100g nutrition is the only thing held in state, at full precision. The
 * nutrition boxes show the selected portion's values because that is how a food
 * packet or a menu board reads, but they are derived: typing in one converts
 * back up to per-100g, and changing the portion re-renders them rescaled. That
 * is why the numbers can no longer disagree with the weight.
 */
export default function FoodPanel({
  initial = {}, onSave, onCancel, onDelete, saveLabel = 'Add to log', isNew = false,
}) {
  const [mealType, setMealType] = useState(initial.meal_type || defaultMealForNow());
  const [name, setName] = useState(initial.food_name || '');

  // The food's own portions, plus a plain 100 g option when it has none of its own
  const [portions, setPortions] = useState(() => parsePortions(initial.portions));
  const options = useMemo(() => portionOptions(portions), [portions]);

  const [quantity, setQuantity] = useState(String(initial.quantity ?? 1));

  // Editing an existing entry reopens on the portion it was logged with;
  // anything else opens on the food's default, never on 100 g unless that is
  // all the food has.
  const [sel, setSel] = useState(() =>
    initial.portion_grams > 0
      ? { label: initial.portion_label || 'g', grams: initial.portion_grams }
      : defaultPortion(portions)
  );
  const [custom, setCustom] = useState(() =>
    initial.portion_grams > 0 && ['g', 'oz', 'ml'].includes(initial.portion_label)
  );
  const [customUnit, setCustomUnit] = useState(
    ['g', 'oz', 'ml'].includes(initial.portion_label) ? initial.portion_label : 'g'
  );

  // Per 100 g, unrounded. The single source of truth for every number on screen.
  const [per100, setPer100] = useState(() => seedPer100(initial));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const qty = parseFloat(quantity) || 0;
  const perPortion = useMemo(() => scaleTo(per100, sel.grams), [per100, sel]);
  const totals = useMemo(() => scaleTo(per100, qty * sel.grams), [per100, qty, sel]);

  /** Typing in a nutrition box: convert that portion's value back to per 100 g. */
  function setField(field, typed) {
    const next = { ...roundedPortion(perPortion), [field]: parseFloat(typed) || 0 };
    setPer100(scaleFrom(next, sel.grams));
  }

  function pickPortion(value) {
    if (value === CUSTOM) {
      setCustom(true);
      setSel(unitPortion(customUnit));
      return;
    }
    setCustom(false);
    setSel(options[Number(value)] || defaultPortion(portions));
  }

  function pickUnit(unit) {
    setCustomUnit(unit);
    setSel(unitPortion(unit));
  }

  async function handleSave() {
    setError('');
    if (!name.trim()) { setError('Give the food a name.'); return; }
    if (!(sel.grams > 0)) { setError('Give the portion a weight.'); return; }
    setSaving(true);
    try {
      const cleanPortions = parsePortions(portions);
      await onSave({
        food_name: name.trim(),
        barcode: initial.barcode || '',
        meal_type: mealType,
        quantity: qty || 1,
        portion_label: sel.label,
        portion_grams: sel.grams,
        portions: cleanPortions,
        // Kept so a saved entry still reads sensibly to anything that has not
        // moved over to portions yet, and so the row is self-describing.
        serving_size: portionLabel(sel),
        serving_grams: sel.grams,
        calories: round1(perPortion.calories),
        protein_g: round1(perPortion.protein_g),
        carbs_g: round1(perPortion.carbs_g),
        fat_g: round1(perPortion.fat_g),
        cal_per_100g: per100.calories,
        protein_per_100g: per100.protein_g,
        carbs_per_100g: per100.carbs_g,
        fat_per_100g: per100.fat_g,
      });
    } catch (err) {
      setError(err.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  const selIndex = custom ? CUSTOM : options.findIndex(
    (p) => p.label === sel.label && p.grams === sel.grams
  );

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

      {/* Amount — how many of which portion */}
      <div className="flex flex-col gap-2">
        <label className="text-zinc-400 text-xs">Amount</label>
        <div className="flex gap-2 items-stretch">
          <input className={`${inputCls} w-20 shrink-0`} type="number" step="0.5" min="0"
            aria-label="How many"
            value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <select className={`${inputCls} flex-1 min-w-0`} aria-label="Portion"
            value={selIndex === -1 ? CUSTOM : selIndex}
            onChange={(e) => pickPortion(e.target.value)}>
            {options.map((p, i) => (
              <option key={`${p.label}-${i}`} value={i}>{portionLabel(p)}</option>
            ))}
            <option value={CUSTOM}>Custom weight…</option>
          </select>
        </div>

        {custom && (
          <div className="flex gap-2 items-center">
            {['g', 'oz', 'ml'].map((unit) => (
              <button key={unit} onClick={() => pickUnit(unit)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  customUnit === unit ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-800/60 text-zinc-500 hover:text-zinc-300'
                }`}>
                {unit}
              </button>
            ))}
            {customUnit === 'oz' && qty > 0 && (
              <p className="text-zinc-600 text-[10px]">= {round1(qty * UNIT_TO_GRAMS.oz)} g</p>
            )}
          </div>
        )}

        <p className="text-zinc-600 text-[11px]">
          That is {round1(qty * sel.grams)} g in total.
        </p>
      </div>

      {/* Nutrition — shown for the selected portion, stored per 100 g */}
      <div className="flex flex-col gap-2">
        <label className="text-zinc-400 text-xs">
          Nutrition per {portionLabel(sel)}
        </label>
        <div className="grid grid-cols-4 gap-2">
          {[
            ['kcal', 'calories'], ['Protein', 'protein_g'],
            ['Carbs', 'carbs_g'], ['Fat', 'fat_g'],
          ].map(([label, field]) => (
            <div key={field} className="flex flex-col gap-1">
              <label className="text-zinc-500 text-[10px]">{label}</label>
              <input className={`${inputCls} px-2`} type="number" step="0.1" min="0"
                value={round1(perPortion[field])}
                onChange={(e) => setField(field, e.target.value)} />
            </div>
          ))}
        </div>
        <p className="text-zinc-600 text-[11px]">
          Per 100 g: {round1(per100.calories)} kcal · P {round1(per100.protein_g)} · C {round1(per100.carbs_g)} · F {round1(per100.fat_g)}
        </p>
      </div>

      {/* Defining a new food: say what amounts it comes in */}
      {isNew && <PortionEditor value={portions} onChange={setPortions} />}

      {/* Live total */}
      <div className="bg-zinc-800/60 border border-zinc-700/60 rounded-xl px-4 py-3">
        <p className="text-zinc-500 text-xs mb-1">This entry</p>
        <p className="text-zinc-100 text-2xl font-bold leading-none">
          {Math.round(totals.calories)}<span className="text-zinc-400 text-sm font-medium ml-1">kcal</span>
        </p>
        <p className="text-zinc-500 text-xs mt-1.5">
          Protein {Math.round(totals.protein_g)} g · Carbs {Math.round(totals.carbs_g)} g · Fat {Math.round(totals.fat_g)} g
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

/** Rounded copy of a portion's values, so editing one box does not drag the
 *  others by a rounding hair on the way back to per-100g. */
function roundedPortion(p) {
  return {
    calories: round1(p.calories), protein_g: round1(p.protein_g),
    carbs_g: round1(p.carbs_g), fat_g: round1(p.fat_g),
  };
}

/**
 * Works out the per-100g basis a food arrives with. Preferring the stored
 * per-100g values, falling back to per-serving values divided by the serving
 * weight, and finally to zeros for a food being created from scratch.
 */
function seedPer100(initial) {
  if (initial.cal_per_100g != null) {
    return {
      calories: initial.cal_per_100g,
      protein_g: initial.protein_per_100g ?? 0,
      carbs_g: initial.carbs_per_100g ?? 0,
      fat_g: initial.fat_per_100g ?? 0,
    };
  }
  const grams = initial.portion_grams ?? initial.serving_grams;
  if (grams > 0 && initial.calories != null) {
    return scaleFrom({
      calories: initial.calories, protein_g: initial.protein_g,
      carbs_g: initial.carbs_g, fat_g: initial.fat_g,
    }, grams);
  }
  return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
}
