import React from 'react';
import { Plus, X, Star } from 'lucide-react';

const inputCls = 'bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

/**
 * Defines the amounts a food comes in — "1 drumstick" weighing 90 g, "1 thigh"
 * weighing 130 g, and so on. The first row is the default: the portion selected
 * when this food is added to the log.
 *
 * This edits a food's definition, not a single log entry. Used on the My Foods
 * form and on the Create tab of the add-food modal.
 */
export default function PortionEditor({ value = [], onChange }) {
  const rows = Array.isArray(value) ? value : [];

  const set = (i, key, v) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));

  const add = () => onChange([...rows, { label: '', grams: '' }]);

  const remove = (i) => onChange(rows.filter((_, j) => j !== i));

  // Moving a row to the top is what makes it the default, so there is no
  // separate "is default" flag to keep in sync.
  const makeDefault = (i) =>
    onChange([rows[i], ...rows.filter((_, j) => j !== i)]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <label className="text-zinc-400 text-xs">Portions</label>
        <p className="text-zinc-600 text-[10px]">The top one is the default</p>
      </div>

      {rows.length === 0 && (
        <p className="text-zinc-600 text-[11px]">
          No portions yet — this food will be logged in grams. Add one like
          &ldquo;1 drumstick&rdquo; weighing 90 g to log it that way instead.
        </p>
      )}

      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            className={`${inputCls} flex-1 min-w-0`}
            placeholder="e.g. 1 drumstick"
            value={row.label ?? ''}
            onChange={(e) => set(i, 'label', e.target.value)}
          />
          <div className="flex items-center gap-1 shrink-0">
            <input
              className={`${inputCls} w-20`}
              type="number" step="0.1" min="0" placeholder="90"
              value={row.grams ?? ''}
              onChange={(e) => set(i, 'grams', e.target.value)}
            />
            <span className="text-zinc-500 text-xs">g</span>
          </div>
          <button
            type="button"
            onClick={() => makeDefault(i)}
            disabled={i === 0}
            aria-label={i === 0 ? 'Default portion' : 'Make this the default'}
            title={i === 0 ? 'Default portion' : 'Make this the default'}
            className={`p-1.5 rounded transition-colors shrink-0 ${
              i === 0 ? 'text-teal-400' : 'text-zinc-600 hover:text-teal-400'
            }`}
          >
            <Star className={`w-4 h-4 ${i === 0 ? 'fill-teal-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="Remove portion"
            className="text-zinc-600 hover:text-red-400 p-1.5 rounded transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-zinc-500 hover:text-teal-400 text-xs font-medium self-start px-1 py-1 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Add a portion
      </button>
    </div>
  );
}
