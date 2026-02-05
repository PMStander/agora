import { useEffect, useState, useCallback, useRef } from 'react';
import { openclawClient, type OpenClawMessage, type ConnectionStatus } from '../lib/openclawClient';
import { useAgentStore } from '../stores/agents';

interface AgentEventPayload {
  content?: string;
  done?: boolean;
  runId?: string;
  status?: string;
}

export function useOpenClaw() {
  const [status, setStatus] = useState<ConnectionStatus>(openclawClient.status);
  const [connectionError, setConnectionError] = useState<string | null>(openclawClient.error);
  const streamBufferRef = useRef<string>('');
  
  const { addMessage, updateLastMessage, setConnected, setLoading, activeAgentId } = useAgentStore();

  // Subscribe to status changes
  useEffect(() => {
    const unsubStatus = openclawClient.onStatusChange((newStatus) => {
      setStatus(newStatus);
      setConnected(newStatus === 'connected');
      setConnectionError(openclawClient.error);
    });

    const unsubMessage = openclawClient.onMessage((msg: OpenClawMessage) => {
      if (msg.type === 'event' && msg.event === 'agent') {
        const payload = msg.payload as AgentEventPayload;
        
        if (payload.content !== undefined) {
          streamBufferRef.current += payload.content;
          updateLastMessage(activeAgentId, streamBufferRef.current);
        }
        
        if (payload.done) {
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
      await openclawClient.send('agent', {
        message,
        agentId: targetAgent,
        idempotencyKey: `msg-${Date.now()}`,
      });
    } catch (err) {
      setLoading(false);
      throw err;
    }
  }, [activeAgentId, addMessage, setLoading]);

  const spawnSubAgent = useCallback(async (agentId: string, task: string): Promise<void> => {
    await openclawClient.send('agent', {
      message: `Use sessions_spawn to run this task with agent "${agentId}": ${task}`,
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
  };
}
