import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Send, Bot, User } from 'lucide-react';

import ReactMarkdown from 'react-markdown';

export default function AgentChat({ agentName = 'production_assistant', onClose, initialContext = {} }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Create or load conversation on mount
  useEffect(() => {
    const initConversation = async () => {
      try {
        console.log('Initializing conversation with agent:', agentName);
        const conversations = await base44.agents.listConversations({ agent_name: agentName });
        console.log('Existing conversations:', conversations);
        const existingConversation = conversations[0];
        
        if (existingConversation) {
          setConversation(existingConversation);
          setMessages(existingConversation.messages || []);
        } else {
          console.log('Creating new conversation...');
          const newConversation = await base44.agents.createConversation({
            agent_name: agentName,
            metadata: {
              name: 'Production Assistant Chat',
              description: 'AI-powered production assistance',
              ...initialContext,
            },
          });
          console.log('New conversation created:', newConversation);
          setConversation(newConversation);
          setMessages(newConversation.messages || []);
        }
      } catch (err) {
        console.error('Failed to initialize conversation:', err);
        setError(err.message || 'Failed to load chat');
      }
    };

    initConversation();
  }, [agentName]);

  // Subscribe to conversation updates
  useEffect(() => {
    if (!conversation) return;

    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });

    return () => unsubscribe();
  }, [conversation]);

  const handleSend = async () => {
    if (!input.trim() || !conversation) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    try {
      await base44.agents.addMessage(conversation, {
        role: 'user',
        content: userMessage,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      setInput(userMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl h-[90vh] sm:h-[70vh] bg-neutral-900 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-neutral-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
              <Bot className="text-black" size={20} />
            </div>
            <div>
              <h3 className="text-white font-semibold">Production Assistant</h3>
              <p className="text-white text-xs">AI-powered help for your creative workflow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-6 text-center">
            <p className="text-red-400 text-sm mb-4">Failed to load chat: {error}</p>
            <button onClick={onClose} className="px-4 py-2 bg-white/10 rounded-lg text-white text-sm">Close</button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!error && messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-white">
                <Bot size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-sm">Ask me anything about your production!</p>
              </div>
            </div>
          ) : !error && (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <Bot size={16} className="text-black" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-amber-500 text-black'
                      : 'bg-white/10 text-white'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <ReactMarkdown
                      className="text-sm prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                      components={{
                        p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                        ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                        ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                        li: ({ children }) => <li className="my-0.5">{children}</li>,
                        code: ({ inline, children }) => (
                          <code className={inline ? 'px-1 py-0.5 rounded bg-white/10 text-xs' : 'block bg-white/5 p-2 rounded my-2 text-xs'}>
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <User size={16} className="text-white" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-white/10 bg-neutral-800/50">
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask for help with your production..."
              className="flex-1 bg-white/5 text-white placeholder:text-white rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="w-12 h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <Send size={20} className="text-black" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}