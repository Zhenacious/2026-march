import React from 'react';
import { TRACK_TYPES } from '../lib/trackTypes';

/**
 * Reusable track type picker shown as clickable chips.
 * Displays all available track types (weight_reps, distance, duration).
 */
export default function TrackTypePicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TRACK_TYPES.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
            value === t.value
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:border-zinc-600 hover:text-zinc-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
