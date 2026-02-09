import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  createPayPalOrder,
  capturePayPalOrder,
  getPayPalOrderStatus,
  getPayPalAccessToken,
} from '../lib/paypal';
import type {
  PaymentSettings,
  PaymentLink,
  PayPalConfig,
} from '../types/payments';
import type { InvoiceStatus } from '../types/invoicing';
import { useInvoicingStore } from '../stores/invoicing';

// ─── Hook ───────────────────────────────────────────────────────────────────

export function usePayments() {
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const initializedRef = useRef(false);
  const invoicingStore = useInvoicingStore();

  // ── Fetch active PayPal settings on mount ──
  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    supabase
      .from('payment_settings')
      .select('*')
      .eq('provider', 'paypal')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setPaymentSettings(data as PaymentSettings);
      });
  }, []);

  // ── Settings CRUD ──

  const fetchPaymentSettings = useCallback(async (): Promise<PaymentSettings | null> => {
    const { data, error } = await supabase
      .from('payment_settings')
      .select('*')
      .eq('provider', 'paypal')
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('[Payments] Error fetching settings:', error);
      return null;
    }
    if (data) setPaymentSettings(data as PaymentSettings);
    return (data as PaymentSettings) ?? null;
  }, []);

  const savePaymentSettings = useCallback(
    async (config: PayPalConfig, currency: string, isActive: boolean) => {
      setLoading(true);
      try {
        // Upsert by provider
        const { data, error } = await supabase
          .from('payment_settings')
          .upsert(
            {
              provider: 'paypal',
              is_active: isActive,
              config,
              currency,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'provider' }
          )
          .select()
          .single();

        if (error) {
          console.error('[Payments] Error saving settings:', error);
          return null;
        }
        const settings = data as PaymentSettings;
        setPaymentSettings(settings);
        return settings;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── Payment Links ──

  const getPaymentLinksForInvoice = useCallback(
    async (invoiceId: string): Promise<PaymentLink[]> => {
      const { data, error } = await supabase
        .from('payment_links')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('[Payments] Error fetching payment links:', error);
        return [];
      }
      return data as PaymentLink[];
    },
    []
  );

  const createPaymentLink = useCallback(
    async (
      invoiceId: string,
      accessToken: string
    ): Promise<PaymentLink | null> => {
      if (!paymentSettings) {
        console.error('[Payments] No PayPal settings configured');
        return null;
      }

      const config = paymentSettings.config as PayPalConfig;
      if (!config.client_id) {
        console.error('[Payments] PayPal client_id not configured');
        return null;
      }

      // Get invoice from store
      const invoice = invoicingStore.invoices.find((i) => i.id === invoiceId);
      if (!invoice) {
        console.error('[Payments] Invoice not found:', invoiceId);
        return null;
      }

      if (invoice.amount_due <= 0) {
        console.error('[Payments] Invoice has no balance due');
        return null;
      }

      setLoading(true);
      try {
        // Create PayPal order
        const result = await createPayPalOrder(accessToken, config, {
          amount_due: invoice.amount_due,
          currency: invoice.currency,
          invoice_number: invoice.invoice_number,
        });

        // Save payment link to DB
        const { data, error } = await supabase
          .from('payment_links')
          .insert({
            invoice_id: invoiceId,
            provider: 'paypal',
            external_id: result.orderId,
            checkout_url: result.approvalUrl,
            status: 'created',
            amount: invoice.amount_due,
            currency: invoice.currency,
          })
          .select()
          .single();

        if (error) {
          console.error('[Payments] Error saving payment link:', error);
          return null;
        }

        return data as PaymentLink;
      } catch (err) {
        console.error('[Payments] Error creating PayPal order:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [paymentSettings, invoicingStore.invoices]
  );

  const capturePayment = useCallback(
    async (
      paymentLinkId: string,
      accessToken: string
    ): Promise<boolean> => {
      if (!paymentSettings) return false;
      const config = paymentSettings.config as PayPalConfig;

      // Get the payment link
      const { data: link, error: linkErr } = await supabase
        .from('payment_links')
        .select('*')
        .eq('id', paymentLinkId)
        .single();
      if (linkErr || !link) {
        console.error('[Payments] Payment link not found:', linkErr);
        return false;
      }

      const paymentLink = link as PaymentLink;
      if (!paymentLink.external_id) {
        console.error('[Payments] No external order ID');
        return false;
      }

      setLoading(true);
      try {
        const result = await capturePayPalOrder(
          accessToken,
          paymentLink.external_id,
          config.mode
        );

        if (result.status === 'COMPLETED') {
          // Update payment link
          await supabase
            .from('payment_links')
            .update({
              status: 'completed',
              payer_email: result.payerEmail,
              payer_name: result.payerName,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', paymentLinkId);

          // Record invoice payment using the invoicing recordPayment pattern
          const { data: payment, error: payErr } = await supabase
            .from('invoice_payments')
            .insert({
              invoice_id: paymentLink.invoice_id,
              amount: result.captureAmount,
              payment_method: 'PayPal',
              reference_number: paymentLink.external_id,
              notes: `PayPal capture. Payer: ${result.payerEmail ?? 'unknown'}`,
            })
            .select()
            .single();

          if (payErr) {
            console.error('[Payments] Error recording invoice payment:', payErr);
          }

          // Update invoice amount_paid and status
          const invoice = invoicingStore.invoices.find(
            (i) => i.id === paymentLink.invoice_id
          );
          if (invoice && payment) {
            const newAmountPaid = invoice.amount_paid + result.captureAmount;
            const newStatus: InvoiceStatus =
              newAmountPaid >= invoice.total ? 'paid' : 'partially_paid';
            const updates: Record<string, unknown> = {
              amount_paid: newAmountPaid,
              status: newStatus,
              updated_at: new Date().toISOString(),
            };
            if (newStatus === 'paid') {
              updates.paid_at = new Date().toISOString();
            }

            await supabase
              .from('invoices')
              .update(updates)
              .eq('id', paymentLink.invoice_id);
            invoicingStore.updateInvoice(paymentLink.invoice_id, updates as any);
          }

          return true;
        }

        return false;
      } catch (err) {
        console.error('[Payments] Error capturing payment:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [paymentSettings, invoicingStore]
  );

  const checkPaymentStatus = useCallback(
    async (
      paymentLinkId: string,
      accessToken: string
    ): Promise<PaymentLink | null> => {
      if (!paymentSettings) return null;
      const config = paymentSettings.config as PayPalConfig;

      const { data: link, error: linkErr } = await supabase
        .from('payment_links')
        .select('*')
        .eq('id', paymentLinkId)
        .single();
      if (linkErr || !link) return null;

      const paymentLink = link as PaymentLink;
      if (!paymentLink.external_id) return paymentLink;

      try {
        const status = await getPayPalOrderStatus(
          accessToken,
          paymentLink.external_id,
          config.mode
        );

        // Map PayPal status to our status
        let newStatus = paymentLink.status;
        if (status.status === 'APPROVED') newStatus = 'approved';
        else if (status.status === 'COMPLETED') newStatus = 'completed';
        else if (status.status === 'VOIDED') newStatus = 'cancelled';

        if (newStatus !== paymentLink.status) {
          await supabase
            .from('payment_links')
            .update({
              status: newStatus,
              payer_email: status.payerEmail ?? paymentLink.payer_email,
              payer_name: status.payerName ?? paymentLink.payer_name,
              updated_at: new Date().toISOString(),
            })
            .eq('id', paymentLinkId);
        }

        return { ...paymentLink, status: newStatus } as PaymentLink;
      } catch (err) {
        console.error('[Payments] Error checking status:', err);
        return paymentLink;
      }
    },
    [paymentSettings]
  );

  return {
    paymentSettings,
    loading,

    // Settings
    fetchPaymentSettings,
    savePaymentSettings,

    // Payment links
    getPaymentLinksForInvoice,
    createPaymentLink,
    capturePayment,
    checkPaymentStatus,

    // Utilities
    getPayPalAccessToken,
    isConfigured: isSupabaseConfigured(),
    isPayPalActive: paymentSettings?.is_active ?? false,
  };
}
