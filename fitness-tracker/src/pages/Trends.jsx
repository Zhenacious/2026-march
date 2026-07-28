import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { format, parseISO, subDays, eachDayOfInterval, startOfWeek } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { entryTotals } from '../lib/food';

const RANGES = [[14, '2 weeks'], [30, '1 month'], [90, '3 months']];

// Bar/line hues, checked against the dark chart surface for lightness band,
// chroma, CVD separation and contrast before use.
const C_CALORIES = '#0d9488';
const C_GOAL = '#d97706';
const C_PROTEIN = '#0284c7';
const C_VOLUME = '#0d9488';
const C_SETS = '#8b5cf6';

function ChartTooltip({ active, payload, label, unit }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-zinc-300 font-medium mb-1">{label}</p>
      <p className="text-zinc-100">{Math.round(payload[0].value).toLocaleString()} {unit}</p>
    </div>
  );
}

function ChartCard({ title, subtitle, hasData, children }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <h2 className="text-zinc-100 font-semibold">{title}</h2>
      {subtitle && <p className="text-zinc-500 text-xs mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {hasData ? (
        <ResponsiveContainer width="100%" height={240}>{children}</ResponsiveContainer>
      ) : (
        <div className="h-[240px] flex items-center justify-center text-zinc-600 text-sm">
          Nothing logged in this range yet.
        </div>
      )}
    </div>
  );
}

const axisTick = { fill: '#71717a', fontSize: 11 };
const axisLine = { stroke: '#3f3f46' };

