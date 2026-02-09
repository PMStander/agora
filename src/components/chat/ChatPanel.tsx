import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useAgentStore, useActiveAgent, useActiveMessages } from '../../stores/agents';
import { useOpenClaw } from '../../hooks/useOpenClaw';
import { cn } from '../../lib/utils';
import { uploadChatAttachment } from '../../lib/storage';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  agentName?: string;
  agentEmoji?: string;
}

function renderMessageContent(content: string) {
  const pattern = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const matchStart = match.index;
    const matchText = match[0];
    if (matchStart > lastIndex) {
      nodes.push(
        <div key={`text-${lastIndex}`} className="whitespace-pre-wrap">
          {content.slice(lastIndex, matchStart)}
        </div>
      );
    }

    if (match[1] && match[2]) {
      const alt = match[1] || 'attachment';
      const url = match[2];
      nodes.push(
        <img
          key={`img-${matchStart}`}
          src={url}
          alt={alt}
          className="max-w-full rounded-lg border border-border"
        />
      );
    } else if (match[3] && match[4]) {
      const label = match[3];
      const url = match[4];
      nodes.push(
        <a
          key={`link-${matchStart}`}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline"
        >
          {label}
        </a>
      );
    }

    lastIndex = matchStart + matchText.length;
  }

  if (lastIndex < content.length) {
    nodes.push(
      <div key={`text-${lastIndex}`} className="whitespace-pre-wrap">
        {content.slice(lastIndex)}
      </div>
    );
  }

  if (nodes.length === 0) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  return <div className="space-y-2">{nodes}</div>;
}

function ChatMessage({ role, content, reasoning, agentName, agentEmoji }: ChatMessageProps) {
  const hasContent = !!content?.trim();
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
        {hasContent ? renderMessageContent(content) : reasoning ? null : <div className="whitespace-pre-wrap">...</div>}
        {role === 'assistant' && reasoning && reasoning.trim() && (
          <details className="mt-2 rounded-lg border border-border bg-background/60 p-2">
            <summary className="cursor-pointer text-xs text-muted-foreground">Thinking</summary>
            <div className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
              {reasoning}
            </div>
          </details>
        )}
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
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
    // Reset input value to allow selecting the same file again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && files.length === 0) || isLoading || !activeAgent || isUploading) return;

    setIsUploading(true);
    let messageContent = input.trim();

    try {
      // Upload files if present
      if (files.length > 0) {
        const uploadPromises = files.map(file => uploadChatAttachment(file, activeAgent.id));
        const urls = await Promise.all(uploadPromises);
        
        // Append image/file URLs to the message
        const attachmentsMarkdown = files.map((file, i) => {
          const isImage = file.type.startsWith('image/');
          return isImage ? `\n\n![${file.name}](${urls[i]})` : `\n\n[${file.name}](${urls[i]})`;
        }).join('');
        
        messageContent += attachmentsMarkdown;
      }

      setInput('');
      setFiles([]);
      await sendMessage(messageContent, activeAgent.id);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Restore input if failed (optional, but good UX)
      if (files.length === 0) {
          // Only if it was just text, if files failed we might want to keep them selected
          // keeping it simple for now
      }
    } finally {
      setIsUploading(false);
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
                reasoning={msg.reasoning}
                agentName={msg.role === 'assistant' ? activeAgent?.name : undefined}
                agentEmoji={msg.role === 'assistant' ? activeAgent?.emoji : undefined}
              />
            ))}
            {(isLoading || isUploading) && (messages.length === 0 || messages[messages.length - 1]?.role === 'user' || messages[messages.length - 1]?.content === '') && (
              <div className="flex gap-3 p-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm">{activeAgent?.emoji}</span>
                </div>
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <div className="flex gap-1 items-center">
                     {isUploading ? (
                        <span className="text-xs text-muted-foreground">Uploading...</span>
                     ) : (
                       <>
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.1s]" />
                        <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                       </>
                     )}
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
        {/* File Previews */}
        {files.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto py-2">
            {files.map((file, i) => (
              <div key={i} className="relative group flex-shrink-0">
                <div className="w-16 h-16 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
                  {file.type.startsWith('image/') ? (
                    <img 
                      src={URL.createObjectURL(file)} 
                      alt={file.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl">📄</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
                <div className="text-[10px] truncate max-w-[4rem] mt-1 text-muted-foreground">
                  {file.name}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {/* File Input (Hidden) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            multiple
          />
          
          {/* Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isUploading || !isConnected}
            className="p-3 rounded-xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            title="Attach files"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${activeAgent?.name || 'agent'}...`}
            className="flex-1 resize-none rounded-xl bg-muted px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            rows={1}
            disabled={isLoading || isUploading || !isConnected}
          />
          <button
            type="submit"
            disabled={(!input.trim() && files.length === 0) || isLoading || isUploading || !isConnected}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            {isUploading ? '...' : 'Send'}
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
