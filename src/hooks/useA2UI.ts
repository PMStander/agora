import { useState, useEffect, useCallback, useRef } from 'react';

// A2UI Message Types (from the spec)
export interface A2UIComponent {
  id: string;
  type: string;
  parentId?: string;
  props?: Record<string, unknown>;
  children?: string[];
}

export interface A2UISurface {
  id: string;
  rootId?: string;
  components: Map<string, A2UIComponent>;
  dataModel: Record<string, unknown>;
  catalog?: string;
}

export interface A2UIMessage {
  type: 'surfaceUpdate' | 'dataModelUpdate' | 'beginRendering' | 'deleteSurface';
  surfaceId?: string;
  components?: A2UIComponent[];
  data?: Record<string, unknown>;
  rootId?: string;
  catalog?: string;
}

const A2UI_ENDPOINT = 'http://127.0.0.1:18793/a2ui/stream';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10000;

export function useA2UI(autoConnect = false) {
  const [isConnected, setIsConnected] = useState(false);
  const [isEnabled, setIsEnabled] = useState(autoConnect);
  const [surfaces, setSurfaces] = useState<Map<string, A2UISurface>>(new Map());
  const [activeSurfaceId, setActiveSurfaceId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoggedErrorRef = useRef(false);

  const handleMessage = useCallback((msg: A2UIMessage) => {
    setSurfaces(prev => {
      const next = new Map(prev);
      
      switch (msg.type) {
        case 'surfaceUpdate': {
          const surfaceId = msg.surfaceId || 'default';
          const existing = next.get(surfaceId) || {
            id: surfaceId,
            components: new Map(),
            dataModel: {},
          };
          
          // Add/update components
          if (msg.components) {
            for (const comp of msg.components) {
              existing.components.set(comp.id, comp);
            }
          }
          
          next.set(surfaceId, existing);
          setActiveSurfaceId(surfaceId);
          break;
        }
        
        case 'dataModelUpdate': {
          const surfaceId = msg.surfaceId || 'default';
          const existing = next.get(surfaceId);
          if (existing && msg.data) {
            existing.dataModel = { ...existing.dataModel, ...msg.data };
            next.set(surfaceId, existing);
          }
          break;
        }
        
        case 'beginRendering': {
          const surfaceId = msg.surfaceId || 'default';
          const existing = next.get(surfaceId);
          if (existing) {
            existing.rootId = msg.rootId;
            existing.catalog = msg.catalog;
            next.set(surfaceId, existing);
          }
          setActiveSurfaceId(surfaceId);
          break;
        }
        
        case 'deleteSurface': {
          if (msg.surfaceId) {
            next.delete(msg.surfaceId);
          }
          break;
        }
      }
      
      return next;
    });
  }, []);

  const disconnect = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setIsConnected(false);
    retryCountRef.current = 0;
  }, []);

  const connect = useCallback(() => {
    if (eventSourceRef.current) return;

    try {
      console.log('[A2UI] Connecting to canvas host...');
      const es = new EventSource(A2UI_ENDPOINT);
      eventSourceRef.current = es;

      es.onopen = () => {
        console.log('[A2UI] Connected to canvas host');
        setIsConnected(true);
        retryCountRef.current = 0;
        hasLoggedErrorRef.current = false;
      };

      es.onmessage = (event) => {
        try {
          const msg: A2UIMessage = JSON.parse(event.data);
          handleMessage(msg);
        } catch (e) {
          console.error('[A2UI] Parse error:', e);
        }
      };

      es.onerror = () => {
        // Only log once to avoid spam
        if (!hasLoggedErrorRef.current) {
          console.log('[A2UI] Canvas host not available (port 18793). Will retry silently.');
          hasLoggedErrorRef.current = true;
        }
        
        setIsConnected(false);
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        
        // Retry with backoff, but only if enabled and under max retries
        if (isEnabled && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          retryTimeoutRef.current = setTimeout(() => {
            connect();
          }, RETRY_DELAY_MS * retryCountRef.current);
        }
      };
    } catch {
      // Silent fail - canvas host might not be running
      if (!hasLoggedErrorRef.current) {
        console.log('[A2UI] Canvas host not available');
        hasLoggedErrorRef.current = true;
      }
    }
  }, [handleMessage, isEnabled]);

  // Connect/disconnect based on enabled state
  useEffect(() => {
    if (isEnabled) {
      connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [isEnabled, connect, disconnect]);

  const enable = useCallback(() => {
    retryCountRef.current = 0;
    hasLoggedErrorRef.current = false;
    setIsEnabled(true);
  }, []);

  const disable = useCallback(() => {
    setIsEnabled(false);
  }, []);

  const activeSurface = activeSurfaceId ? surfaces.get(activeSurfaceId) : null;

  return {
    isConnected,
    isEnabled,
    surfaces,
    activeSurface,
    activeSurfaceId,
    setActiveSurfaceId,
    enable,
    disable,
    connect,
    disconnect,
  };
}
