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


const MORPH_SECTIONS = [
  { title: 'Body', controls: [
    ['head_width','Head width'],['head_height','Head height'],['neck_width','Neck'],
    ['shoulders','Shoulders'],['chest','Chest'],['waist','Waist'],['belly','Belly'],
    ['hips','Hips'],['buttocks','Buttocks'],['upper_arm','Upper arms'],
    ['forearm','Forearms'],['hands','Hands'],['thighs','Thighs'],['calves','Calves'],
    ['feet','Feet'],['legs_length','Leg length'],['arms_length','Arm length']
  ]},
  { title: 'Face', controls: [
    ['face_width','Face width'],['forehead','Forehead'],['cheeks','Cheeks'],
    ['jaw','Jaw'],['chin','Chin'],['nose_width','Nose width'],
    ['nose_length','Nose projection'],['lips','Lips'],['mouth_width','Mouth width'],
    ['eyes','Eyes'],['eye_spacing','Eye spacing'],['ears','Ears']
  ]},
];
const MORPH_PARTS = new Set(MORPH_SECTIONS.flatMap(section => section.controls.map(([id]) => id)));
const SCENE_ACTIONS = new Set(['create_cube','create_sphere','create_cylinder','create_plane','move_object','rotate_object','scale_object']);
const CHARACTER_ACTIONS = new Set(['set_native_shape_key','create_native_lattice','set_native_lattice_width','set_body_morph']);
const VECTOR = { move_object: 'location', rotate_object: 'rotation', scale_object: 'scale' };
function safePlan(raw, context) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) : raw;
  if (!Array.isArray(parsed?.commands) || parsed.commands.length < 1 || parsed.commands.length > 5)
    throw new Error('AI could not find a supported Blender operation. No changes made.');
  const groups = new Set(context?.vertex_groups?.map((group) => group.name) || []);
  const shapes = new Set(context?.shape_keys?.filter((key) => key.name !== 'Basis').map((key) => key.name) || []);
  let hasLattice = !!context?.modifiers?.some((modifier) => modifier.type === 'LATTICE' && modifier.name.startsWith('AISTAGE_'));
  return parsed.commands.map((item) => {
    if (!item || typeof item.action !== 'string' || ![...SCENE_ACTIONS, ...CHARACTER_ACTIONS].includes(item.action))
      throw new Error('AI requested an unsupported operation. No changes made.');
    if (CHARACTER_ACTIONS.has(item.action)) {
      if (!context?.object || item.name !== context.object)
        throw new Error('Character operation requires the selected Blender mesh.');
      if (item.action === 'set_body_morph') {
        if (!MORPH_PARTS.has(item.part) || typeof item.value !== 'number' || !Number.isFinite(item.value) || item.value < -1 || item.value > 1)
          throw new Error('Invalid body or face morph request.');
        return { action: item.action, name: context.object, part: item.part, value: item.value };
      }
      if (item.action === 'set_native_shape_key') {
        if (!shapes.has(item.shape_key) || typeof item.value !== 'number' || !Number.isFinite(item.value) || item.value < 0 || item.value > 1)
          throw new Error('AI selected a Shape Key not present in Blender.');
        return { action: item.action, name: context.object, shape_key: item.shape_key, value: item.value };
      }
      if (item.action === 'create_native_lattice') {
        if (!groups.has(item.vertex_group) || hasLattice)
          throw new Error('No validated anatomical Vertex Group available for this new modifier.');
        hasLattice = true;
        return { action: item.action, name: context.object, vertex_group: item.vertex_group };
      }
      if (!hasLattice || typeof item.waist_width !== 'number' || !Number.isFinite(item.waist_width) ||
          item.waist_width < 0.75 || item.waist_width > 1.25)
        throw new Error('A native Lattice Modifier and valid width are required. No changes made.');
      return { action: item.action, name: context.object, waist_width: item.waist_width };
    }
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 80)
      throw new Error('AI returned an invalid Blender object name.');
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
  const [workingCharacter, setWorkingCharacter] = useState('');
  const [waistWidth, setWaistWidth] = useState('1');
  const [morphValues, setMorphValues] = useState({});
  const [morphBusy, setMorphBusy] = useState('');
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
    setMessage('Inspecting native Blender operations…');
    try {
      let context = null;
      if (workingCharacter) {
        const inspection = await bridgeRequest('/v1/command', token, {
          action: 'inspect_native_tools', name: workingCharacter,
        });
        context = inspection.result;
        if (!context?.object) throw new Error('Blender did not return the selected character.');
      }
      const nativeSummary = context
        ? JSON.stringify({ object: context.object,
            vertex_groups: context.vertex_groups, shape_keys: context.shape_keys,
            modifiers: context.modifiers }).slice(0, 6500)
        : 'No character selected: only basic scene commands may be used.';
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `USER DIRECTION: ${direction.trim().slice(0, 1500)}\\nACTUAL BLENDER CHARACTER CAPABILITIES: ${nativeSummary}`,
        instructions: `You direct the live Blender scene through its existing native bpy functions. Output JSON { "commands": [...] } only, maximum 5 commands. For a selected character use ONLY supported operations: set_body_morph (name, part, value between -1 and +1) for native AISTAGE shape-key morphology. Valid parts: ${Array.from(MORPH_PARTS).join(", ")}. Use value -0.5 for narrower/smaller and +0.5 for wider/larger. These morphs create Blender Shape Keys automatically on suitable upright humanoid meshes. Also support set_native_shape_key (name, shape_key, value 0..1) on an existing non-Basis key; create_native_lattice (name, vertex_group) only using an EXISTING anatomically relevant vertex group and if no AISTAGE lattice exists; set_native_lattice_width (name, waist_width 0.75..1.25) only with an existing lattice or after creating it in the same plan. Match group and shape key names EXACTLY from the actual scene inspection; never invent anatomy, groups, shape keys, or claim arbitrary deformation is possible. Target only the character selected by the user. For non-character scene edits support create_cube, create_sphere, create_cylinder, create_plane (action, name); move_object (action, name, location [x,y,z]); rotate_object (action, name, rotation [x,y,z] degrees); scale_object (action, name, scale [x,y,z] positive absolute values). For requests not achievable through these available native tools, return {"commands":[]}. No Python scripts. Do not reinterpret unsupported character edits as scene transforms.`,
        response_json_schema: { type: 'object', properties: { commands: { type: 'array', items: { type: 'object', properties: {
          action: { type: 'string' }, name: { type: 'string' },
          shape_key: { type: 'string' }, vertex_group: { type: 'string' }, part: { type: 'string' },
          value: { type: 'number' }, waist_width: { type: 'number' },
          location: { type: 'array', items: { type: 'number' } },
          rotation: { type: 'array', items: { type: 'number' } },
          scale: { type: 'array', items: { type: 'number' } },
        }, required: ['action', 'name'] } } }, required: ['commands'] },
      });
      const approved = safePlan(result, context);
      setPlan(approved);
      setMessage('Blender operations ready to review.');
    } catch (error) {
      setMessage(error?.message || 'AI planning failed. No changes made.');
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
      const selected = items.find((item) => item.name === workingCharacter) || items.find((item) => item.name.includes('body_female_realistic')) || items[0];
      setWorkingCharacter(selected?.name || '');
      setMorphValues({});
      setNativeTools(null);
      setNativeLattice(false);
      setMessage(`Found ${response.result.total_meshes} mesh object(s); showing ${items.length}.`);
    } catch (error) {
      setMessage(error?.message || 'Mesh inspection failed.');
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

  const changeMorph = async (part, value) => {
    if (!connected || !workingCharacter || busy || morphBusy || !MORPH_PARTS.has(part)) return;
    setMorphBusy(part);
    try {
      const response = await bridgeRequest('/v1/command', token, {
        action: 'set_body_morph', name: workingCharacter, part, value
      });
      setMorphValues(previous => ({...previous, [part]: response.result.value}));
      setMessage(`${part.replaceAll('_', ' ')}: ${Math.round(value * 100)}%`);
    } catch (error) {
      setMessage(error?.message || 'Morph failed. The original geometry was not replaced.');
    } finally {
      setMorphBusy('');
    }
  };

  const loadMorphs = async (objectName = workingCharacter) => {
    if (!connected || !objectName || busy) return;
    setBusy(true);
    try {
      const response = await bridgeRequest('/v1/command', token, {action:'list_body_morphs', name:objectName});
      setMorphValues(response.result.values || {});
      setMessage('Morph controls loaded from Blender.');
    } catch (error) {
      setMessage(error?.message || 'Unable to inspect morphs.');
    } finally {
      setBusy(false);
    }
  };

  const resetMorphs = async () => {
    if (!connected || !workingCharacter || busy || morphBusy) return;
    setBusy(true);
    try {
      await bridgeRequest('/v1/command', token, {action:'reset_body_morphs', name:workingCharacter});
      setMorphValues({});
      setMessage('All AISTAGE morphology controls reset to neutral.');
    } catch (error) {
      setMessage(error?.message || 'Reset failed.');
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
    <div className="min-h-full bg-[#171a1e] text-white">
      <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-10 md:py-10 space-y-7">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-white/50 uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-300" /> AISTAGE Studio / 3D
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Blender</h1>
            <p className="text-sm text-white/55">Your characters and scenes, directed from one workspace.</p>
          </div>
          <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium ${connected ? 'border-teal-400/30 bg-teal-400/10 text-teal-200' : 'border-white/15 bg-white/5 text-white/60'}`}>
            <span className={`h-2 w-2 rounded-full ${connected ? 'bg-teal-300' : 'bg-white/30'}`}/>
            {connected ? 'Blender connected' : 'Blender disconnected'}
          </div>
        </div>

        {!connected && (
          <section className="rounded-2xl border border-white/10 bg-[#22262b] p-5 md:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Plug size={19} className="text-teal-300" />
              <div>
                <h2 className="font-medium">Connect to Blender</h2>
                <p className="text-xs text-white/50 mt-1">In Blender, start the local Bridge and copy its token.</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input aria-label="Blender Bridge token" type="password" autoComplete="off" spellCheck={false}
                placeholder="Paste Blender Bridge token" value={token}
                onChange={(event) => { setToken(event.target.value); setConnected(false); }}
                className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm outline-none focus:border-teal-300/60" />
              <button type="button" disabled={busy || !token.trim()} onClick={connect}
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#15191d] transition hover:bg-white/90 disabled:opacity-40">
                {busy ? 'Connecting…' : 'Connect'}
              </button>
            </div>
            <p role="status" aria-live="polite" className="text-xs text-white/55">{message}</p>
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-[#22262b] overflow-hidden">
          <div className="border-b border-white/10 px-5 py-5 md:px-7">
            <div className="flex items-center gap-2"><Box size={18} className="text-teal-300"/><h2 className="text-base font-semibold">Character</h2></div>
            <p className="mt-1 text-xs text-white/50">Select a mesh from your Blender scene and edit it directly.</p>
          </div>
          <div className="p-5 md:p-7 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={inspectCharacters} disabled={!connected || busy}
                className="rounded-xl border border-white/20 px-4 py-2.5 text-sm transition hover:bg-white/10 disabled:opacity-35">
                Find characters in Blender
              </button>
              {characters.length > 0 && <span className="text-xs text-white/50">{characters.length} mesh object(s) found</span>}
            </div>
            {characters.length > 0 && (
              <label className="block space-y-2 text-xs text-white/60">Blender character
                <select value={workingCharacter} onChange={(event) => {
                    setWorkingCharacter(event.target.value); setMorphValues({}); setNativeTools(null);
                    setNativeGroup(''); setNativeLattice(false); setPlan([]);
                  }}
                  className="block w-full rounded-xl border border-white/15 bg-[#171a1e] p-3 text-sm text-white">
                  {characters.map(item => <option key={item.name} value={item.name}>
                    {item.name} · {item.vertices.toLocaleString()} vertices
                  </option>)}
                </select>
              </label>
            )}
            {workingCharacter && <p className="text-xs text-teal-200/90">
              Selected character: {workingCharacter}. Changes apply directly to this Blender object.
            </p>}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#22262b] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-5 md:px-7">
            <div>
              <h2 className="text-lg font-semibold">Character Morph</h2>
              <p className="mt-1 text-xs text-white/55">Body and face controls · non-destructive Blender Shape Keys</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => loadMorphs()} disabled={!connected || !workingCharacter || busy || !!morphBusy}
                className="rounded-lg border border-white/20 px-3 py-2 text-xs disabled:opacity-40">Refresh</button>
              <button type="button" onClick={resetMorphs} disabled={!connected || !workingCharacter || busy || !!morphBusy}
                className="rounded-lg border border-white/20 px-3 py-2 text-xs disabled:opacity-40">Reset all</button>
            </div>
          </div>
          <div className="p-5 md:p-7 space-y-7">
            {!workingCharacter && <p className="text-sm text-white/50">Select a character in Blender above to enable morphing.</p>}
            {MORPH_SECTIONS.map(section => (
              <div key={section.title} className="space-y-4">
                <h3 className="text-sm font-semibold text-white/80">{section.title}</h3>
                <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                  {section.controls.map(([part,label]) => (
                    <div key={part} className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <label htmlFor={`morph-${part}`} className="text-white/70">{label}</label>
                        <span className="font-mono tabular-nums text-white/55">
                          {Math.round((morphValues[part] ?? 0) * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input id={`morph-${part}`} type="range" min="-1" max="1" step="0.05"
                          value={morphValues[part] ?? 0}
                          disabled={!connected || !workingCharacter || busy || !!morphBusy}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            setMorphValues(previous => ({...previous, [part]: value}));
                          }}
                          onPointerUp={(event) => changeMorph(part, Number(event.currentTarget.value))}
                          onKeyUp={(event) => {
                            if (['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(event.key))
                              changeMorph(part, Number(event.currentTarget.value));
                          }}
                          className="h-1.5 min-w-0 flex-1 accent-teal-300"/>
                        <button type="button" aria-label={`Apply ${label}`}
                          disabled={!connected || !workingCharacter || busy || !!morphBusy}
                          onClick={() => changeMorph(part, morphValues[part] ?? 0)}
                          className="rounded-lg border border-white/15 px-2 py-1 text-xs text-white/60 hover:text-white disabled:opacity-35">Apply</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-xs text-white/45">Morphology is generated for upright human meshes. Face and limb results depend on the character topology; inspect the Blender viewport before saving.</p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#22262b] overflow-hidden">
          <div className="border-b border-white/10 p-5 md:p-7">
            <div className="flex items-center gap-2"><Sparkles size={19} className="text-teal-300"/><h2 className="text-lg font-semibold">AI Director</h2></div>
            <p className="mt-2 text-sm text-white/60">Describe what you want to create. AI reads the actual native Blender tools available for your character before preparing changes.</p>
          </div>
          <div className="space-y-4 p-5 md:p-7">
            <textarea rows={4} maxLength={1500} value={direction}
              onChange={(event) => { setDirection(event.target.value); setPlan([]); }}
              placeholder="Describe your scene or the change you want to make…"
              className="block w-full resize-y rounded-xl border border-white/15 bg-[#171a1e] px-4 py-4 text-sm leading-relaxed outline-none focus:border-teal-300/60"/>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-sm text-xs text-white/45">AI Director can now control the Body and Face Shape Keys above using natural language.</p>
              <button type="button" disabled={!connected || busy || planning || !direction.trim()}
                onClick={prepareAI} className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#15191d] hover:bg-white/90 disabled:opacity-35">
                <Sparkles size={16}/>{planning ? 'Preparing…' : 'Prepare with AI'}
              </button>
            </div>
            {plan.length > 0 && (
              <div className="rounded-xl border border-teal-300/20 bg-teal-300/5 p-4 space-y-4">
                <p className="text-sm font-medium">Review operations</p>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-white/80">
                  {plan.map((command, index) =>
                    <li key={index}>{command.action.replaceAll('_', ' ')} · {command.name}
                      {VECTOR[command.action] ? ` [${command[VECTOR[command.action]].join(', ')}]` : command.action === 'set_body_morph' ? ` · ${command.part}: ${command.value}` : command.action === 'set_native_shape_key' ? ` · ${command.shape_key}: ${command.value}` : command.action === 'create_native_lattice' ? ` · ${command.vertex_group}` : command.action === 'set_native_lattice_width' ? ` · width ${command.waist_width}` : ''}
                    </li>)}
                </ol>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={runAIPlan} disabled={!connected || busy || planning}
                    className="rounded-xl bg-teal-300 px-5 py-2.5 text-sm font-semibold text-[#101819] disabled:opacity-35">Execute in Blender</button>
                  <button type="button" disabled={busy} onClick={() => setPlan([])}
                    className="rounded-xl border border-white/20 px-5 py-2.5 text-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </section>

        <details className="rounded-2xl border border-white/10 bg-[#22262b] open:bg-[#22262b]">
          <summary className="cursor-pointer select-none px-5 py-5 text-sm font-medium text-white/75 md:px-7">
            Native Blender controls <span className="ml-2 text-xs font-normal text-white/40">Advanced · optional</span>
          </summary>
          <div className="border-t border-white/10 p-5 md:p-7 space-y-4">
            <p className="text-xs text-white/55">These controls use Blender's existing tools. For anatomical edits, the correct region must already be defined as a Vertex Group. No automatic body-part selection is available yet.</p>
            {!workingCharacter ? (
              <p className="text-sm text-white/60">Choose a character above to access native modeling controls.</p>
            ) : (
              <>
                <button type="button" disabled={!connected || busy} onClick={() => inspectNative()}
                  className="rounded-xl border border-white/20 px-4 py-2.5 text-sm disabled:opacity-35">Read Blender tools</button>
                {nativeTools && (
                  <div className="space-y-4">
                    <label className="block space-y-2 text-xs text-white/60">Vertex Group
                      <select value={nativeGroup} onChange={(event) => { setNativeGroup(event.target.value); setNativeLattice(false); }}
                        className="block w-full rounded-xl border border-white/15 bg-[#171a1e] p-3 text-sm text-white">
                        <option value="">Select a vertex group</option>
                        {nativeTools.vertex_groups.map(group => <option key={group.name} value={group.name}>{group.name} ({group.assigned_vertices} vertices)</option>)}
                      </select>
                    </label>
                    <button type="button" onClick={makeWaistSelection} disabled={!connected || busy}
                      className="rounded-xl border border-white/20 px-4 py-2.5 text-sm disabled:opacity-35">Use selected Blender vertices as Waist group</button>
                    <button type="button" onClick={makeLattice} disabled={!connected || busy || !nativeGroup || nativeLattice}
                      className="rounded-xl border border-white/20 px-4 py-2.5 text-sm disabled:opacity-35">Add native Lattice Modifier</button>
                    {nativeLattice && (
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="space-y-2 text-xs text-white/60">Lattice width factor
                          <input type="number" min="0.75" max="1.25" step="0.05" value={waistWidth}
                            onChange={(event) => setWaistWidth(event.target.value)}
                            className="block w-32 rounded-xl border border-white/15 bg-[#171a1e] p-3 text-sm text-white"/>
                        </label>
                        <button type="button" onClick={applyWaist}
                          disabled={!connected || busy || waistWidth.trim() === '' || !Number.isFinite(Number(waistWidth)) || Number(waistWidth) < 0.75 || Number(waistWidth) > 1.25}
                          className="rounded-xl border border-white/20 px-4 py-3 text-sm disabled:opacity-35">Adjust lattice</button>
                      </div>
                    )}
                    {nativeTools.shape_keys.length > 1 && (
                      <div className="space-y-3 border-t border-white/10 pt-4">
                        <label className="block space-y-2 text-xs text-white/60">Existing Shape Key
                          <select value={nativeShape} onChange={(event) => setNativeShape(event.target.value)}
                            className="block w-full rounded-xl border border-white/15 bg-[#171a1e] p-3 text-sm text-white">
                            {nativeTools.shape_keys.filter(key => key.name !== 'Basis').map(key => <option key={key.name} value={key.name}>{key.name}</option>)}
                          </select>
                        </label>
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="space-y-2 text-xs text-white/60">Value
                            <input type="number" min="0" max="1" step="0.1" value={nativeShapeValue}
                              onChange={(event) => setNativeShapeValue(event.target.value)}
                              className="block w-32 rounded-xl border border-white/15 bg-[#171a1e] p-3 text-sm text-white"/>
                          </label>
                          <button type="button"
                            disabled={!connected || busy || !nativeShape || nativeShapeValue.trim() === '' || !Number.isFinite(Number(nativeShapeValue)) || Number(nativeShapeValue) < 0 || Number(nativeShapeValue) > 1}
                            onClick={() => nativeCommand({action:'set_native_shape_key',name:workingCharacter,shape_key:nativeShape,value:Number(nativeShapeValue)})}
                            className="rounded-xl border border-white/20 px-4 py-3 text-sm disabled:opacity-35">Set Shape Key</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </details>

        <details className="rounded-2xl border border-white/10 bg-[#22262b]">
          <summary className="cursor-pointer select-none px-5 py-5 text-sm text-white/60 md:px-7">Basic scene utilities</summary>
          <div className="border-t border-white/10 p-5 md:p-7 space-y-3">
            <label className="block text-xs text-white/60">Object name
              <input value={objectName} maxLength={80} onChange={(event) => setObjectName(event.target.value)}
                className="mt-2 block w-full rounded-xl border border-white/15 bg-[#171a1e] p-3 text-sm text-white"/>
            </label>
            <button type="button" disabled={!connected || busy || !validName} onClick={() => execute({action:'create_cube',name})}
              className="rounded-xl border border-white/20 px-4 py-2.5 text-sm disabled:opacity-35">Create cube</button>
            <div className="grid grid-cols-3 gap-3">
              {['X','Y','Z'].map((axis,index) =>
                <label key={axis} className="text-xs text-white/60">{axis}
                  <input type="number" value={location[index]} step="0.1"
                    onChange={(event) => setLocation(previous => previous.map((item,i) => i === index ? event.target.value : item))}
                    className="mt-2 block w-full rounded-xl border border-white/15 bg-[#171a1e] p-3 text-sm text-white"/>
                </label>)}
            </div>
            <button type="button" disabled={!connected || busy || !validName || !validCoords}
              onClick={() => execute({action:'move_object',name,location:coords})}
              className="rounded-xl border border-white/20 px-4 py-2.5 text-sm disabled:opacity-35">Move object</button>
          </div>
        </details>

        {connected && <p role="status" aria-live="polite" className="rounded-xl border border-white/10 px-4 py-3 text-xs text-white/65">{message}</p>}
      </div>
    </div>
  );
}
