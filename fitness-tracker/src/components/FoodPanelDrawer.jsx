import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import FoodPanel from './FoodPanel';

/** True on wide screens, kept in state so it follows a window resize. */
export function useIsWide(query = '(min-width: 768px)') {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setWide(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return wide;
}

/**
 * Slide-over drawer for wide screens. The daily log stays visible and dimmed
 * behind it. Narrow screens use the /food/add route instead — a drawer is
 * cramped one-handed.
 */
export default function FoodPanelDrawer({ open, title, initial, onSave, onCancel, onDelete, saveLabel }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end bg-black/55"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog" aria-modal="true" aria-label={title}
          onClick={onCancel}
        >
          <motion.div
            className="bg-zinc-900 border-l border-zinc-800 w-full max-w-md h-full overflow-y-auto shadow-2xl"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
              <h2 className="text-zinc-100 font-semibold">{title}</h2>
              <button onClick={onCancel} aria-label="Close"
                className="text-zinc-500 hover:text-zinc-200 p-2 rounded-xl hover:bg-zinc-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <FoodPanel
                initial={initial}
                onSave={onSave}
                onCancel={onCancel}
                onDelete={onDelete}
                saveLabel={saveLabel}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
