import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, Search, Library, History, ChefHat, PlusCircle, Utensils } from 'lucide-react';
import FoodPanel from './FoodPanel';
import { toPanelFood } from '../lib/foodEntries';

const TABS = [
  { key: 'search', label: 'Search', icon: Search },
  { key: 'mine', label: 'My Foods', icon: Library },
  { key: 'previous', label: 'Previous', icon: History },
  { key: 'recipes', label: 'Recipes', icon: ChefHat, disabled: true },
  { key: 'create', label: 'Create', icon: PlusCircle },
];

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');

/** Remembered for the session so reopening lands where you left off. */
let lastTab = 'search';

function letterFor(name) {
  const c = (name || '').trim()[0];
  if (!c) return '#';
  const u = c.toUpperCase();
  return u >= 'A' && u <= 'Z' ? u : '#';
}

/** One dense result row: name bold on the left, brand muted on the right. */
function FoodRow({ food, onPick, right }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-800/50 transition-colors">
      <button onClick={onPick} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <span className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
          <Utensils className="w-4 h-4 text-zinc-500" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-zinc-100 text-sm font-medium truncate">{food.name}</span>
          <span className="block text-zinc-500 text-xs truncate">
            {Math.round(food.calories || 0)} kcal · {food.serving_size || 'serving'}
          </span>
        </span>
        {food.brand && (
          <span className="text-zinc-500 text-xs truncate max-w-24 text-right shrink-0">
            {String(food.brand).split(',')[0].trim()}
          </span>
        )}
      </button>
      {right}
    </div>
  );
}

/**
 * The single place food gets added: tabbed sources on the left of the flow,
 * and picking any row swaps this same surface to the amount/meal detail step
 * rather than stacking another layer on top.
 */
