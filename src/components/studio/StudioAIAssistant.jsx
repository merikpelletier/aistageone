import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { BookOpen, BookmarkPlus, Bot, Check, Loader2, Pencil, Plus, Save, Search, Send, Sparkles, Trash2, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/api/base44Client';
import { useAppContext } from '@/lib/AppContext';

const assistantModes = [
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'guide', label: 'Guide' },
  { value: 'creative', label: 'Creative' },
  { value: 'production', label: 'Production' },
];

const journalTypes = ['Idea', 'Decision', 'Character', 'Story', 'Visual', 'Dialogue', 'Production', 'Marketing', 'To Do', 'Reference'];

const modeGuidance = {
  hybrid: 'Combine factual AISTAGE.ONE guidance with creative and production help. Knowledge is the source of truth for platform facts, but it must not limit original creative ideas or practical production suggestions.',
  guide: 'Prioritize factual AISTAGE.ONE guidance from Knowledge and current Studio context. Explain documented tools, limits, and workflows without inventing platform behavior.',
  creative: 'Act as an imaginative creative collaborator for story, dialogue, visual concepts, prompts, characters, sets, marketing, presentation, and artistic problem-solving. Knowledge defines platform facts but does not limit creative proposals.',
  production: 'Focus on practical next steps for the active Studio task. Use Knowledge for real AISTAGE.ONE capabilities and provide concrete production preparation, prompts, structure, and workflow recommendations.',
};

const starter = {
  role: 'assistant',
  content: 'I’m connected to your AI Stage One Studio context. Tell me what you are working on and I’ll help you prepare the next step.',
};

async function readInvokeError(invokeError) {
  if (!invokeError) return '';
  try {
    const response = invokeError?.context;
    if (response && typeof response.clone === 'function') {
      const cloned = response.clone();
      const payload = await cloned.json().catch(() => null);
      if (payload?.error) return String(payload.error);
      if (payload?.message) return String(payload.message);
    }
  } catch (error) {
    console.warn('Could not parse Studio AI Assistant error response.', error);
  }
  return invokeError?.message || 'Assistant request failed.';
}

