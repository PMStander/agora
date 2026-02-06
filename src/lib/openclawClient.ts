/**
 * Singleton OpenClaw WebSocket Client
 * Implements OpenClaw Gateway Protocol v3
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
const PROTOCOL_VERSION = 3;

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
              // Note: nonce from payload can be used for signed auth if needed
              
              // Send connect handshake with proper protocol params
              const connectId = this.nextId();
              this.pendingRequests.set(connectId, {
                resolve: () => {
                  console.log('[OpenClaw] Connected successfully!');
                  clearTimeout(connectTimeout);
                  this.setStatus('connected');
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
                    id: 'cli',  // Use 'cli' to avoid device pairing requirement
                    displayName: 'Agora',
                    version: '0.1.0',
                    platform: 'macos',
                    mode: 'cli'  // Match the ID
                  },
                  auth: {
                    token: '15a28c1c50501b7ab7b60e9e0c10876d282cda40d71c9bb2'  // Gateway auth token
                  },
                  role: 'operator',
                  scopes: ['operator.read', 'operator.write', 'operator.admin'],
                  caps: [],
                  commands: [],
                  permissions: {},
                  locale: navigator.language || 'en-US',
                  userAgent: 'Agora/0.1.0'
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
          
          const wasConnected = this._status === 'connected';
          this.setStatus('disconnected');
          this.ws = null;
          this.connectPromise = null;

          // Reject any pending requests
          this.pendingRequests.forEach((pending, id) => {
            pending.reject(new Error('Connection closed'));
            this.pendingRequests.delete(id);
          });

          // Auto-reconnect after 3 seconds if was previously connected
          if (wasConnected) {
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

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // Prevent auto-reconnect
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }
}

// Singleton instance
export const openclawClient = new OpenClawClient();

// Auto-connect on module load
openclawClient.connect().catch(err => {
  console.error('[OpenClaw] Initial connection failed:', err);
});
