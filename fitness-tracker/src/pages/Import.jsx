import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { parseFitNotesCSV } from '../lib/fitnotes';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';

export default function Import() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setStatus(null);
    setParsedRows([]);
    setFileName(file.name);

    try {
      const rows = await parseFitNotesCSV(file);
      setParsedRows(rows);
    } catch (err) {
      setError('Failed to parse CSV: ' + err.message);
    }
  }

  async function handleImport() {
    if (parsedRows.length === 0) return;
    setImporting(true);
    setError('');
    setStatus(null);

    try {
      const uniqueExercises = [...new Set(parsedRows.map((r) => r.exercise))];
      const exerciseRecords = uniqueExercises.map((name) => {
        const row = parsedRows.find((r) => r.exercise === name);
        return { user_id: user.id, name, category: row?.category || '' };
      });

      const { error: exErr } = await supabase
        .from('exercises')
        .upsert(exerciseRecords, { onConflict: 'user_id,name', ignoreDuplicates: false });
      if (exErr) throw new Error('Exercises upsert failed: ' + exErr.message);

      const uniqueDates = [...new Set(parsedRows.map((r) => r.date))];
      const workoutRecords = uniqueDates.map((date) => ({
        user_id: user.id,
        date,
      }));

      const { error: wErr } = await supabase
        .from('workouts')
        .upsert(workoutRecords, { onConflict: 'user_id,date', ignoreDuplicates: false });
      if (wErr) throw new Error('Workouts upsert failed: ' + wErr.message);

      const { data: insertedWorkouts, error: fetchErr } = await supabase
        .from('workouts')
        .select('id, date')
        .eq('user_id', user.id)
        .in('date', uniqueDates);
      if (fetchErr) throw new Error('Fetch workouts failed: ' + fetchErr.message);

      const workoutIdMap = {};
      (insertedWorkouts || []).forEach((w) => { workoutIdMap[w.date] = w.id; });

      const BATCH_SIZE = 100;
      let inserted = 0;
      setProgress({ done: 0, total: parsedRows.length });

      const allSets = parsedRows.map((row, idx) => ({
        workout_id: workoutIdMap[row.date],
        exercise_name: row.exercise,
        weight_kg: row.weight_kg,
        reps: row.reps,
        distance: row.distance,
        distance_unit: row.distance_unit,
        duration_seconds: row.duration_seconds,
        set_order: idx,
      })).filter((s) => s.workout_id);

      for (let i = 0; i < allSets.length; i += BATCH_SIZE) {
        const batch = allSets.slice(i, i + BATCH_SIZE);
        const { error: sErr } = await supabase.from('workout_sets').insert(batch);
        if (sErr) throw new Error(`Sets insert batch failed: ${sErr.message}`);
        inserted += batch.length;
        setProgress({ done: inserted, total: allSets.length });
      }

      setStatus({
        type: 'success',
        message: `Successfully imported ${allSets.length} sets across ${uniqueDates.length} workouts and ${uniqueExercises.length} exercises.`,
      });
      setParsedRows([]);
      setFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
      setProgress({ done: 0, total: 0 });
    }
  }

  const preview = parsedRows.slice(0, 10);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Import FitNotes CSV</h1>
      <p className="text-zinc-400 text-sm mb-6">
        Export your data from the FitNotes app and upload the CSV file here
      </p>

      {error && (
        <div className="flex items-start gap-3 bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {status?.type === 'success' && (
        <div className="flex items-start gap-3 bg-green-950 border border-green-800 text-green-300 px-4 py-3 rounded-lg mb-4 text-sm">
          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{status.message}</span>
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
        <label className="block text-sm font-medium text-zinc-300 mb-3">Upload CSV File</label>
        <div
          className="border-2 border-dashed border-zinc-700 hover:border-violet-500 rounded-xl p-8 text-center transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">
            {fileName ? (
              <span className="flex items-center justify-center gap-2 text-violet-300">
                <FileText className="w-4 h-4" />
                {fileName}
              </span>
            ) : (
              'Click to select a FitNotes CSV file'
            )}
          </p>
          <p className="text-zinc-600 text-xs mt-1">
            Columns: Date, Exercise, Category, Weight (kg), Reps, Distance, Distance Unit, Time
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {parsedRows.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-zinc-100 font-semibold">
              Preview{' '}
              <span className="text-zinc-500 font-normal text-sm">
                (first {Math.min(10, parsedRows.length)} of {parsedRows.length} rows)
              </span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {['Date', 'Exercise', 'Category', 'Weight (kg)', 'Reps', 'Distance', 'Unit', 'Duration (s)'].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-zinc-300 whitespace-nowrap">{row.date}</td>
                    <td className="px-4 py-2.5 text-zinc-200 font-medium whitespace-nowrap">
                      {row.exercise}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-400">{row.category || '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-300">{row.weight_kg || 0}</td>
                    <td className="px-4 py-2.5 text-zinc-300">{row.reps || 0}</td>
                    <td className="px-4 py-2.5 text-zinc-300">{row.distance || 0}</td>
                    <td className="px-4 py-2.5 text-zinc-300">{row.distance_unit || '—'}</td>
                    <td className="px-4 py-2.5 text-zinc-300">{row.duration_seconds || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {importing && progress.total > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-zinc-300 text-sm font-medium">Importing…</span>
            <span className="text-zinc-400 text-xs">
              {progress.done} / {progress.total}
            </span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2">
            <div
              className="bg-violet-600 h-2 rounded-full transition-all duration-200"
              style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {parsedRows.length > 0 && (
        <button
          onClick={handleImport}
          disabled={importing}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" />
          {importing
            ? `Importing… (${progress.done}/${progress.total})`
            : `Import ${parsedRows.length} rows`}
        </button>
      )}
    </div>
  );
}
