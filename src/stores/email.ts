import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Email, EmailTemplate, EmailAccount } from '../types/email';

// ─── Store Interface ────────────────────────────────────────────────────────

type EmailSubTab = 'inbox' | 'sent' | 'drafts' | 'templates';

interface EmailState {
  // Data (loaded from Supabase, NOT persisted to localStorage)
  emails: Email[];
  templates: EmailTemplate[];
  accounts: EmailAccount[];

  // UI State (persisted)
  selectedEmailId: string | null;
  selectedAccountId: string | null;
  activeSubTab: EmailSubTab;
  composeOpen: boolean;
  replyToId: string | null;
  searchQuery: string;

  // ─── Email Actions ──────────────────────────────────────────
  setEmails: (emails: Email[]) => void;
  addEmail: (email: Email) => void;
  updateEmail: (emailId: string, updates: Partial<Email>) => void;
  removeEmail: (emailId: string) => void;

  // ─── Template Actions ───────────────────────────────────────
  setTemplates: (templates: EmailTemplate[]) => void;
  addTemplate: (template: EmailTemplate) => void;
  updateTemplate: (templateId: string, updates: Partial<EmailTemplate>) => void;
  removeTemplate: (templateId: string) => void;

  // ─── Account Actions ────────────────────────────────────────
  setAccounts: (accounts: EmailAccount[]) => void;
  addAccount: (account: EmailAccount) => void;
  updateAccount: (accountId: string, updates: Partial<EmailAccount>) => void;
  removeAccount: (accountId: string) => void;

  // ─── UI Actions ─────────────────────────────────────────────
  selectEmail: (id: string | null) => void;
  selectAccount: (id: string | null) => void;
  setActiveSubTab: (tab: EmailSubTab) => void;
  setComposeOpen: (open: boolean) => void;
  setReplyToId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

const EMAIL_STORAGE_KEY = 'agora-email-v1';

export const useEmailStore = create<EmailState>()(
  persist(
    (set) => ({
      // Initial data
      emails: [],
      templates: [],
      accounts: [],

      // UI State
      selectedEmailId: null,
      selectedAccountId: null,
      activeSubTab: 'inbox',
      composeOpen: false,
      replyToId: null,
      searchQuery: '',

      // Email Actions (upsert pattern)
      setEmails: (emails) => set({ emails }),
      addEmail: (email) =>
        set((state) => {
          const idx = state.emails.findIndex((e) => e.id === email.id);
          if (idx === -1) return { emails: [email, ...state.emails] };
          const emails = [...state.emails];
          emails[idx] = { ...emails[idx], ...email };
          return { emails };
        }),
      updateEmail: (emailId, updates) =>
        set((state) => ({
          emails: state.emails.map((e) =>
            e.id === emailId ? { ...e, ...updates } : e
          ),
        })),
      removeEmail: (emailId) =>
        set((state) => ({
          emails: state.emails.filter((e) => e.id !== emailId),
          selectedEmailId:
            state.selectedEmailId === emailId ? null : state.selectedEmailId,
        })),

      // Template Actions (upsert pattern)
      setTemplates: (templates) => set({ templates }),
      addTemplate: (template) =>
        set((state) => {
          const idx = state.templates.findIndex((t) => t.id === template.id);
          if (idx === -1) return { templates: [template, ...state.templates] };
          const templates = [...state.templates];
          templates[idx] = { ...templates[idx], ...template };
          return { templates };
        }),
      updateTemplate: (templateId, updates) =>
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === templateId ? { ...t, ...updates } : t
          ),
        })),
      removeTemplate: (templateId) =>
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== templateId),
        })),

      // Account Actions (upsert pattern)
      setAccounts: (accounts) => set({ accounts }),
      addAccount: (account) =>
        set((state) => {
          const idx = state.accounts.findIndex((a) => a.id === account.id);
          if (idx === -1) return { accounts: [account, ...state.accounts] };
          const accounts = [...state.accounts];
          accounts[idx] = { ...accounts[idx], ...account };
          return { accounts };
        }),
      updateAccount: (accountId, updates) =>
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === accountId ? { ...a, ...updates } : a
          ),
        })),
      removeAccount: (accountId) =>
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== accountId),
          selectedAccountId:
            state.selectedAccountId === accountId ? null : state.selectedAccountId,
        })),

      // UI Actions
      selectEmail: (id) => set({ selectedEmailId: id }),
      selectAccount: (id) => set({ selectedAccountId: id }),
      setActiveSubTab: (tab) => set({ activeSubTab: tab }),
      setComposeOpen: (open) => set({ composeOpen: open, replyToId: open ? null : null }),
      setReplyToId: (id) => set({ replyToId: id, composeOpen: true }),
      setSearchQuery: (query) => set({ searchQuery: query }),
    }),
    {
      name: EMAIL_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Supabase-first: only persist UI state, NOT entity data
      partialize: (state) => ({
        selectedEmailId: state.selectedEmailId,
        selectedAccountId: state.selectedAccountId,
        activeSubTab: state.activeSubTab,
        searchQuery: state.searchQuery,
      }),
    }
  )
);

// ─── Selectors ──────────────────────────────────────────────────────────────

export const useSelectedEmail = () => {
  const emails = useEmailStore((s) => s.emails);
  const selectedId = useEmailStore((s) => s.selectedEmailId);
  return emails.find((e) => e.id === selectedId) || null;
};

export const useInboxEmails = () => {
  const emails = useEmailStore((s) => s.emails);
  return emails.filter((e) => e.direction === 'inbound' && e.status === 'received');
};

export const useSentEmails = () => {
  const emails = useEmailStore((s) => s.emails);
  return emails.filter(
    (e) => e.direction === 'outbound' && e.status !== 'draft'
  );
};

export const useDraftEmails = () => {
  const emails = useEmailStore((s) => s.emails);
  return emails.filter((e) => e.status === 'draft');
};

export const useEmailsForContact = (contactId: string | null) => {
  const emails = useEmailStore((s) => s.emails);
  if (!contactId) return [];
  return emails.filter((e) => e.contact_id === contactId);
};

export const useEmailsForDeal = (dealId: string | null) => {
  const emails = useEmailStore((s) => s.emails);
  if (!dealId) return [];
  return emails.filter((e) => e.deal_id === dealId);
};

export const useEmailThread = (threadId: string | null) => {
  const emails = useEmailStore((s) => s.emails);
  if (!threadId) return [];
  return emails
    .filter((e) => e.id === threadId || e.thread_id === threadId)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
};

export const useDefaultAccount = () => {
  const accounts = useEmailStore((s) => s.accounts);
  return accounts.find((a) => a.is_default) || accounts[0] || null;
};

// ─── Profile Workspace Selectors ─────────────────────────────────────────────

export const useEmailsForCompany = (companyId: string | null, companyContactIds: Set<string>) => {
  const emails = useEmailStore((s) => s.emails);
  if (!companyId || companyContactIds.size === 0) return [];
  return emails.filter((e) => e.contact_id && companyContactIds.has(e.contact_id));
};
