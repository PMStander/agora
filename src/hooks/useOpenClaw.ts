import { useEffect, useRef, useCallback, useState } from 'react';
import { useAgentStore } from '../stores/agents';

interface OpenClawMessage {
  type: 'req' | 'res' | 'event';
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  payload?: unknown;
  error?: { code: number; message: string };
  event?: string;
  ok?: boolean;
}

interface AgentEventPayload {
  content?: string;
  done?: boolean;
  runId?: string;
  status?: string;
}

const GATEWAY_URL = 'ws://127.0.0.1:18789';

export function useOpenClaw() {
  const wsRef = useRef<WebSocket | null>(null);
  const requestIdRef = useRef(0);
  const pendingRef = useRef<Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }>>(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const streamBufferRef = useRef<string>('');
  
  const { addMessage, updateLastMessage, setConnected, setLoading, activeAgentId } = useAgentStore();

  const nextId = useCallback(() => {
    return `req-${++requestIdRef.current}-${Date.now()}`;
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback((msg: OpenClawMessage) => {
    console.log('[OpenClaw] Received:', msg.type, msg.id || msg.event);
    
    if (msg.type === 'res') {
      const pending = pendingRef.current.get(msg.id!);
      if (pending) {
        pendingRef.current.delete(msg.id!);
        if (msg.error || msg.ok === false) {
          pending.reject(msg.error || new Error('Request failed'));
        } else {
          pending.resolve(msg.payload);
        }
      }
    } else if (msg.type === 'event') {
      if (msg.event === 'agent') {
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
    }
  }, [activeAgentId, updateLastMessage, setLoading]);

  // Connect to gateway
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[OpenClaw] Already connected');
      return Promise.resolve();
    }
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('[OpenClaw] Already connecting');
      return Promise.resolve();
    }
    if (isConnecting) {
      console.log('[OpenClaw] Connection in progress');
      return Promise.resolve();
    }

    console.log('[OpenClaw] Connecting to', GATEWAY_URL);
    setIsConnecting(true);
    setConnectionError(null);
    
    return new Promise<void>((resolve, reject) => {
      try {
        const ws = new WebSocket(GATEWAY_URL);
        wsRef.current = ws;

        const connectTimeout = setTimeout(() => {
          console.error('[OpenClaw] Connection timeout');
          ws.close();
          setIsConnecting(false);
          setConnectionError('Connection timeout');
          reject(new Error('Connection timeout'));
        }, 10000);

        ws.onopen = () => {
          console.log('[OpenClaw] WebSocket opened');
          clearTimeout(connectTimeout);
          
          // Send connect handshake
          const connectId = nextId();
          pendingRef.current.set(connectId, {
            resolve: () => {
              console.log('[OpenClaw] Handshake complete');
              setIsConnected(true);
              setConnected(true);
              setIsConnecting(false);
              setConnectionError(null);
              resolve();
            },
            reject: (err) => {
              console.error('[OpenClaw] Handshake failed:', err);
              setIsConnecting(false);
              setConnectionError('Handshake failed');
              reject(err);
            }
          });

          ws.send(JSON.stringify({
            type: 'req',
            id: connectId,
            method: 'connect',
            params: {}
          }));
        };

        ws.onmessage = (event) => {
          try {
            const msg: OpenClawMessage = JSON.parse(event.data);
            handleMessage(msg);
          } catch (e) {
            console.error('[OpenClaw] Parse error:', e);
          }
        };

        ws.onerror = (error) => {
          console.error('[OpenClaw] WebSocket error:', error);
          clearTimeout(connectTimeout);
          setIsConnecting(false);
          setConnectionError('Connection error');
          reject(error);
        };

        ws.onclose = (event) => {
          console.log('[OpenClaw] WebSocket closed:', event.code, event.reason);
          clearTimeout(connectTimeout);
          setIsConnected(false);
          setConnected(false);
          wsRef.current = null;
          
          // Auto-reconnect after 3 seconds
          if (!event.wasClean) {
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('[OpenClaw] Attempting reconnect...');
              connect().catch(console.error);
            }, 3000);
          }
        };
      } catch (err) {
        console.error('[OpenClaw] Failed to create WebSocket:', err);
        setIsConnecting(false);
        setConnectionError('Failed to connect');
        reject(err);
      }
    });
  }, [isConnecting, nextId, setConnected, handleMessage]);

  // Send message to agent
  const sendMessage = useCallback(async (message: string, agentId?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      await connect();
    }

    const id = nextId();
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

    return new Promise((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject });

      setTimeout(() => {
        if (pendingRef.current.has(id)) {
          pendingRef.current.delete(id);
          setLoading(false);
          reject(new Error('Request timeout'));
        }
      }, 300000);

      wsRef.current?.send(JSON.stringify({
        type: 'req',
        id,
        method: 'agent',
        params: {
          message,
          agentId: targetAgent,
          idempotencyKey: id,
        }
      }));
    });
  }, [activeAgentId, addMessage, connect, nextId, setLoading]);

  // Spawn sub-agent
  const spawnSubAgent = useCallback(async (agentId: string, task: string): Promise<void> => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      await connect();
    }

    const id = nextId();
    
    return new Promise<void>((resolve, reject) => {
      pendingRef.current.set(id, { 
        resolve: () => resolve(), 
        reject 
      });

      setTimeout(() => {
        if (pendingRef.current.has(id)) {
          pendingRef.current.delete(id);
          reject(new Error('Spawn timeout'));
        }
      }, 30000);

      wsRef.current?.send(JSON.stringify({
        type: 'req',
        id,
        method: 'agent',
        params: {
          message: `Use sessions_spawn to run this task with agent "${agentId}": ${task}`,
          idempotencyKey: id,
        }
      }));
    });
  }, [connect, nextId]);

  // Auto-connect on mount
  useEffect(() => {
    console.log('[OpenClaw] Hook mounted, connecting...');
    connect().catch((err) => {
      console.error('[OpenClaw] Initial connect failed:', err);
    });
    
    return () => {
      console.log('[OpenClaw] Hook unmounting, cleaning up...');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return {
    isConnected,
    isConnecting,
    connectionError,
    connect,
    sendMessage,
    spawnSubAgent,
  };
}
