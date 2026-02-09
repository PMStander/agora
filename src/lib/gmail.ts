/**
 * Gmail Integration Library
 *
 * Google Cloud Console setup required:
 * 1. Create a project at https://console.cloud.google.com
 * 2. Enable the Gmail API
 * 3. Create OAuth 2.0 credentials (Desktop App type)
 * 4. Set redirect URI to http://localhost:8234/oauth/callback
 * 5. Required scopes:
 *    - https://www.googleapis.com/auth/gmail.send
 *    - https://www.googleapis.com/auth/gmail.readonly
 *    - https://www.googleapis.com/auth/gmail.modify
 * 6. Set VITE_GMAIL_CLIENT_ID and VITE_GMAIL_CLIENT_SECRET in .env
 *
 * OAuth flow for Tauri desktop app:
 * - Uses tauri-plugin-shell to open the consent screen in the default browser
 * - Redirect goes to localhost:8234 which the app intercepts via a polling mechanism
 * - Falls back to window.open() if Tauri shell is not available
 */

import { supabase } from './supabase';
import type { EmailAccount } from '../types/email';

// ─── Config ─────────────────────────────────────────────────────────────────

const GMAIL_CLIENT_ID = import.meta.env.VITE_GMAIL_CLIENT_ID || '';
const GMAIL_CLIENT_SECRET = import.meta.env.VITE_GMAIL_CLIENT_SECRET || '';
const GMAIL_REDIRECT_URI = 'http://localhost:8234/oauth/callback';
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

const GMAIL_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export function isGmailConfigured(): boolean {
  return GMAIL_CLIENT_ID !== '' && GMAIL_CLIENT_SECRET !== '';
}

// ─── OAuth Flow ─────────────────────────────────────────────────────────────

/**
 * Initiates the Gmail OAuth2 flow by opening the consent screen.
 * Uses Tauri shell plugin if available, otherwise falls back to window.open().
 * Returns the auth URL for reference.
 */
export function initiateGmailAuth(): string {
  const params = new URLSearchParams({
    client_id: GMAIL_CLIENT_ID,
    redirect_uri: GMAIL_REDIRECT_URI,
    response_type: 'code',
    scope: GMAIL_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  });

  const authUrl = `${GMAIL_AUTH_URL}?${params.toString()}`;

  // Try Tauri shell plugin first (opens in default browser)
  try {
    const tauriShell = (window as any).__TAURI__?.shell;
    if (tauriShell?.open) {
      tauriShell.open(authUrl);
      return authUrl;
    }
  } catch {
    // Tauri shell not available
  }

  // Fallback: open in new window
  window.open(authUrl, '_blank', 'noopener,noreferrer');
  return authUrl;
}

/**
 * Exchanges the authorization code for access/refresh tokens.
 */
export async function handleOAuthCallback(
  code: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  email: string;
} | null> {
  try {
    const tokenResponse = await fetch(GMAIL_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        redirect_uri: GMAIL_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      console.error('[Gmail] Token exchange failed:', await tokenResponse.text());
      return null;
    }

    const tokens = await tokenResponse.json();

    // Get the user's email address
    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    if (!profileResponse.ok) {
      console.error('[Gmail] Failed to get user profile');
      return null;
    }

    const profile = await profileResponse.json();

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      email: profile.email,
    };
  } catch (err) {
    console.error('[Gmail] OAuth callback error:', err);
    return null;
  }
}

/**
 * Refreshes the access token using a refresh token.
 */
