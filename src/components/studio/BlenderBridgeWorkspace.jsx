import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Box, Plug, Send, ShieldCheck, Sparkles } from 'lucide-react';

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


const ALLOWED = new Set(['create_cube','create_sphere','create_cylinder','create_plane','move_object','rotate_object','scale_object']);
const VECTOR = { move_object: 'location', rotate_object: 'rotation', scale_object: 'scale' };
function safePlan(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) : raw;
  if (!Array.isArray(parsed?.commands) || parsed.commands.length < 1 || parsed.commands.length > 5)
    throw new Error('AI returned no supported operations (limit: 5).');
  return parsed.commands.map((item) => {
    if (!item || !ALLOWED.has(item.action) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 80)
      throw new Error('AI returned an unsupported action or object name.');
    const command = { action: item.action, name: item.name.trim() };
    const key = VECTOR[item.action];
    if (key) {
      if (!Array.isArray(item[key]) || item[key].length !== 3 || !item[key].every((n) =>
        typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 10000 &&
        (key !== 'scale' || (n >= 0.001 && n <= 1000))))
        throw new Error('AI returned invalid transform values.');
      command[key] = item[key];
    }
    return command;
  });
}

export default function BlenderBridgeWorkspace() {
  const [token, setToken] = useState('');
  const [direction, setDirection] = useState('');
  const [characters, setCharacters] = useState([]);
  const [characterSource, setCharacterSource] = useState('');
  const [workingCharacter, setWorkingCharacter] = useState('');
  const [waistWidth, setWaistWidth] = useState('1');
  const [nativeTools, setNativeTools] = useState(null);
  const [nativeGroup, setNativeGroup] = useState('');
  const [nativeLattice, setNativeLattice] = useState(false);
  const [nativeShape, setNativeShape] = useState('');
  const [nativeShapeValue, setNativeShapeValue] = useState('0');

  const [plan, setPlan] = useState([]);
  const [planning, setPlanning] = useState(false);
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
        ? 'Cannot reach Blender. Start Bridge 0.5 in Blender; your browser may also require local-network permission.'
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


  const prepareAI = async () => {
    if (!connected || busy || planning || !direction.trim()) return;
    setPlanning(true);
    setPlan([]);
    setMessage('Preparing AI plan…');
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: direction.trim().slice(0, 1500),
        instructions: 'Translate the user request (French or English) into a safe Blender command plan. Respond only with JSON of shape {"commands":[{"action":"create_cube","name":"Cube"}]}. Allowed actions: create_cube, create_sphere, create_cylinder, create_plane, move_object, rotate_object, scale_object. Each needs action and name. move_object needs location [x,y,z]; rotate_object needs rotation [x,y,z] in DEGREES; scale_object needs scale [x,y,z] with ABSOLUTE positive values. Maximum 5 ordered commands. Never invent a complex geometry operation, materials, lights, animation or Python scripts. If unsupported, return {"commands":[]}.',
        response_json_schema: { type: 'object', properties: { commands: { type: 'array', items: { type: 'object', properties: { action: { type: 'string' }, name: { type: 'string' }, location: { type: 'array', items: { type: 'number' } }, rotation: { type: 'array', items: { type: 'number' } }, scale: { type: 'array', items: { type: 'number' } } }, required: ['action', 'name'] } } }, required: ['commands'] },
      });
      setPlan(safePlan(result));
      setMessage('Review the AI plan before execution.');
    } catch (error) {
      setMessage(error?.message || 'AI planning failed.');
    } finally {
      setPlanning(false);
    }
  };

  const runAIPlan = async () => {
    if (!connected || busy || planning || !plan.length) return;
    setBusy(true);
    const commands = [...plan];
    setPlan([]);
    try {
      for (let i = 0; i < commands.length; i++) {
        setMessage(`Executing ${i + 1} / ${commands.length}…`);
        await bridgeRequest('/v1/command', token, commands[i]);
      }
      setMessage(`Completed ${commands.length} operation(s) in Blender.`);
    } catch (error) {
      if (error.message === 'Invalid token' || error.message === 'Failed to fetch') setConnected(false);
      setMessage(`Stopped: ${error.message}. Prior operations may have completed.`);
    } finally {
      setBusy(false);
    }
  };


  const inspectCharacters = async () => {
    if (!connected || busy) return;
    setBusy(true);
    try {
      const response = await bridgeRequest('/v1/command', token, { action: 'inspect_character_meshes' });
      const items = response?.result?.objects || [];
      setCharacters(items);
      const selected = items.find((item) => item.name === characterSource) || items.find((item) => item.name.includes('body_female_realistic')) || items.find((item) => !item.working_copy) || items[0];
      setCharacterSource(selected?.name || '');
      setMessage(`Found ${response.result.total_meshes} mesh object(s); showing ${items.length}.`);
    } catch (error) {
      setMessage(error?.message || 'Mesh inspection failed.');
    } finally {
      setBusy(false);
    }
  };

  const createCharacterCopy = async () => {
    if (!connected || busy || !characterSource) return;
    setBusy(true);
    try {
      const response = await bridgeRequest('/v1/command', token, { action: 'create_character_copy', name: characterSource });
      setWorkingCharacter(response.result.object);
      setNativeTools(null);
      setNativeGroup('');
      setNativeLattice(false);
      setMessage(`Working copy created: ${response.result.object}. Original preserved.`);
    } catch (error) {
      setMessage(error?.message || 'Could not create character copy.');
    } finally {
      setBusy(false);
    }
  };


  const nativeCommand = async (command, after) => {
    if (!connected || busy) return;
    setBusy(true);
    try {
      const response = await bridgeRequest('/v1/command', token, command);
      after?.(response.result);
      setMessage(JSON.stringify(response.result));
    } catch (error) {
      setMessage(error?.message || 'Native Blender command failed.');
    } finally {
      setBusy(false);
    }
  };

  const inspectNative = (name = workingCharacter) => {
    if (!name) return;
    nativeCommand({ action: 'inspect_native_tools', name }, (result) => {
      setNativeTools(result);
      setNativeGroup((previous) => result.vertex_groups.some((group) => group.name === previous)
        ? previous : (result.vertex_groups[0]?.name || ''));
      setNativeShape(result.shape_keys.find((key) => key.name !== 'Basis')?.name || '');
      setNativeLattice(result.modifiers.some((mod) => mod.type === 'LATTICE' && mod.name.startsWith('AISTAGE_')));
    });
  };

  const makeWaistSelection = () => {
    nativeCommand({ action: 'create_vertex_group_from_selection', name: workingCharacter }, (result) => {
      setNativeGroup(result.vertex_group);
      setNativeTools(null);
      setNativeLattice(false);
    });
  };

  const makeLattice = () => {
    nativeCommand({ action: 'create_native_lattice', name: workingCharacter, vertex_group: nativeGroup },
      () => setNativeLattice(true));
  };

  const applyWaist = () => {
    const width = Number(waistWidth);
    if (waistWidth.trim() === '' || !Number.isFinite(width) || width < 0.75 || width > 1.25) return;
    nativeCommand({ action: 'set_native_lattice_width', name: workingCharacter, waist_width: width });
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
          <p className="text-sm text-white/70">In Blender 5.3, install Bridge 0.6, select Start Local Bridge, then Copy Test Token. Paste it here. Your token is held only in this browser tab.</p>
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

        <div className="rounded-xl border border-teal-400/30 bg-white/5 p-5 space-y-4">
          <h3 className="flex items-center gap-2 font-semibold"><Sparkles size={18} /> AI Director 3D</h3>
          <p className="text-sm text-white/70">Describe the scene change. AI planning uses AISTAGE credits. Nothing is sent to Blender until you review and approve.</p>
          <textarea rows={3} maxLength={1500} value={direction}
            onChange={(event) => { setDirection(event.target.value); setPlan([]); }}
            placeholder="Create a sphere named Moon and move Moon to X 2, Y 0, Z 3."
            className="w-full rounded-lg border border-white/20 bg-black/30 p-3 text-white" />
          <button type="button" disabled={!connected || busy || planning || !direction.trim()} onClick={prepareAI}
            className="rounded-lg bg-teal-400 px-4 py-2 font-semibold text-black disabled:opacity-40">
            {planning ? 'Preparing…' : 'Prepare with AI (credits)'}
          </button>
          {plan.length > 0 && (
            <div className="rounded-lg border border-white/15 bg-black/25 p-4 space-y-3">
              <p className="text-sm font-semibold">Review before execution</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-white/85">
                {plan.map((command, index) => <li key={index}>
                  {command.action.replaceAll('_', ' ')} — {command.name}
                  {VECTOR[command.action] ? ` [${command[VECTOR[command.action]].join(', ')}]` : ''}
                </li>)}
              </ol>
              <div className="flex gap-3">
                <button type="button" disabled={busy || planning || !connected} onClick={runAIPlan}
                  className="rounded-lg bg-white px-4 py-2 font-semibold text-black disabled:opacity-40">Execute in Blender</button>
                <button type="button" disabled={busy} onClick={() => setPlan([])}
                  className="rounded-lg border border-white/20 px-4 py-2">Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/15 bg-white/5 p-5 space-y-4">
          <h3 className="flex items-center gap-2 font-semibold"><Box size={18} /> Character Mesh Studio</h3>
          <p className="text-sm text-white/70">Read the human mesh already loaded in Blender, make an independent working copy and apply a reversible shape key. The original remains unchanged.</p>
          <button type="button" disabled={!connected || busy} onClick={inspectCharacters}
            className="rounded-lg bg-white px-4 py-2 font-semibold text-black disabled:opacity-40">Inspect character meshes</button>
          {characters.length > 0 && (
            <>
              <label htmlFor="aistage-character-source" className="block text-sm">Source mesh</label>
              <select id="aistage-character-source" value={characterSource}
                onChange={(event) => setCharacterSource(event.target.value)}
                className="w-full rounded-lg border border-white/20 bg-[#202328] p-3 text-white">
                {characters.map((item) => <option key={item.name} value={item.name}>
                  {item.name} — {item.vertices.toLocaleString()} vertices, {item.quads.toLocaleString()} quads
                </option>)}
              </select>
              <button type="button" disabled={!connected || busy || !characterSource} onClick={createCharacterCopy}
                className="rounded-lg border border-white/25 px-4 py-2 font-semibold disabled:opacity-40">
                Create independent working copy
              </button>
            </>
          )}

          {characters.some((item) => item.working_copy) && (
            <div className="space-y-2">
              <label htmlFor="aistage-existing-copy" className="block text-sm">Existing working copy</label>
              <select id="aistage-existing-copy" value={workingCharacter} onChange={(event) => {
                  setWorkingCharacter(event.target.value); setNativeTools(null); setNativeLattice(false);
                }} className="w-full rounded-lg border border-white/20 bg-[#202328] p-3 text-white">
                <option value="">Choose a working copy</option>
                {characters.filter((item) => item.working_copy).map((item) =>
                  <option key={item.name} value={item.name}>{item.name}</option>)}
              </select>
            </div>
          )}
          {workingCharacter && (
            <div className="space-y-3 rounded-lg border border-teal-400/30 bg-black/20 p-4">
              <p className="break-all text-sm">Working copy: <strong>{workingCharacter}</strong></p>
              <p className="text-sm text-white/75">Blender-native modeling: Vertex Groups, Lattice Modifier, Shape Keys. The previous automatic waist deformation is disabled.</p>
              <button type="button" disabled={!connected || busy} onClick={() => inspectNative()}
                className="rounded-lg border border-white/25 px-4 py-2 font-semibold disabled:opacity-40">
                Inspect native Blender tools
              </button>
              {nativeTools && (
                <>
                  <p className="text-sm">Existing vertex groups: {nativeTools.vertex_groups.length}</p>
                  <label htmlFor="aistage-native-group" className="block text-sm">Vertex group controlling the deformation</label>
                  <select id="aistage-native-group" value={nativeGroup} onChange={(event) => {
                      setNativeGroup(event.target.value); setNativeLattice(false);
                    }} className="w-full rounded-lg border border-white/20 bg-[#202328] p-3 text-white">
                    <option value="">Select an existing group</option>
                    {nativeTools.vertex_groups.map((group) =>
                      <option key={group.name} value={group.name}>{group.name} ({group.assigned_vertices} vertices)</option>)}
                  </select>
                  <p className="text-xs text-white/60">Alternatively, select ONLY waist vertices on the working copy in Blender Edit Mode, then use the button below. This creates a Blender Vertex Group without moving any geometry.</p>
                  <button type="button" disabled={!connected || busy} onClick={makeWaistSelection}
                    className="rounded-lg border border-white/25 px-4 py-2 disabled:opacity-40">
                    Use Blender's selected vertices as Waist group
                  </button>
                  <button type="button" disabled={!connected || busy || !nativeGroup || nativeLattice}
                    onClick={makeLattice} className="rounded-lg border border-white/25 px-4 py-2 disabled:opacity-40">
                    Create native Lattice Modifier
                  </button>
                  {nativeLattice && (
                    <>
                      <label htmlFor="aistage-waist-width" className="block text-sm">Lattice width factor (0.75–1.25)</label>
                      <input id="aistage-waist-width" type="number" min="0.75" max="1.25" step="0.05"
                        value={waistWidth} onChange={(event) => setWaistWidth(event.target.value)}
                        className="w-full rounded-lg border border-white/20 bg-black/30 p-3 text-white" />
                      <button type="button" disabled={!connected || busy || !Number.isFinite(Number(waistWidth)) || Number(waistWidth) < 0.75 || Number(waistWidth) > 1.25}
                        onClick={applyWaist} className="rounded-lg bg-teal-400 px-4 py-2 font-semibold text-black disabled:opacity-40">
                        Adjust native Blender lattice
                      </button>
                    </>
                  )}
                  {nativeTools.shape_keys.length > 1 && (
                    <>
                      <label htmlFor="aistage-native-shape" className="block text-sm">Existing Blender Shape Key</label>
                      <select id="aistage-native-shape" value={nativeShape}
                        onChange={(event) => setNativeShape(event.target.value)}
                        className="w-full rounded-lg border border-white/20 bg-[#202328] p-3 text-white">
                        {nativeTools.shape_keys.filter((key) => key.name !== 'Basis').map((key) =>
                          <option key={key.name} value={key.name}>{key.name}</option>)}
                      </select>
                      <input type="number" min="0" max="1" step="0.1" value={nativeShapeValue}
                        onChange={(event) => setNativeShapeValue(event.target.value)}
                        className="w-full rounded-lg border border-white/20 bg-black/30 p-3 text-white" />
                      <button type="button" disabled={!connected || busy || !nativeShape || nativeShapeValue.trim() === '' || !Number.isFinite(Number(nativeShapeValue)) || Number(nativeShapeValue) < 0 || Number(nativeShapeValue) > 1}
                        onClick={() => nativeCommand({ action: 'set_native_shape_key', name: workingCharacter,
                          shape_key: nativeShape, value: Number(nativeShapeValue) })}
                        className="rounded-lg border border-white/25 px-4 py-2 disabled:opacity-40">
                        Set native Shape Key
                      </button>
                    </>
                  )}
                </>
              )}
              <p className="text-xs text-white/60">Only the working copy is modified; original meshes remain untouched. Native modifiers are non-destructive. A vertex group is required; Blender must know the anatomy before the shape is altered.</p>
            </div>
          )}
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
