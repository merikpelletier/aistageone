import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/api/base44Client';

export default function Login() {
  const [searchParams] = useSearchParams();
  const [fullName, setFullName] = useState('');
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

    const result = mode === 'signup'
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/Login?confirmed=1`,
          },
        })
      : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (result.error) {
      setMessage(result.error.message);
      return;
    }

    if (mode === 'signup' && !result.data.session) {
      setMessage('Vérifie ton courriel pour confirmer ton compte.');
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
      <form onSubmit={submit} className="w-full max-w-sm bg-yellow-400 rounded-2xl p-7 shadow-2xl">
        <h1 className="text-3xl font-black text-black mb-1">AISTAGE.ONE</h1>
        <p className="text-black/70 mb-6">
          {mode === 'login' ? 'Connexion' : mode === 'signup' ? 'Créer un compte' : 'Réinitialiser le mot de passe'}
        </p>
        {searchParams.get('confirmed') === '1' && (
          <p className="text-sm text-green-800 mb-4">Ton courriel est confirmé. Tu peux maintenant te connecter.</p>
        )}
        {mode === 'signup' && (
          <>
            <label className="block text-sm text-black mb-1">Nom affiché</label>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
              autoComplete="name"
              className="w-full rounded-lg border-2 border-black bg-white px-3 py-2 mb-4"
            />
          </>
        )}
        <label className="block text-sm text-black mb-1">Courriel</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          className="w-full rounded-lg border-2 border-black bg-white px-3 py-2 mb-4"
        />
        {mode !== 'forgot' && (
          <>
            <label className="block text-sm text-black mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full rounded-lg border-2 border-black bg-white px-3 py-2 mb-4"
            />
          </>
        )}
        {message && <p className="text-sm text-red-700 mb-4">{message}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-black text-yellow-400 py-3 font-black disabled:opacity-50">
          {loading ? 'Patiente…' : mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer le compte' : 'Envoyer le courriel'}
        </button>
        <button
          type="button"
          onClick={() => { setMessage(''); setMode(mode === 'login' ? 'signup' : 'login'); }}
          className="w-full text-sm text-black mt-4 underline"
        >
          {mode === 'login' ? 'Créer un compte' : 'J’ai déjà un compte'}
        </button>
        {mode === 'login' && (
          <button
            type="button"
            onClick={() => { setMessage(''); setMode('forgot'); }}
            className="w-full text-sm text-black mt-3 underline"
          >
            Mot de passe oublié
          </button>
        )}
      </form>
    </div>
  );
}
