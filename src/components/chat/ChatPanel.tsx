import { useState, useRef, useEffect } from 'react';
import { useAgentStore, useActiveAgent, useActiveMessages } from '../../stores/agents';
import { useOpenClaw } from '../../hooks/useOpenClaw';
import { cn } from '../../lib/utils';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  agentName?: string;
  agentEmoji?: string;
}

function ChatMessage({ role, content, agentName, agentEmoji }: ChatMessageProps) {
  return (
    <div
      className={cn(
        'flex gap-3 p-4',
        role === 'user' ? 'justify-end' : 'justify-start'
      )}
    >
      {role === 'assistant' && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-sm">{agentEmoji || '🤖'}</span>
        </div>
      )}
      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-4 py-2',
          role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        {role === 'assistant' && agentName && (
          <div className="text-xs text-muted-foreground mb-1">{agentName}</div>
        )}
        <div className="whitespace-pre-wrap">{content || '...'}</div>
      </div>
      {role === 'user' && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
          <span className="text-sm">👤</span>
        </div>
      )}
    </div>
  );
}

export function ChatPanel() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const { isLoading } = useAgentStore();
  const { isConnected, isConnecting, connect, sendMessage } = useOpenClaw();
  const activeAgent = useActiveAgent();
  const messages = useActiveMessages();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !activeAgent) return;

    const userMessage = input.trim();
    setInput('');

    try {
      await sendMessage(userMessage, activeAgent.id);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        {activeAgent && (
          <>
            <img
              src={activeAgent.avatar}
              alt={activeAgent.name}
              className="w-10 h-10 rounded-full object-cover border-2 border-border"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div>
              <h2 className="font-semibold">{activeAgent.name}</h2>
              <p className="text-sm text-muted-foreground">
                {activeAgent.persona} · {activeAgent.role}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                )}
              />
              <span className="text-xs text-muted-foreground">
                {isConnected ? 'Connected to OpenClaw' : 'Disconnected'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <img
              src={activeAgent?.avatar}
              alt={activeAgent?.name}
              className="w-24 h-24 rounded-full object-cover border-4 border-primary/20 mb-4"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="text-4xl mb-4">{activeAgent?.emoji || '🏛️'}</div>
            <h3 className="text-xl font-semibold mb-2">
              {activeAgent?.name || 'Agora'}
            </h3>
            <p className="text-muted-foreground max-w-md">
              {activeAgent ? (
                `I am ${activeAgent.name}, ${activeAgent.persona}. As your ${activeAgent.role}, I am ready to serve. What wisdom do you seek?`
              ) : (
                'Select an agent to begin your conversation.'
              )}
            </p>
          </div>
        ) : (
          <div className="py-4">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
                agentName={msg.role === 'assistant' ? activeAgent?.name : undefined}
                agentEmoji={msg.role === 'assistant' ? activeAgent?.emoji : undefined}
              />
            ))}
            {isLoading && messages[messages.length - 1]?.content === '' && (
              <div className="flex gap-3 p-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm">{activeAgent?.emoji}</span>
                </div>
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${activeAgent?.name || 'agent'}...`}
            className="flex-1 resize-none rounded-xl bg-muted px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            rows={1}
            disabled={isLoading || !isConnected}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !isConnected}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            Send
          </button>
        </div>
        {!isConnected && (
          <div className="flex items-center gap-2 mt-2">
            <p className="text-xs text-red-400">
              ⚠️ Not connected to OpenClaw Gateway. Make sure it's running on port 18789.
            </p>
            <button
              onClick={() => connect()}
              disabled={isConnecting}
              className="text-xs text-primary hover:underline disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Retry'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