function journalTitle(content) {
  return String(content || '')
    .replace(/[#*_`>\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Journal note';
}

function tagsFromInput(value) {
  return String(value || '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20);
}

function tagsToInput(tags) {
  return Array.isArray(tags) ? tags.join(', ') : '';
}

function AssistantMarkdown({ children }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 className="mt-3 mb-2 text-lg font-bold leading-snug first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="mt-3 mb-2 text-base font-bold leading-snug first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="mt-3 mb-1.5 text-sm font-bold leading-snug first:mt-0">{children}</h3>,
        p: ({ children }) => <p className="my-2 leading-6 first:mt-0 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
        li: ({ children }) => <li className="pl-0.5 leading-6">{children}</li>,
        strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
        hr: () => <hr className="my-3 border-white/15" />,
        blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-teal-400/60 pl-3 text-white/75">{children}</blockquote>,
        code: ({ children }) => <code className="bg-black/35 px-1 py-0.5 text-[0.92em] text-teal-200">{children}</code>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

export default function StudioAIAssistant() {
  const location = useLocation();
  const { appContext } = useAppContext();
  const visible = location.pathname.toLowerCase() === '/studio';

  const [toolbarHost, setToolbarHost] = useState(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState('chat');
  const [messages, setMessages] = useState([starter]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [model, setModel] = useState('');
  const [mode, setMode] = useState('hybrid');

  const [journalEntries, setJournalEntries] = useState([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState('');
  const [journalSearch, setJournalSearch] = useState('');
  const [journalTypeFilter, setJournalTypeFilter] = useState('All');
  const [journalProjectFilter, setJournalProjectFilter] = useState('All');
  const [journalEditor, setJournalEditor] = useState(null);
  const [journalSaving, setJournalSaving] = useState(false);
  const [savedJournalIndex, setSavedJournalIndex] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    const locateToolbar = () => {
      const candidates = Array.from(document.querySelectorAll('aside'));
      const studioAside = candidates.find((node) => node.className?.toString?.().includes('border-r')) || null;
      setToolbarHost(studioAside);
    };
    locateToolbar();
    const id = window.setInterval(locateToolbar, 1000);
    return () => window.clearInterval(id);
  }, [visible]);

  useEffect(() => {
    if (panel !== 'chat' || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending, open, panel]);

  const context = useMemo(() => ({
    ...appContext,
    pathname: location.pathname,
    search: location.search,
    title: document?.title || '',
    assistant_mode: mode,
    assistant_mode_guidance: modeGuidance[mode] || modeGuidance.hybrid,
  }), [appContext, location.pathname, location.search, mode]);

  const loadJournal = async () => {
    setJournalLoading(true);
    setJournalError('');
    try {
      const { data, error: loadError } = await supabase
        .from('creator_journal_entry')
        .select('id,title,content,entry_type,project_name,tags,use_with_ai,studio_context,created_at,updated_at')
        .order('updated_at', { ascending: false });
      if (loadError) throw loadError;
      setJournalEntries(data || []);
    } catch (err) {
      setJournalError(err instanceof Error ? err.message : 'Could not load Journal.');
    } finally {
      setJournalLoading(false);
    }
  };

  useEffect(() => {
    if (open && panel === 'journal') loadJournal();
  }, [open, panel]);

  const projectOptions = useMemo(() => {
    const projects = [...new Set(journalEntries.map((entry) => entry.project_name).filter(Boolean))];
    return projects.sort((a, b) => a.localeCompare(b));
  }, [journalEntries]);

  const filteredJournalEntries = useMemo(() => {
    const search = journalSearch.trim().toLowerCase();
    return journalEntries.filter((entry) => {
      if (journalTypeFilter !== 'All' && entry.entry_type !== journalTypeFilter) return false;
      if (journalProjectFilter !== 'All' && entry.project_name !== journalProjectFilter) return false;
      if (!search) return true;
      const haystack = [entry.title, entry.content, entry.entry_type, entry.project_name, ...(entry.tags || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [journalEntries, journalSearch, journalTypeFilter, journalProjectFilter]);

  const openJournalEditor = (values = {}) => {
    setJournalError('');
    setJournalEditor({
      id: values.id || null,
      title: values.title || '',
      content: values.content || '',
      entry_type: values.entry_type || 'Idea',
      project_name: values.project_name || '',
      tags_input: tagsToInput(values.tags),
      use_with_ai: values.use_with_ai !== false,
      studio_context: values.studio_context || context,
      source_index: values.source_index ?? null,
    });
  };

  const prepareJournalSave = (message, index, event) => {
    const bubble = event.currentTarget.closest('[data-assistant-message]');
    const selection = window.getSelection();
    const selectionInsideBubble = selection
      && selection.rangeCount > 0
      && bubble
      && bubble.contains(selection.anchorNode)
      && bubble.contains(selection.focusNode);
    const selectedText = selectionInsideBubble ? selection.toString().trim() : '';
    const content = selectedText || message.content;
    openJournalEditor({
      title: journalTitle(content),
      content,
      entry_type: 'Idea',
      project_name: context.project_name || context.project || '',
      tags: [],
      use_with_ai: true,
      studio_context: context,
      source_index: index,
    });
  };

  const saveJournalEditor = async () => {
    if (!journalEditor?.content?.trim() || journalSaving) return;
    setJournalSaving(true);
    setJournalError('');
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth?.user) throw new Error('You must be signed in to save to Journal.');

      const payload = {
        title: journalEditor.title.trim() || journalTitle(journalEditor.content),
        content: journalEditor.content.trim(),
        entry_type: journalEditor.entry_type,
        project_name: journalEditor.project_name.trim() || null,
        tags: tagsFromInput(journalEditor.tags_input),
        use_with_ai: journalEditor.use_with_ai,
        studio_context: journalEditor.studio_context || context,
      };

      if (journalEditor.id) {
        const { error: updateError } = await supabase
          .from('creator_journal_entry')
          .update(payload)
          .eq('id', journalEditor.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('creator_journal_entry')
          .insert({ ...payload, user_id: auth.user.id });
        if (insertError) throw insertError;
      }

      window.getSelection()?.removeAllRanges();
      if (journalEditor.source_index !== null) {
        setSavedJournalIndex(journalEditor.source_index);
        window.setTimeout(() => setSavedJournalIndex((current) => current === journalEditor.source_index ? null : current), 2200);
      }
      setJournalEditor(null);
      await loadJournal();
    } catch (err) {
      setJournalError(err instanceof Error ? err.message : 'Could not save Journal entry.');
    } finally {
      setJournalSaving(false);
    }
  };

  const toggleJournalAI = async (entry) => {
    setJournalError('');
    const next = !entry.use_with_ai;
    setJournalEntries((current) => current.map((item) => item.id === entry.id ? { ...item, use_with_ai: next } : item));
    const { error: updateError } = await supabase
      .from('creator_journal_entry')
      .update({ use_with_ai: next })
      .eq('id', entry.id);
    if (updateError) {
      setJournalEntries((current) => current.map((item) => item.id === entry.id ? { ...item, use_with_ai: entry.use_with_ai } : item));
      setJournalError(updateError.message);
    }
  };

  const deleteJournalEntry = async (entry) => {
    if (!window.confirm(`Delete “${entry.title}”?`)) return;
    setJournalError('');
    const { error: deleteError } = await supabase
      .from('creator_journal_entry')
      .delete()
      .eq('id', entry.id);
    if (deleteError) {
      setJournalError(deleteError.message);
      return;
    }
    setJournalEntries((current) => current.filter((item) => item.id !== entry.id));
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const nextUser = { role: 'user', content: text };
    const history = messages.filter((m) => ['user', 'assistant'].includes(m.role)).slice(-16);
    setMessages((current) => [...current, nextUser]);
    setDraft('');
    setSending(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('studio-ai-assistant', {
        body: { message: text, history, context, mode },
      });
      if (invokeError) throw new Error(await readInvokeError(invokeError));
      if (data?.error || data?.ok === false) throw new Error(data?.error || 'Assistant request failed.');
      if (!data?.text) throw new Error('Assistant returned no response.');
      setModel(data?.model || '');
      setMessages((current) => [...current, { role: 'assistant', content: data.text }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant request failed.');
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setMessages([starter]);
    setError('');
    setModel('');
    setJournalError('');
  };

  if (!visible) return null;

  const toolbarButton = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      title="AI Assistant"
      aria-label="Open AI Assistant"
      className="w-full min-h-[46px] px-3 flex items-center gap-2 bg-teal-500 hover:bg-teal-400 text-black border-t border-black/10 font-bold text-[11px]"
    >
      <Sparkles size={14} className="flex-shrink-0" />
      <span className="truncate">AI Assistant</span>
    </button>
  );

  return (
    <>
      {toolbarHost ? createPortal(toolbarButton, toolbarHost) : null}

      {!toolbarHost && (
        <button
          onClick={() => setOpen(true)}
          className="lg:hidden fixed z-[6200] left-3 bottom-[74px] h-11 px-3 bg-teal-500 text-black font-bold text-xs flex items-center gap-2 shadow-lg"
        >
          <Sparkles size={14} /> AI
        </button>
      )}

      {open && (
        <aside className="fixed z-[9050] top-14 right-0 bottom-0 w-full sm:w-[460px] bg-[#17191d] text-white border-l border-white/10 shadow-2xl flex flex-col">
          <div className="h-14 px-4 flex items-center justify-between bg-[#202328] border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-teal-500 text-black flex items-center justify-center">
                {panel === 'chat' ? <Bot size={17} /> : <BookOpen size={17} />}
              </div>
              <div className="min-w-0">
                <div className="text-[9px] uppercase tracking-[0.2em] text-white/45">AISTAGE.ONE</div>
                <div className="font-bold text-sm truncate">{panel === 'chat' ? 'AI Assistant' : 'Creator Journal'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {panel === 'chat' ? (
                <button onClick={reset} className="w-9 h-9 flex items-center justify-center bg-white/10" title="New conversation"><Trash2 size={16} /></button>
              ) : (
                <button onClick={() => openJournalEditor()} className="h-9 px-3 flex items-center gap-1.5 bg-teal-500 text-black text-xs font-bold" title="New journal entry"><Plus size={14} /> New</button>
              )}
              <button onClick={() => setOpen(false)} className="w-9 h-9 flex items-center justify-center bg-white/10" title="Close"><X size={18} /></button>
            </div>
          </div>

          <div className="grid grid-cols-2 border-b border-white/10 bg-[#202328] flex-shrink-0">
            <button onClick={() => setPanel('chat')} className={`h-10 text-xs font-bold ${panel === 'chat' ? 'bg-teal-500 text-black' : 'text-white/55 hover:text-white'}`}>Assistant</button>
            <button onClick={() => setPanel('journal')} className={`h-10 text-xs font-bold ${panel === 'journal' ? 'bg-teal-500 text-black' : 'text-white/55 hover:text-white'}`}>Journal</button>
          </div>

          {panel === 'chat' ? (
            <>
              <div className="px-4 py-3 border-b border-white/10 bg-black/20 text-[11px] leading-5 text-white/55 flex-shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 truncate">
                    Context: <span className="text-white/80">{appContext?.section || appContext?.page || 'Studio'}</span>
                    {model ? <span className="ml-2 text-teal-300">· {model}</span> : null}
                  </div>
                  <label className="flex flex-shrink-0 items-center gap-2 text-white/45">
                    <span>Mode</span>
                    <select
                      value={mode}
                      onChange={(event) => setMode(event.target.value)}
                      disabled={sending}
                      className="h-7 border border-white/15 bg-[#17191d] px-2 text-[11px] font-semibold text-white/85 outline-none focus:border-teal-400 disabled:opacity-50"
                      aria-label="Assistant mode"
                    >
                      {assistantModes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
                <div className="mt-1 text-white/35">Read / advise / prepare only. Execution permissions are not enabled yet.</div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      data-assistant-message={message.role === 'assistant' ? index : undefined}
                      className={`max-w-[88%] px-3 py-2 text-sm leading-6 ${message.role === 'user' ? 'bg-teal-500 text-black whitespace-pre-wrap' : 'bg-white/7 border border-white/10 text-white/90'}`}
                    >
                      {message.role === 'assistant' ? <AssistantMarkdown>{message.content}</AssistantMarkdown> : message.content}
                      {message.role === 'assistant' && index > 0 && (
                        <div className="mt-2 border-t border-white/10 pt-2 flex justify-end">
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={(event) => prepareJournalSave(message, index, event)}
                            className="flex items-center gap-1.5 text-[11px] font-semibold text-white/45 hover:text-teal-300"
                            title="Select text in this reply to classify and save only that section. With no selection, the whole reply is prepared for Journal."
                          >
                            {savedJournalIndex === index ? <><Check size={12} /> Saved to Journal</> : <><BookmarkPlus size={12} /> Save to Journal</>}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-white/7 border border-white/10 px-3 py-2 flex items-center gap-2 text-sm text-white/60">
                      <Loader2 size={15} className="animate-spin" /> Thinking…
                    </div>
                  </div>
                )}
                {error && <div className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-200">{error}</div>}
                {journalError && <div className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-200">Journal: {journalError}</div>}
              </div>

              <div className="p-3 border-t border-white/10 bg-[#202328] flex-shrink-0">
                <div className="flex items-end gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Ask about what you’re doing in the Studio…"
                    rows={3}
                    className="flex-1 resize-none border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-teal-400"
                  />
                  <button
                    onClick={send}
                    disabled={sending || !draft.trim()}
                    className="w-11 h-11 bg-teal-500 hover:bg-teal-400 text-black flex items-center justify-center disabled:opacity-40"
                    title="Send"
                  >
                    {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 border-b border-white/10 bg-black/20 space-y-2 flex-shrink-0">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
                  <input
                    value={journalSearch}
                    onChange={(event) => setJournalSearch(event.target.value)}
                    placeholder="Search journal..."
                    className="w-full h-9 border border-white/15 bg-black/30 pl-9 pr-3 text-xs text-white outline-none focus:border-teal-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={journalTypeFilter} onChange={(event) => setJournalTypeFilter(event.target.value)} className="h-8 border border-white/15 bg-[#17191d] px-2 text-xs text-white/80 outline-none">
                    <option>All</option>
                    {journalTypes.map((type) => <option key={type}>{type}</option>)}
                  </select>
                  <select value={journalProjectFilter} onChange={(event) => setJournalProjectFilter(event.target.value)} className="h-8 border border-white/15 bg-[#17191d] px-2 text-xs text-white/80 outline-none">
                    <option>All</option>
                    {projectOptions.map((project) => <option key={project}>{project}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {journalLoading && <div className="py-10 flex items-center justify-center gap-2 text-sm text-white/45"><Loader2 size={16} className="animate-spin" /> Loading Journal…</div>}
                {!journalLoading && filteredJournalEntries.length === 0 && (
                  <div className="py-10 text-center text-sm text-white/40">No Journal entries match this view.</div>
                )}
                {!journalLoading && filteredJournalEntries.map((entry) => (
                  <article key={entry.id} className="border border-white/10 bg-white/5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="bg-teal-500/15 text-teal-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{entry.entry_type || 'Idea'}</span>
                          {entry.project_name && <span className="bg-white/8 text-white/55 px-2 py-0.5 text-[10px]">{entry.project_name}</span>}
                        </div>
                        <h3 className="text-sm font-bold text-white leading-5">{entry.title}</h3>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openJournalEditor(entry)} className="w-8 h-8 flex items-center justify-center bg-white/8 text-white/55 hover:text-white" title="Edit"><Pencil size={13} /></button>
                        <button onClick={() => deleteJournalEntry(entry)} className="w-8 h-8 flex items-center justify-center bg-white/8 text-white/55 hover:text-red-300" title="Delete"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/65 whitespace-pre-wrap line-clamp-5">{entry.content}</p>
                    {Array.isArray(entry.tags) && entry.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">{entry.tags.map((tag) => <span key={tag} className="border border-white/10 px-1.5 py-0.5 text-[10px] text-white/45">#{tag}</span>)}</div>
                    )}
                    <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between gap-3">
                      <span className="text-[10px] text-white/30">{entry.updated_at ? new Date(entry.updated_at).toLocaleDateString() : ''}</span>
                      <label className="flex items-center gap-2 text-[11px] text-white/55 cursor-pointer">
                        <input type="checkbox" checked={entry.use_with_ai !== false} onChange={() => toggleJournalAI(entry)} className="accent-teal-400" /> Use with AI
                      </label>
                    </div>
                  </article>
                ))}
                {journalError && <div className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-200">{journalError}</div>}
              </div>
            </>
          )}
        </aside>
      )}

      {journalEditor && createPortal(
        <div className="fixed inset-0 z-[9300] bg-black/70 flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !journalSaving) setJournalEditor(null); }}>
          <div className="w-full max-w-[560px] max-h-[88vh] overflow-y-auto bg-[#202328] border border-white/15 text-white shadow-2xl">
            <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between">
              <div className="font-bold text-sm">{journalEditor.id ? 'Edit Journal Entry' : 'Save to Journal'}</div>
              <button onClick={() => !journalSaving && setJournalEditor(null)} className="w-8 h-8 flex items-center justify-center bg-white/8" title="Close"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <label className="block">
                <span className="block mb-1 text-[11px] font-bold uppercase tracking-wide text-white/45">Title</span>
                <input value={journalEditor.title} onChange={(event) => setJournalEditor((current) => ({ ...current, title: event.target.value }))} className="w-full h-10 border border-white/15 bg-black/30 px-3 text-sm text-white outline-none focus:border-teal-400" />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block mb-1 text-[11px] font-bold uppercase tracking-wide text-white/45">Type</span>
                  <select value={journalEditor.entry_type} onChange={(event) => setJournalEditor((current) => ({ ...current, entry_type: event.target.value }))} className="w-full h-10 border border-white/15 bg-[#17191d] px-3 text-sm text-white outline-none focus:border-teal-400">
                    {journalTypes.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block mb-1 text-[11px] font-bold uppercase tracking-wide text-white/45">Project</span>
                  <input value={journalEditor.project_name} onChange={(event) => setJournalEditor((current) => ({ ...current, project_name: event.target.value }))} placeholder="Optional" className="w-full h-10 border border-white/15 bg-black/30 px-3 text-sm text-white outline-none focus:border-teal-400" />
                </label>
              </div>

              <label className="block">
                <span className="block mb-1 text-[11px] font-bold uppercase tracking-wide text-white/45">Tags</span>
                <input value={journalEditor.tags_input} onChange={(event) => setJournalEditor((current) => ({ ...current, tags_input: event.target.value }))} placeholder="character, episode 3, continuity" className="w-full h-10 border border-white/15 bg-black/30 px-3 text-sm text-white outline-none focus:border-teal-400" />
              </label>

              <label className="block">
                <span className="block mb-1 text-[11px] font-bold uppercase tracking-wide text-white/45">Journal Note</span>
                <textarea value={journalEditor.content} onChange={(event) => setJournalEditor((current) => ({ ...current, content: event.target.value }))} rows={10} className="w-full resize-y border border-white/15 bg-black/30 px-3 py-2 text-sm leading-6 text-white outline-none focus:border-teal-400" />
              </label>

              <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                <input type="checkbox" checked={journalEditor.use_with_ai} onChange={(event) => setJournalEditor((current) => ({ ...current, use_with_ai: event.target.checked }))} className="accent-teal-400" />
                Use this entry as context for the AI Assistant
              </label>

              {journalError && <div className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-200">{journalError}</div>}
            </div>
            <div className="p-3 border-t border-white/10 flex justify-end gap-2">
              <button onClick={() => setJournalEditor(null)} disabled={journalSaving} className="h-10 px-4 bg-white/8 text-sm text-white/70 disabled:opacity-40">Cancel</button>
              <button onClick={saveJournalEditor} disabled={journalSaving || !journalEditor.content.trim()} className="h-10 px-4 bg-teal-500 hover:bg-teal-400 text-black text-sm font-bold flex items-center gap-2 disabled:opacity-40">
                {journalSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
