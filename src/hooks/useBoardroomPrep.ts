import { useCallback, useRef } from 'react';
import { openclawClient, type OpenClawMessage } from '../lib/openclawClient';
import { useAgentStore } from '../stores/agents';
import { useBoardroomStore } from '../stores/boardroom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createNotificationDirect } from './useNotifications';
import type {
  PrepAssignment,
  PrepResult,
  EntityReference,
  BoardroomSessionMetadata,
} from '../types/boardroom';
import type { MediaAttachment } from '../types/supabase';

// ─── Utility: extract text from OpenClaw message ────────────────────────────

function extractText(message: any): string {
  if (!message) return '';
  if (typeof message === 'string') return message;
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text || '')
      .join('');
  }
  if (typeof message.text === 'string') return message.text;
  return '';
}

function mergeDeltaBuffer(previous: string, incoming: string): string {
  if (!incoming) return previous;
  if (!previous) return incoming;
  if (incoming.startsWith(previous)) return incoming;
  if (previous.startsWith(incoming)) return previous;
  if (incoming.length > previous.length * 0.8) return incoming;
  return previous + incoming;
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

function buildEntitySummaries(refs: EntityReference[]): string {
  if (!refs.length) return '';
  return refs.map((r) => `- ${r.emoji || ''} [${r.type}] ${r.label}`).join('\n');
}

function buildPrepPrompt(
  agent: { name: string; role: string; persona: string; soul: any },
  session: { title: string; topic: string },
  entityRefs: EntityReference[],
  attachments: MediaAttachment[],
  assignmentPrompt: string
): string {
  const parts: string[] = [];

  parts.push('=== YOUR IDENTITY ===');
  parts.push(`Name: ${agent.name}`);
  parts.push(`Role: ${agent.role}`);
  parts.push(`Persona: ${agent.persona}`);
  if (agent.soul?.origin) parts.push(`Origin: ${agent.soul.origin}`);
  if (agent.soul?.philosophy?.length > 0) {
    parts.push(`Philosophy: ${agent.soul.philosophy.join('; ')}`);
  }
  if (agent.soul?.communicationStyle) {
    const cs = agent.soul.communicationStyle;
    parts.push(`Communication: ${cs.tone} (${cs.formality}, ${cs.verbosity})`);
  }

  parts.push('');
  parts.push('=== PREPARATION TASK ===');
  parts.push(`You are preparing for a boardroom session: "${session.title}"`);
  if (session.topic) parts.push(`Session topic: ${session.topic}`);

  const entitySummary = buildEntitySummaries(entityRefs);
  if (entitySummary) {
    parts.push('');
    parts.push('=== RELEVANT ENTITIES ===');
    parts.push(entitySummary);
  }

  if (attachments.length > 0) {
    parts.push('');
    parts.push('=== ATTACHED FILES ===');
    for (const att of attachments) {
      parts.push(`- ${att.name} (${att.type})`);
    }
  }

  parts.push('');
  parts.push('=== YOUR ASSIGNMENT ===');
  parts.push(assignmentPrompt);

  parts.push('');
  parts.push('Produce thorough findings. If you have structured data (tables, metrics, comparisons), emit A2UI JSON blocks so your findings render as interactive cards in the boardroom. Otherwise, write clear markdown.');

  return parts.join('\n');
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useBoardroomPrep() {
  // No whole-store subscription — access via getState() in callbacks.
  const cancelRef = useRef(false);

  const runResearchPrep = useCallback(
    async (
      sessionId: string,
      assignment: PrepAssignment,
      context: { title: string; topic: string; entityRefs: EntityReference[]; attachments: MediaAttachment[] }
    ): Promise<PrepResult> => {
      const agent = useAgentStore.getState().agentProfiles[assignment.agent_id];
      if (!agent) {
        return { agent_id: assignment.agent_id, status: 'error', text: '', error: 'Agent not found' };
      }

      const prompt = buildPrepPrompt(
        agent,
        { title: context.title, topic: context.topic },
        context.entityRefs,
        context.attachments,
        assignment.prompt
      );

      const sessionKey = `boardroom-prep:${sessionId}:${assignment.agent_id}`;
      const idempotencyKey = `br-prep-${sessionId}-${assignment.agent_id}-${Date.now()}`;
      const acceptedRunIds = new Set<string>([idempotencyKey]);

      // Initialize streaming for this agent
      useBoardroomStore.getState().setPrepStreamingContent(sessionId, assignment.agent_id, '');

      return new Promise<PrepResult>((resolve) => {
        let streamBuffer = '';
        let resolved = false;

        const unsub = openclawClient.onMessage((msg: OpenClawMessage) => {
          if (msg.type !== 'event' || msg.event !== 'chat') return;
          const payload = msg.payload as any;
          const eventRunId = payload.runId as string | undefined;
          if (eventRunId && !acceptedRunIds.has(eventRunId)) return;

          if (payload.state === 'delta') {
            const text = extractText(payload.message);
            if (text) {
              streamBuffer = mergeDeltaBuffer(streamBuffer, text);
              useBoardroomStore.getState().setPrepStreamingContent(sessionId, assignment.agent_id, streamBuffer);
            }
          }

          if (payload.state === 'final') {
            const text = extractText(payload.message);
            const finalText = mergeDeltaBuffer(streamBuffer, text);
            resolved = true;
            unsub();
            resolve({
              agent_id: assignment.agent_id,
              status: 'completed',
              text: finalText,
              completed_at: new Date().toISOString(),
            });
          }

          if (payload.state === 'error' || payload.state === 'aborted') {
            resolved = true;
            unsub();
            resolve({
              agent_id: assignment.agent_id,
              status: 'error',
              text: streamBuffer,
              error: payload.errorMessage || `Prep ${payload.state}`,
            });
          }
        });

        // Timeout: 3 minutes for prep (longer than normal turns)
        setTimeout(() => {
          if (!resolved) {
            unsub();
            resolve({
              agent_id: assignment.agent_id,
              status: streamBuffer ? 'completed' : 'error',
              text: streamBuffer,
              error: streamBuffer ? undefined : 'Preparation timeout',
              completed_at: new Date().toISOString(),
            });
          }
        }, 180_000);

        // Send the request
        openclawClient.send('chat.send', {
          sessionKey,
          message: prompt,
          deliver: false,
          idempotencyKey,
        }).then((ack: any) => {
          if (ack?.runId && ack.runId !== idempotencyKey) {
            acceptedRunIds.add(ack.runId);
          }
        }).catch((err: any) => {
          if (!resolved) {
            resolved = true;
            unsub();
            resolve({
              agent_id: assignment.agent_id,
              status: 'error',
              text: '',
              error: err.message || 'Failed to start prep',
            });
          }
        });
      });
    },
    []
  );

  const runMissionPrep = useCallback(
    async (
      _sessionId: string,
      assignment: PrepAssignment,
      context: { title: string; topic: string; entityRefs: EntityReference[]; attachments: MediaAttachment[] }
    ): Promise<PrepResult> => {
      if (!isSupabaseConfigured()) {
        return { agent_id: assignment.agent_id, status: 'error', text: '', error: 'Supabase not configured' };
      }

      const currentProfiles = useAgentStore.getState().agentProfiles;
      const agent = currentProfiles[assignment.agent_id];
      const agentLabel = agent ? `${agent.name}` : assignment.agent_id;

      const inputText = [
        `Preparation for boardroom session: "${context.title}"`,
        context.topic ? `Topic: ${context.topic}` : '',
        '',
        buildEntitySummaries(context.entityRefs),
        '',
        assignment.prompt,
      ].filter(Boolean).join('\n');

      const { data: mission, error } = await supabase
        .from('missions')
        .insert({
          title: `Prep: ${context.title} — ${agentLabel}`,
          description: assignment.prompt,
          input_text: inputText,
          agent_id: assignment.agent_id,
          priority: 'high',
          status: 'scheduled',
          mission_status: 'scheduled',
          mission_phase: 'statement',
          mission_phase_status: 'awaiting_approval',
          mission_statement: null,
          mission_plan: null,
          scheduled_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error || !mission) {
        return {
          agent_id: assignment.agent_id,
          status: 'error',
          text: '',
          error: error?.message || 'Failed to create prep mission',
        };
      }

      // If delegate_to agents specified, create sub-missions
      if (assignment.delegate_to?.length) {
        for (const delegateId of assignment.delegate_to) {
          const delegateAgent = currentProfiles[delegateId];
          const delegateLabel = delegateAgent ? delegateAgent.name : delegateId;
          await supabase.from('missions').insert({
            title: `Prep assist: ${context.title} — ${delegateLabel}`,
            description: `Assist ${agentLabel} with: ${assignment.prompt}`,
            input_text: inputText,
            agent_id: delegateId,
            priority: 'medium',
            status: 'scheduled',
            mission_status: 'scheduled',
            mission_phase: 'statement',
            mission_phase_status: 'awaiting_approval',
            scheduled_at: new Date().toISOString(),
          });
        }
      }

      return {
        agent_id: assignment.agent_id,
        status: 'completed',
        text: `Mission created: "${mission.title}". The agent will work through statement → plan → tasks.`,
        mission_id: mission.id,
        completed_at: new Date().toISOString(),
      };
    },
    []
  );

  const startPreparation = useCallback(
    async (
      sessionId: string,
      assignments: PrepAssignment[],
      context: { title: string; topic: string; entityRefs: EntityReference[]; attachments: MediaAttachment[] }
    ) => {
      cancelRef.current = false;
      useBoardroomStore.getState().setPrepStatus(sessionId, 'running');

      createNotificationDirect(
        'system',
        `Preparation started: ${context.title}`,
        `${assignments.length} agent(s) preparing for boardroom session`,
      ).catch(() => {});

      // Initialize pending results
      for (const assignment of assignments) {
        useBoardroomStore.getState().addPrepResult(sessionId, {
          agent_id: assignment.agent_id,
          status: 'running',
          text: '',
        });
      }

      // Run all assignments in parallel
      const promises = assignments.map(async (assignment) => {
        if (cancelRef.current) {
          return { agent_id: assignment.agent_id, status: 'error' as const, text: '', error: 'Cancelled' };
        }

        const result = assignment.mode === 'mission'
          ? await runMissionPrep(sessionId, assignment, context)
          : await runResearchPrep(sessionId, assignment, context);

        // Update store with individual result
        useBoardroomStore.getState().updatePrepResult(sessionId, assignment.agent_id, result);
        return result;
      });

      const results = await Promise.allSettled(promises);
      const prepResults: PrepResult[] = results.map((r) =>
        r.status === 'fulfilled'
          ? r.value
          : { agent_id: 'unknown', status: 'error' as const, text: '', error: r.reason?.message || 'Unknown error' }
      );

      // Update session metadata with prep results
      const session = useBoardroomStore.getState().sessions.find((s) => s.id === sessionId);
      if (session) {
        const currentMetadata = (session.metadata || {}) as BoardroomSessionMetadata;
        const updatedMetadata: BoardroomSessionMetadata = {
          ...currentMetadata,
          preparation: {
            ...(currentMetadata.preparation || { assignments: [], results: [], status: 'pending' }),
            results: prepResults,
            status: 'completed',
            completed_at: new Date().toISOString(),
          },
        };

        await supabase
          .from('boardroom_sessions')
          .update({
            metadata: updatedMetadata,
            status: 'open',
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);

        useBoardroomStore.getState().updateSession(sessionId, {
          metadata: updatedMetadata,
          status: 'open',
        });
      }

      useBoardroomStore.getState().setPrepStatus(sessionId, 'completed');

      createNotificationDirect(
        'system',
        `Preparation complete: ${context.title}`,
        `${prepResults.filter((r) => r.status === 'completed').length}/${assignments.length} tasks completed. Session is ready.`,
      ).catch(() => {});
    },
    [runResearchPrep, runMissionPrep]
  );

  const cancelPreparation = useCallback(
    async (sessionId: string) => {
      cancelRef.current = true;
      const s = useBoardroomStore.getState();
      s.setPrepStatus(sessionId, 'error');

      await supabase
        .from('boardroom_sessions')
        .update({ status: 'open', updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      s.updateSession(sessionId, { status: 'open' });
      s.clearPrep(sessionId);
    },
    []
  );

  return { startPreparation, cancelPreparation };
}
