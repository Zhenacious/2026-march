import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, X, ArrowRight } from 'lucide-react';

const CATEGORY_COLORS = {
  chest:     'bg-rose-500',
  back:      'bg-blue-500',
  abs:       'bg-amber-400',
  legs:      'bg-green-500',
  triceps:   'bg-orange-500',
  biceps:    'bg-violet-500',
  shoulders: 'bg-sky-500',
  mobility:  'bg-teal-500',
};

const LEGEND_ITEMS = [
  { label: 'Chest',     color: 'bg-rose-500' },
  { label: 'Back',      color: 'bg-blue-500' },
  { label: 'Legs',      color: 'bg-green-500' },
  { label: 'Shoulders', color: 'bg-sky-500' },
  { label: 'Arms',      color: 'bg-orange-500' },
  { label: 'Abs',       color: 'bg-amber-400' },
  { label: 'Mobility',  color: 'bg-teal-500' },
];

export default function CalendarView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workoutDates, setWorkoutDates] = useState({});
  const [calDots, setCalDots] = useState({});   // { [dateStr]: string[] } — deduplicated dot classes
  const [selectedDay, setSelectedDay] = useState(null);
  const [daySets, setDaySets] = useState([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const [error, setError] = useState('');

  const fetchMonthWorkouts = useCallback(async () => {
    if (!user) return;
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

    try {
      const { data: workouts, error: err } = await supabase
        .from('workouts')
        .select('id, date')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end);

      if (err) throw err;

      const dateMap = {};
      (workouts || []).forEach((w) => { dateMap[w.date] = w.id; });
      setWorkoutDates(dateMap);

      if (!workouts || workouts.length === 0) { setCalDots({}); return; }

      // Fetch sets for these workouts to get exercise names
      const ids = workouts.map((w) => w.id);
      const idToDate = {};
      workouts.forEach((w) => { idToDate[w.id] = w.date; });

      const { data: sets } = await supabase
        .from('workout_sets')
        .select('workout_id, exercise_name')
        .in('workout_id', ids);

      if (!sets || sets.length === 0) { setCalDots({}); return; }

      // Fetch categories for all exercise names that appear this month
      const exerciseNames = [...new Set(sets.map((s) => s.exercise_name))];
      const { data: exData } = await supabase
        .from('exercises')
        .select('name, category')
        .eq('user_id', user.id)
        .in('name', exerciseNames);

      const categoryMap = {};
      (exData || []).forEach((ex) => { categoryMap[ex.name] = (ex.category || '').toLowerCase(); });

      // Build dots map: { [dateStr]: [dotClass, ...] } — at most one dot per category
      const dots = {};
      sets.forEach((s) => {
        const date = idToDate[s.workout_id];
        if (!date) return;
        const cat = categoryMap[s.exercise_name];
        const dotClass = cat && CATEGORY_COLORS[cat];
        if (!dotClass) return;
        if (!dots[date]) dots[date] = new Set();
        dots[date].add(dotClass);
      });

      // Convert Sets to arrays
      const dotsArr = {};
      Object.entries(dots).forEach(([d, s]) => { dotsArr[d] = [...s]; });
      setCalDots(dotsArr);
    } catch (err) {
      setError(err.message);
    }
  }, [user, currentDate]);

  useEffect(() => {
    fetchMonthWorkouts();
  }, [fetchMonthWorkouts]);

  async function handleDayClick(day) {
    const dateStr = format(day, 'yyyy-MM-dd');
    setSelectedDay(day);
    setDaySets([]);

    const workoutId = workoutDates[dateStr];
    if (!workoutId) return;

    setLoadingDay(true);
    try {
      const { data, error: err } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('workout_id', workoutId)
        .order('set_order');

      if (err) throw err;
      setDaySets(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDay(false);
    }
  }

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const groupedSets = daySets.reduce((acc, s) => {
    if (!acc[s.exercise_name]) acc[s.exercise_name] = [];
    acc[s.exercise_name].push(s);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Calendar</h1>
      <p className="text-zinc-400 text-sm mb-6">Your workout history at a glance</p>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-6">
        <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-zinc-100 font-semibold text-lg">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-xs font-medium text-zinc-500 py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const hasWorkout = !!workoutDates[dateStr];
              const dots = calDots[dateStr] || [];
              const inMonth = isSameMonth(day, currentDate);
              const selected = selectedDay && isSameDay(day, selectedDay);
              const today = isToday(day);

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(day)}
                  className={`
                    aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-colors relative pb-3
                    ${!inMonth ? 'opacity-25' : ''}
                    ${selected ? 'bg-violet-600 text-white' : hasWorkout ? 'bg-violet-950 hover:bg-violet-900 text-violet-200' : 'hover:bg-zinc-800 text-zinc-300'}
                    ${today && !selected ? 'ring-1 ring-violet-500' : ''}
                  `}
                >
                  <span className="text-xs font-medium">{format(day, 'd')}</span>
                  {hasWorkout && !selected && (
                    <div className="absolute bottom-1 flex gap-0.5 items-center">
                      {dots.length > 0
                        ? dots.slice(0, 4).map((cls, i) => (
                            <span key={i} className={`w-1 h-1 rounded-full ${cls}`} />
                          ))
                        : <span className="w-1 h-1 rounded-full bg-violet-400" />
                      }
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded ring-1 ring-violet-500 bg-zinc-900" />
              Today
            </div>
            {LEGEND_ITEMS.map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {selectedDay && (
          <div className="w-72 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-zinc-100 font-semibold">
                {format(selectedDay, 'MMMM d, yyyy')}
              </h3>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingDay ? (
              <div className="text-zinc-400 text-sm">Loading…</div>
            ) : !workoutDates[format(selectedDay, 'yyyy-MM-dd')] ? (
              <div className="text-zinc-500 text-sm">No workout on this day.</div>
            ) : daySets.length === 0 ? (
              <div className="text-zinc-500 text-sm">Workout logged but no sets found.</div>
            ) : (
              <div className="space-y-4 overflow-y-auto flex-1">
                {Object.entries(groupedSets).map(([exercise, sets]) => (
                  <div key={exercise}>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                      {exercise}
                    </p>
                    <div className="space-y-1">
                      {sets.map((s, i) => (
                        <div key={s.id} className="text-xs text-zinc-300 bg-zinc-800 rounded-lg px-3 py-2">
                          Set {i + 1}
                          {s.weight_kg > 0 && ` · ${s.weight_kg} kg`}
                          {s.reps > 0 && ` × ${s.reps} reps`}
                          {s.distance > 0 && ` · ${s.distance} ${s.distance_unit || 'km'}`}
                          {s.duration_seconds > 0 &&
                            ` · ${Math.floor(s.duration_seconds / 60)}:${String(s.duration_seconds % 60).padStart(2, '0')}`}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => navigate(`/today?date=${format(selectedDay, 'yyyy-MM-dd')}`)}
              className="mt-4 flex items-center justify-center gap-2 w-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Go to Workout
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
