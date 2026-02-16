import { useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useWorkflowsStore } from '../stores/workflows';
import { handleRealtimePayload } from '../lib/realtimeHelpers';
import type {
  Workflow,
  WorkflowRun,
  WorkflowSequence,
  ActionStep,
} from '../types/workflows';
import { createNotificationDirect } from './useNotifications';

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useWorkflows() {
  const store = useWorkflowsStore();
  const initializedRef = useRef(false);

  // ── Initial fetch + realtime subscriptions ──
  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    // Fetch workflows
    supabase
      .from('workflows')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) store.setWorkflows(data as Workflow[]);
      });

    // Fetch recent runs
    supabase
      .from('workflow_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!error && data) store.setWorkflowRuns(data as WorkflowRun[]);
      });

    // Fetch sequences
    supabase
      .from('workflow_sequences')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) store.setSequences(data as WorkflowSequence[]);
      });

    // ── Realtime subscriptions ──
    const workflowsSub = supabase
      .channel('workflows-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workflows' },
        (payload) =>
          handleRealtimePayload<Workflow>(
            payload,
            store.addWorkflow,
            store.updateWorkflow,
            store.removeWorkflow
          )
      )
      .subscribe();

    const runsSub = supabase
      .channel('workflow-runs-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workflow_runs' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            store.addWorkflowRun(payload.new as WorkflowRun);
          } else if (payload.eventType === 'UPDATE') {
            store.updateWorkflowRun(
              (payload.new as WorkflowRun).id,
              payload.new as Partial<WorkflowRun>
            );
          }
        }
      )
      .subscribe();

    const seqSub = supabase
      .channel('workflow-sequences-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workflow_sequences' },
        (payload) =>
          handleRealtimePayload<WorkflowSequence>(
            payload,
            store.addSequence,
            store.updateSequence,
            store.removeSequence
          )
      )
      .subscribe();

    return () => {
      workflowsSub.unsubscribe();
      runsSub.unsubscribe();
      seqSub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Workflow CRUD ──

  const createWorkflow = useCallback(
    async (data: {
      name: string;
      description?: string;
      trigger_type: Workflow['trigger_type'];
      trigger_entity?: Workflow['trigger_entity'];
      trigger_conditions?: Record<string, unknown>;
      trigger_schedule?: string;
      actions?: ActionStep[];
      owner_agent_id?: string;
      status?: Workflow['status'];
    }) => {
      const { data: workflow, error } = await supabase
        .from('workflows')
        .insert({
          name: data.name,
          description: data.description || null,
          status: data.status || 'draft',
          trigger_type: data.trigger_type,
          trigger_entity: data.trigger_entity || null,
          trigger_conditions: data.trigger_conditions || {},
          trigger_schedule: data.trigger_schedule || null,
          actions: data.actions || [],
          owner_agent_id: data.owner_agent_id || null,
        })
        .select()
        .single();
      if (error) {
        console.error('[Workflows] Error creating workflow:', error);
        return null;
      }
      store.addWorkflow(workflow as Workflow);
      return workflow as Workflow;
    },
    [store]
  );

  const updateWorkflowDetails = useCallback(
    async (workflowId: string, updates: Partial<Workflow>) => {
      const { error } = await supabase
        .from('workflows')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', workflowId);
      if (error) {
        console.error('[Workflows] Error updating workflow:', error);
        return;
      }
      store.updateWorkflow(workflowId, updates);
    },
    [store]
  );

  const deleteWorkflow = useCallback(
    async (workflowId: string) => {
      const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', workflowId);
      if (error) {
        console.error('[Workflows] Error deleting workflow:', error);
        return;
      }
      store.removeWorkflow(workflowId);
    },
    [store]
  );

  const toggleWorkflow = useCallback(
    async (workflowId: string) => {
      const workflow = useWorkflowsStore
        .getState()
        .workflows.find((w) => w.id === workflowId);
      if (!workflow) return;

      const newStatus = workflow.status === 'active' ? 'paused' : 'active';
      await updateWorkflowDetails(workflowId, { status: newStatus });
    },
    [updateWorkflowDetails]
  );

  // ── Execution Engine ──

  const executeWorkflow = useCallback(
    async (
      workflowId: string,
      triggerPayload: Record<string, unknown> = {}
    ) => {
      const workflow = useWorkflowsStore
        .getState()
        .workflows.find((w) => w.id === workflowId);
      if (!workflow) {
        console.error('[Workflows] Workflow not found:', workflowId);
        return null;
      }

      const actions = workflow.actions || [];
      const now = new Date().toISOString();

      // Create a run record
      const { data: run, error: runError } = await supabase
        .from('workflow_runs')
        .insert({
          workflow_id: workflowId,
          status: 'running',
          trigger_payload: triggerPayload,
          current_step: 0,
          steps_completed: 0,
          steps_total: actions.length,
          entity_type:
            (triggerPayload.entity_type as string) || workflow.trigger_entity || null,
          entity_id: (triggerPayload.entity_id as string) || null,
          started_at: now,
        })
        .select()
        .single();

      if (runError || !run) {
        console.error('[Workflows] Error creating run:', runError);
        return null;
      }

      store.addWorkflowRun(run as WorkflowRun);

      // Process actions sequentially
      let missionId: string | null = null;
      try {
        for (let i = 0; i < actions.length; i++) {
          const action = actions[i];

          // Update current step
          await supabase
            .from('workflow_runs')
            .update({ current_step: i })
            .eq('id', run.id);
          store.updateWorkflowRun(run.id, { current_step: i });

          await processAction(action, triggerPayload);

          // Track mission_id if create_mission produced one
          if (action.type === 'create_mission' && missionId === null) {
            // mission_id is set by processAction via side effects
          }

          // Update steps completed
          await supabase
            .from('workflow_runs')
            .update({ steps_completed: i + 1 })
            .eq('id', run.id);
          store.updateWorkflowRun(run.id, { steps_completed: i + 1 });
        }

        // Mark run as completed
        const completedAt = new Date().toISOString();
        await supabase
          .from('workflow_runs')
          .update({ status: 'completed', completed_at: completedAt })
          .eq('id', run.id);
        store.updateWorkflowRun(run.id, {
          status: 'completed',
          completed_at: completedAt,
        });

        // Increment run_count on workflow
        await supabase
          .from('workflows')
          .update({
            run_count: (workflow.run_count || 0) + 1,
            last_run_at: completedAt,
          })
          .eq('id', workflowId);
        store.updateWorkflow(workflowId, {
          run_count: (workflow.run_count || 0) + 1,
          last_run_at: completedAt,
        });

        // Create notification for workflow completion
        createNotificationDirect(
          'workflow_completed',
          `Workflow "${workflow.name}" completed`,
          `All ${actions.length} steps completed successfully.`,
          'workflow_run',
          run.id
        );

        return run as WorkflowRun;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';
        const failedAt = new Date().toISOString();
        await supabase
          .from('workflow_runs')
          .update({
            status: 'failed',
            error_message: errorMessage,
            completed_at: failedAt,
          })
          .eq('id', run.id);
        store.updateWorkflowRun(run.id, {
          status: 'failed',
          error_message: errorMessage,
          completed_at: failedAt,
        });
        console.error('[Workflows] Execution failed:', err);

        // Create notification for workflow failure
        createNotificationDirect(
          'workflow_failed',
          `Workflow "${workflow.name}" failed`,
          errorMessage,
          'workflow_run',
          run.id
        );

        return run as WorkflowRun;
      }
    },
    [store]
  );

  return {
    workflows: store.workflows,
    workflowRuns: store.workflowRuns,
    sequences: store.sequences,
    createWorkflow,
    updateWorkflowDetails,
    deleteWorkflow,
    toggleWorkflow,
    executeWorkflow,
    isConfigured: isSupabaseConfigured(),
  };
}