export default function Trends() {
  const { user } = useAuth();
  const [tab, setTab] = useState('food');
  const [days, setDays] = useState(30);
  const [foodRows, setFoodRows] = useState([]);
  const [workoutRows, setWorkoutRows] = useState([]); // { date, volume, sets }
  const [goal, setGoal] = useState(null);
  const [error, setError] = useState('');

  const since = useMemo(() => format(subDays(new Date(), days - 1), 'yyyy-MM-dd'), [days]);

  useEffect(() => {
    if (!user || tab !== 'food') return;
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from('food_entries').select('*')
        .eq('user_id', user.id).gte('date', since);
      const { data: s } = await supabase
        .from('user_settings').select('goal_calories').eq('user_id', user.id).maybeSingle();
      if (cancelled) return;
      if (err) setError(err.message);
      else { setFoodRows(data || []); setError(''); }
      setGoal(s?.goal_calories ?? null);
    })();
    return () => { cancelled = true; };
  }, [user, tab, since]);

  useEffect(() => {
    if (!user || tab !== 'workout') return;
    let cancelled = false;
    (async () => {
      const { data: workouts, error: err } = await supabase
        .from('workouts').select('id, date')
        .eq('user_id', user.id).gte('date', since);
      if (err) { if (!cancelled) setError(err.message); return; }
      const ids = (workouts || []).map((w) => w.id);
      if (ids.length === 0) { if (!cancelled) { setWorkoutRows([]); setError(''); } return; }

      const idToDate = {};
      (workouts || []).forEach((w) => { idToDate[w.id] = w.date; });
      const { data: sets } = await supabase
        .from('workout_sets').select('workout_id, weight_kg, reps')
        .in('workout_id', ids);
      if (cancelled) return;

      const byDate = {};
      (sets || []).forEach((s) => {
        const d = idToDate[s.workout_id];
        if (!d) return;
        if (!byDate[d]) byDate[d] = { volume: 0, sets: 0 };
        byDate[d].volume += (s.weight_kg || 0) * (s.reps || 0);
        byDate[d].sets += 1;
      });
      setWorkoutRows(Object.entries(byDate).map(([date, v]) => ({ date, ...v })));
      setError('');
    })();
    return () => { cancelled = true; };
  }, [user, tab, since]);

  // Every day in the range, so gaps read as gaps rather than being collapsed
  const allDays = useMemo(
    () => eachDayOfInterval({ start: subDays(new Date(), days - 1), end: new Date() })
      .map((d) => format(d, 'yyyy-MM-dd')),
    [days]
  );

  const foodData = useMemo(() => {
    const byDate = {};
    foodRows.forEach((e) => {
      const t = entryTotals(e);
      if (!byDate[e.date]) byDate[e.date] = { calories: 0, protein: 0 };
      byDate[e.date].calories += t.calories;
      byDate[e.date].protein += t.protein;
    });
    return allDays.map((d) => ({
      label: format(parseISO(d), 'MMM d'),
      calories: Math.round(byDate[d]?.calories || 0),
      protein: Math.round(byDate[d]?.protein || 0),
    }));
  }, [foodRows, allDays]);

  const volumeData = useMemo(() => {
    const byDate = {};
    workoutRows.forEach((r) => { byDate[r.date] = r.volume; });
    return allDays.map((d) => ({
      label: format(parseISO(d), 'MMM d'),
      volume: Math.round(byDate[d] || 0),
    }));
  }, [workoutRows, allDays]);

  const setsPerWeek = useMemo(() => {
    const byWeek = {};
    workoutRows.forEach((r) => {
      const wk = format(startOfWeek(parseISO(r.date), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      byWeek[wk] = (byWeek[wk] || 0) + r.sets;
    });
    return Object.entries(byWeek)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([wk, sets]) => ({ label: format(parseISO(wk), 'MMM d'), sets }));
  }, [workoutRows]);

  const hasFood = foodRows.length > 0;
  const hasWorkouts = workoutRows.length > 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <div className="bg-teal-600/20 p-2 rounded-xl">
          <BarChart3 className="w-5 h-5 text-teal-400" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-100">Trends</h1>
      </div>
      <p className="text-zinc-400 text-sm mb-6">How your eating and training look over time.</p>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-xl mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1 mb-4">
        {[['workout', 'Workout'], ['food', 'Food']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === key ? 'bg-teal-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-6">
        {RANGES.map(([value, label]) => (
          <button key={value} onClick={() => setDays(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              days === value ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-800/60 text-zinc-500 hover:text-zinc-300'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'food' ? (
        <div className="flex flex-col gap-4">
          <ChartCard
            title="Calories per day"
            subtitle={goal ? `Dashed line marks your ${goal} kcal goal` : null}
            hasData={hasFood}
          >
            <BarChart data={foodData} margin={{ top: 5, right: 8, left: 0, bottom: 5 }} barCategoryGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={axisLine} tickLine={false} minTickGap={24} />
              <YAxis tick={axisTick} axisLine={axisLine} tickLine={false} width={44} />
              <Tooltip cursor={{ fill: '#ffffff10' }} content={<ChartTooltip unit="kcal" />} />
              {goal && <ReferenceLine y={goal} stroke={C_GOAL} strokeDasharray="4 4" strokeWidth={2} />}
              <Bar dataKey="calories" fill={C_CALORIES} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Protein per day" hasData={hasFood}>
            <BarChart data={foodData} margin={{ top: 5, right: 8, left: 0, bottom: 5 }} barCategoryGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={axisLine} tickLine={false} minTickGap={24} />
              <YAxis tick={axisTick} axisLine={axisLine} tickLine={false} width={44} unit=" g" />
              <Tooltip cursor={{ fill: '#ffffff10' }} content={<ChartTooltip unit="g protein" />} />
              <Bar dataKey="protein" fill={C_PROTEIN} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <ChartCard title="Training volume per day" subtitle="Weight × reps, added up across every set" hasData={hasWorkouts}>
            <BarChart data={volumeData} margin={{ top: 5, right: 8, left: 0, bottom: 5 }} barCategoryGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={axisLine} tickLine={false} minTickGap={24} />
              <YAxis tick={axisTick} axisLine={axisLine} tickLine={false} width={52} />
              <Tooltip cursor={{ fill: '#ffffff10' }} content={<ChartTooltip unit="kg lifted" />} />
              <Bar dataKey="volume" fill={C_VOLUME} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Sets per week" subtitle="Weeks start on Monday" hasData={setsPerWeek.length > 0}>
            <BarChart data={setsPerWeek} margin={{ top: 5, right: 8, left: 0, bottom: 5 }} barCategoryGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" vertical={false} />
              <XAxis dataKey="label" tick={axisTick} axisLine={axisLine} tickLine={false} minTickGap={24} />
              <YAxis tick={axisTick} axisLine={axisLine} tickLine={false} width={44} allowDecimals={false} />
              <Tooltip cursor={{ fill: '#ffffff10' }} content={<ChartTooltip unit="sets" />} />
              <Bar dataKey="sets" fill={C_SETS} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>
        </div>
      )}
    </div>
  );
}
