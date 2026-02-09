/**
 * OpenClaw Gateway WebSocket Client
 * Connects to the OpenClaw Gateway for agent communication
 */

export interface OpenClawConfig {
  host: string;
  port: number;
  token?: string;
}

export interface AgentMessage {
  type: 'req' | 'res' | 'event';
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  payload?: unknown;
  error?: { code: number; message: string };
  event?: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export class OpenClawClient {
  private ws: WebSocket | null = null;
  private config: OpenClawConfig;
  private requestId = 0;
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }>();
  
  public onStatusChange?: (status: ConnectionStatus) => void;
  public onEvent?: (event: string, payload: unknown) => void;
  public onAgentStream?: (content: string, done: boolean) => void;

  constructor(config: OpenClawConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.onStatusChange?.('connecting');
      
      const url = `ws://${this.config.host}:${this.config.port}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        // Send connect handshake
        this.send({
          type: 'req',
          id: this.nextId(),
          method: 'connect',
          params: {
            auth: this.config.token ? { token: this.config.token } : undefined,
          },
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: AgentMessage = JSON.parse(event.data);
          this.handleMessage(msg, resolve, reject);
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      this.ws.onerror = (error) => {
        this.onStatusChange?.('error');
        reject(error);
      };

      this.ws.onclose = () => {
        this.onStatusChange?.('disconnected');
        this.ws = null;
      };
    });
  }

  private handleMessage(
    msg: AgentMessage,
    connectResolve?: () => void,
    connectReject?: (reason: unknown) => void
  ) {
    if (msg.type === 'res') {
      // Handle connect response
      if (msg.id?.startsWith('connect-') && connectResolve) {
        if (msg.error) {
          this.onStatusChange?.('error');
          connectReject?.(msg.error);
        } else {
          this.onStatusChange?.('connected');
          connectResolve();
        }
        return;
      }

      // Handle other responses
      const pending = this.pendingRequests.get(msg.id!);
      if (pending) {
        this.pendingRequests.delete(msg.id!);
        if (msg.error) {
          pending.reject(msg.error);
        } else {
          pending.resolve(msg.payload);
        }
      }
    } else if (msg.type === 'event') {
      this.onEvent?.(msg.event!, msg.payload);
      
      // Handle agent streaming events
      if (msg.event === 'agent') {
        const payload = msg.payload as { content?: string; done?: boolean };
        if (payload.content !== undefined) {
          this.onAgentStream?.(payload.content, payload.done ?? false);
        }
      }
    }
  }

  async sendMessage(message: string, agentId?: string): Promise<unknown> {
    const id = this.nextId();
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      this.send({
        type: 'req',
        id,
        method: 'agent',
        params: {
          message,
          agentId,
        },
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 300000);
    });
  }

  private send(msg: AgentMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private nextId(): string {
    return `req-${++this.requestId}`;
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}

// Default config for local development
export const defaultConfig: OpenClawConfig = {
  host: '127.0.0.1',
  port: 18789,
  token: import.meta.env.VITE_OPENCLAW_GATEWAY_TOKEN || import.meta.env.VITE_OPENCLAW_TOKEN,
};
