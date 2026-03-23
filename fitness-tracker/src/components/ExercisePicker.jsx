import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';

const CATEGORY_COLORS = {
  chest:     { dot: 'bg-rose-500',   badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  back:      { dot: 'bg-blue-500',   badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  abs:       { dot: 'bg-amber-400',  badge: 'bg-amber-400/20 text-amber-300 border-amber-400/40' },
  legs:      { dot: 'bg-green-500',  badge: 'bg-green-500/20 text-green-300 border-green-500/40' },
  triceps:   { dot: 'bg-orange-500', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  biceps:    { dot: 'bg-violet-500', badge: 'bg-violet-500/20 text-violet-300 border-violet-500/40' },
  shoulders: { dot: 'bg-sky-500',    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  mobility:  { dot: 'bg-teal-500',   badge: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
};

const MUSCLE_GROUPS = [
  { label: 'All',       categories: null },
  { label: 'Chest',     categories: ['chest'] },
  { label: 'Back',      categories: ['back'] },
  { label: 'Arms',      categories: ['biceps', 'triceps'] },
  { label: 'Legs',      categories: ['legs'] },
  { label: 'Shoulders', categories: ['shoulders'] },
  { label: 'Abs',       categories: ['abs'] },
  { label: 'Mobility',  categories: ['mobility'] },
  { label: 'Other',     categories: [''] },
];

export default function ExercisePicker({ exercises, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState('All');

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const group = MUSCLE_GROUPS.find((g) => g.label === activeGroup);

  const filtered = exercises.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    const cat = (ex.category || '').toLowerCase();
    const matchesGroup =
      group.categories === null ||
      (activeGroup === 'Other' ? !Object.keys(CATEGORY_COLORS).includes(cat) : group.categories.includes(cat));
    return matchesSearch && matchesGroup;
  });

  // Group filtered exercises by category for display
  const grouped = filtered.reduce((acc, ex) => {
    const cat = ex.category || '';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ex);
    return acc;
  }, {});

  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-800">
          <h2 className="text-zinc-100 font-semibold">Select Exercise</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises…"
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Muscle group tabs */}
        <div className="px-5 pb-3 flex gap-1.5 flex-wrap">
          {MUSCLE_GROUPS.map((g) => (
            <button
              key={g.label}
              onClick={() => setActiveGroup(g.label)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                activeGroup === g.label
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600 hover:text-zinc-200'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Exercise list */}
        <div className="overflow-y-auto flex-1 px-2 pb-3">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-zinc-500 text-sm">
              No exercises found
            </div>
          ) : (
            sortedCategories.map((cat) => {
              const color = CATEGORY_COLORS[cat.toLowerCase()];
              return (
                <div key={cat} className="mb-3">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-3 py-1.5">
                    {cat || 'Uncategorized'}
                  </p>
                  {grouped[cat].map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => { onSelect(ex.name); onClose(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors text-left"
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color ? color.dot : 'bg-zinc-600'}`} />
                      <span className="text-zinc-200 text-sm flex-1">{ex.name}</span>
                      {cat && (
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${color ? color.badge : 'bg-zinc-700 text-zinc-400 border-zinc-600'}`}>
                          {cat}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
