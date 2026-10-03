import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
      setMessage(error ? error.message : 'Un courriel de réinitialisation vient de t’être envoyé.');
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
      setMessage('La connexion a reussi, mais aucune session n\'a ete creee. Reessaie.');
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
      const destination = new URL(returnTo || '/', window.location.origin);
      window.location.replace(destination.origin === window.location.origin ? `${destination.pathname}${destination.search}${destination.hash}` : '/');
    } catch {
      window.location.replace('/');
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm border border-white/15 bg-[#0a1114] p-7 shadow-2xl">
        <h1 className="text-3xl font-black text-white mb-1">AISTAGE.ONE</h1>
        <p className="text-white/55 mb-6">
{mode === 'login' ? 'Private preview access' : 'Reset password'}
        </p>
        {searchParams.get('confirmed') === '1' && (
          <p className="text-sm text-green-800 mb-4">Ton courriel est confirmé. Tu peux maintenant te connecter.</p>
        )}
              required
              autoComplete="name"
              className="w-full border border-white/20 bg-black px-3 py-2 mb-4 text-white"
            />
          </>
        )}
        <label className="block text-sm text-white/70 mb-1">Courriel</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          className="w-full border border-white/20 bg-black px-3 py-2 mb-4 text-white"
        />
        {mode !== 'forgot' && (
          <>
            <label className="block text-sm text-white/70 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="current-password"
              className="w-full border border-white/20 bg-black px-3 py-2 mb-4 text-white"
            />
          </>
        )}
        {message && <p className="text-sm text-red-700 mb-4">{message}</p>}
        <button disabled={loading} className="w-full bg-[#c8a45f] text-black py-3 font-black tracking-wider disabled:opacity-50">
{loading ? 'Please wait…' : mode === 'login' ? 'LOG IN' : 'SEND RESET EMAIL'}
        </button>
        {mode === 'login' && (
          <button
            type="button"
            onClick={() => { setMessage(''); setMode('forgot'); }}
            className="w-full text-sm text-white/60 mt-3 underline"
          >
            Mot de passe oublié
          </button>
        )}
      </form>
    </div>
  );
}
