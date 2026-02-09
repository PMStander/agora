import { useState, useEffect, useCallback, useRef } from 'react';
import { openclawClient, type OpenClawMessage } from '../lib/openclawClient';

// A2UI Message Types
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

const LEGACY_A2UI_ENDPOINT = 'http://127.0.0.1:18793/a2ui/stream';
const STREAM_PROBE_TIMEOUT_MS = 1500;
const MAX_SEARCH_DEPTH = 6;
const A2UI_ACTION_KEYS = new Set(['surfaceUpdate', 'dataModelUpdate', 'beginRendering', 'deleteSurface']);

type A2UIConnectionMode = 'disabled' | 'gateway-events' | 'stream';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeComponents(value: unknown): A2UIComponent[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const normalized = value.map((entry): A2UIComponent | null => {
    if (!isRecord(entry)) return null;

    const id = asString(entry.id);
    const type = asString(entry.type);
    if (!id || !type) return null;

    const component: A2UIComponent = { id, type };
    const parentId = asString(entry.parentId);
    const props = isRecord(entry.props) ? entry.props : undefined;
    const children = Array.isArray(entry.children)
      ? entry.children.map((child) => String(child))
      : undefined;

    if (parentId) component.parentId = parentId;
    if (props) component.props = props;
    if (children && children.length > 0) component.children = children;

    return component;
  }).filter((entry): entry is A2UIComponent => entry !== null);

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeA2UIMessage(value: unknown): A2UIMessage | null {
  if (!isRecord(value)) return null;

  const rawType = asString(value.type);
  if (rawType && A2UI_ACTION_KEYS.has(rawType)) {
    const surfaceId = asString(value.surfaceId);
    if (rawType === 'surfaceUpdate') {
      return {
        type: 'surfaceUpdate',
        surfaceId,
        components: normalizeComponents(value.components),
        rootId: asString(value.rootId),
        catalog: asString(value.catalog),
      };
    }

    if (rawType === 'dataModelUpdate') {
      const data = isRecord(value.data) ? value.data : isRecord(value.dataModel) ? value.dataModel : undefined;
      return { type: 'dataModelUpdate', surfaceId, data };
    }

    if (rawType === 'beginRendering') {
      return {
        type: 'beginRendering',
        surfaceId,
        rootId: asString(value.rootId) ?? asString(value.componentId),
        catalog: asString(value.catalog),
      };
    }

    if (rawType === 'deleteSurface') {
      return { type: 'deleteSurface', surfaceId };
    }
  }

  const actionEntry = Array.from(A2UI_ACTION_KEYS).find((key) => isRecord(value[key]));
  if (!actionEntry) return null;

  const payload = value[actionEntry] as Record<string, unknown>;
  const surfaceId = asString(payload.surfaceId) ?? asString(value.surfaceId);

  if (actionEntry === 'surfaceUpdate') {
    return {
      type: 'surfaceUpdate',
      surfaceId,
      components: normalizeComponents(payload.components),
      rootId: asString(payload.rootId) ?? asString(payload.componentId),
      catalog: asString(payload.catalog),
    };
  }

  if (actionEntry === 'dataModelUpdate') {
    const data = isRecord(payload.data)
      ? payload.data
      : isRecord(payload.dataModel)
      ? payload.dataModel
      : undefined;
    return { type: 'dataModelUpdate', surfaceId, data };
  }

  if (actionEntry === 'beginRendering') {
    return {
      type: 'beginRendering',
      surfaceId,
      rootId: asString(payload.rootId) ?? asString(payload.componentId),
      catalog: asString(payload.catalog),
    };
  }

  return {
    type: 'deleteSurface',
    surfaceId,
  };
}

function extractMessagesFromString(raw: string): A2UIMessage[] {
  const text = raw.trim();
  if (!text) return [];
  if (text.length > 200000) return [];
  if (!/(surfaceUpdate|dataModelUpdate|beginRendering|deleteSurface)/.test(text)) return [];

  const messages: A2UIMessage[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const parseCandidate = (candidate: string) => {
    try {
      const parsed = JSON.parse(candidate);
      const single = normalizeA2UIMessage(parsed);
      if (single) {
        messages.push(single);
        return;
      }
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          const normalized = normalizeA2UIMessage(entry);
          if (normalized) messages.push(normalized);
        }
      }
    } catch {
      // Ignore parse errors while scanning mixed content.
    }
  };

  if (lines.length > 1) {
    for (const line of lines) parseCandidate(line);
  }
  parseCandidate(text);

  return messages;
}

