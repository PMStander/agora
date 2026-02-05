/**
 * Singleton OpenClaw WebSocket Client
 * Manages a single connection shared across all components
 */

type MessageHandler = (msg: OpenClawMessage) => void;
type StatusHandler = (status: ConnectionStatus) => void;

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

const GATEWAY_URL = 'ws://127.0.0.1:18789';

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
  private _status: ConnectionStatus = 'disconnected';
  private _error: string | null = null;
  private connectPromise: Promise<void> | null = null;

  get status() { return this._status; }
  get error() { return this._error; }
  get isConnected() { return this._status === 'connected'; }

  private setStatus(status: ConnectionStatus, error?: string) {
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

  private nextId(): string {
    return `req-${++this.requestId}-${Date.now()}`;
  }

  connect(): Promise<void> {
    // Return existing promise if already connecting
    if (this.connectPromise) {
      return this.connectPromise;
    }

    // Already connected
    if (this.ws?.readyState === WebSocket.OPEN) {
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
          console.log('[OpenClaw] WebSocket opened, sending handshake...');
          clearTimeout(connectTimeout);

          // Send connect handshake
          const connectId = this.nextId();
          this.pendingRequests.set(connectId, {
            resolve: () => {
              console.log('[OpenClaw] Connected successfully!');
              this.setStatus('connected');
              this.connectPromise = null;
              resolve();
            },
            reject: (err) => {
              console.error('[OpenClaw] Handshake failed:', err);
              this.setStatus('error', 'Handshake failed');
              this.connectPromise = null;
              reject(err);
            }
          });

          this.ws!.send(JSON.stringify({
            type: 'req',
            id: connectId,
            method: 'connect',
            params: {}
          }));
        };

        this.ws.onmessage = (event) => {
          try {
            const msg: OpenClawMessage = JSON.parse(event.data);
            this.handleMessage(msg);
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
          this.setStatus('disconnected');
          this.ws = null;
          this.connectPromise = null;

          // Auto-reconnect after 3 seconds if not clean close
          if (!event.wasClean && this._status !== 'error') {
            this.reconnectTimeout = setTimeout(() => {
              console.log('[OpenClaw] Attempting reconnect...');
              this.connect().catch(console.error);
            }, 3000);
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

  private handleMessage(msg: OpenClawMessage) {
    console.log('[OpenClaw] Received:', msg.type, msg.id || msg.event);

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
  }

  async send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
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

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.ws?.close();
    this.ws = null;
    this.setStatus('disconnected');
  }
}

// Singleton instance
export const openclawClient = new OpenClawClient();

// Auto-connect on module load
openclawClient.connect().catch(err => {
  console.error('[OpenClaw] Initial connection failed:', err);
});
