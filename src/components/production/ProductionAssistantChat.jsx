import VoicePicker from '@/components/studio/VoicePicker.jsx';
import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { MessageCircle, X, Send, Volume2, Loader2, VolumeX, Mic, MicOff } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function ProductionAssistantChat({ episodeTitle, dossierTitle, dossierCategory }) {
  const [open, setOpen] = useState(false);
  const [speechVoice, setSpeechVoice] = useState('Rachel');
  const [speechLanguage, setSpeechLanguage] = useState('en');
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const audioRef = useRef(null);
  const bottomRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Create conversation on first open
  useEffect(() => {
    if (!open || conversation) return;
    const init = async () => {
      const contextParts = [];
      if (dossierTitle) contextParts.push(`Series/Dossier: "${dossierTitle}"`);
      if (dossierCategory) contextParts.push(`Category: ${dossierCategory}`);
      if (episodeTitle) contextParts.push(`Episode: "${episodeTitle}"`);

      const conv = await base44.agents.createConversation({
        agent_name: 'production_assistant',
        metadata: { name: episodeTitle || 'Production Session' },
      });

      // Send context silently as first system message so the agent knows where it is
      if (contextParts.length > 0) {
        await base44.agents.addMessage(conv, {
          role: 'user',
          content: `[Context] The user is currently working on the following production:\n${contextParts.join('\n')}\n\nPlease greet them and offer to help with this specific production.`,
        });
      }

      setConversation(conv);
      setMessages(conv.messages || []);
    };
    init();
  }, [open]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });
    return unsub;
  }, [conversation?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);



  const stopFlagRef = useRef(false);

  const speakMessage = async (msg) => {
    if (!msg.content) return;
    // Stop any current playback
    stopFlagRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    // Reset stop flag for new playback
    stopFlagRef.current = false;
    setSpeakingMsgId(msg.id);

    try {
      const result = await base44.integrations.Core.GenerateSpeech({
        text: msg.content.slice(0, 5000),
        voice: speechVoice,
        language_code: speechLanguage,
      });
      if (stopFlagRef.current) return;
      const audio = new Audio(result.url);
      audioRef.current = audio;
      audio.play();
      audio.onended = () => {
        audioRef.current = null;
        setSpeakingMsgId(null);
      };
    } catch {
      audioRef.current = null;
      setSpeakingMsgId(null);
    }
  };

  const stopSpeaking = () => {
    stopFlagRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeakingMsgId(null);
  };

  const sendMessage = async () => {
    if (!input.trim() || !conversation || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    await base44.agents.addMessage(conversation, { role: 'user', content: text });
    setSending(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setTranscribing(true);
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });
          const transcript = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
          if (transcript) setInput(prev => (prev + ' ' + transcript).trim());
        } catch { /* ignore */ } finally {
          setTranscribing(false);
        }
      };
      mediaRecorder.start();
      setRecording(true);
    } catch { /* mic denied */ }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setRecording(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-50 w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-900/40 transition-colors"
        >
          <MessageCircle size={22} />
        </button>
      )}

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed left-0 right-0 z-[60] bg-[#111] border-t border-white/10 flex flex-col"
            style={{ bottom: '56px', top: '0', maxHeight: 'calc(100vh - 56px)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <p className="text-white text-sm font-light tracking-wide">Production Assistant</p>
              </div>
              <div className="flex items-center gap-2">
                {speakingMsgId && (
                  <button onClick={stopSpeaking} className="p-1 text-red-400 hover:text-red-300">
                    <VolumeX size={18} />
                  </button>
                )}
                <button onClick={() => { setOpen(false); stopSpeaking(); }} className="p-1 text-white hover:text-white">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="px-4 py-2 text-white"><VoicePicker value={speechVoice} onChange={setSpeechVoice} language={speechLanguage} onLanguageChange={setSpeechLanguage} /></div>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {!conversation && (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={20} className="text-white animate-spin" />
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={msg.id || i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm font-light leading-relaxed relative group
                    ${msg.role === 'user'
                      ? 'bg-white/10 text-white rounded-br-sm'
                      : 'bg-red-600/10 border border-red-600/20 text-white/80 rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                    {msg.role === 'assistant' && msg.content && (
                      <button
                        onClick={() => speakingMsgId === msg.id ? stopSpeaking() : speakMessage(msg)}
                        className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-[#222] border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {speakingMsgId === msg.id
                          ? <VolumeX size={11} className="text-red-400" />
                          : <Volume2 size={11} className="text-white" />
                        }
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-red-600/10 border border-red-600/20 rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-red-400/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-red-400/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-red-400/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-white/10 flex gap-2 flex-shrink-0">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask anything about your production..."
                className="flex-1 bg-white/15 border border-white/30 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/50 outline-none focus:border-white/50"
              />
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
                  recording ? 'bg-red-600 animate-pulse' : 'bg-white/20 hover:bg-white/30'
                } disabled:opacity-30`}
              >
                {transcribing
                  ? <Loader2 size={16} className="text-white animate-spin" />
                  : recording
                    ? <MicOff size={16} className="text-white" />
                    : <Mic size={16} className="text-white" />
                }
              </button>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || !conversation || sending}
                className="w-10 h-10 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-white/20 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
              >
                <Send size={16} className="text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
