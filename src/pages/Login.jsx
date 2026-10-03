import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/api/base44Client';

export default function Login() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/ResetPassword`,
      });
      setLoading(false);
      setMessage(error ? error.message : 'Check your email for the reset link.');
      return;
    }

    const result = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    const session = result.data.session;
    if (!session) {
      setMessage('Login succeeded, but no session was created. Please try again.');
      return;
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (sessionError) {
      setMessage(sessionError.message);
      return;
    }

    const returnTo = searchParams.get('returnTo');
    try {
      const destination = new URL(returnTo || '/Index', window.location.origin);
      const safePath = destination.origin === window.location.origin
        ? `${destination.pathname}${destination.search}${destination.hash}`
        : '/Index';
      window.location.replace(safePath);
    } catch {
      window.location.replace('/Index');
    }
  };

  return (
    <div className="min-h-screen bg-[#05090b] text-white flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,133,126,.18),transparent_34%),radial-gradient(circle_at_80%_85%,rgba(200,164,95,.14),transparent_30%)]" />
      <form onSubmit={submit} className="relative w-full max-w-sm border border-white/15 bg-[#0a1114]/95 p-7 shadow-2xl">
        <Link to="/" className="mb-8 inline-block text-[10px] font-black uppercase tracking-[.18em] text-white/45 hover:text-white">
          ← Public preview
        </Link>
        <h1 className="text-3xl font-black tracking-[.08em] text-white">
          <span className="text-[#c8a45f]">AI</span> STAGE ONE
        </h1>
        <p className="mt-2 mb-7 text-sm text-white/50">
          {mode === 'login' ? 'Private preview — Admin & Guest access only.' : 'Reset your private preview password.'}
        </p>

        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/55">Email</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          className="mb-4 w-full border border-white/20 bg-black px-3 py-3 text-sm text-white outline-none focus:border-[#7ec7c1]"
        />

        {mode === 'login' && (
          <>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-white/55">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="current-password"
              className="mb-4 w-full border border-white/20 bg-black px-3 py-3 text-sm text-white outline-none focus:border-[#7ec7c1]"
            />
          </>
        )}

        {message && <p className="mb-4 text-sm text-[#e0c17e]">{message}</p>}

        <button
          disabled={loading}
          className="w-full border border-[#c8a45f] bg-[#c8a45f] py-3 text-xs font-black uppercase tracking-[.16em] text-black disabled:opacity-50"
        >
          {loading ? 'PLEASE WAIT…' : mode === 'login' ? 'LOG IN' : 'SEND RESET EMAIL'}
        </button>

        <button
          type="button"
          onClick={() => { setMessage(''); setMode(mode === 'login' ? 'forgot' : 'login'); }}
          className="mt-4 w-full text-xs text-white/50 underline hover:text-white"
        >
          {mode === 'login' ? 'Forgot password?' : 'Back to login'}
        </button>

        <p className="mt-8 border-t border-white/10 pt-5 text-xs leading-5 text-white/40">
          No public account creation during the private preview. Use the pre-registration form on the public landing page to join the launch list.
        </p>
      </form>
    </div>
  );
}