// ─── Action Processor ───────────────────────────────────────────────────────

async function processAction(
  action: ActionStep,
  triggerPayload: Record<string, unknown>
) {
  switch (action.type) {
    case 'create_mission': {
      const agentId = action.agent_id || 'alexander';
      const title =
        action.mission_title ||
        action.template ||
        `Auto-mission from workflow`;
      const { error } = await supabase
        .from('missions')
        .insert({
          title,
          description: action.template || null,
          agent_id: agentId,
          status: 'scheduled',
          mission_status: 'scheduled',
          mission_phase: 'statement',
          mission_phase_status: 'awaiting_approval',
          priority: 'medium',
          scheduled_at: new Date().toISOString(),
          input_text: action.template || null,
          created_by: 'workflow',
        })
        .select()
        .single();
      if (error) throw new Error(`create_mission failed: ${error.message}`);
      break;
    }

    case 'update_field': {
      const entityType = action.entity || (triggerPayload.entity_type as string);
      const entityId = triggerPayload.entity_id as string;
      if (!entityType || !entityId || !action.field) {
        throw new Error('update_field requires entity, entity_id, and field');
      }
      const tableName = entityType === 'contact' ? 'contacts'
        : entityType === 'company' ? 'companies'
        : entityType === 'deal' ? 'deals'
        : entityType === 'order' ? 'orders'
        : entityType === 'project' ? 'projects'
        : null;
      if (!tableName) throw new Error(`Unknown entity type: ${entityType}`);
      const { error } = await supabase
        .from(tableName)
        .update({ [action.field]: action.value, updated_at: new Date().toISOString() })
        .eq('id', entityId);
      if (error) throw new Error(`update_field failed: ${error.message}`);
      break;
    }

    case 'send_notification': {
      console.log('[Workflow Notification]', action.message || 'No message');
      break;
    }

    case 'create_interaction': {
      const contactId = triggerPayload.entity_type === 'contact'
        ? (triggerPayload.entity_id as string)
        : (triggerPayload.contact_id as string) || null;
      const companyId = triggerPayload.entity_type === 'company'
        ? (triggerPayload.entity_id as string)
        : (triggerPayload.company_id as string) || null;
      const dealId = triggerPayload.entity_type === 'deal'
        ? (triggerPayload.entity_id as string)
        : (triggerPayload.deal_id as string) || null;

      const { error } = await supabase.from('crm_interactions').insert({
        interaction_type: action.interaction_type || 'note',
        subject: action.subject || 'Automated interaction',
        body: action.body || null,
        contact_id: contactId,
        company_id: companyId,
        deal_id: dealId,
        agent_id: 'workflow',
      });
      if (error)
        throw new Error(`create_interaction failed: ${error.message}`);
      break;
    }

    case 'wait': {
      // In a real system this would use a delayed queue. For now, log it.
      console.log('[Workflow] Wait action:', action.duration || 'unspecified');
      break;
    }

    case 'create_task': {
      // Create a mission-level task
      const { error } = await supabase
        .from('missions')
        .insert({
          title: action.title || 'Workflow-generated task',
          description: action.description || null,
          agent_id: action.agent_id || 'alexander',
          status: 'scheduled',
          mission_status: 'scheduled',
          mission_phase: 'tasks',
          mission_phase_status: 'approved',
          priority: action.priority || 'medium',
          scheduled_at: new Date().toISOString(),
          created_by: 'workflow',
        })
        .select()
        .single();
      if (error) throw new Error(`create_task failed: ${error.message}`);
      break;
    }

    default:
      console.warn('[Workflow] Unknown action type:', (action as ActionStep).type);
  }
}
