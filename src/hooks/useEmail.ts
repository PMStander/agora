import { useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useEmailStore, useDefaultAccount } from '../stores/email';
import { handleRealtimePayload } from '../lib/realtimeHelpers';
import {
  initiateGmailAuth,
  handleOAuthCallback,
  sendEmail as gmailSendEmail,
  fetchEmails as gmailFetchEmails,
  syncInbox as gmailSyncInbox,
  isGmailConfigured,
  openMailto,
} from '../lib/gmail';
import type {
  Email,
  EmailTemplate,
  EmailAccount,
  EmailCategory,
} from '../types/email';
import type { Contact } from '../types/crm';

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useEmail() {
  const store = useEmailStore();
  const defaultAccount = useDefaultAccount();
  const initializedRef = useRef(false);

  // ── Initial fetch + realtime subscriptions ──
  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    // Fetch emails
    supabase
      .from('emails')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!error && data) store.setEmails(data as Email[]);
      });

    // Fetch templates
    supabase
      .from('email_templates')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) store.setTemplates(data as EmailTemplate[]);
      });

    // Fetch accounts
    supabase
      .from('email_accounts')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) store.setAccounts(data as EmailAccount[]);
      });

    // ── Realtime subscription for emails ──
    const emailsSub = supabase
      .channel('email-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'emails' },
        (payload) =>
          handleRealtimePayload<Email>(
            payload,
            store.addEmail,
            store.updateEmail,
            store.removeEmail
          )
      )
      .subscribe();

    return () => {
      emailsSub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Gmail OAuth ──

  const connectGmail = useCallback(() => {
    if (!isGmailConfigured()) {
      console.error('[Email] Gmail not configured. Set VITE_GMAIL_CLIENT_ID and VITE_GMAIL_CLIENT_SECRET.');
      return;
    }
    initiateGmailAuth();
  }, []);

  const completeGmailAuth = useCallback(
    async (code: string) => {
      const result = await handleOAuthCallback(code);
      if (!result) return null;

      // Create or update email account
      const { data: existing } = await supabase
        .from('email_accounts')
        .select('id')
        .eq('email_address', result.email)
        .single();

      const accountData = {
        email_address: result.email,
        display_name: result.email.split('@')[0],
        provider: 'gmail' as const,
        credentials: {
          access_token: result.access_token,
          refresh_token: result.refresh_token,
          expires_at: Date.now() + result.expires_in * 1000,
        },
        is_default: store.accounts.length === 0,
        sync_enabled: true,
      };

      if (existing) {
        const { data: updated, error } = await supabase
          .from('email_accounts')
          .update({ ...accountData, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();
        if (!error && updated) {
          store.updateAccount(existing.id, updated as EmailAccount);
          return updated as EmailAccount;
        }
      } else {
        const { data: created, error } = await supabase
          .from('email_accounts')
          .insert(accountData)
          .select()
          .single();
        if (!error && created) {
          store.addAccount(created as EmailAccount);
          return created as EmailAccount;
        }
      }
      return null;
    },
    [store]
  );

  // ── Send Email ──

  const sendEmailAction = useCallback(
    async (data: {
      to: string[];
      subject: string;
      body: string;
      cc?: string[];
      bcc?: string[];
      contact_id?: string;
      company_id?: string;
      deal_id?: string;
      template_id?: string;
      account?: EmailAccount;
    }) => {
      const account = data.account || defaultAccount;

      if (!account) {
        // Fallback to mailto
        openMailto(data.to[0], data.subject, data.body, data.cc?.join(','), data.bcc?.join(','));
        return null;
      }

      if (account.provider === 'apple_mail') {
        openMailto(data.to[0], data.subject, data.body, data.cc?.join(','), data.bcc?.join(','));
        return null;
      }

      // Send via Gmail API
      const result = await gmailSendEmail(account, data.to, data.subject, data.body, {
        cc: data.cc,
        bcc: data.bcc,
      });

      if (!result) {
        console.error('[Email] Failed to send via Gmail');
        return null;
      }

      // Create email record in DB
      const emailRecord = {
        direction: 'outbound' as const,
        status: 'sent' as const,
        from_address: account.email_address,
        to_addresses: data.to,
        cc_addresses: data.cc || [],
        bcc_addresses: data.bcc || [],
        subject: data.subject,
        body_html: data.body,
        contact_id: data.contact_id || null,
        company_id: data.company_id || null,
        deal_id: data.deal_id || null,
        template_id: data.template_id || null,
        email_account_id: account.id,
        external_message_id: result.messageId,
        gmail_thread_id: result.threadId,
        sent_at: new Date().toISOString(),
      };

      const { data: email, error } = await supabase
        .from('emails')
        .insert(emailRecord)
        .select()
        .single();

      if (error) {
        console.error('[Email] Error saving email record:', error);
        return null;
      }

      // Auto-create CRM interaction
      const interactionData = {
        interaction_type: 'email' as const,
        subject: data.subject,
        body: data.body,
        contact_id: data.contact_id || null,
        company_id: data.company_id || null,
        deal_id: data.deal_id || null,
        direction: 'outbound' as const,
      };

      const { data: interaction } = await supabase
        .from('crm_interactions')
        .insert(interactionData)
        .select()
        .single();

      // Link interaction back to email
      if (interaction) {
        await supabase
          .from('emails')
          .update({ interaction_id: interaction.id })
          .eq('id', email.id);
      }

      // Update last_contacted_at on contact
      if (data.contact_id) {
        await supabase
          .from('contacts')
          .update({ last_contacted_at: new Date().toISOString() })
          .eq('id', data.contact_id);
      }

      store.addEmail(email as Email);
      return email as Email;
    },
    [store, defaultAccount]
  );

  // ── Save Draft ──

  const saveDraft = useCallback(
    async (data: {
      to?: string[];
      subject?: string;
      body?: string;
      cc?: string[];
      bcc?: string[];
      contact_id?: string;
      company_id?: string;
      deal_id?: string;
      existingDraftId?: string;
    }) => {
      const account = defaultAccount;

      const draftData = {
        direction: 'outbound' as const,
        status: 'draft' as const,
        from_address: account?.email_address || null,
        to_addresses: data.to || [],
        cc_addresses: data.cc || [],
        bcc_addresses: data.bcc || [],
        subject: data.subject || null,
        body_html: data.body || null,
        contact_id: data.contact_id || null,
        company_id: data.company_id || null,
        deal_id: data.deal_id || null,
        email_account_id: account?.id || null,
      };

      if (data.existingDraftId) {
        const { error } = await supabase
          .from('emails')
          .update({ ...draftData, updated_at: new Date().toISOString() })
          .eq('id', data.existingDraftId);
        if (!error) {
          store.updateEmail(data.existingDraftId, draftData as Partial<Email>);
        }
        return data.existingDraftId;
      }

      const { data: email, error } = await supabase
        .from('emails')
        .insert(draftData)
        .select()
        .single();
      if (error) {
        console.error('[Email] Error saving draft:', error);
        return null;
      }
      store.addEmail(email as Email);
      return email.id;
    },
    [store, defaultAccount]
  );

  // ── Reply ──

  const replyToEmail = useCallback(
    async (emailId: string, body: string) => {
      const originalEmail = store.emails.find((e) => e.id === emailId);
      if (!originalEmail) return null;

      const replyTo = originalEmail.from_address
        ? [originalEmail.from_address]
        : originalEmail.to_addresses;

      return sendEmailAction({
        to: replyTo,
        subject: `Re: ${originalEmail.subject || ''}`,
        body,
        contact_id: originalEmail.contact_id || undefined,
        company_id: originalEmail.company_id || undefined,
        deal_id: originalEmail.deal_id || undefined,
      });
    },
    [store, sendEmailAction]
  );

  // ── Template Application ──

  const applyTemplate = useCallback(
    (templateId: string, contact?: Contact | null): { subject: string; body: string } | null => {
      const template = store.templates.find((t) => t.id === templateId);
      if (!template) return null;

      let subject = template.subject || '';
      let body = template.body_html || template.body_text || '';

      // Variable substitution
      if (contact) {
        const vars: Record<string, string> = {
          first_name: contact.first_name,
          last_name: contact.last_name,
          full_name: `${contact.first_name} ${contact.last_name}`,
          email: contact.email || '',
          phone: contact.phone || '',
          job_title: contact.job_title || '',
        };

        for (const [key, value] of Object.entries(vars)) {
          const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          subject = subject.replace(pattern, value);
          body = body.replace(pattern, value);
        }
      }

      // Apply default values for remaining variables
      if (template.variables) {
        for (const v of template.variables) {
          const pattern = new RegExp(`\\{\\{${v.name}\\}\\}`, 'g');
          subject = subject.replace(pattern, v.default_value || '');
          body = body.replace(pattern, v.default_value || '');
        }
      }

      return { subject, body };
    },
    [store]
  );

  // ── Template CRUD ──

  const createTemplate = useCallback(
    async (data: {
      name: string;
      subject?: string;
      body_html?: string;
      body_text?: string;
      category?: EmailCategory;
      variables?: Array<{ name: string; default_value?: string }>;
      owner_agent_id?: string;
    }) => {
      const { data: template, error } = await supabase
        .from('email_templates')
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error('[Email] Error creating template:', error);
        return null;
      }
      store.addTemplate(template as EmailTemplate);
      return template as EmailTemplate;
    },
    [store]
  );

  const updateTemplateDetails = useCallback(
    async (templateId: string, updates: Partial<EmailTemplate>) => {
      const { error } = await supabase
        .from('email_templates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', templateId);
      if (error) {
        console.error('[Email] Error updating template:', error);
        return;
      }
      store.updateTemplate(templateId, updates);
    },
    [store]
  );

  const deleteTemplate = useCallback(
    async (templateId: string) => {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId);
      if (error) {
        console.error('[Email] Error deleting template:', error);
        return;
      }
      store.removeTemplate(templateId);
    },
    [store]
  );

  // ── Gmail Sync ──

  const syncGmail = useCallback(
    async (account?: EmailAccount) => {
      const syncAccount = account || defaultAccount;
      if (!syncAccount || syncAccount.provider !== 'gmail') return 0;

      const gmailMessages = await gmailFetchEmails(
        syncAccount,
        syncAccount.last_synced_at
          ? `after:${Math.floor(new Date(syncAccount.last_synced_at).getTime() / 1000)}`
          : 'newer_than:7d',
        50
      );

      let synced = 0;

      // Fetch contacts for email matching
      const { data: contacts } = await supabase.from('contacts').select('id, email');
      const contactByEmail = new Map(
        (contacts || []).filter((c: any) => c.email).map((c: any) => [c.email.toLowerCase(), c.id])
      );

      for (const msg of gmailMessages) {
        // Skip if already synced
        const { data: existing } = await supabase
          .from('emails')
          .select('id')
          .eq('external_message_id', msg.id)
          .single();
        if (existing) continue;

        // Extract sender email
        const fromMatch = msg.from.match(/<([^>]+)>/) || [null, msg.from];
        const senderEmail = (fromMatch[1] || msg.from).trim().toLowerCase();
        const matchedContactId = contactByEmail.get(senderEmail) || null;

        const emailRecord = {
          direction: 'inbound' as const,
          status: 'received' as const,
          from_address: msg.from,
          to_addresses: msg.to,
          subject: msg.subject,
          body_html: msg.body,
          body_text: msg.snippet,
          contact_id: matchedContactId,
          email_account_id: syncAccount.id,
          external_message_id: msg.id,
          gmail_thread_id: msg.threadId,
          received_at: msg.date ? new Date(msg.date).toISOString() : new Date().toISOString(),
          labels: msg.labels,
        };

        const { data: email, error } = await supabase
          .from('emails')
          .insert(emailRecord)
          .select()
          .single();

        if (!error && email) {
          store.addEmail(email as Email);

          // Auto-create inbound CRM interaction
          if (matchedContactId) {
            await supabase.from('crm_interactions').insert({
              interaction_type: 'email',
              subject: msg.subject,
              body: msg.snippet,
              contact_id: matchedContactId,
              direction: 'inbound',
            });
          }

          synced++;
        }
      }

      // Update last_synced_at
      const now = new Date().toISOString();
      await supabase
        .from('email_accounts')
        .update({ last_synced_at: now, updated_at: now })
        .eq('id', syncAccount.id);
      store.updateAccount(syncAccount.id, { last_synced_at: now });

      return synced;
    },
    [store, defaultAccount]
  );

  // ── Delete Email ──

  const deleteEmail = useCallback(
    async (emailId: string) => {
      const { error } = await supabase
        .from('emails')
        .delete()
        .eq('id', emailId);
      if (error) {
        console.error('[Email] Error deleting email:', error);
        return;
      }
      store.removeEmail(emailId);
    },
    [store]
  );

  return {
    // Data
    emails: store.emails,
    templates: store.templates,
    accounts: store.accounts,

    // Gmail Auth
    connectGmail,
    completeGmailAuth,
    isGmailConfigured: isGmailConfigured(),

    // Email Actions
    sendEmail: sendEmailAction,
    saveDraft,
    replyToEmail,
    deleteEmail,

    // Templates
    applyTemplate,
    createTemplate,
    updateTemplateDetails,
    deleteTemplate,

    // Sync
    syncGmail,

    // State
    isConfigured: isSupabaseConfigured(),
  };
}
