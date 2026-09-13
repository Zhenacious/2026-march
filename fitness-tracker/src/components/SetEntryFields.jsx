import React from 'react';
import { DISTANCE_UNITS, hmsToSeconds, secondsToHMS } from '../lib/trackTypes';

// The input fields for logging or editing one set, shared by the Today entry
// pad and the inline edit form. `values` is the shape from
// trackTypes.emptyValues(); only the fields for the track type are shown.
//
// Numbers in the fields are always real values (never faded placeholders):
// tapping a field selects its contents so typing replaces the old number,
// and +/- steps from what is shown.

// Select the whole value when a field gains focus. Deferred a frame so the
// tap that focused the field doesn't immediately collapse the selection.
function selectOnFocus(e) {
  const el = e.target;
  requestAnimationFrame(() => { try { el.select(); } catch { /* ignore */ } });
}

function adjustWeight(current, delta) {
  const n = parseFloat(current);
  const base = Number.isFinite(n) ? n : 0;
  return String(Math.max(0, Math.round((base + delta) * 100) / 100));
}

function adjustReps(current, delta) {
  const n = parseInt(current, 10);
  const base = Number.isFinite(n) ? n : 0;
  return String(Math.max(0, base + delta));
}

const BTN = 'w-10 h-10 flex-shrink-0 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white hover:border-zinc-600 text-lg font-bold';
const INPUT = 'flex-1 min-w-[3rem] w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 rounded-xl px-1 py-2.5 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 text-center';

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-zinc-500 text-center mb-1">{label}</p>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

// Minutes and Seconds for time-based exercises. +/- on seconds carries into
// minutes (55 s + 5 = 1:00) and typed values are tidied on blur (90 s = 1:30).
// Hours are folded into minutes; formatDuration still shows h:mm:ss on display.
function TimeSteppers({ values, onChange }) {
  const total = () => hmsToSeconds(values.h, values.m, values.s);

  const setFromSeconds = (secs) => {
    const { h, m, s } = secondsToHMS(Math.max(0, secs));
    const minutes = h * 60 + m;
    onChange({ ...values, h: '', m: minutes ? String(minutes) : '', s: s ? String(s) : '' });
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Minutes">
        <button type="button" className={BTN} onClick={() => setFromSeconds(total() - 60)}>−</button>
        <input type="text" inputMode="numeric" value={values.m} onFocus={selectOnFocus}
          onChange={(e) => onChange({ ...values, m: e.target.value.replace(/[^\d]/g, '') })}
          onBlur={() => setFromSeconds(total())}
          placeholder="0" className={INPUT} />
        <button type="button" className={BTN} onClick={() => setFromSeconds(total() + 60)}>+</button>
      </Field>
      <Field label="Seconds">
        <button type="button" className={BTN} onClick={() => setFromSeconds(total() - 5)}>−</button>
        <input type="text" inputMode="numeric" value={values.s} onFocus={selectOnFocus}
          onChange={(e) => onChange({ ...values, s: e.target.value.replace(/[^\d]/g, '') })}
          onBlur={() => setFromSeconds(total())}
          placeholder="0" className={INPUT} />
        <button type="button" className={BTN} onClick={() => setFromSeconds(total() + 5)}>+</button>
      </Field>
    </div>
  );
}

// Distance value + unit, for distance_time exercises.
function DistanceField({ values, onChange }) {
  return (
    <Field label="Distance">
      <input type="text" inputMode="decimal" value={values.distance} onFocus={selectOnFocus}
        onChange={(e) => onChange({ ...values, distance: e.target.value.replace(/[^\d.]/g, '') })}
        placeholder="0" className={INPUT} />
      <select value={values.distanceUnit}
        onChange={(e) => onChange({ ...values, distanceUnit: e.target.value })}
        className="w-16 flex-shrink-0 bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-xl px-2 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
        {DISTANCE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
    </Field>
  );
}

// Weight + reps.
function StepperPair({ values, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Weight (kg)">
        <button type="button" className={BTN}
          onClick={() => onChange({ ...values, weightKg: adjustWeight(values.weightKg, -2.5) })}>−</button>
        <input type="text" inputMode="decimal" value={values.weightKg} onFocus={selectOnFocus}
          onChange={(e) => onChange({ ...values, weightKg: e.target.value.replace(/[^\d.]/g, '') })}
          placeholder="0" className={INPUT} />
        <button type="button" className={BTN}
          onClick={() => onChange({ ...values, weightKg: adjustWeight(values.weightKg, 2.5) })}>+</button>
      </Field>
      <Field label="Reps">
        <button type="button" className={BTN}
          onClick={() => onChange({ ...values, reps: adjustReps(values.reps, -1) })}>−</button>
        <input type="text" inputMode="numeric" value={values.reps} onFocus={selectOnFocus}
          onChange={(e) => onChange({ ...values, reps: e.target.value.replace(/[^\d]/g, '') })}
          placeholder="0" className={INPUT} />
        <button type="button" className={BTN}
          onClick={() => onChange({ ...values, reps: adjustReps(values.reps, 1) })}>+</button>
      </Field>
    </div>
  );
}

export default function SetEntryFields({ trackType, values, onChange }) {
  if (trackType === 'time') return <TimeSteppers values={values} onChange={onChange} />;
  if (trackType === 'distance_time') {
    return (
      <div className="space-y-2.5">
        <DistanceField values={values} onChange={onChange} />
        <TimeSteppers values={values} onChange={onChange} />
      </div>
    );
  }
  return <StepperPair values={values} onChange={onChange} />;
}
