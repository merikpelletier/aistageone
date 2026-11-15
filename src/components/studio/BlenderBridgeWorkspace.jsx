import React, { useState } from 'react';
import { Box, Plug, Send, ShieldCheck } from 'lucide-react';

const BRIDGE_URL = 'http://127.0.0.1:18765';

async function bridgeRequest(path, token, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${BRIDGE_URL}${path}`, {
      method: payload ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      signal: controller.signal,
      cache: 'no-store',
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || `Bridge error ${response.status}`);
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

export default function BlenderBridgeWorkspace() {
  const [token, setToken] = useState('');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Not connected');
  const [objectName, setObjectName] = useState('AISTAGE_Studio_Cube');
  const [location, setLocation] = useState(['0', '0', '1']);

  const connect = async () => {
    if (!token.trim()) return setMessage('Copy the token from the AISTAGE panel in Blender.');
    setBusy(true);
    setConnected(false);
    try {
      const result = await bridgeRequest('/v1/health', token);
      setConnected(true);
      setMessage(`Connected to Blender ${result.blender}`);
    } catch (error) {
      setMessage(error.name === 'AbortError' ? 'Blender did not respond.' : error.message === 'Failed to fetch'
        ? 'Cannot reach Blender. Start Bridge 0.3 in Blender; your browser may also require local-network permission.'
        : error.message);
    } finally {
      setBusy(false);
    }
  };

  const execute = async (command) => {
    if (!connected || busy) return;
    setBusy(true);
    try {
      const response = await bridgeRequest('/v1/command', token, command);
      setMessage(`Done: ${response.result.object}`);
    } catch (error) {
      if (error.message === 'Invalid token' || error.message === 'Failed to fetch') setConnected(false);
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };

  const name = objectName.trim();
  const validName = name.length > 0 && name.length <= 80;
  const coords = location.map(Number);
  const validCoords = location.every((value) => value.trim() !== '') && coords.every((n) => Number.isFinite(n) && Math.abs(n) <= 10000);

  return (
    <div className="min-h-full p-5 md:p-8 bg-[#202328] text-white">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Box className="h-7 w-7" />
          <div>
            <h2 className="text-2xl font-semibold">Blender Bridge</h2>
            <p className="text-sm text-white/60">Control Blender on this computer from AISTAGE.ONE Studio.</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/5 p-5 space-y-4">
          <h3 className="flex items-center gap-2 font-semibold"><Plug size={18} /> Connect Blender</h3>
          <p className="text-sm text-white/70">In Blender 5.3, install Bridge 0.3, select Start Local Bridge, then Copy Test Token. Paste it here. Your token is held only in this browser tab.</p>
          <label htmlFor="aistage-blender-token" className="block text-sm">Bridge token</label>
          <input id="aistage-blender-token" type="password" value={token}
            onChange={(event) => { setToken(event.target.value); setConnected(false); }}
            autoComplete="off" spellCheck={false} placeholder="Paste token from Blender"
            className="w-full rounded-lg border border-white/20 bg-black/30 p-3 text-white" />
          <button type="button" disabled={busy || !token.trim()} onClick={connect}
            className="rounded-lg bg-white px-4 py-2 font-semibold text-black disabled:opacity-40">
            {busy ? 'Connecting…' : 'Connect to Blender'}
          </button>
          <p role="status" aria-live="polite" className={connected ? 'text-sm text-emerald-300' : 'text-sm text-white/75'}>
            {message}
          </p>
        </div>
        <div className="rounded-xl border border-white/15 bg-white/5 p-5 space-y-4">
          <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} /> Scene commands</h3>
          <p className="text-sm text-white/70">Only the listed operations are enabled. No arbitrary Python execution.</p>
          <label htmlFor="aistage-blender-object" className="block text-sm">Object name</label>
          <input id="aistage-blender-object" value={objectName} maxLength={80}
            onChange={(event) => setObjectName(event.target.value)}
            className="w-full rounded-lg border border-white/20 bg-black/30 p-3 text-white" />
          <button type="button" disabled={!connected || busy || !validName}
            onClick={() => execute({ action: 'create_cube', name })}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 font-semibold text-black disabled:opacity-40">
            <Box size={16} /> Create cube in Blender
          </button>
          <div className="grid grid-cols-3 gap-3">
            {['X', 'Y', 'Z'].map((axis, index) => (
              <label key={axis} className="text-sm">{axis}
                <input type="number" step="0.1" value={location[index]}
                  onChange={(event) => setLocation((previous) => previous.map((item, i) => i === index ? event.target.value : item))}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/30 p-3 text-white" />
              </label>
            ))}
          </div>
          <button type="button" disabled={!connected || busy || !validName || !validCoords}
            onClick={() => execute({ action: 'move_object', name, location: coords })}
            className="flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 font-semibold text-white disabled:opacity-40">
            <Send size={16} /> Move existing object
          </button>
        </div>
      </div>
    </div>
  );
}
