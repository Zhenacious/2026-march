import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import WorkoutLog from './pages/WorkoutLog';
import Exercises from './pages/Exercises';
import CalendarView from './pages/CalendarView';
import Progress from './pages/Progress';
import Import from './pages/Import';
import ExerciseHistory from './pages/ExerciseHistory';
import BodyWeightTracker from './pages/BodyWeightTracker';

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
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

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
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workouts" element={<WorkoutLog />} />
        <Route path="/exercises" element={<Exercises />} />
        <Route path="/exercises/:name" element={<ExerciseHistory />} />
        <Route path="/calendar" element={<CalendarView />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/import" element={<Import />} />
        <Route path="/body-weight" element={<BodyWeightTracker />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
