import React, { useState } from 'react';
import { supabase } from '@/api/base44Client';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    window.location.assign('/MemberDashboard');
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-yellow-400 rounded-2xl p-7 shadow-2xl">
        <h1 className="text-3xl font-black text-black mb-1">AISTAGE.ONE</h1>
        <p className="text-black/70 mb-6">Choisir un nouveau mot de passe</p>
        <label className="block text-sm text-black mb-1">Nouveau mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-lg border-2 border-black bg-white px-3 py-2 mb-4"
        />
        {message && <p className="text-sm text-red-700 mb-4">{message}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-black text-yellow-400 py-3 font-black disabled:opacity-50">
          {loading ? 'Patiente…' : 'Enregistrer le mot de passe'}
        </button>
      </form>
    </div>
  );
}
