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

export function useA2UI() {
  const [isConnected, setIsConnected] = useState(false);
  const [surfaces, setSurfaces] = useState<Map<string, A2UISurface>>(new Map());
  const [activeSurfaceId, setActiveSurfaceId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) return;

    try {
      // Connect to OpenClaw canvas host A2UI stream
      const es = new EventSource('http://127.0.0.1:18793/a2ui/stream');
      eventSourceRef.current = es;

      es.onopen = () => {
        console.log('[A2UI] Connected to canvas host');
        setIsConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const msg: A2UIMessage = JSON.parse(event.data);
          handleMessage(msg);
        } catch (e) {
          console.error('[A2UI] Parse error:', e);
        }
      };

      es.onerror = (error) => {
        console.error('[A2UI] EventSource error:', error);
        setIsConnected(false);
        // Attempt reconnect after 5s
        setTimeout(() => {
          eventSourceRef.current = null;
          connect();
        }, 5000);
      };
    } catch (error) {
      console.error('[A2UI] Connection error:', error);
    }
  }, []);

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
            if (activeSurfaceId === msg.surfaceId) {
              setActiveSurfaceId(null);
            }
          }
          break;
        }
      }
      
      return next;
    });
  }, [activeSurfaceId]);

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setIsConnected(false);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const activeSurface = activeSurfaceId ? surfaces.get(activeSurfaceId) : null;

  return {
    isConnected,
    surfaces,
    activeSurface,
    activeSurfaceId,
    setActiveSurfaceId,
    connect,
    disconnect,
  };
}
