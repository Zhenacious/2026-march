import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Activity, Dumbbell, CalendarDays, TrendingUp, Plus, Upload, Flame, Trophy } from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalSets: 0,
    mostFrequent: '—',
    lastWorkout: '—',
    streak: 0,
    sevenDays: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const { data: workouts, error: wErr } = await supabase
          .from('workouts')
          .select('id, date')
          .eq('user_id', user.id)
          .order('date', { ascending: false });
        if (wErr) throw wErr;

        const totalWorkouts = workouts?.length || 0;
        const lastWorkout =
          workouts && workouts.length > 0
            ? format(parseISO(workouts[0].date), 'MMM d, yyyy')
            : '—';
        const workoutIds = (workouts || []).map((w) => w.id);

        let totalSets = 0;
        let mostFrequent = '—';
        if (workoutIds.length > 0) {
          const { data: sets, error: sErr } = await supabase
            .from('workout_sets')
            .select('id, exercise_name')
            .in('workout_id', workoutIds);
          if (sErr) throw sErr;
          totalSets = sets?.length || 0;
          if (sets && sets.length > 0) {
            const freq = {};
            sets.forEach((s) => { freq[s.exercise_name] = (freq[s.exercise_name] || 0) + 1; });
            mostFrequent = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
          }
        }
        // Streak — consecutive days with workouts ending today or yesterday
        const dateSet = new Set((workouts || []).map((w) => w.date));
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        let streakStart = new Date();
        if (!dateSet.has(todayStr)) streakStart = subDays(streakStart, 1);
        let streak = 0;
        let cur = streakStart;
        while (dateSet.has(format(cur, 'yyyy-MM-dd'))) {
          streak++;
          cur = subDays(cur, 1);
        }

        // Last 7 days activity
        const sevenDays = Array.from({ length: 7 }, (_, i) => {
          const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
          return { date: d, active: dateSet.has(d), label: format(subDays(new Date(), 6 - i), 'EEE') };
        });

        setStats({ totalWorkouts, totalSets, mostFrequent, lastWorkout, streak, sevenDays });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (user) fetchStats();
  }, [user]);

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-0.5">Dashboard</h1>
      <p className="text-zinc-500 text-sm mb-8">Welcome back</p>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Big action shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => navigate(`/today?date=${today}`)}
          className="group relative bg-violet-600 hover:bg-violet-500 rounded-2xl p-8 text-left transition-colors overflow-hidden"
        >
          <div className="absolute right-6 top-6 opacity-20 group-hover:opacity-30 transition-opacity">
            <Plus className="w-24 h-24" />
          </div>
          <div className="relative">
            <div className="bg-white/20 rounded-xl p-3 w-fit mb-4">
              <Plus className="w-7 h-7 text-white" />
            </div>
            <p className="text-white/70 text-sm font-medium mb-1">Ready to train?</p>
            <p className="text-white text-2xl font-bold">Log Today's Workout</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/calendar')}
          className="group relative bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-8 text-left transition-colors overflow-hidden"
        >
          <div className="absolute right-6 top-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <CalendarDays className="w-24 h-24 text-zinc-100" />
          </div>
          <div className="relative">
            <div className="bg-zinc-700 rounded-xl p-3 w-fit mb-4">
              <CalendarDays className="w-7 h-7 text-zinc-200" />
            </div>
            <p className="text-zinc-500 text-sm font-medium mb-1">See your history</p>
            <p className="text-zinc-100 text-2xl font-bold">View Calendar</p>
          </div>
        </button>
      </div>

      {/* Streak + 7-day activity */}
      {!loading && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* Streak */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center gap-4">
            <div className="bg-orange-500/15 rounded-xl p-3 flex-shrink-0">
              <Flame className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-0.5">Streak</p>
              <p className="text-zinc-100 text-2xl font-bold leading-none">
                {stats.streak}<span className="text-zinc-500 text-sm font-normal ml-1">days</span>
              </p>
            </div>
          </div>

          {/* 7-day activity */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <p className="text-zinc-500 text-xs mb-3">Last 7 days</p>
            <div className="flex items-end justify-between gap-1">
              {stats.sevenDays.map(({ date, active, label }) => (
                <div key={date} className="flex flex-col items-center gap-1.5 flex-1">
                  <div className={`w-full rounded-md ${active ? 'bg-violet-500 h-5' : 'bg-zinc-800 h-3'} transition-all`} />
                  <span className="text-zinc-600 text-[10px]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Secondary shortcuts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <button
          onClick={() => navigate('/progress')}
          className="flex flex-col items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl px-4 py-4 transition-colors group"
        >
          <TrendingUp className="w-6 h-6 text-violet-400" />
          <span className="text-zinc-400 text-xs group-hover:text-zinc-200 transition-colors text-center">Progress</span>
        </button>
        <button
          onClick={() => navigate('/records')}
          className="flex flex-col items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl px-4 py-4 transition-colors group"
        >
          <Trophy className="w-6 h-6 text-amber-400" />
          <span className="text-zinc-400 text-xs group-hover:text-zinc-200 transition-colors text-center">Records</span>
        </button>
        <button
          onClick={() => navigate('/exercises')}
          className="flex flex-col items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl px-4 py-4 transition-colors group"
        >
          <Dumbbell className="w-6 h-6 text-emerald-400" />
          <span className="text-zinc-400 text-xs group-hover:text-zinc-200 transition-colors text-center">Exercises</span>
        </button>
        <button
          onClick={() => navigate('/import')}
          className="flex flex-col items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl px-4 py-4 transition-colors group"
        >
          <Upload className="w-6 h-6 text-blue-400" />
          <span className="text-zinc-400 text-xs group-hover:text-zinc-200 transition-colors text-center">Import</span>
        </button>
      </div>

      {/* Stats — compact */}
      {!loading && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Your Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Workouts', value: stats.totalWorkouts, color: 'text-violet-400' },
              { label: 'Total Sets', value: stats.totalSets, color: 'text-blue-400' },
              { label: 'Most Frequent', value: stats.mostFrequent, color: 'text-emerald-400' },
              { label: 'Last Workout', value: stats.lastWorkout, color: 'text-amber-400' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-zinc-500 text-xs mb-1">{s.label}</p>
                <p className={`font-semibold text-sm ${s.color} truncate`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
