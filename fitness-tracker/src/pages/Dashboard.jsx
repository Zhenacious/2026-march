import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Dumbbell, CalendarDays, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-start gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-zinc-400 text-sm">{label}</p>
        <p className="text-zinc-100 text-2xl font-semibold mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    totalSets: 0,
    mostFrequent: '—',
    lastWorkout: '—',
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
            sets.forEach((s) => {
              freq[s.exercise_name] = (freq[s.exercise_name] || 0) + 1;
            });
            mostFrequent = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
          }
        }

        setStats({ totalWorkouts, totalSets, mostFrequent, lastWorkout });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (user) fetchStats();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Loading stats…</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Dashboard</h1>
      <p className="text-zinc-400 text-sm mb-8">Welcome back, {user?.email}</p>

      {error && (
        <div className="bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={CalendarDays}
          label="Total Workouts"
          value={stats.totalWorkouts}
          color="bg-violet-600"
        />
        <StatCard
          icon={Activity}
          label="Total Sets Logged"
          value={stats.totalSets}
          color="bg-blue-600"
        />
        <StatCard
          icon={Dumbbell}
          label="Most Frequent Exercise"
          value={stats.mostFrequent}
          color="bg-emerald-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Last Workout"
          value={stats.lastWorkout}
          color="bg-amber-600"
        />
      </div>

      <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Quick Start</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <a
            href="/workouts"
            className="flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl px-4 py-3 transition-colors group"
          >
            <Activity className="w-4 h-4 text-violet-400" />
            <span className="text-zinc-300 text-sm group-hover:text-zinc-100 transition-colors">
              Log a Workout
            </span>
          </a>
          <a
            href="/progress"
            className="flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl px-4 py-3 transition-colors group"
          >
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-zinc-300 text-sm group-hover:text-zinc-100 transition-colors">
              View Progress
            </span>
          </a>
          <a
            href="/import"
            className="flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl px-4 py-3 transition-colors group"
          >
            <Dumbbell className="w-4 h-4 text-emerald-400" />
            <span className="text-zinc-300 text-sm group-hover:text-zinc-100 transition-colors">
              Import FitNotes Data
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
