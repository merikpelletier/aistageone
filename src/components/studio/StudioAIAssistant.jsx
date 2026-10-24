import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { Bot, Loader2, Send, Sparkles, Trash2, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/api/base44Client';
import { useAppContext } from '@/lib/AppContext';

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
        code: ({ children }) => <code className="rounded-sm bg-black/35 px-1 py-0.5 text-[0.92em] text-teal-200">{children}</code>,
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
  const [messages, setMessages] = useState([starter]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [model, setModel] = useState('');
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
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending, open]);

  const context = useMemo(() => ({
    ...appContext,
    pathname: location.pathname,
    search: location.search,
    title: document?.title || '',
  }), [appContext, location.pathname, location.search]);

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
        body: {
          message: text,
          history,
          context,
        },
      });

      if (invokeError) {
        throw new Error(await readInvokeError(invokeError));
      }

      if (data?.error || data?.ok === false) {
        throw new Error(data?.error || 'Assistant request failed.');
      }

      if (!data?.text) {
        throw new Error('Assistant returned no response.');
      }

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
        <aside className="fixed z-[9050] top-14 right-0 bottom-0 w-full sm:w-[420px] bg-[#17191d] text-white border-l border-white/10 shadow-2xl flex flex-col">
          <div className="h-14 px-4 flex items-center justify-between bg-[#202328] border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-teal-500 text-black flex items-center justify-center"><Bot size={17} /></div>
              <div className="min-w-0">
                <div className="text-[9px] uppercase tracking-[0.2em] text-white/45">AISTAGE.ONE</div>
                <div className="font-bold text-sm truncate">AI Assistant</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={reset} className="w-9 h-9 flex items-center justify-center bg-white/10" title="New conversation"><Trash2 size={16} /></button>
              <button onClick={() => setOpen(false)} className="w-9 h-9 flex items-center justify-center bg-white/10" title="Close"><X size={18} /></button>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-white/10 bg-black/20 text-[11px] leading-5 text-white/55 flex-shrink-0">
            Context: <span className="text-white/80">{appContext?.section || appContext?.page || 'Studio'}</span>
            {model ? <span className="ml-2 text-teal-300">· {model}</span> : null}
            <div className="mt-1 text-white/35">Read / advise / prepare only. Execution permissions are not enabled yet.</div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] px-3 py-2 text-sm leading-6 ${message.role === 'user' ? 'bg-teal-500 text-black whitespace-pre-wrap' : 'bg-white/7 border border-white/10 text-white/90'}`}>
                  {message.role === 'assistant'
                    ? <AssistantMarkdown>{message.content}</AssistantMarkdown>
                    : message.content}
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
            {error && (
              <div className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-200">{error}</div>
            )}
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
        </aside>
      )}
    </>
  );
}
