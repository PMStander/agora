import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  Contact,
  Company,
  DealPipeline,
  Deal,
  CrmInteraction,
  LifecycleStatus,
  DealStatus,
  CrmEntityType,
} from '../types/crm';

// ─── Store Interface ────────────────────────────────────────────────────────

interface CrmState {
  // Data (loaded from Supabase, NOT persisted to localStorage)
  contacts: Contact[];
  companies: Company[];
  pipelines: DealPipeline[];
  deals: Deal[];
  interactions: CrmInteraction[];

  // UI State (persisted)
  selectedContactId: string | null;
  selectedCompanyId: string | null;
  selectedDealId: string | null;
  activePipelineId: string | null;
  activeSubTab: 'contacts' | 'companies' | 'deals' | 'interactions' | 'quotes' | 'invoices';
  activeViewId: string | null;
  searchQuery: string;
  filters: {
    lifecycleStatus: LifecycleStatus | 'all';
    dealStatus: DealStatus | 'all';
    ownerAgent: string | null;
    tags: string[];
  };

  // Profile Workspace (full-page entity view)
  profileWorkspaceEntityType: CrmEntityType | null;
  profileWorkspaceEntityId: string | null;
  profileWorkspaceTab: string;
  profileNavStack: Array<{ entityType: CrmEntityType; entityId: string; label: string }>;

  // ─── Contact Actions ──────────────────────────────────────
  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  updateContact: (contactId: string, updates: Partial<Contact>) => void;
  removeContact: (contactId: string) => void;

  // ─── Company Actions ──────────────────────────────────────
  setCompanies: (companies: Company[]) => void;
  addCompany: (company: Company) => void;
  updateCompany: (companyId: string, updates: Partial<Company>) => void;
  removeCompany: (companyId: string) => void;

  // ─── Pipeline Actions ─────────────────────────────────────
  setPipelines: (pipelines: DealPipeline[]) => void;

  // ─── Deal Actions ─────────────────────────────────────────
  setDeals: (deals: Deal[]) => void;
  addDeal: (deal: Deal) => void;
  updateDeal: (dealId: string, updates: Partial<Deal>) => void;
  removeDeal: (dealId: string) => void;
  moveDealToStage: (dealId: string, stageId: string) => void;

  // ─── Interaction Actions ──────────────────────────────────
  setInteractions: (interactions: CrmInteraction[]) => void;
  addInteraction: (interaction: CrmInteraction) => void;

  // ─── UI Actions ───────────────────────────────────────────
  selectContact: (id: string | null) => void;
  selectCompany: (id: string | null) => void;
  selectDeal: (id: string | null) => void;
  setActivePipeline: (id: string | null) => void;
  setActiveSubTab: (tab: CrmState['activeSubTab']) => void;
  setActiveViewId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<CrmState['filters']>) => void;

  // ─── Profile Workspace Actions ──────────────────────────
  openProfileWorkspace: (entityType: CrmEntityType, entityId: string, label: string) => void;
  closeProfileWorkspace: () => void;
  setProfileWorkspaceTab: (tab: string) => void;
  navigateToProfile: (entityType: CrmEntityType, entityId: string, label: string) => void;
  navigateBack: () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

const CRM_STORAGE_KEY = 'agora-crm-v1';

