import { useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useWorkflowsStore } from '../stores/workflows';
import type { Workflow } from '../types/workflows';

/**
 * Realtime event listener that watches CRM tables for changes
 * and automatically fires matching active workflows.
 *
 * Must be mounted once (e.g. inside WorkflowsTab).
 */
export function useWorkflowTriggers(
  executeWorkflow: (workflowId: string, triggerPayload: Record<string, unknown>) => Promise<unknown>
) {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    // Subscribe to contacts
    const contactsSub = supabase
      .channel('wf-trigger-contacts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        (payload) => handleEvent('contact', payload)
      )
      .subscribe();

    // Subscribe to companies
    const companiesSub = supabase
      .channel('wf-trigger-companies')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'companies' },
        (payload) => handleEvent('company', payload)
      )
      .subscribe();

    // Subscribe to deals
    const dealsSub = supabase
      .channel('wf-trigger-deals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deals' },
        (payload) => handleEvent('deal', payload)
      )
      .subscribe();

    return () => {
      contactsSub.unsubscribe();
      companiesSub.unsubscribe();
      dealsSub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEvent(
    entityType: 'contact' | 'company' | 'deal',
    payload: any
  ) {
    const activeWorkflows = useWorkflowsStore
      .getState()
      .workflows.filter((w) => w.status === 'active');

    for (const workflow of activeWorkflows) {
      if (matches(workflow, entityType, payload)) {
        const triggerPayload: Record<string, unknown> = {
          entity_type: entityType,
          entity_id: payload.new?.id || payload.old?.id,
          event_type: payload.eventType,
          new: payload.new,
          old: payload.old,
        };
        executeWorkflow(workflow.id, triggerPayload).catch((err) =>
          console.error(
            `[WorkflowTrigger] Failed to execute workflow ${workflow.id}:`,
            err
          )
        );
      }
    }
  }
}

// ─── Matching Logic ─────────────────────────────────────────────────────────

function matches(
  workflow: Workflow,
  entityType: 'contact' | 'company' | 'deal',
  payload: any
): boolean {
  // Entity type must match (if specified)
  if (workflow.trigger_entity && workflow.trigger_entity !== entityType) {
    return false;
  }

  const triggerType = workflow.trigger_type;
  const eventType: string = payload.eventType; // INSERT, UPDATE, DELETE
  const newRecord = payload.new as Record<string, unknown> | null;
  const oldRecord = payload.old as Record<string, unknown> | null;
  const conditions = workflow.trigger_conditions || {};

  switch (triggerType) {
    case 'entity_created':
      return eventType === 'INSERT';

    case 'entity_updated':
      return eventType === 'UPDATE';

    case 'field_changed': {
      if (eventType !== 'UPDATE' || !newRecord || !oldRecord) return false;
      const field = conditions.field as string | undefined;
      if (!field) return false;
      const oldVal = oldRecord[field];
      const newVal = newRecord[field];
      if (oldVal === newVal) return false;
      // Optionally match specific from/to values
      if (conditions.from !== undefined && String(oldVal) !== String(conditions.from))
        return false;
      if (conditions.to !== undefined && String(newVal) !== String(conditions.to))
        return false;
      return true;
    }

    case 'stage_changed': {
      if (entityType !== 'deal' || eventType !== 'UPDATE') return false;
      if (!newRecord || !oldRecord) return false;
      return oldRecord.stage_id !== newRecord.stage_id;
    }

    case 'deal_won': {
      if (entityType !== 'deal' || eventType !== 'UPDATE') return false;
      if (!newRecord || !oldRecord) return false;
      return oldRecord.status !== 'won' && newRecord.status === 'won';
    }

    case 'deal_lost': {
      if (entityType !== 'deal' || eventType !== 'UPDATE') return false;
      if (!newRecord || !oldRecord) return false;
      return oldRecord.status !== 'lost' && newRecord.status === 'lost';
    }

    // schedule, manual, webhook don't match realtime events
    case 'schedule':
    case 'manual':
    case 'webhook':
      return false;

    default:
      return false;
  }
}
