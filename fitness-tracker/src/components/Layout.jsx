import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Dumbbell,
  Library,
  Calendar,
  TrendingUp,
  Upload,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/exercises', label: 'Exercises', icon: Library },
  { to: '/calendar', label: 'Calendar', icon: Calendar },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/import', label: 'Import', icon: Upload },
];

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    try {
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }

  const NavItems = () => (
    <>
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? 'bg-violet-600 text-white'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
            }`
          }
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          {label}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <aside className="hidden md:flex w-56 flex-col bg-zinc-900 border-r border-zinc-800">
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-zinc-800">
          <div className="bg-violet-600 p-1.5 rounded-lg">
            <Dumbbell className="w-4 h-4 text-white" />
          </div>
          <span className="text-zinc-100 font-semibold text-sm">FitTrack</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavItems />
        </nav>

        <div className="px-3 py-4 border-t border-zinc-800">
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-violet-700 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-medium">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <span className="text-zinc-400 text-xs truncate flex-1">{user?.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-zinc-800 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="bg-violet-600 p-1.5 rounded-lg">
              <Dumbbell className="w-4 h-4 text-white" />
            </div>
            <span className="text-zinc-100 font-semibold text-sm">FitTrack</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="text-zinc-500 hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <NavItems />
        </nav>

        <div className="px-3 py-4 border-t border-zinc-800">
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-violet-700 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-medium">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <span className="text-zinc-400 text-xs truncate flex-1">{user?.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-zinc-800 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-zinc-400 hover:text-zinc-100"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-violet-600 p-1 rounded-md">
              <Dumbbell className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-zinc-100 font-semibold text-sm">FitTrack</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-zinc-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
