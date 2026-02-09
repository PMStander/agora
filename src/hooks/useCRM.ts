import { useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useCrmStore } from '../stores/crm';
import { handleRealtimePayload } from '../lib/realtimeHelpers';
import type {
  Contact,
  Company,
  Deal,
  DealPipeline,
  CrmInteraction,
  InteractionType,
  InteractionDirection,
  LifecycleStatus,
} from '../types/crm';

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useCRM() {
  const store = useCrmStore();
  const initializedRef = useRef(false);

  // ── Initial fetch + realtime subscriptions ──
  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    // Fetch contacts
    supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) store.setContacts(data as Contact[]);
      });

    // Fetch companies
    supabase
      .from('companies')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (!error && data) store.setCompanies(data as Company[]);
      });

    // Fetch pipelines with stages
    supabase
      .from('deal_pipelines')
      .select('*, pipeline_stages(*)')
      .then(({ data, error }) => {
        if (!error && data) {
          store.setPipelines(
            data.map((p: any) => ({
              ...p,
              stages: (p.pipeline_stages || []).sort(
                (a: any, b: any) => a.display_order - b.display_order
              ),
            })) as DealPipeline[]
          );
        }
      });

    // Fetch deals
    supabase
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) store.setDeals(data as Deal[]);
      });

    // Fetch recent interactions
    supabase
      .from('crm_interactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!error && data) store.setInteractions(data as CrmInteraction[]);
      });

    // ── Realtime subscriptions ──
    const contactsSub = supabase
      .channel('crm-contacts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        (payload) =>
          handleRealtimePayload<Contact>(
            payload,
            store.addContact,
            store.updateContact,
            store.removeContact
          )
      )
      .subscribe();

    const companiesSub = supabase
      .channel('crm-companies-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'companies' },
        (payload) =>
          handleRealtimePayload<Company>(
            payload,
            store.addCompany,
            store.updateCompany,
            store.removeCompany
          )
      )
      .subscribe();

    const dealsSub = supabase
      .channel('crm-deals-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deals' },
        (payload) =>
          handleRealtimePayload<Deal>(
            payload,
            store.addDeal,
            store.updateDeal,
            store.removeDeal
          )
      )
      .subscribe();

    const interactionsSub = supabase
      .channel('crm-interactions-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'crm_interactions' },
        (payload) => store.addInteraction(payload.new as CrmInteraction)
      )
      .subscribe();

    return () => {
      contactsSub.unsubscribe();
      companiesSub.unsubscribe();
      dealsSub.unsubscribe();
      interactionsSub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Contact CRUD ──

  const createContact = useCallback(
    async (data: {
      first_name: string;
      last_name: string;
      email?: string;
      phone?: string;
      company_id?: string;
      job_title?: string;
      lifecycle_status?: LifecycleStatus;
      lead_source?: string;
      owner_agent_id?: string;
      tags?: string[];
      notes?: string;
    }) => {
      const { data: contact, error } = await supabase
        .from('contacts')
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error('[CRM] Error creating contact:', error);
        return null;
      }
      store.addContact(contact as Contact);
      return contact as Contact;
    },
    [store]
  );

  const updateContactDetails = useCallback(
    async (contactId: string, updates: Partial<Contact>) => {
      const { error } = await supabase
        .from('contacts')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', contactId);
      if (error) {
        console.error('[CRM] Error updating contact:', error);
        return;
      }
      store.updateContact(contactId, updates);
    },
    [store]
  );

  const deleteContact = useCallback(
    async (contactId: string) => {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contactId);
      if (error) {
        console.error('[CRM] Error deleting contact:', error);
        return;
      }
      store.removeContact(contactId);
    },
    [store]
  );

  // ── Company CRUD ──

  const createCompany = useCallback(
    async (data: {
      name: string;
      domain?: string;
      industry?: string;
      website?: string;
      phone?: string;
      owner_agent_id?: string;
      tags?: string[];
      notes?: string;
    }) => {
      const { data: company, error } = await supabase
        .from('companies')
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error('[CRM] Error creating company:', error);
        return null;
      }
      store.addCompany(company as Company);
      return company as Company;
    },
    [store]
  );

  const updateCompanyDetails = useCallback(
    async (companyId: string, updates: Partial<Company>) => {
      const { error } = await supabase
        .from('companies')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', companyId);
      if (error) {
        console.error('[CRM] Error updating company:', error);
        return;
      }
      store.updateCompany(companyId, updates);
    },
    [store]
  );

  const deleteCompany = useCallback(
    async (companyId: string) => {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId);
      if (error) {
        console.error('[CRM] Error deleting company:', error);
        return;
      }
      store.removeCompany(companyId);
    },
    [store]
  );

  // ── Deal CRUD ──

  const createDeal = useCallback(
    async (data: {
      title: string;
      pipeline_id: string;
      stage_id: string;
      description?: string;
      amount?: number;
      currency?: string;
      contact_id?: string;
      company_id?: string;
      owner_agent_id?: string;
      close_date?: string;
      priority?: string;
      tags?: string[];
    }) => {
      const { data: deal, error } = await supabase
        .from('deals')
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error('[CRM] Error creating deal:', error);
        return null;
      }
      store.addDeal(deal as Deal);
      return deal as Deal;
    },
    [store]
  );

  const moveDeal = useCallback(
    async (dealId: string, stageId: string) => {
      const pipeline = store.pipelines.find((p) =>
        p.stages.some((s) => s.id === stageId)
      );
      const stage = pipeline?.stages.find((s) => s.id === stageId);

      const updates: Partial<Deal> = {
        stage_id: stageId,
        updated_at: new Date().toISOString(),
      };

      // Auto-set deal status for terminal stages
      if (stage?.is_won) {
        updates.status = 'won';
        updates.close_date = new Date().toISOString();
      }
      if (stage?.is_lost) {
        updates.status = 'lost';
        updates.close_date = new Date().toISOString();
      }

      // Optimistic update
      store.updateDeal(dealId, updates);

      const { error } = await supabase
        .from('deals')
        .update(updates)
        .eq('id', dealId);

      if (error) {
        console.error('[CRM] Error moving deal:', error);
      }
    },
    [store]
  );

  const updateDealDetails = useCallback(
    async (dealId: string, updates: Partial<Deal>) => {
      const { error } = await supabase
        .from('deals')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', dealId);
      if (error) {
        console.error('[CRM] Error updating deal:', error);
        return;
      }
      store.updateDeal(dealId, updates);
    },
    [store]
  );

  const deleteDeal = useCallback(
    async (dealId: string) => {
      const { error } = await supabase
        .from('deals')
        .delete()
        .eq('id', dealId);
      if (error) {
        console.error('[CRM] Error deleting deal:', error);
        return;
      }
      store.removeDeal(dealId);
    },
    [store]
  );

  // ── Interaction Logging ──

  const logInteraction = useCallback(
    async (data: {
      interaction_type: InteractionType;
      subject?: string;
      body?: string;
      contact_id?: string;
      company_id?: string;
      deal_id?: string;
      agent_id?: string;
      direction?: InteractionDirection;
      duration_minutes?: number;
    }) => {
      const { data: interaction, error } = await supabase
        .from('crm_interactions')
        .insert(data)
        .select()
        .single();
      if (error) {
        console.error('[CRM] Error logging interaction:', error);
        return null;
      }
      store.addInteraction(interaction as CrmInteraction);

      // Update last_contacted_at on contact
      if (data.contact_id) {
        const now = new Date().toISOString();
        await supabase
          .from('contacts')
          .update({ last_contacted_at: now })
          .eq('id', data.contact_id);
        store.updateContact(data.contact_id, { last_contacted_at: now });
      }

      return interaction as CrmInteraction;
    },
    [store]
  );

  return {
    // Data
    contacts: store.contacts,
    companies: store.companies,
    pipelines: store.pipelines,
    deals: store.deals,
    interactions: store.interactions,

    // Contact
    createContact,
    updateContactDetails,
    deleteContact,

    // Company
    createCompany,
    updateCompanyDetails,
    deleteCompany,

    // Deal
    createDeal,
    moveDeal,
    updateDealDetails,
    deleteDeal,

    // Interaction
    logInteraction,

    // State
    isConfigured: isSupabaseConfigured(),
  };
}
