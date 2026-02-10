import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useAgentStore, useActiveAgent, useActiveMessages } from '../../stores/agents';
import { useOpenClaw } from '../../hooks/useOpenClaw';
import { cn } from '../../lib/utils';
import { uploadChatAttachment } from '../../lib/storage';
import { useSlashCommandsStore } from '../../stores/slashCommands';
import { ProjectContextSelector } from './ProjectContextSelector';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  agentName?: string;
  agentEmoji?: string;
  isContextMarker?: boolean;
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

function ChatMessage({ role, content, reasoning, agentName, agentEmoji, isContextMarker }: ChatMessageProps) {
  const hasContent = !!content?.trim();
  
  // Render system messages (context markers) differently
  if (role === 'system' && isContextMarker) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border border-border rounded-full text-xs text-muted-foreground">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>{content}</span>
        </div>
      </div>
    );
  }
  
  return (
    <div
      className={cn(
        'flex flex-col px-3 py-2',
        role === 'user' ? 'items-end' : 'items-start'
      )}
    >
      {/* Avatar + name row above the bubble */}
      {role === 'assistant' && (
        <div className="flex items-center gap-1.5 mb-1">
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-xs">{agentEmoji || '🤖'}</span>
          </div>
          {agentName && (
            <span className="text-xs text-muted-foreground">{agentName}</span>
          )}
        </div>
      )}
      {role === 'user' && (
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs text-muted-foreground">You</span>
        </div>
      )}
      {/* Message bubble — full width available */}
      <div
        className={cn(
          'max-w-[92%] rounded-2xl px-3 py-2',
          role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
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
    </div>
  );
}

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commandsDropdownRef = useRef<HTMLDivElement>(null);
  
  const isLoading = useAgentStore((s) => s.isLoading);
  const insertContextMarker = useAgentStore((s) => s.insertContextMarker);
  const { isConnected, isConnecting, connect, sendMessage } = useOpenClaw();
  const activeAgent = useActiveAgent();
  const messages = useActiveMessages();
  const { commands } = useSlashCommandsStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Filter commands based on input
  const filteredCommands = input.startsWith('/') && !input.includes(' ')
    ? commands.filter(cmd => cmd.trigger.toLowerCase().startsWith(input.toLowerCase()))
    : [];

  // Show/hide command suggestions
  useEffect(() => {
    setShowCommandSuggestions(filteredCommands.length > 0 && input.startsWith('/'));
    setSelectedCommandIndex(0);
  }, [input, filteredCommands.length]);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (commandsDropdownRef.current && !commandsDropdownRef.current.contains(e.target as Node)) {
        setShowCommandSuggestions(false);
      }
    };

    if (showCommandSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCommandSuggestions]);

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
      // Process slash commands
      if (messageContent.startsWith('/')) {
        const spaceIndex = messageContent.indexOf(' ');
        const trigger = spaceIndex > 0 ? messageContent.substring(0, spaceIndex) : messageContent;
        const userContent = spaceIndex > 0 ? messageContent.substring(spaceIndex + 1).trim() : '';
        
        const command = commands.find(cmd => cmd.trigger === trigger);
        
        if (command) {
          // Replace placeholders in the template
          let processedTemplate = command.promptTemplate;
          
          // Replace {{content}} with user's content
          if (processedTemplate.includes('{{content}}')) {
            processedTemplate = processedTemplate.replace(/\{\{content\}\}/g, userContent || '[No content provided]');
          }
          
          // For {{language}} and other placeholders, try to extract from user content
          // Simple heuristic: first word after command might be the language
          if (processedTemplate.includes('{{language}}')) {
            const firstWord = userContent.split(' ')[0] || 'English';
            const contentAfterFirst = userContent.split(' ').slice(1).join(' ') || userContent;
            processedTemplate = processedTemplate.replace(/\{\{language\}\}/g, firstWord);
            processedTemplate = processedTemplate.replace(/\{\{content\}\}/g, contentAfterFirst || '[No content provided]');
          }
          
          messageContent = processedTemplate;
        }
      }

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

  const selectCommand = (command: typeof commands[0]) => {
    // For now, just insert the trigger. In a more advanced implementation,
    // we could prompt for placeholder values or insert the template directly
    setInput(command.trigger + ' ');
    setShowCommandSuggestions(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle command suggestions navigation
    if (showCommandSuggestions && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex(prev => prev > 0 ? prev - 1 : 0);
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        selectCommand(filteredCommands[selectedCommandIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommandSuggestions(false);
        return;
      }
    }

    // Normal message submission
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleClearContext = () => {
    if (activeAgent) {
      insertContextMarker(activeAgent.id);
      setShowClearConfirm(false);
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
              {/* Project Context Selector */}
              <ProjectContextSelector />
              {/* Clear Context Button */}
              {messages.length > 0 && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  disabled={isLoading}
                  className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Clear conversation context"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </button>
              )}
              
            </div>
          </>
        )}
      </div>

      {/* Clear Context Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowClearConfirm(false)}>
          <div className="bg-background border border-border rounded-lg p-6 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Clear Conversation Context?</h3>
                <p className="text-sm text-muted-foreground mb-1">
                  This will start a fresh context from this point. The AI will not have access to messages before this marker.
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Message history will remain visible, but won't be included in future AI responses.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearContext}
                className="px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              >
                Clear Context
              </button>
            </div>
          </div>
        </div>
      )}

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
                isContextMarker={msg.isContextMarker}
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

        {/* Command Suggestions Dropdown */}
        {showCommandSuggestions && filteredCommands.length > 0 && (
          <div 
            ref={commandsDropdownRef}
            className="mb-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto"
          >
            {filteredCommands.map((command, idx) => (
              <button
                key={command.id}
                type="button"
                onClick={() => selectCommand(command)}
                className={cn(
                  "w-full text-left px-4 py-3 transition-colors border-b border-zinc-800 last:border-b-0",
                  idx === selectedCommandIndex
                    ? "bg-amber-500/20 text-amber-400"
                    : "text-zinc-300 hover:bg-zinc-800"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-medium">{command.trigger}</span>
                  {command.id.startsWith('default-') && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      DEFAULT
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500">{command.description}</div>
              </button>
            ))}
            <div className="px-4 py-2 bg-zinc-950 border-t border-zinc-800">
              <p className="text-[10px] text-zinc-600">
                ↑↓ to navigate • Tab or Enter to select • Esc to dismiss
              </p>
            </div>
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
