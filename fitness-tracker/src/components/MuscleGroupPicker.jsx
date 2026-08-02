import React from 'react';
import { CATEGORY_COLORS, CATEGORY_OPTIONS, categoryLabel } from '../lib/categories';

/**
 * Reusable muscle group category picker shown as clickable chips.
 * Displays all canonical categories as colorful buttons.
 * Pass an empty string to select "None" (uncategorized).
 */
export default function MuscleGroupPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange('')}
        className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
          value === ''
            ? 'bg-zinc-600 text-zinc-100 border-zinc-500'
            : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:border-zinc-600 hover:text-zinc-300'
        }`}
      >
        None
      </button>
      {CATEGORY_OPTIONS.map((cat) => {
        const color = CATEGORY_COLORS[cat];
        const isActive = value === cat;
        return (
          <button
            key={cat}
            type="button"
            onClick={() => onChange(cat)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex items-center gap-1.5 ${
              isActive
                ? `${color?.badge || 'bg-zinc-700 text-zinc-100 border-zinc-600'}`
                : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:border-zinc-600 hover:text-zinc-300'
            }`}
          >
            {color && <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />}
            {categoryLabel(cat)}
          </button>
        );
      })}
    </div>
  );
}