export default function AddFoodModal({
  open, onClose, onSave, onDelete,
  searchState, myFoods, previousFoods, createForm, initialDetail = null,
}) {
  const [tab, setTab] = useState(lastTab);
  const [detail, setDetail] = useState(null); // { food, entryId } once a row is picked
  const listRef = useRef(null);

  useEffect(() => { lastTab = tab; }, [tab]);

  useEffect(() => {
    if (!open) return;
    // Editing an existing entry opens straight on the detail step
    setDetail(initialDetail);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Which list the current tab shows, and whether the A–Z index applies
  const { rows, browsable } = useMemo(() => {
    if (tab === 'mine') return { rows: myFoods, browsable: true };
    if (tab === 'previous') return { rows: previousFoods, browsable: false };
    if (tab === 'search') {
      // With an empty box, browse your own foods instead of showing nothing
      const searching = searchState.query.trim().length > 0 && searchState.results;
      return {
        rows: searching ? searchState.results : myFoods,
        browsable: !searching,
      };
    }
    return { rows: [], browsable: false };
  }, [tab, myFoods, previousFoods, searchState]);

  const grouped = useMemo(() => {
    if (!browsable) return null;
    const map = {};
    for (const f of rows) {
      const l = letterFor(f.name);
      (map[l] = map[l] || []).push(f);
    }
    return map;
  }, [rows, browsable]);

  function jumpTo(letter) {
    const el = listRef.current?.querySelector(`[data-letter="${letter}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const title = detail ? (detail.entryId ? 'Edit entry' : 'Add food') : 'Add Food';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex sm:items-center sm:justify-center bg-black/60 sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          role="dialog" aria-modal="true" aria-label="Add food"
          onClick={onClose}
        >
          <motion.div
            className="bg-zinc-900 w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-zinc-800 flex flex-col overflow-hidden shadow-2xl"
            initial={{ y: 24, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top,0px))] sm:pt-4 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2 min-w-0">
                {detail && (
                  <button onClick={() => setDetail(null)} aria-label="Back to list"
                    className="text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <h2 className="text-zinc-100 font-semibold truncate">{title}</h2>
              </div>
              <button onClick={onClose} aria-label="Close"
                className="text-zinc-500 hover:text-zinc-200 p-2 rounded-xl hover:bg-zinc-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {detail ? (
              <div className="flex-1 overflow-y-auto p-5">
                <FoodPanel
                  initial={detail.food}
                  saveLabel={detail.entryId ? 'Save changes' : 'Add to log'}
                  onSave={(values) => onSave(values, detail.entryId)}
                  onCancel={() => setDetail(null)}
                  onDelete={detail.entryId ? () => onDelete(detail.entryId) : null}
                />
              </div>
            ) : (
              <>
                {/* Source tabs — icon over label */}
                <div className="flex gap-1 px-2 py-2 border-b border-zinc-800 overflow-x-auto">
                  {TABS.map(({ key, label, icon: Icon, disabled }) => (
                    <button key={key} onClick={() => !disabled && setTab(key)} disabled={disabled}
                      title={disabled ? 'Coming soon' : ''}
                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-medium min-w-16 transition-colors disabled:opacity-35 ${
                        tab === key ? 'bg-teal-600/20 text-teal-300' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60'
                      }`}>
                      <Icon className="w-5 h-5" />
                      {label}
                    </button>
                  ))}
                </div>

                {tab === 'create' ? (
                  <div className="flex-1 overflow-y-auto p-5">{createForm}</div>
                ) : tab === 'recipes' ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 text-zinc-500 p-8">
                    <ChefHat className="w-8 h-8 opacity-40" />
                    <p className="text-sm">Recipes are coming later.</p>
                  </div>
                ) : (
                  <>
                    {tab === 'search' && (
                      <div className="px-4 py-3 border-b border-zinc-800">
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            value={searchState.query}
                            onChange={(e) => searchState.setQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') searchState.run(searchState.query); }}
                            placeholder="Search a food or barcode"
                            className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                          <button onClick={() => searchState.run(searchState.query)} disabled={searchState.loading}
                            className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                            {searchState.loading ? '…' : 'Search'}
                          </button>
                        </div>
                        {searchState.error && (
                          <p className="text-red-400 text-xs mt-2">{searchState.error}</p>
                        )}
                      </div>
                    )}

                    <div className="flex-1 flex min-h-0">
                      <div ref={listRef} className="flex-1 overflow-y-auto">
                        {rows.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-500 p-8 text-center">
                            <Utensils className="w-8 h-8 opacity-40" />
                            <p className="text-sm">
                              {tab === 'previous'
                                ? 'Nothing logged yet — foods you log will show up here.'
                                : tab === 'mine'
                                  ? 'No saved foods yet. Load the starter foods from My Foods, or use Create.'
                                  : 'Type a food name or barcode above.'}
                            </p>
                          </div>
                        ) : browsable && grouped ? (
                          LETTERS.filter((l) => grouped[l]?.length).map((l) => (
                            <div key={l} data-letter={l}>
                              <div className="px-4 py-1.5 bg-zinc-950/60 border-y border-zinc-800/60 sticky top-0">
                                <span className="text-zinc-400 text-xs font-semibold">{l}</span>
                              </div>
                              {grouped[l].map((f) => (
                                <FoodRow key={f.id || f.name} food={f}
                                  onPick={() => setDetail({ food: toPanelFood(f) })} />
                              ))}
                            </div>
                          ))
                        ) : (
                          rows.map((f, i) => (
                            <FoodRow
                              key={f.id || `${f.source}-${f.barcode || i}`}
                              food={f}
                              onPick={() => setDetail({ food: toPanelFood(f) })}
                              right={searchState.rowAction ? searchState.rowAction(f, i) : null}
                            />
                          ))
                        )}
                      </div>

                      {/* A–Z index: letters with nothing under them stay greyed so
                          each letter keeps the same position every time */}
                      {browsable && rows.length > 12 && (
                        <div className="flex flex-col justify-center px-1 py-2 border-l border-zinc-800/60 shrink-0">
                          {LETTERS.map((l) => {
                            const has = grouped?.[l]?.length;
                            return (
                              <button key={l} onClick={() => has && jumpTo(l)} disabled={!has}
                                className={`text-[9px] leading-tight px-1 py-px rounded transition-colors ${
                                  has ? 'text-teal-400 hover:bg-zinc-800' : 'text-zinc-700'
                                }`}>
                                {l}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
