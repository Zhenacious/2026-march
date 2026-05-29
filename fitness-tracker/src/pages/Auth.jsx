import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Waves } from 'lucide-react';

// Normalize an email so accidental capitalisation / trailing whitespace doesn't
// create a different account than the one the user thinks they're using.
function normalizeEmail(value) {
  return (value || '').trim().toLowerCase();
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    const cleanEmail = normalizeEmail(email);

    // Catch wrong-email typos at signup BEFORE we send anything.
    if (!isLogin && cleanEmail !== normalizeEmail(confirmEmail)) {
      setError("The two email addresses don't match. Re-check the confirm field.");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signIn(cleanEmail, password);
        navigate('/today');
      } else {
        const data = await signUp(cleanEmail, password);
        if (data?.session) {
          // Email confirmation is disabled in Supabase — user is already in.
          navigate('/today');
        } else {
          setMessage(
            `Confirmation link sent to ${cleanEmail}. Check that's the right address — if it isn't, sign up again with the correct one.`
          );
        }
      }
    } catch (err) {
      const raw = err?.message || '';
      const friendly = /rate.?limit|too many|exceeded/i.test(raw)
        ? "Sign-up emails are temporarily rate-limited. Try again in a minute, or sign in if you already created your account."
        : raw || 'Something went wrong. Please try again.';
      setError(friendly);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-zinc-800 p-3 rounded-2xl mb-4">
            <Waves className="w-8 h-8 text-teal-400" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-100"><span className="bg-gradient-to-r from-teal-400 to-cyan-300 bg-clip-text text-transparent">Dolphin</span>FitTrack</h1>
          <p className="text-zinc-400 mt-1 text-sm">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          {error && (
            <div className="bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-green-950 border border-green-800 text-green-300 px-4 py-3 rounded-lg mb-6 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete={isLogin ? 'email' : 'off'}
                placeholder="you@example.com"
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Confirm email
                </label>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  required
                  autoComplete="off"
                  placeholder="Type your email again"
                  className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <p className="text-zinc-500 text-xs mt-1">
                  We send a verification link here — make sure it's spelled correctly.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={6}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2.5 text-sm transition-colors"
            >
              {loading ? 'Please wait…' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); setMessage(''); setConfirmEmail(''); }}
              className="text-sm text-zinc-400 hover:text-teal-400 transition-colors"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