export const useCrmStore = create<CrmState>()(
  persist(
    (set) => ({
      // Initial data
      contacts: [],
      companies: [],
      pipelines: [],
      deals: [],
      interactions: [],

      // UI State
      selectedContactId: null,
      selectedCompanyId: null,
      selectedDealId: null,
      activePipelineId: null,
      activeSubTab: 'contacts',
      activeViewId: null,
      searchQuery: '',
      filters: {
        lifecycleStatus: 'all',
        dealStatus: 'all',
        ownerAgent: null,
        tags: [],
      },

      // Profile Workspace
      profileWorkspaceEntityType: null,
      profileWorkspaceEntityId: null,
      profileWorkspaceTab: 'overview',
      profileNavStack: [],

      // Contact Actions (upsert pattern from missionControl)
      setContacts: (contacts) => set({ contacts }),
      addContact: (contact) =>
        set((state) => {
          const idx = state.contacts.findIndex((c) => c.id === contact.id);
          if (idx === -1) return { contacts: [contact, ...state.contacts] };
          const contacts = [...state.contacts];
          contacts[idx] = { ...contacts[idx], ...contact };
          return { contacts };
        }),
      updateContact: (contactId, updates) =>
        set((state) => ({
          contacts: state.contacts.map((c) =>
            c.id === contactId ? { ...c, ...updates } : c
          ),
        })),
      removeContact: (contactId) =>
        set((state) => ({
          contacts: state.contacts.filter((c) => c.id !== contactId),
          selectedContactId:
            state.selectedContactId === contactId
              ? null
              : state.selectedContactId,
        })),

      // Company Actions
      setCompanies: (companies) => set({ companies }),
      addCompany: (company) =>
        set((state) => {
          const idx = state.companies.findIndex((c) => c.id === company.id);
          if (idx === -1) return { companies: [company, ...state.companies] };
          const companies = [...state.companies];
          companies[idx] = { ...companies[idx], ...company };
          return { companies };
        }),
      updateCompany: (companyId, updates) =>
        set((state) => ({
          companies: state.companies.map((c) =>
            c.id === companyId ? { ...c, ...updates } : c
          ),
        })),
      removeCompany: (companyId) =>
        set((state) => ({
          companies: state.companies.filter((c) => c.id !== companyId),
          selectedCompanyId:
            state.selectedCompanyId === companyId
              ? null
              : state.selectedCompanyId,
        })),

      // Pipeline Actions
      setPipelines: (pipelines) => set({ pipelines }),

      // Deal Actions
      setDeals: (deals) => set({ deals }),
      addDeal: (deal) =>
        set((state) => {
          const idx = state.deals.findIndex((d) => d.id === deal.id);
          if (idx === -1) return { deals: [deal, ...state.deals] };
          const deals = [...state.deals];
          deals[idx] = { ...deals[idx], ...deal };
          return { deals };
        }),
      updateDeal: (dealId, updates) =>
        set((state) => ({
          deals: state.deals.map((d) =>
            d.id === dealId ? { ...d, ...updates } : d
          ),
        })),
      removeDeal: (dealId) =>
        set((state) => ({
          deals: state.deals.filter((d) => d.id !== dealId),
          selectedDealId:
            state.selectedDealId === dealId ? null : state.selectedDealId,
        })),
      moveDealToStage: (dealId, stageId) =>
        set((state) => ({
          deals: state.deals.map((d) =>
            d.id === dealId
              ? { ...d, stage_id: stageId, updated_at: new Date().toISOString() }
              : d
          ),
        })),

      // Interaction Actions
      setInteractions: (interactions) => set({ interactions }),
      addInteraction: (interaction) =>
        set((state) => ({
          interactions: [interaction, ...state.interactions].slice(0, 500),
        })),

      // UI Actions
      selectContact: (id) => set({ selectedContactId: id }),
      selectCompany: (id) => set({ selectedCompanyId: id }),
      selectDeal: (id) => set({ selectedDealId: id }),
      setActivePipeline: (id) => set({ activePipelineId: id }),
      setActiveSubTab: (tab) => set({ activeSubTab: tab }),
      setActiveViewId: (id) => set({ activeViewId: id }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setFilters: (filters) =>
        set((state) => ({ filters: { ...state.filters, ...filters } })),

      // Profile Workspace Actions
      openProfileWorkspace: (entityType, entityId, _label) =>
        set({
          profileWorkspaceEntityType: entityType,
          profileWorkspaceEntityId: entityId,
          profileWorkspaceTab: 'overview',
          profileNavStack: [],
          // Clear sidebar selections
          selectedContactId: null,
          selectedCompanyId: null,
          selectedDealId: null,
        }),
      closeProfileWorkspace: () =>
        set({
          profileWorkspaceEntityType: null,
          profileWorkspaceEntityId: null,
          profileWorkspaceTab: 'overview',
          profileNavStack: [],
        }),
      setProfileWorkspaceTab: (tab) => set({ profileWorkspaceTab: tab }),
      navigateToProfile: (entityType, entityId, label) =>
        set((state) => ({
          profileNavStack: [
            ...state.profileNavStack,
            {
              entityType: state.profileWorkspaceEntityType!,
              entityId: state.profileWorkspaceEntityId!,
              label,
            },
          ],
          profileWorkspaceEntityType: entityType,
          profileWorkspaceEntityId: entityId,
          profileWorkspaceTab: 'overview',
        })),
      navigateBack: () =>
        set((state) => {
          const stack = [...state.profileNavStack];
          const prev = stack.pop();
          if (!prev) return {};
          return {
            profileNavStack: stack,
            profileWorkspaceEntityType: prev.entityType,
            profileWorkspaceEntityId: prev.entityId,
            profileWorkspaceTab: 'overview',
          };
        }),
    }),
    {
      name: CRM_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Supabase-first: only persist UI state, NOT entity data
      partialize: (state) => ({
        selectedContactId: state.selectedContactId,
        selectedCompanyId: state.selectedCompanyId,
        selectedDealId: state.selectedDealId,
        activePipelineId: state.activePipelineId,
        activeSubTab: state.activeSubTab,
        activeViewId: state.activeViewId,
        filters: state.filters,
        // Profile workspace (navStack deliberately NOT persisted — session only)
        profileWorkspaceEntityType: state.profileWorkspaceEntityType,
        profileWorkspaceEntityId: state.profileWorkspaceEntityId,
        profileWorkspaceTab: state.profileWorkspaceTab,
      }),
    }
  )
);

// ─── Selectors ──────────────────────────────────────────────────────────────

export const useSelectedContact = () => {
  const contacts = useCrmStore((s) => s.contacts);
  const selectedId = useCrmStore((s) => s.selectedContactId);
  return contacts.find((c) => c.id === selectedId) || null;
};

export const useSelectedCompany = () => {
  const companies = useCrmStore((s) => s.companies);
  const selectedId = useCrmStore((s) => s.selectedCompanyId);
  return companies.find((c) => c.id === selectedId) || null;
};

export const useSelectedDeal = () => {
  const deals = useCrmStore((s) => s.deals);
  const selectedId = useCrmStore((s) => s.selectedDealId);
  return deals.find((d) => d.id === selectedId) || null;
};

export const useFilteredContacts = () => {
  const contacts = useCrmStore((s) => s.contacts);
  const searchQuery = useCrmStore((s) => s.searchQuery);
  const filters = useCrmStore((s) => s.filters);

  return contacts.filter((contact) => {
    if (
      filters.lifecycleStatus !== 'all' &&
      contact.lifecycle_status !== filters.lifecycleStatus
    )
      return false;
    if (filters.ownerAgent && contact.owner_agent_id !== filters.ownerAgent)
      return false;
    if (
      filters.tags.length > 0 &&
      !filters.tags.some((t) => contact.tags.includes(t))
    )
      return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const fullName =
        `${contact.first_name} ${contact.last_name}`.toLowerCase();
      return (
        fullName.includes(q) ||
        (contact.email?.toLowerCase().includes(q) ?? false) ||
        (contact.phone?.includes(q) ?? false)
      );
    }
    return true;
  });
};

