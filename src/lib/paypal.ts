/**
 * PayPal REST API v2 Client
 *
 * IMPORTANT: For production use, API calls that require client_secret should
 * be routed through a Supabase Edge Function or Tauri command to keep the
 * secret server-side. The functions here are structured for that migration --
 * replace the fetch calls with your Edge Function endpoints when ready.
 *
 * For the MVP / sandbox testing, the access token flow is included directly.
 */

import type { PayPalConfig } from '../types/payments';

// ─── Constants ──────────────────────────────────────────────────────────────

const PAYPAL_SANDBOX_URL = 'https://api-m.sandbox.paypal.com';
const PAYPAL_LIVE_URL = 'https://api-m.paypal.com';

function getBaseUrl(mode: 'sandbox' | 'live'): string {
  return mode === 'sandbox' ? PAYPAL_SANDBOX_URL : PAYPAL_LIVE_URL;
}

// ─── Access Token ───────────────────────────────────────────────────────────

/**
 * Get an OAuth2 access token from PayPal using client credentials.
 *
 * NOTE: In production, this should happen server-side (Edge Function / Tauri command)
 * so that client_secret is never exposed to the browser.
 */
export async function getPayPalAccessToken(
  clientId: string,
  clientSecret: string,
  mode: 'sandbox' | 'live' = 'sandbox'
): Promise<string> {
  const baseUrl = getBaseUrl(mode);
  const credentials = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

// ─── Create Order ───────────────────────────────────────────────────────────

export interface CreateOrderResult {
  orderId: string;
  approvalUrl: string;
}

/**
 * Create a PayPal checkout order for an invoice.
 * Returns the order ID and the approval URL the payer should visit.
 */
export async function createPayPalOrder(
  accessToken: string,
  config: PayPalConfig,
  invoice: {
    amount_due: number;
    currency: string;
    invoice_number: string;
  }
): Promise<CreateOrderResult> {
  const baseUrl = getBaseUrl(config.mode);

  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: invoice.invoice_number,
        description: `Payment for invoice ${invoice.invoice_number}`,
        amount: {
          currency_code: invoice.currency,
          value: invoice.amount_due.toFixed(2),
        },
      },
    ],
    application_context: {
      brand_name: 'Agora',
      landing_page: 'LOGIN',
      user_action: 'PAY_NOW',
    },
  };

  const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal create order failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const approvalLink = data.links?.find(
    (l: { rel: string; href: string }) => l.rel === 'approve'
  );

  if (!approvalLink) {
    throw new Error('PayPal order created but no approval URL returned');
  }

  return {
    orderId: data.id as string,
    approvalUrl: approvalLink.href as string,
  };
}

// ─── Capture Order ──────────────────────────────────────────────────────────

export interface CaptureResult {
  status: string;
  payerEmail: string | null;
  payerName: string | null;
  captureAmount: number;
  captureCurrency: string;
}

/**
 * Capture a previously approved PayPal order.
 */
export async function capturePayPalOrder(
  accessToken: string,
  orderId: string,
  mode: 'sandbox' | 'live' = 'sandbox'
): Promise<CaptureResult> {
  const baseUrl = getBaseUrl(mode);

  const res = await fetch(
    `${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal capture failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const capture =
    data.purchase_units?.[0]?.payments?.captures?.[0];

  return {
    status: data.status,
    payerEmail: data.payer?.email_address ?? null,
    payerName: data.payer?.name
      ? `${data.payer.name.given_name ?? ''} ${data.payer.name.surname ?? ''}`.trim()
      : null,
    captureAmount: capture ? parseFloat(capture.amount.value) : 0,
    captureCurrency: capture?.amount?.currency_code ?? 'USD',
  };
}

// ─── Get Order Status ───────────────────────────────────────────────────────

export interface OrderStatus {
  id: string;
  status: string;
  payerEmail: string | null;
  payerName: string | null;
}

/**
 * Check the current status of a PayPal order.
 */
export async function getPayPalOrderStatus(
  accessToken: string,
  orderId: string,
  mode: 'sandbox' | 'live' = 'sandbox'
): Promise<OrderStatus> {
  const baseUrl = getBaseUrl(mode);

  const res = await fetch(
    `${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal get order failed: ${res.status} ${err}`);
  }

  const data = await res.json();

  return {
    id: data.id,
    status: data.status,
    payerEmail: data.payer?.email_address ?? null,
    payerName: data.payer?.name
      ? `${data.payer.name.given_name ?? ''} ${data.payer.name.surname ?? ''}`.trim()
      : null,
  };
}
