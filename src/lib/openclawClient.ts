/**
 * Singleton OpenClaw WebSocket Client
 * Implements OpenClaw Gateway Protocol v3
 */

import type { ConnectionQuality } from '../types/supabase';

type MessageHandler = (msg: OpenClawMessage) => void;
type StatusHandler = (status: ConnectionStatus) => void;
type QualityHandler = (quality: ConnectionQuality) => void;
type ReconnectHandler = () => void;

export interface OpenClawMessage {
  type: 'req' | 'res' | 'event';
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  payload?: unknown;
  error?: { code: number; message: string };
  event?: string;
  ok?: boolean;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const DEFAULT_GATEWAY_URL = 'ws://127.0.0.1:18789';
const PROTOCOL_VERSION = 3;
const APP_VERSION = '0.1.0';

// Reconnection constants
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_MAX_ATTEMPTS = 10;

// Heartbeat constants
const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_PONG_TIMEOUT_MS = 10_000;
const DEGRADED_THRESHOLD_MS = 60_000;

function resolveGatewayUrl(raw: string | undefined): string {
  if (!raw) return DEFAULT_GATEWAY_URL;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'http:') parsed.protocol = 'ws:';
    if (parsed.protocol === 'https:') parsed.protocol = 'wss:';
    if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
      return DEFAULT_GATEWAY_URL;
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    if (raw.startsWith('/') && typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}${raw.replace(/\/$/, '')}`;
    }
    if (raw.startsWith('ws://') || raw.startsWith('wss://')) {
      return raw.replace(/\/$/, '');
    }
    return DEFAULT_GATEWAY_URL;
  }
}

const GATEWAY_URL = resolveGatewayUrl(import.meta.env.VITE_OPENCLAW_GATEWAY_URL);
const GATEWAY_TOKEN = (
  import.meta.env.VITE_OPENCLAW_GATEWAY_TOKEN ||
  import.meta.env.VITE_OPENCLAW_TOKEN ||
  ''
).trim();

class OpenClawClient {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private qualityHandlers: Set<QualityHandler> = new Set();
  private reconnectHandlers: Set<ReconnectHandler> = new Set();
  private _status: ConnectionStatus = 'disconnected';
  private _error: string | null = null;
  private _helloPayload: Record<string, unknown> | null = null;
  private connectPromise: Promise<void> | null = null;

  // Reconnection state
  private _reconnectAttempt = 0;

  // Heartbeat state
  private _heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private _heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private _quality: ConnectionQuality = 'good';
  private _degradedSince: number | null = null;

  get status() { return this._status; }
  get error() { return this._error; }
  get isConnected() { return this._status === 'connected'; }
  get quality() { return this._quality; }
  get reconnectAttempt() { return this._reconnectAttempt; }
  get gatewayUrl() { return GATEWAY_URL; }
  get gatewayHttpBase() {
    try {
      const parsed = new URL(GATEWAY_URL);
      parsed.protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:';
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString().replace(/\/$/, '');
    } catch {
      return 'http://127.0.0.1:18789';
    }
  }
  get canvasHostUrl() {
    const raw = this._helloPayload?.canvasHostUrl;
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
  }

  private setStatus(status: ConnectionStatus, error?: string) {
    console.log(`[OpenClaw] Status: ${this._status} -> ${status}`, error ? `(${error})` : '');
    this._status = status;
    this._error = error || null;
    this.statusHandlers.forEach(h => h(status));
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatusChange(handler: StatusHandler) {
    this.statusHandlers.add(handler);
    // Immediately call with current status
    handler(this._status);
    return () => this.statusHandlers.delete(handler);
  }

  onQualityChange(handler: QualityHandler) {
    this.qualityHandlers.add(handler);
    handler(this._quality);
    return () => this.qualityHandlers.delete(handler);
  }

  onReconnect(handler: ReconnectHandler) {
    this.reconnectHandlers.add(handler);
    return () => this.reconnectHandlers.delete(handler);
  }

  private setQuality(quality: ConnectionQuality) {
    if (this._quality === quality) return;
    console.log(`[OpenClaw] Quality: ${this._quality} -> ${quality}`);
    this._quality = quality;
    if (quality === 'degraded') {
      this._degradedSince = this._degradedSince ?? Date.now();
    } else {
      this._degradedSince = null;
    }
    this.qualityHandlers.forEach(h => h(quality));
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this._heartbeatInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      // Send a lightweight ping request
      const id = this.nextId();
      this.ws.send(JSON.stringify({ type: 'req', id, method: 'ping', params: {} }));

      this._heartbeatTimeout = setTimeout(() => {
        // No pong within timeout -- mark degraded
        this.setQuality('degraded');

        // If degraded for too long, mark lost and trigger stale recovery
        if (this._degradedSince && Date.now() - this._degradedSince >= DEGRADED_THRESHOLD_MS) {
          this.setQuality('lost');
        }
      }, HEARTBEAT_PONG_TIMEOUT_MS);

      // Listen for the pong response
      this.pendingRequests.set(id, {
        resolve: () => {
          if (this._heartbeatTimeout) {
            clearTimeout(this._heartbeatTimeout);
            this._heartbeatTimeout = null;
          }
          this.setQuality('good');
        },
        reject: () => {
          // Pong failed -- already handled by timeout above
        },
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
    if (this._heartbeatTimeout) {
      clearTimeout(this._heartbeatTimeout);
      this._heartbeatTimeout = null;
    }
  }

  private nextId(): string {
    return `req-${++this.requestId}-${Date.now()}`;
  }

  connect(): Promise<void> {
    // Return existing promise if already connecting
    if (this.connectPromise) {
      return this.connectPromise;
    }

    // Already connected
    if (this.ws?.readyState === WebSocket.OPEN && this._status === 'connected') {
      return Promise.resolve();
    }

    console.log('[OpenClaw] Connecting to', GATEWAY_URL);
    this.setStatus('connecting');

    this.connectPromise = new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(GATEWAY_URL);

        const connectTimeout = setTimeout(() => {
          console.error('[OpenClaw] Connection timeout');
          this.ws?.close();
          this.setStatus('error', 'Connection timeout');
          this.connectPromise = null;
          reject(new Error('Connection timeout'));
        }, 10000);

        this.ws.onopen = () => {
          console.log('[OpenClaw] WebSocket opened, waiting for challenge...');
          // Don't clear timeout yet - wait for successful handshake
        };

        this.ws.onmessage = (event) => {
          try {
            const msg: OpenClawMessage = JSON.parse(event.data);
            console.log('[OpenClaw] Received:', msg.type, msg.id || msg.event);

            // Handle connect.challenge event
            if (msg.type === 'event' && msg.event === 'connect.challenge') {
              console.log('[OpenClaw] Received challenge, sending handshake...');
              if (!GATEWAY_TOKEN) {
                console.warn('[OpenClaw] VITE_OPENCLAW_GATEWAY_TOKEN is not set; handshake may fail if gateway auth is enabled');
              }
              // Note: nonce from payload can be used for signed auth if needed

              // Send connect handshake with proper protocol params
              const connectId = this.nextId();
              this.pendingRequests.set(connectId, {
                resolve: (payload) => {
                  if (payload && typeof payload === 'object') {
                    this._helloPayload = payload as Record<string, unknown>;
                  } else {
                    this._helloPayload = null;
                  }
                  console.log('[OpenClaw] Connected successfully!');
                  clearTimeout(connectTimeout);
                  this.setStatus('connected');
                  this.setQuality('good');
                  this.startHeartbeat();
                  this.connectPromise = null;
                  resolve();
                },
                reject: (err) => {
                  console.error('[OpenClaw] Handshake failed:', err);
                  clearTimeout(connectTimeout);
                  this.setStatus('error', 'Handshake failed');
                  this.connectPromise = null;
                  reject(err);
                }
              });

              this.ws!.send(JSON.stringify({
                type: 'req',
                id: connectId,
                method: 'connect',
                params: {
                  minProtocol: PROTOCOL_VERSION,
                  maxProtocol: PROTOCOL_VERSION,
                  client: {
                    id: 'cli', // Use 'cli' to avoid device pairing requirement
                    displayName: 'Agora',
                    version: APP_VERSION,
                    platform: 'macos',
                    mode: 'cli' // Match the ID
                  },
                  auth: GATEWAY_TOKEN ? { token: GATEWAY_TOKEN } : undefined,
                  role: 'operator',
                  scopes: ['operator.read', 'operator.write', 'operator.admin'],
                  caps: [],
                  commands: [],
                  permissions: {},
                  locale: navigator.language || 'en-US',
                  userAgent: `Agora/${APP_VERSION}`
                }
              }));
              return;
            }

            // Handle response messages
            if (msg.type === 'res') {
              const pending = this.pendingRequests.get(msg.id!);
              if (pending) {
                this.pendingRequests.delete(msg.id!);
                if (msg.error || msg.ok === false) {
                  pending.reject(msg.error || new Error('Request failed'));
                } else {
                  pending.resolve(msg.payload);
                }
              }
            }

            // Notify all message handlers
            this.messageHandlers.forEach(h => h(msg));
          } catch (e) {
            console.error('[OpenClaw] Parse error:', e);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[OpenClaw] WebSocket error:', error);
          clearTimeout(connectTimeout);
          this.setStatus('error', 'Connection failed');
          this.connectPromise = null;
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('[OpenClaw] WebSocket closed:', event.code, event.reason);
          clearTimeout(connectTimeout);
          this.stopHeartbeat();

          const wasConnected = this._status === 'connected';
          this.setStatus('disconnected');
          this.setQuality('lost');
          this._helloPayload = null;
          this.ws = null;
          this.connectPromise = null;

          // Reject any pending requests
          this.pendingRequests.forEach((pending, id) => {
            pending.reject(new Error('Connection closed'));
            this.pendingRequests.delete(id);
          });

          // Auto-reconnect with exponential backoff + jitter
          if (wasConnected && this._reconnectAttempt < RECONNECT_MAX_ATTEMPTS) {
            const base = Math.min(
              RECONNECT_BASE_MS * Math.pow(2, this._reconnectAttempt),
              RECONNECT_MAX_MS,
            );
            // Add jitter: random 0-50% of base delay
            const jitter = Math.floor(Math.random() * base * 0.5);
            const delay = base + jitter;
            this._reconnectAttempt += 1;
            console.log(`[OpenClaw] Reconnect attempt ${this._reconnectAttempt}/${RECONNECT_MAX_ATTEMPTS} in ${delay}ms`);
            this.reconnectTimeout = setTimeout(() => {
              this.connect()
                .then(() => {
                  // Successful reconnection -- reset attempts and notify listeners
                  this._reconnectAttempt = 0;
                  this.reconnectHandlers.forEach(h => h());
                })
                .catch(console.error);
            }, delay);
          } else if (this._reconnectAttempt >= RECONNECT_MAX_ATTEMPTS) {
            console.error('[OpenClaw] Max reconnect attempts reached');
            this.setStatus('error', 'Max reconnect attempts reached');
          }
        };
      } catch (err) {
        console.error('[OpenClaw] Failed to create WebSocket:', err);
        this.setStatus('error', 'Failed to connect');
        this.connectPromise = null;
        reject(err);
      }
    });

    return this.connectPromise;
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this._status !== 'connected') {
      await this.connect();
    }

    const id = this.nextId();

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 300000); // 5 min timeout

      this.ws?.send(JSON.stringify({
        type: 'req',
        id,
        method,
        params,
      }));
    });
  }

  resetReconnectAttempts() {
    this._reconnectAttempt = 0;
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.stopHeartbeat();
    this._reconnectAttempt = 0;
    if (this.ws) {
      this.ws.onclose = null; // Prevent auto-reconnect
      this.ws.close();
      this.ws = null;
    }
    this._helloPayload = null;
    this.setStatus('disconnected');
    this.setQuality('lost');
  }
}

// Singleton instance
export const openclawClient = new OpenClawClient();

// Auto-connect on module load
openclawClient.connect().catch(err => {
  console.error('[OpenClaw] Initial connection failed:', err);
});
