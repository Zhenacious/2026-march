import React, { useMemo, useRef } from 'react';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');

/** Anything not starting A–Z (numbers, Chinese characters) groups under #. */
export function letterFor(name) {
  const c = (name || '').trim()[0];
  if (!c) return '#';
  const u = c.toUpperCase();
  return u >= 'A' && u <= 'Z' ? u : '#';
}

/**
 * A long list grouped by first letter with a jump index down the right edge.
 * Letters with nothing under them are greyed rather than removed, so every
 * letter keeps the same position and becomes easy to hit from memory.
 *
 * Shown only past `minItems` — below that, scrolling is quicker than aiming.
 */
export default function AlphaList({ items, getName, renderRow, minItems = 12, className = '' }) {
  const scrollRef = useRef(null);

  const grouped = useMemo(() => {
    const map = {};
    for (const item of items) {
      const l = letterFor(getName(item));
      (map[l] = map[l] || []).push(item);
    }
    return map;
  }, [items, getName]);

  function jumpTo(letter) {
    scrollRef.current
      ?.querySelector(`[data-letter="${letter}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const showIndex = items.length > minItems;

  return (
    <div className={`flex min-h-0 ${className}`}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {LETTERS.filter((l) => grouped[l]?.length).map((l) => (
          <div key={l} data-letter={l}>
            <div className="px-4 py-1.5 bg-zinc-950/70 border-y border-zinc-800/60 sticky top-0 z-10">
              <span className="text-zinc-400 text-xs font-semibold">{l}</span>
            </div>
            {grouped[l].map((item, i) => renderRow(item, i))}
          </div>
        ))}
      </div>

      {showIndex && (
        <div className="flex flex-col justify-center px-1 py-2 border-l border-zinc-800/60 shrink-0 select-none">
          {LETTERS.map((l) => {
            const has = !!grouped[l]?.length;
            return (
              <button
                key={l}
                onClick={() => has && jumpTo(l)}
                disabled={!has}
                aria-label={has ? `Jump to ${l}` : undefined}
                className={`text-[9px] leading-tight px-1 py-px rounded transition-colors ${
                  has ? 'text-teal-400 hover:bg-zinc-800' : 'text-zinc-700'
                }`}
              >
                {l}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
