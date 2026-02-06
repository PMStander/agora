import { useEffect, useState, useCallback, useRef } from 'react';
import { openclawClient, type OpenClawMessage, type ConnectionStatus } from '../lib/openclawClient';
import { useAgentStore } from '../stores/agents';

/**
 * Extract text from an Anthropic-format message.
 * Handles both string content and content block arrays.
 */
function extractText(message: any): string {
  if (!message) return '';
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text || '')
      .join('');
  }
  return '';
}

export function useOpenClaw() {
  const [status, setStatus] = useState<ConnectionStatus>(openclawClient.status);
  const [connectionError, setConnectionError] = useState<string | null>(openclawClient.error);
  const streamBufferRef = useRef<string>('');
  
  const { addMessage, updateLastMessage, setConnected, setLoading, activeAgentId } = useAgentStore();

  // Track whether we've already loaded history for the main agent
  const historyLoadedRef = useRef(false);

  // Subscribe to status changes and try to connect if disconnected
  useEffect(() => {
    const unsubStatus = openclawClient.onStatusChange((newStatus) => {
      console.log('[useOpenClaw] Status changed:', newStatus);
      setStatus(newStatus);
      setConnected(newStatus === 'connected');
      setConnectionError(openclawClient.error);

      // Load chat history when connected (only for main agent, only once)
      if (newStatus === 'connected' && !historyLoadedRef.current) {
        historyLoadedRef.current = true;
        loadHistory('main', 'main').catch(console.error);
      }
    });

    // Try to connect if we're disconnected when component mounts
    if (openclawClient.status === 'disconnected' || openclawClient.status === 'error') {
      console.log('[useOpenClaw] Initial status is', openclawClient.status, '- attempting connect');
      openclawClient.connect().catch(err => {
        console.error('[useOpenClaw] Connect failed:', err);
      });
    }

    const unsubMessage = openclawClient.onMessage((msg: OpenClawMessage) => {
      if (msg.type === 'event' && msg.event === 'chat') {
        const payload = msg.payload as any;

        if (payload.state === 'delta') {
          // delta contains full accumulated text, not incremental
          const text = extractText(payload.message);
          if (text) {
            streamBufferRef.current = text;
            updateLastMessage(activeAgentId, text);
          }
        }

        if (payload.state === 'final') {
          const text = extractText(payload.message);
          if (text) {
            updateLastMessage(activeAgentId, text);
          }
          setLoading(false);
          streamBufferRef.current = '';
        }

        if (payload.state === 'error' || payload.state === 'aborted') {
          const errorText = payload.errorMessage || 'Response was ' + payload.state;
          updateLastMessage(activeAgentId, errorText);
          setLoading(false);
          streamBufferRef.current = '';
        }
      }
    });

    return () => {
      unsubStatus();
      unsubMessage();
    };
  }, [activeAgentId, setConnected, setLoading, updateLastMessage]);

  const connect = useCallback(() => {
    return openclawClient.connect();
  }, []);

  const loadHistory = useCallback(async (sessionKey: string = 'main', targetAgentId?: string) => {
    const agentId = targetAgentId || activeAgentId;
    try {
      const result = await openclawClient.send('chat.history', {
        sessionKey,
        limit: 50,
      }) as any;
      if (result?.messages && Array.isArray(result.messages)) {
        console.log('[useOpenClaw] Loaded history:', result.messages.length, 'messages for agent', agentId);
        for (const msg of result.messages) {
          const text = extractText(msg);
          if (text && msg.role) {
            addMessage(agentId, {
              role: msg.role,
              content: text,
            });
          }
        }
      }
    } catch (err) {
      console.error('[useOpenClaw] Failed to load history:', err);
    }
  }, [activeAgentId, addMessage]);

  const sendMessage = useCallback(async (message: string, agentId?: string) => {
    const targetAgent = agentId || activeAgentId;
    
    // Add user message immediately
    addMessage(targetAgent, {
      role: 'user',
      content: message,
    });

    // Add placeholder for assistant response
    addMessage(targetAgent, {
      role: 'assistant',
      content: '',
      agentId: targetAgent,
    });

    setLoading(true);
    streamBufferRef.current = '';

    try {
      // For the main agent (Marcus), send directly
      // For other agents, route through main with agent context
      const actualMessage = targetAgent === 'main' 
        ? message 
        : `[Speaking as ${targetAgent}] ${message}`;
      
      const result = await openclawClient.send('chat.send', {
        sessionKey: 'main',
        message: actualMessage,
        deliver: false,
        idempotencyKey: `msg-${Date.now()}`,
      });
      console.log('[useOpenClaw] chat.send ack:', result);
    } catch (err) {
      setLoading(false);
      updateLastMessage(targetAgent, 'Error: ' + String(err));
    }
  }, [activeAgentId, addMessage, setLoading, updateLastMessage]);

  const spawnSubAgent = useCallback(async (agentId: string, task: string): Promise<void> => {
    await openclawClient.send('chat.send', {
      sessionKey: 'main',
      message: `Use sessions_spawn to run this task with agent "${agentId}": ${task}`,
      deliver: false,
      idempotencyKey: `spawn-${Date.now()}`,
    });
  }, []);

  return {
    isConnected: status === 'connected',
    isConnecting: status === 'connecting',
    connectionError,
    connect,
    sendMessage,
    spawnSubAgent,
    loadHistory,
  };
}
