import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Home,
  Waves,
  Library,
  Calendar,
  TrendingUp,
  Upload,
  LogOut,
  X,
  Scale,
  LayoutDashboard,
  ChevronUp,
  Trophy,
} from 'lucide-react';

/** Secondary destinations — opened from the bottom “More” sheet (keeps the main chrome stable in mobile Safari / PWA). */
const moreNavItems = [
  { to: '/exercises',   label: 'Exercises',        icon: Library },
  { to: '/records',     label: 'Personal Records', icon: Trophy },
  { to: '/calendar',    label: 'Calendar',         icon: Calendar },
  { to: '/progress',    label: 'Progress',         icon: TrendingUp },
  { to: '/body-weight', label: 'Body weight',      icon: Scale },
  { to: '/dashboard',   label: 'Stats',            icon: LayoutDashboard },
  { to: '/import',      label: 'Import',           icon: Upload },
];

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isTodayRoute = location.pathname === '/today';

  async function handleSignOut() {
    try {
      setMoreOpen(false);
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Sign out error:', err);
    }
  }

  return (
    <div className="flex flex-col min-h-dvh h-dvh bg-zinc-950 overflow-hidden">

      {/* ── Simple top bar (no slide-out drawer — avoids odd Safari window / chrome shifts) ── */}
      <header className="flex items-center justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3.5 bg-zinc-900 border-b border-zinc-800 flex-shrink-0 z-30">
        <NavLink to="/today" className="flex items-center gap-2.5" onClick={() => setMoreOpen(false)}>
          <div className="bg-teal-600 p-1.5 rounded-lg">
            <Waves className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-base"><span className="bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">Dolphin</span><span className="text-zinc-100">FitTrack</span></span>
        </NavLink>
      </header>

      {/* ── Page scroll area — padding clears the fixed bottom bar ── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-zinc-950 pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))]">
        <Outlet />
      </main>

      {/* ── App-style bottom bar: primary = Today, rest = More (sheet, not side drawer) ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)] pt-1.5 px-2"
        aria-label="Main navigation"
      >
        <div className="max-w-lg mx-auto flex gap-2">
          <NavLink
            to="/today"
            onClick={() => setMoreOpen(false)}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 rounded-2xl py-3.5 min-h-[3.25rem] text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-gradient-to-r from-teal-600 to-cyan-500 text-white shadow-lg shadow-teal-900/40'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 active:bg-zinc-800'
              }`
            }
          >
            <Home className="w-6 h-6 flex-shrink-0" aria-hidden />
            Today
          </NavLink>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-2xl py-3.5 min-h-[3.25rem] text-sm font-semibold transition-colors ${
              !isTodayRoute
                ? 'bg-zinc-800 text-teal-300 ring-1 ring-teal-500/40'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 active:bg-zinc-800'
            }`}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
          >
            <ChevronUp className="w-6 h-6 flex-shrink-0 opacity-90" aria-hidden />
            More
          </button>
        </div>
      </nav>

      {/* ── “More” bottom sheet ── */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/55"
          role="dialog"
          aria-modal="true"
          aria-label="More options"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="bg-zinc-900 rounded-t-3xl border-t border-zinc-800 max-h-[min(78vh,520px)] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-zinc-100 font-semibold text-lg">More</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="text-zinc-500 hover:text-zinc-200 p-2 rounded-xl hover:bg-zinc-800 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="px-5 text-zinc-500 text-xs pb-3">Other tools and settings</p>
            <nav className="overflow-y-auto px-3 pb-4 space-y-1">
              {moreNavItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3.5 rounded-2xl text-base font-medium min-h-[52px] transition-colors ${
                      isActive
                        ? 'bg-teal-600 text-white'
                        : 'text-zinc-200 hover:bg-zinc-800 active:bg-zinc-800/90'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 flex-shrink-0 opacity-90" />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="border-t border-zinc-800 px-3 pt-2 pb-4 space-y-2">
              <div className="flex items-center gap-2 px-4 py-2">
                <div className="w-9 h-9 rounded-full bg-teal-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-medium">
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="text-zinc-500 text-sm truncate flex-1">{user?.email}</span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center justify-center gap-2 w-full px-4 py-3.5 rounded-2xl text-zinc-300 hover:text-red-400 hover:bg-zinc-800 text-base font-medium min-h-[52px] transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