export async function refreshAccessToken(
  account: EmailAccount
): Promise<string | null> {
  const credentials = account.credentials as {
    refresh_token?: string;
    access_token?: string;
    expires_at?: number;
  };

  if (!credentials.refresh_token) {
    console.error('[Gmail] No refresh token available');
    return null;
  }

  // Check if current token is still valid (5 min buffer)
  if (credentials.expires_at && credentials.expires_at > Date.now() + 300_000) {
    return credentials.access_token || null;
  }

  try {
    const response = await fetch(GMAIL_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        refresh_token: credentials.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('[Gmail] Token refresh failed:', await response.text());
      return null;
    }

    const data = await response.json();
    const expiresAt = Date.now() + data.expires_in * 1000;

    // Update stored credentials
    await supabase
      .from('email_accounts')
      .update({
        credentials: {
          ...credentials,
          access_token: data.access_token,
          expires_at: expiresAt,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id);

    return data.access_token;
  } catch (err) {
    console.error('[Gmail] Token refresh error:', err);
    return null;
  }
}

// ─── Gmail API Helpers ──────────────────────────────────────────────────────

async function getAccessToken(account: EmailAccount): Promise<string | null> {
  return refreshAccessToken(account);
}

/**
 * Sends an email via the Gmail API.
 */
export async function sendEmail(
  account: EmailAccount,
  to: string[],
  subject: string,
  body: string,
  options?: {
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    inReplyTo?: string;
    threadId?: string;
  }
): Promise<{ messageId: string; threadId: string } | null> {
  const accessToken = await getAccessToken(account);
  if (!accessToken) return null;

  // Build RFC 2822 email message
  const headers = [
    `From: ${account.display_name ? `${account.display_name} <${account.email_address}>` : account.email_address}`,
    `To: ${to.join(', ')}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
  ];

  if (options?.cc?.length) headers.push(`Cc: ${options.cc.join(', ')}`);
  if (options?.bcc?.length) headers.push(`Bcc: ${options.bcc.join(', ')}`);
  if (options?.replyTo) headers.push(`Reply-To: ${options.replyTo}`);
  if (options?.inReplyTo) headers.push(`In-Reply-To: ${options.inReplyTo}`);

  const rawMessage = `${headers.join('\r\n')}\r\n\r\n${body}`;
  const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const requestBody: Record<string, unknown> = {
    raw: encodedMessage,
  };
  if (options?.threadId) requestBody.threadId = options.threadId;

  try {
    const response = await fetch(`${GMAIL_API_BASE}/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error('[Gmail] Send failed:', await response.text());
      return null;
    }

    const result = await response.json();
    return {
      messageId: result.id,
      threadId: result.threadId,
    };
  } catch (err) {
    console.error('[Gmail] Send error:', err);
    return null;
  }
}

/**
 * Fetches emails from Gmail.
 */
export async function fetchEmails(
  account: EmailAccount,
  query?: string,
  maxResults = 20
): Promise<
  Array<{
    id: string;
    threadId: string;
    from: string;
    to: string[];
    subject: string;
    snippet: string;
    body: string;
    date: string;
    labels: string[];
  }>
> {
  const accessToken = await getAccessToken(account);
  if (!accessToken) return [];

  try {
    const params = new URLSearchParams({
      maxResults: String(maxResults),
    });
    if (query) params.set('q', query);

    const listResponse = await fetch(
      `${GMAIL_API_BASE}/messages?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!listResponse.ok) return [];
    const listData = await listResponse.json();

    if (!listData.messages?.length) return [];

    // Fetch full message details
    const messages = await Promise.all(
      listData.messages.map(async (msg: { id: string }) => {
        const msgResponse = await fetch(
          `${GMAIL_API_BASE}/messages/${msg.id}?format=full`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        if (!msgResponse.ok) return null;
        return msgResponse.json();
      })
    );

    return messages
      .filter(Boolean)
      .map((msg: any) => {
        const headers = msg.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())
            ?.value || '';

        // Extract body from payload
        let body = '';
        if (msg.payload?.body?.data) {
          body = decodeBase64Url(msg.payload.body.data);
        } else if (msg.payload?.parts) {
          const htmlPart = msg.payload.parts.find(
            (p: any) => p.mimeType === 'text/html'
          );
          const textPart = msg.payload.parts.find(
            (p: any) => p.mimeType === 'text/plain'
          );
          const part = htmlPart || textPart;
          if (part?.body?.data) {
            body = decodeBase64Url(part.body.data);
          }
        }

        return {
          id: msg.id,
          threadId: msg.threadId,
          from: getHeader('From'),
          to: getHeader('To')
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean),
          subject: getHeader('Subject'),
          snippet: msg.snippet || '',
          body,
          date: getHeader('Date'),
          labels: msg.labelIds || [],
        };
      });
  } catch (err) {
    console.error('[Gmail] Fetch error:', err);
    return [];
  }
}

/**
 * Fetches a full thread from Gmail.
 */
export async function fetchThread(
  account: EmailAccount,
  threadId: string
): Promise<any | null> {
  const accessToken = await getAccessToken(account);
  if (!accessToken) return null;

  try {
    const response = await fetch(
      `${GMAIL_API_BASE}/threads/${threadId}?format=full`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) return null;
    return response.json();
  } catch (err) {
    console.error('[Gmail] Thread fetch error:', err);
    return null;
  }
}

/**
 * Syncs inbox emails since last_synced_at.
 * Returns the count of new emails synced.
 */
export async function syncInbox(
  account: EmailAccount
): Promise<number> {
  const query = account.last_synced_at
    ? `after:${Math.floor(new Date(account.last_synced_at).getTime() / 1000)}`
    : 'newer_than:7d';

  const gmailEmails = await fetchEmails(account, query, 50);
  return gmailEmails.length;
}

// ─── Apple Mail Fallback ────────────────────────────────────────────────────

/**
 * Opens a mailto: URL to compose an email in Apple Mail (or default mail app).
 * Uses Tauri shell plugin if available.
 */
export function openMailto(
  to: string,
  subject?: string,
  body?: string,
  cc?: string,
  bcc?: string
): void {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  if (cc) params.set('cc', cc);
  if (bcc) params.set('bcc', bcc);

  const mailtoUrl = `mailto:${encodeURIComponent(to)}?${params.toString()}`;

  try {
    const tauriShell = (window as any).__TAURI__?.shell;
    if (tauriShell?.open) {
      tauriShell.open(mailtoUrl);
      return;
    }
  } catch {
    // Tauri shell not available
  }

  window.location.href = mailtoUrl;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function decodeBase64Url(data: string): string {
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return data;
  }
}
