import VoicePicker from '@/components/studio/VoicePicker.jsx';
import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Send, Mic, Square, X, VolumeX, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '@/lib/AppContext';

// Sound wave animation — idle breathes gently, active pulses energetically
function SoundWave({ isActive, accentColor }) {
  const bars = [3, 5, 8, 11, 7, 4, 9, 6, 10, 4, 7, 5, 8, 4, 6];
  return (
    <div className="flex items-center gap-[2px] h-7">
      {bars.map((baseH, i) => (
        <motion.div
          key={i}
          className="w-[2px] rounded-full"
          style={{
            background: accentColor || 'linear-gradient(to top, #b8860b, #ffd700, #ffec80)',
          }}
          animate={isActive ? {
            // Energetic speaking wave
            height: [baseH, baseH * 3, baseH * 0.5, baseH * 2.2, baseH],
          } : {
            // Gentle idle breathing — always animating, just subtle
            height: [baseH * 0.6, baseH * 1.4, baseH * 0.8, baseH * 1.2, baseH * 0.6],
          }}
          transition={isActive ? {
            duration: 0.5 + i * 0.04,
            repeat: Infinity,
            repeatType: 'mirror',
            ease: 'easeInOut',
            delay: i * 0.03,
          } : {
            duration: 2 + i * 0.15,
            repeat: Infinity,
            repeatType: 'mirror',
            ease: 'easeInOut',
            delay: i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

// Voice recorder
function useVoiceRecorder({ onTranscript }) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = e => chunksRef.current.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file: new File([blob], 'voice.webm', { type: 'audio/webm' }) });
      const transcript = await base44.integrations.Core.TranscribeAudio({ audio_url: file_url });
      onTranscript(transcript);
    };
    mr.start();
    mediaRecorderRef.current = mr;
    setIsRecording(true);
  };

  const stop = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  return { isRecording, start, stop };
}

export default function PersistentAIBar({ agentName = 'production_assistant', label = 'Production Assistant', placeholder = 'Ask the AI...', position = 'top', backgroundColor, accentColor, textColor, iconColor }) {
  const { appContext } = useAppContext();
  const [input, setInput] = useState('');
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechVoice, setSpeechVoice] = useState('Domi');
  const [speechLanguage, setSpeechLanguage] = useState('en');
  const speechSettingsRef = useRef({ voice: speechVoice, language_code: speechLanguage });
  speechSettingsRef.current = { voice: speechVoice, language_code: speechLanguage };
  const [isMuted, setIsMuted] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const audioRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isMutedRef = useRef(false);
  const lastSpokenIdxRef = useRef(-1);
  const lastSpokenContentRef = useRef('');
  const speakDebounceRef = useRef(null);

  // Init conversation
  useEffect(() => {
    const init = async () => {
      try {
        const convs = await base44.agents.listConversations({ agent_name: agentName });
        if (convs[0]) {
          setConversation(convs[0]);
          setMessages(convs[0].messages || []);
        } else {
          const c = await base44.agents.createConversation({ agent_name: agentName, metadata: { name: 'AI Bar Chat' } });
          setConversation(c);
        }
      } catch {}
    };
    init();
  }, [agentName]);

  // Keep isMutedRef in sync so subscription closure always has latest value
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // Subscribe to updates
  useEffect(() => {
    if (!conversation) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      const msgs = data.messages || [];
      setMessages(msgs);
      setIsLoading(false);
      const lastIdx = msgs.length - 1;
      const last = msgs[lastIdx];
      if (last?.role === 'assistant' && last.content && !isMutedRef.current) {
        // Debounce: wait until content stops changing (streaming done) before speaking
        clearTimeout(speakDebounceRef.current);
        speakDebounceRef.current = setTimeout(() => {
          if (last.content !== lastSpokenContentRef.current) {
            lastSpokenContentRef.current = last.content;
            lastSpokenIdxRef.current = lastIdx;
            speakText(last.content);
          }
        }, 1500);
      }
    });
    return () => unsub();
  }, [conversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const audioUnlockedRef = useRef(false);

  // Mobile browsers require a user gesture before audio can play programmatically.
  // Unlock the audio element on first interaction (tap send, mic, mute, or the bar).
  useEffect(() => {
    const unlock = () => {
      if (audioUnlockedRef.current || !audioRef.current) return;
      audioRef.current
        .play()
        .then(() => { audioRef.current.pause(); audioUnlockedRef.current = true; })
        .catch(() => {});
    };
    const opts = { once: false };
    window.addEventListener('touchend', unlock, opts);
    window.addEventListener('click', unlock, opts);
    return () => {
      window.removeEventListener('touchend', unlock);
      window.removeEventListener('click', unlock);
    };
  }, []);

  const speakText = async (text) => {
    try {
      setIsSpeaking(true);
      const res = await base44.functions.invoke('generateSpeech', { text: text.slice(0, 5000), ...speechSettingsRef.current });
      const url = res?.data?.file_url;
      if (url && audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
        audioRef.current.onended = () => setIsSpeaking(false);
      } else {
        setIsSpeaking(false);
      }
    } catch {
      setIsSpeaking(false);
    }
  };

  const handleSend = async (text) => {
    const msg = (text || input).trim();
    if (!msg || !conversation) return;
    setInput('');
    setIsLoading(true);
    setShowMessages(true);

    // Build context prefix so the agent knows where the user is
    const ctxParts = [];
    if (appContext.page) ctxParts.push(`Page: ${appContext.page}`);
    if (appContext.section) ctxParts.push(`Section: ${appContext.section}`);
    if (appContext.detail) ctxParts.push(`Detail: ${appContext.detail}`);
    const contextPrefix = ctxParts.length > 0 ? `[Context — ${ctxParts.join(' | ')}]\n` : '';

    await base44.agents.addMessage(conversation, { role: 'user', content: contextPrefix + msg });
  };

  const { isRecording, start: startRec, stop: stopRec } = useVoiceRecorder({
    onTranscript: async (transcript) => {
      setIsTranscribing(false);
      if (transcript) handleSend(transcript);
    },
  });

  const handleMicClick = () => {
    if (isRecording) {
      stopRec();
      setIsTranscribing(true);
    } else {
      startRec();
    }
  };

  return (
    <>
      <audio ref={audioRef} className="hidden" />
      <style>{`
        .aistage-agent-bar.aistage-agent-text [class*="text-"] { color: var(--aistage-agent-text) !important; }
        .aistage-agent-bar.aistage-agent-icons svg { color: var(--aistage-agent-icon) !important; stroke: currentColor; }
      `}</style>

      {/* Persistent top bar */}
      <div className={`aistage-agent-bar${textColor ? ' aistage-agent-text' : ''}${iconColor ? ' aistage-agent-icons' : ''} fixed left-0 right-0 z-[300] bg-black/90 backdrop-blur-md ${position === 'bottom' ? 'bottom-0 border-t' : 'top-0 border-b'}`} style={position === 'bottom' ? { paddingBottom: 'env(safe-area-inset-bottom)', height: 'calc(52px + env(safe-area-inset-bottom))', backgroundColor: backgroundColor || undefined, borderColor: accentColor || undefined, '--aistage-agent-text': textColor || undefined, '--aistage-agent-icon': iconColor || undefined } : { paddingTop: 'env(safe-area-inset-top)', height: 'calc(52px + env(safe-area-inset-top))', backgroundColor: backgroundColor || undefined, borderColor: accentColor || undefined, '--aistage-agent-text': textColor || undefined, '--aistage-agent-icon': iconColor || undefined }} aria-label={label}>
        <div className="flex items-center h-[52px] gap-2" style={{ paddingLeft: '8px', paddingRight: 'calc(8px + env(safe-area-inset-right))' }}>

          {/* Sound wave / mode toggle */}
          <button
            onClick={() => setShowMessages(v => !v)}
            className="flex items-center gap-1.5 px-2 h-9 rounded-xl bg-black/40 border border-yellow-600/40 flex-shrink-0"
          >
            <SoundWave isActive={isSpeaking || isLoading} accentColor={accentColor} />
          </button>

          {/* Text input */}
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={placeholder || label || 'Ask the AI...'}
            className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs placeholder-white/70 focus:outline-none focus:border-yellow-500/50 h-9"
            disabled={isLoading}
          />

          {/* Send */}
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading || !conversation}
            className="w-9 h-9 rounded-xl bg-yellow-400 hover:opacity-90 disabled:opacity-40 flex items-center justify-center flex-shrink-0 transition-colors"
            style={{ backgroundColor: accentColor || undefined }}
          >
            <Send size={14} className="text-black" />
          </button>

          {/* Mic */}
          <button
            onClick={handleMicClick}
            disabled={isTranscribing || isLoading}
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40 ${
              isRecording ? 'bg-red-500 hover:bg-red-400 animate-pulse' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {isRecording ? <Square size={14} className="text-white fill-white" /> : <Mic size={14} className="text-white" />}
          </button>

          {/* Mute toggle */}
          <button
            onClick={() => setIsMuted(v => !v)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
              isMuted ? 'bg-red-500/80 hover:bg-red-500' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            {isMuted ? <VolumeX size={14} className="text-white" /> : <Volume2 size={14} className="text-white" />}
          </button>
        </div>
      </div>

      {/* Chat panel dropdown */}
      <AnimatePresence>
        {showMessages && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={`aistage-agent-bar${textColor ? ' aistage-agent-text' : ''}${iconColor ? ' aistage-agent-icons' : ''} fixed left-0 right-0 z-[290] bg-black/95 backdrop-blur-md border-b border-yellow-600/20 max-h-[60vh] overflow-y-auto`}
            style={position === 'bottom' ? { bottom: 'calc(52px + env(safe-area-inset-bottom))', '--aistage-agent-text': textColor || undefined, '--aistage-agent-icon': iconColor || undefined } : { top: 'calc(52px + env(safe-area-inset-top))', '--aistage-agent-text': textColor || undefined, '--aistage-agent-icon': iconColor || undefined }}
          >
            <div className="flex justify-end px-4 pt-3 sticky top-0 bg-black/95 z-10">
              <button onClick={() => setShowMessages(false)} className="text-white hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="px-4 pb-4 space-y-3">
              {messages.length === 0 ? (
                <p className="text-white text-xs text-center py-6">Ask me anything about your production!</p>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div style={msg.role === 'user' ? { backgroundColor: accentColor || '#facc15' } : undefined} className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                      msg.role === 'user' ? 'text-black' : 'bg-white/10 text-white'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex gap-2">
                  <div className="bg-white/10 rounded-2xl px-3 py-2 flex items-center gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} className="w-1.5 h-1.5 bg-yellow-400 rounded-full"
                        animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                    ))}
                  </div>
                </div>
              )}
              <div className="text-white"><VoicePicker value={speechVoice} onChange={setSpeechVoice} language={speechLanguage} onLanguageChange={setSpeechLanguage} /></div>
              <div ref={messagesEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
