import React, { useState, useMemo } from 'react';
import { Scale, Plus, Trash2, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { loadBodyWeights, saveBodyWeights } from '../lib/bodyWeight';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
        <p className="text-zinc-300 font-medium mb-1">{label}</p>
        <p className="text-violet-400">{payload[0].value} kg</p>
      </div>
    );
  }
  return null;
};

export default function BodyWeightTracker() {
  const [weights, setWeights] = useState(() => loadBodyWeights());
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [weightInput, setWeightInput] = useState('');
  const [error, setError] = useState('');

  const sorted = useMemo(
    () => [...weights].sort((a, b) => b.date.localeCompare(a.date)),
    [weights]
  );

  const latest = sorted[0] || null;

  const chartData = useMemo(() => {
    return [...weights]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({
        date: format(parseISO(e.date), 'MMM d yy'),
        'Weight (kg)': e.weight_kg,
      }));
  }, [weights]);

  function handleAdd() {
    setError('');
    const kg = parseFloat(weightInput);
    if (!kg || kg <= 0 || kg > 500) { setError('Enter a valid weight (kg).'); return; }
    if (!date) { setError('Select a date.'); return; }

    // Upsert — replace any existing entry for that date
    const updated = [
      ...weights.filter((e) => e.date !== date),
      { date, weight_kg: kg },
    ];
    saveBodyWeights(updated);
    setWeights(updated);
    setWeightInput('');
  }

  function handleDelete(entryDate) {
    const updated = weights.filter((e) => e.date !== entryDate);
    saveBodyWeights(updated);
    setWeights(updated);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <div className="bg-violet-600/20 p-2 rounded-xl">
          <Scale className="w-5 h-5 text-violet-400" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-100">Body Weight</h1>
      </div>
      <p className="text-zinc-400 text-sm mb-6">
        Track your weight over time. Used automatically for bodyweight exercises (sets logged at 0 kg).
      </p>

      {/* Current weight card */}
      {latest && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6 flex items-center justify-between">
          <div>
            <p className="text-zinc-500 text-xs mb-1">Current weight</p>
            <p className="text-3xl font-bold text-zinc-100">{latest.weight_kg} <span className="text-lg text-zinc-400 font-medium">kg</span></p>
          </div>
          <p className="text-zinc-500 text-sm">{format(parseISO(latest.date), 'MMM d, yyyy')}</p>
        </div>
      )}

      {/* Add entry */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
        <h2 className="text-zinc-100 font-semibold mb-4">Log Weight</h2>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex flex-col gap-1">
            <label className="text-zinc-400 text-xs">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-zinc-400 text-xs">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 75.5"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Log
          </button>
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>

      {/* Chart */}
      {chartData.length >= 2 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
          <h2 className="text-zinc-100 font-semibold mb-5">Weight Over Time</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3f3f46' }} tickLine={false} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={{ stroke: '#3f3f46' }} tickLine={false} unit=" kg" domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Weight (kg)" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* History list */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-zinc-500 gap-2">
          <TrendingUp className="w-8 h-8 opacity-40" />
          <p className="text-sm">No entries yet. Log your first weight above.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800">
            <h2 className="text-zinc-100 font-semibold">History</h2>
          </div>
          <div className="divide-y divide-zinc-800">
            {sorted.map((entry) => (
              <div key={entry.date} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-800/50 transition-colors group">
                <div>
                  <p className="text-zinc-100 text-sm font-medium">{entry.weight_kg} kg</p>
                  <p className="text-zinc-500 text-xs">{format(parseISO(entry.date), 'EEEE, MMM d, yyyy')}</p>
                </div>
                <button
                  onClick={() => handleDelete(entry.date)}
                  className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
