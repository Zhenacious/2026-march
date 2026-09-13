import React, { lazy } from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Today from './pages/Today';

// Every page except Today (the daily one) loads on demand, so the phone only
// downloads and parses the code for the screen it is actually showing. The
// heavy chart library, for example, is only fetched when a chart page opens.
//
// After a deploy the old chunk files are gone; if a page's code fails to load
// for that reason, one reload picks up the new build. The flag stops a broken
// network from reloading forever.
function lazyPage(loader) {
  const RELOAD_FLAG = 'fittrack_chunk_reload';
  return lazy(() => loader()
    .then((mod) => { try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* ignore */ } return mod; })
    .catch((err) => {
      let reloaded = false;
      try {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, '1');
          reloaded = true;
          window.location.reload();
        }
      } catch { /* ignore */ }
      if (!reloaded) throw err;
      return new Promise(() => {}); // page is reloading; never resolve
    }));
}

const Dashboard = lazyPage(() => import('./pages/Dashboard'));
const Exercises = lazyPage(() => import('./pages/Exercises'));
const CalendarView = lazyPage(() => import('./pages/CalendarView'));
const Import = lazyPage(() => import('./pages/Import'));
const ExerciseHistory = lazyPage(() => import('./pages/ExerciseHistory'));
const BodyWeightTracker = lazyPage(() => import('./pages/BodyWeightTracker'));
const PersonalRecords = lazyPage(() => import('./pages/PersonalRecords'));
const Trends = lazyPage(() => import('./pages/Trends'));
const MyFoods = lazyPage(() => import('./pages/MyFoods'));

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-sm">Loading…</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/today" replace />;
  }

  return children;
}

// Redirect /workouts?date=X → /today?date=X so old links still work
function WorkoutsRedirect() {
  const [searchParams] = useSearchParams();
  const date = searchParams.get('date');
  return <Navigate to={date ? `/today?date=${date}` : '/today'} replace />;
}

// Redirect /food?date=X → /today?tab=food&date=X (food now lives on the Today page)
function FoodRedirect() {
  const [searchParams] = useSearchParams();
  const date = searchParams.get('date');
  return <Navigate to={`/today?tab=food${date ? `&date=${date}` : ''}`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/today" replace />} />
      <Route path="/workouts" element={<WorkoutsRedirect />} />
      <Route path="/food" element={<FoodRedirect />} />

      <Route
        path="/login"
        element={
          <PublicRoute>
            <Auth />
          </PublicRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/today" element={<Today />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/exercises" element={<Exercises />} />
        <Route path="/exercises/:name" element={<ExerciseHistory />} />
        <Route path="/calendar" element={<CalendarView />} />
        <Route path="/progress" element={<Navigate to="/exercises" replace />} />
        <Route path="/import" element={<Import />} />
        <Route path="/body-weight" element={<BodyWeightTracker />} />
        <Route path="/records" element={<PersonalRecords />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/foods" element={<MyFoods />} />
      </Route>

      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}