export const useFilteredDeals = () => {
  const deals = useCrmStore((s) => s.deals);
  const filters = useCrmStore((s) => s.filters);

  return deals.filter((deal) => {
    if (filters.dealStatus !== 'all' && deal.status !== filters.dealStatus)
      return false;
    if (filters.ownerAgent && deal.owner_agent_id !== filters.ownerAgent)
      return false;
    return true;
  });
};

export const useDealsByStage = (stageId: string) => {
  const deals = useCrmStore((s) => s.deals);
  return deals.filter((d) => d.stage_id === stageId && d.status === 'open');
};

export const useContactsByCompany = (companyId: string) => {
  const contacts = useCrmStore((s) => s.contacts);
  return contacts.filter((c) => c.company_id === companyId);
};

export const useActivePipeline = () => {
  const pipelines = useCrmStore((s) => s.pipelines);
  const activePipelineId = useCrmStore((s) => s.activePipelineId);
  return (
    pipelines.find((p) => p.id === activePipelineId) ||
    pipelines.find((p) => p.is_default) ||
    pipelines[0] ||
    null
  );
};

export const useInteractionsForEntity = (
  entityType: 'contact' | 'company' | 'deal',
  entityId: string | null
) => {
  const interactions = useCrmStore((s) => s.interactions);
  if (!entityId) return [];
  return interactions.filter((i) => {
    switch (entityType) {
      case 'contact':
        return i.contact_id === entityId;
      case 'company':
        return i.company_id === entityId;
      case 'deal':
        return i.deal_id === entityId;
    }
  });
};

// ─── Profile Workspace Selectors ─────────────────────────────────────────────

export const useDealsByCompany = (companyId: string | null) => {
  const deals = useCrmStore((s) => s.deals);
  if (!companyId) return [];
  return deals.filter((d) => d.company_id === companyId);
};

export const useDealsByContact = (contactId: string | null) => {
  const deals = useCrmStore((s) => s.deals);
  if (!contactId) return [];
  return deals.filter((d) => d.contact_id === contactId);
};
