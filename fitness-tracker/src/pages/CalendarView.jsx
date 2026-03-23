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
  isToday,
  addMonths,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workoutDates, setWorkoutDates] = useState({});
  const [error, setError] = useState('');

  const fetchMonthWorkouts = useCallback(async () => {
    if (!user) return;
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

    try {
      const { data, error: err } = await supabase
        .from('workouts')
        .select('id, date')
        .eq('user_id', user.id)
        .gte('date', start)
        .lte('date', end);

      if (err) throw err;

      const dateMap = {};
      (data || []).forEach((w) => {
        dateMap[w.date] = w.id;
      });
      setWorkoutDates(dateMap);
    } catch (err) {
      setError(err.message);
    }
  }, [user, currentDate]);

  useEffect(() => {
    fetchMonthWorkouts();
  }, [fetchMonthWorkouts]);

  function handleDayClick(day) {
    navigate(`/workouts?date=${format(day, 'yyyy-MM-dd')}`);
  }

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Calendar</h1>
      <p className="text-zinc-400 text-sm mb-6">Your workout history at a glance</p>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 max-w-lg">
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
              <div
                key={d}
                className="text-center text-xs font-medium text-zinc-500 py-1"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calDays.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const hasWorkout = !!workoutDates[dateStr];
              const inMonth = isSameMonth(day, currentDate);
              const today = isToday(day);

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(day)}
                  className={`
                    aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-colors relative
                    ${!inMonth ? 'opacity-25' : ''}
                    ${hasWorkout ? 'bg-violet-950 hover:bg-violet-900 text-violet-200 cursor-pointer' : 'hover:bg-zinc-800 text-zinc-300 cursor-pointer'}
                    ${today ? 'ring-1 ring-violet-500' : ''}
                  `}
                >
                  <span className="text-xs font-medium">{format(day, 'd')}</span>
                  {hasWorkout && (
                    <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-violet-400" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-violet-950 border border-violet-800" />
              Workout logged
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded ring-1 ring-violet-500 bg-zinc-900" />
              Today
            </div>
          </div>
      </div>
    </div>
  );
}
