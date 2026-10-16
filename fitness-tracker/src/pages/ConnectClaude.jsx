import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Plug, Copy, Check, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { generateConnectorKey, hashConnectorKey, connectorUrl } from '../lib/connectorKey';

// Lets each user make their own private link for Claude's custom connector.
// The link's key is created here in the browser; only its hash is saved, so
// the full link is shown once. Losing it just means making a new one.
export default function ConnectClaude() {
  const { user } = useAuth();
  const [createdAt, setCreatedAt] = useState(null); // when the active link was made
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newLink, setNewLink] = useState('');       // shown once, right after generating
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('connector_keys')
      .select('created_at')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        setCreatedAt(data?.created_at || null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user.id]);

  async function generate() {
    setBusy(true);
    setError('');
    try {
      const key = generateConnectorKey();
      const { data, error: err } = await supabase
        .from('connector_keys')
        .upsert({ user_id: user.id, key_hash: await hashConnectorKey(key), created_at: new Date().toISOString() })
        .select('created_at')
        .single();
      if (err) throw err;
      setCreatedAt(data.created_at);
      setNewLink(connectorUrl(window.location.origin, key));
      setCopied(false);
    } catch (err) {
      setError(err.message || 'Could not create a link.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setError('');
    const { error: err } = await supabase.from('connector_keys').delete().eq('user_id', user.id);
    setBusy(false);
    setConfirmRevoke(false);
    if (err) { setError(err.message); return; }
    setCreatedAt(null);
    setNewLink('');
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(newLink);
      setCopied(true);
    } catch {
      setError('Could not copy automatically. Select the link and copy it by hand.');
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1 flex items-center gap-2">
        <Plug className="w-6 h-6" /> Connect to Claude
      </h1>
      <p className="text-zinc-400 text-sm mb-6">
        Give Claude read-only access to your workouts, food and body weight, so you can ask
        coaching questions without pasting anything. Claude can never change your data.
      </p>

      {error && (
        <div className="flex items-start gap-3 bg-red-950 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
        {loading ? (
          <p className="text-zinc-400 text-sm">Checking your link...</p>
        ) : newLink ? (
          <>
            <p className="text-zinc-100 text-sm font-medium mb-2">Your connector link</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={newLink}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono"
              />
              <button
                onClick={copy}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm px-3 py-2 rounded-lg"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-amber-300 text-xs mt-3">
              Copy it now. For your security it is only shown once. Treat it like a password:
              anyone with this link can read your data.
            </p>
          </>
        ) : createdAt ? (
          <p className="text-zinc-300 text-sm">
            You have an active link, created {format(new Date(createdAt), 'd MMM yyyy')}. It can't be
            shown again. If you've lost it, make a new one (the old one stops working).
          </p>
        ) : (
          <p className="text-zinc-300 text-sm">You haven't made a link yet.</p>
        )}

        {!loading && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={generate}
              disabled={busy}
              className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 text-sm px-3 py-2 rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
              {createdAt ? 'Make a new link' : 'Generate my link'}
            </button>
            {createdAt && !confirmRevoke && (
              <button
                onClick={() => setConfirmRevoke(true)}
                disabled={busy}
                className="flex items-center gap-1.5 text-red-400 hover:text-red-300 text-sm px-3 py-2 rounded-lg"
              >
                <Trash2 className="w-4 h-4" /> Revoke
              </button>
            )}
            {confirmRevoke && (
              <span className="flex items-center gap-2 text-sm text-zinc-300">
                Claude will lose access.
                <button onClick={revoke} disabled={busy} className="text-red-400 hover:text-red-300 font-medium">Yes, revoke</button>
                <button onClick={() => setConfirmRevoke(false)} className="text-zinc-400 hover:text-zinc-200">Cancel</button>
              </span>
            )}
          </div>
        )}
      </section>

      <section className="text-sm text-zinc-300 space-y-4">
        <div>
          <h2 className="text-zinc-100 font-semibold mb-1">Add it to claude.ai</h2>
          <ol className="list-decimal list-inside space-y-1 text-zinc-400">
            <li>Open claude.ai, then Settings, then Connectors.</li>
            <li>Choose Add custom connector. Name it FitTrack and paste your link. Leave the advanced (OAuth) fields empty.</li>
            <li>In a chat or project, turn FitTrack on from the tools menu.</li>
            <li>Ask something like "How has my bench press gone this month?"</li>
          </ol>
          <p className="text-zinc-500 text-xs mt-2">Custom connectors need a paid Claude plan.</p>
        </div>
        <div>
          <h2 className="text-zinc-100 font-semibold mb-1">Claude Code (optional)</h2>
          <code className="block bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 break-all">
            claude mcp add --transport http fittrack YOUR_LINK
          </code>
        </div>
      </section>
    </div>
  );
}
