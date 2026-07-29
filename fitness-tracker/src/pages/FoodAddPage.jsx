import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import FoodPanel from '../components/FoodPanel';
import { insertFoodEntry, updateFoodEntry, deleteFoodEntry } from '../lib/foodEntries';

/**
 * Full-screen add/edit route used on narrow screens. Wide screens get the same
 * FoodPanel inside a slide-over drawer instead.
 *
 * The food being logged arrives via router state; landing here directly (a
 * refresh, a shared link) has nothing to show, so it bounces back to the log.
 */
export default function FoodAddPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [error, setError] = useState('');

  const food = state?.food || null;
  const entryId = state?.entryId || null;
  const date = state?.date;

  function backToLog() {
    navigate(`/today?tab=food${date ? `&date=${date}` : ''}`, { replace: true });
  }

  if (!food || !date) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <p className="text-zinc-400 text-sm mb-4">
          Nothing to add here — pick a food from the log first.
        </p>
        <button onClick={backToLog}
          className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Back to Food log
        </button>
      </div>
    );
  }

  async function handleSave(values) {
    if (entryId) await updateFoodEntry(entryId, values);
    else await insertFoodEntry(user.id, date, values);
    backToLog();
  }

  async function handleDelete() {
    try {
      await deleteFoodEntry(entryId);
      backToLog();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-lg mx-auto pb-8">
      <div className="flex items-center gap-2 px-4 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-3">
        <button onClick={backToLog} aria-label="Back"
          className="text-zinc-500 hover:text-zinc-200 p-2 rounded-xl hover:bg-zinc-800 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-zinc-100">
          {entryId ? 'Edit entry' : 'Add food'}
        </h1>
      </div>

      {error && (
        <div className="mx-4 mb-3 bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="px-4">
        <FoodPanel
          initial={food}
          onSave={handleSave}
          onCancel={backToLog}
          onDelete={entryId ? handleDelete : null}
          saveLabel={entryId ? 'Save changes' : 'Add to log'}
        />
      </div>
    </div>
  );
}
