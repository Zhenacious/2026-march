import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import MuscleGroupPicker from './MuscleGroupPicker';
import TrackTypePicker from './TrackTypePicker';

/**
 * Modal dialog for editing an exercise.
 * Displays name input, category picker, and track type picker.
 */
export default function ExerciseEditDialog({ exercise, onSave, onCancel, isSaving }) {
  const [name, setName] = useState(exercise?.name || '');
  const [category, setCategory] = useState(exercise?.category || '');
  const [trackType, setTrackType] = useState(exercise?.track_type || 'weight_reps');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      category,
      track_type: trackType,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-zinc-100 font-semibold">Edit Exercise</h2>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-200 p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Exercise name */}
          <div>
            <label className="block text-xs text-zinc-500 mb-2 font-medium">Exercise Name</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Bench Press"
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Muscle group */}
          <div>
            <label className="block text-xs text-zinc-500 mb-2 font-medium">Category</label>
            <MuscleGroupPicker value={category} onChange={setCategory} />
          </div>

          {/* Track type */}
          <div>
            <label className="block text-xs text-zinc-500 mb-2 font-medium">Tracks</label>
            <TrackTypePicker value={trackType} onChange={setTrackType} />
          </div>
        </div>

        {/* Buttons */}
        <div className="px-5 py-4 border-t border-zinc-800 flex gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="flex items-center gap-1.5 flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2.5 rounded-lg transition-colors"
          >
            <Check className="w-4 h-4" />
            Save
          </button>
          <button
            onClick={onCancel}
            className="flex-1 text-zinc-400 hover:text-zinc-200 text-sm font-semibold px-3 py-2.5 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