function extractA2UIMessages(value: unknown): A2UIMessage[] {
  const collected: A2UIMessage[] = [];
  const seenObjects = new Set<unknown>();

  const visit = (node: unknown, depth: number) => {
    if (depth > MAX_SEARCH_DEPTH || node == null) return;

    if (typeof node === 'string') {
      for (const msg of extractMessagesFromString(node)) {
        collected.push(msg);
      }
      return;
    }

    if (typeof node !== 'object') return;

    if (seenObjects.has(node)) return;
    seenObjects.add(node);

    const direct = normalizeA2UIMessage(node);
    if (direct) collected.push(direct);

    if (Array.isArray(node)) {
      for (const entry of node) visit(entry, depth + 1);
      return;
    }

    for (const entry of Object.values(node)) visit(entry, depth + 1);
  };

  visit(value, 0);

  if (collected.length <= 1) return collected;
  const deduped = new Map<string, A2UIMessage>();
  for (const msg of collected) {
    deduped.set(JSON.stringify(msg), msg);
  }
  return Array.from(deduped.values());
}

function createEmptySurface(id: string): A2UISurface {
  return {
    id,
    components: new Map(),
    dataModel: {},
  };
}

function normalizeCanvasHostA2UIEndpoint(canvasHostUrl: string | null): string | null {
  if (!canvasHostUrl) return null;
  try {
    const parsed = new URL(canvasHostUrl);
    parsed.pathname = '/a2ui/stream';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

function buildA2UIStreamCandidates(): string[] {
  const envEndpoint = asString(import.meta.env.VITE_A2UI_STREAM_URL);
  const gatewayEndpoint = `${openclawClient.gatewayHttpBase}/a2ui/stream`;
  const canvasEndpoint = normalizeCanvasHostA2UIEndpoint(openclawClient.canvasHostUrl);

  const values = [envEndpoint, gatewayEndpoint, canvasEndpoint, LEGACY_A2UI_ENDPOINT];
  const deduped = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    deduped.add(value);
  }
  return Array.from(deduped);
}

async function endpointSupportsSse(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STREAM_PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      cache: 'no-store',
      signal: controller.signal,
    });
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    return response.ok && contentType.includes('text/event-stream');
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveA2UIStreamEndpoint(): Promise<string | null> {
  const candidates = buildA2UIStreamCandidates();
  for (const candidate of candidates) {
    if (await endpointSupportsSse(candidate)) return candidate;
  }
  return null;
}

export function useA2UI(autoConnect = false) {
  const [isEnabled, setIsEnabled] = useState(autoConnect);
  const [gatewayConnected, setGatewayConnected] = useState(openclawClient.isConnected);
  const [connectionMode, setConnectionMode] = useState<A2UIConnectionMode>(
    autoConnect ? 'gateway-events' : 'disabled'
  );
  const [streamEndpoint, setStreamEndpoint] = useState<string | null>(null);
  const [surfaces, setSurfaces] = useState<Map<string, A2UISurface>>(new Map());
  const [activeSurfaceId, setActiveSurfaceId] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const isConnectingRef = useRef(false);

  const handleMessage = useCallback((msg: A2UIMessage) => {
    setSurfaces((prev) => {
      const next = new Map(prev);

      switch (msg.type) {
        case 'surfaceUpdate': {
          const surfaceId = msg.surfaceId || 'default';
          const existing = next.get(surfaceId) || createEmptySurface(surfaceId);

          if (msg.components) {
            for (const comp of msg.components) {
              existing.components.set(comp.id, comp);
            }
          }

          if (msg.rootId) existing.rootId = msg.rootId;
          if (msg.catalog) existing.catalog = msg.catalog;

          next.set(surfaceId, existing);
          setActiveSurfaceId(surfaceId);
          break;
        }

        case 'dataModelUpdate': {
          const surfaceId = msg.surfaceId || 'default';
          const existing = next.get(surfaceId) || createEmptySurface(surfaceId);
          if (msg.data) existing.dataModel = { ...existing.dataModel, ...msg.data };
          next.set(surfaceId, existing);
          break;
        }

        case 'beginRendering': {
          const surfaceId = msg.surfaceId || 'default';
          const existing = next.get(surfaceId) || createEmptySurface(surfaceId);
          if (msg.rootId) existing.rootId = msg.rootId;
          if (msg.catalog) existing.catalog = msg.catalog;
          next.set(surfaceId, existing);
          setActiveSurfaceId(surfaceId);
          break;
        }

        case 'deleteSurface': {
          if (msg.surfaceId) {
            next.delete(msg.surfaceId);
            setActiveSurfaceId((current) => {
              if (current && current !== msg.surfaceId) return current;
              const first = next.keys().next();
              return first.done ? null : first.value;
            });
          } else {
            next.clear();
            setActiveSurfaceId(null);
          }
          break;
        }
      }

      return next;
    });
  }, []);

  const pushMessages = useCallback((messages: A2UIMessage[]) => {
    for (const message of messages) handleMessage(message);
  }, [handleMessage]);

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    isConnectingRef.current = false;
    setStreamEndpoint(null);
    setConnectionMode(isEnabled ? 'gateway-events' : 'disabled');
  }, [isEnabled]);

  const connect = useCallback(() => {
    if (!isEnabled) return;
    if (eventSourceRef.current || isConnectingRef.current) return;

    isConnectingRef.current = true;

    (async () => {
      const endpoint = await resolveA2UIStreamEndpoint();
      if (!endpoint) {
        setStreamEndpoint(null);
        setConnectionMode('gateway-events');
        isConnectingRef.current = false;
        return;
      }

      try {
        const es = new EventSource(endpoint);
        eventSourceRef.current = es;
        setStreamEndpoint(endpoint);

        es.onopen = () => {
          setConnectionMode('stream');
        };

        es.onmessage = (event) => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(event.data);
          } catch {
            parsed = event.data;
          }
          const messages = extractA2UIMessages(parsed);
          if (messages.length > 0) pushMessages(messages);
        };

        es.onerror = () => {
          eventSourceRef.current?.close();
          eventSourceRef.current = null;
          setConnectionMode('gateway-events');
          setStreamEndpoint(null);
        };
      } catch {
        setConnectionMode('gateway-events');
        setStreamEndpoint(null);
      } finally {
        isConnectingRef.current = false;
      }
    })();
  }, [isEnabled, pushMessages]);

  useEffect(() => {
    const unsubStatus = openclawClient.onStatusChange((status) => {
      setGatewayConnected(status === 'connected');
      if (status !== 'connected') {
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        if (isEnabled) setConnectionMode('gateway-events');
      }
    });

    const unsubMessage = openclawClient.onMessage((msg: OpenClawMessage) => {
      if (!isEnabled) return;
      if (msg.type !== 'event') return;

      if (msg.event === 'chat') {
        const payload = msg.payload as Record<string, unknown> | undefined;
        if (payload?.state !== 'final') return;
      } else if (msg.event !== 'agent') {
        return;
      }

      const messages = extractA2UIMessages(msg.payload);
      if (messages.length === 0) return;

      pushMessages(messages);
      if (!eventSourceRef.current) setConnectionMode('gateway-events');
    });

    return () => {
      unsubStatus();
      unsubMessage();
    };
  }, [isEnabled, pushMessages]);

  // Connect/disconnect stream probe based on enabled state.
  useEffect(() => {
    if (!isEnabled) {
      disconnect();
      return;
    }
    setConnectionMode('gateway-events');
    connect();
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [isEnabled, connect, disconnect]);

  const enable = useCallback(() => setIsEnabled(true), []);
  const disable = useCallback(() => setIsEnabled(false), []);

  const activeSurface = activeSurfaceId ? surfaces.get(activeSurfaceId) : null;
  const isConnected = isEnabled && gatewayConnected;

  return {
    isConnected,
    isEnabled,
    connectionMode,
    streamEndpoint,
    surfaces,
    activeSurface,
    activeSurfaceId,
    setActiveSurfaceId,
    pushMessages,
    enable,
    disable,
    connect,
    disconnect,
  };
}
