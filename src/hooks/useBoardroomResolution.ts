// ─── Boardroom Resolution Package Hook ────────────────────────────────────────

import { useCallback } from 'react';
import { openclawClient, type OpenClawMessage } from '../lib/openclawClient';
import { extractText, mergeDeltaBuffer } from '../lib/boardroomUtils';
import { useCrmStore } from '../stores/crm';
import { supabase } from '../lib/supabase';
import { useBoardroomStore } from '../stores/boardroom';
import {
  generateResolutionPackagePrompt,
  parseResolutionPackage,
  getDefaultResolutionMode,
} from '../lib/boardroomResolution';
import type {
  BoardroomSession,
  BoardroomMessage,
  BoardroomSessionMetadata,
  ResolutionPackage,
  ResolutionPackageItem,
  ResolutionMission,
  ResolutionFollowUpMeeting,
  ResolutionCRMAction,
  ResolutionCalendarEvent,
  ResolutionQuote,
  ResolutionProject,
  SessionSummary,
} from '../types/boardroom';
import {
  writeFeedbackToSharedContext,
  writeDecisionToSharedContext,
} from '../lib/sharedContextFeedback';

export function useBoardroomResolution() {
  // No whole-store subscription needed.
  // All callbacks access the store via getState() so they remain stable.

  /**
   * Generate resolution package from session
   */
  const generateResolutionPackage = useCallback(
    async (
      session: BoardroomSession,
      messages: BoardroomMessage[],
      summary: SessionSummary,
      agentProfiles: Record<string, any>
    ): Promise<ResolutionPackage | null> => {
      try {
        const metadata = session.metadata as BoardroomSessionMetadata;
        const mode = metadata?.resolution_mode || getDefaultResolutionMode(session.session_type);

        // Skip if resolution mode is 'none'
        if (mode === 'none') {
          return null;
        }

        // Fetch existing CRM data to avoid duplicates
        const crmState = useCrmStore.getState();
        const availableCompanies = crmState.companies.map(c => ({ id: c.id, name: c.name }));
        const availableContacts = crmState.contacts.map(c => {
          const company = crmState.companies.find(co => co.id === c.company_id);
          return { id: c.id, name: `${c.first_name} ${c.last_name}`, company: company?.name };
        });

        // Generate prompt
        const prompt = generateResolutionPackagePrompt(
          session,
          messages,
          summary,
          agentProfiles,
          availableCompanies,
          availableContacts
        );

        // Stream the LLM response
        const sessionKey = `boardroom:${session.id}:resolution`;
        const idempotencyKey = `br-${session.id}-resolution-${Date.now()}`;
        const acceptedRunIds = new Set<string>([idempotencyKey]);

        let streamBuffer = '';
        let resolved = false;

        const responsePromise = new Promise<string>((resolve, reject) => {
          const unsub = openclawClient.onMessage((msg: OpenClawMessage) => {
            if (msg.type !== 'event' || msg.event !== 'chat') return;
            const payload = msg.payload as any;
            const eventRunId = payload.runId as string | undefined;
            if (eventRunId && !acceptedRunIds.has(eventRunId)) return;

            if (payload.state === 'delta') {
              const text = extractText(payload.message);
              if (text) streamBuffer = mergeDeltaBuffer(streamBuffer, text);
            }
            if (payload.state === 'final') {
              const text = extractText(payload.message);
              const finalText = mergeDeltaBuffer(streamBuffer, text);
              resolved = true;
              unsub();
              resolve(finalText);
            }
            if (payload.state === 'error' || payload.state === 'aborted') {
              resolved = true;
              unsub();
              reject(new Error(payload.errorMessage || 'Resolution generation failed'));
            }
          });

          setTimeout(() => {
            if (!resolved) {
              unsub();
              if (streamBuffer) resolve(streamBuffer);
              else reject(new Error('Resolution generation timeout'));
            }
          }, 90_000);
        });

        const ack = await openclawClient.send('chat.send', {
          sessionKey,
          message: prompt,
          deliver: false,
          idempotencyKey,
        }) as { runId?: string } | undefined;

        if (ack?.runId && ack.runId !== idempotencyKey) {
          acceptedRunIds.add(ack.runId);
        }

        const response = await responsePromise;

        // Parse the response
        const resolutionPackage = parseResolutionPackage(response, session.id, mode);

        return resolutionPackage;
      } catch (err) {
        console.error('[BoardroomResolution] Failed to generate resolution package:', err);
        return null;
      }
    },
    []
  );

  /**
   * Save resolution package to session metadata
   */
  const saveResolutionPackage = useCallback(
    async (sessionId: string, resolutionPackage: ResolutionPackage) => {
      const session = useBoardroomStore.getState().sessions.find(s => s.id === sessionId);
      if (!session) return;

      const metadata: BoardroomSessionMetadata = {
        ...(session.metadata || {}),
        resolution_package: resolutionPackage,
      };

      const { error } = await supabase
        .from('boardroom_sessions')
        .update({
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (!error) {
        useBoardroomStore.getState().updateSession(sessionId, { metadata });
      }
    },
    []
  );

  /**
   * Approve a resolution package item
   */
  const approveResolutionItem = useCallback(
    async (sessionId: string, itemId: string) => {
      const session = useBoardroomStore.getState().sessions.find(s => s.id === sessionId);
      if (!session) return;

      const metadata = session.metadata as BoardroomSessionMetadata;
      const resolutionPackage = metadata?.resolution_package;
      if (!resolutionPackage) return;

      const updatedItems = resolutionPackage.items.map(item =>
        item.id === itemId ? { ...item, status: 'approved' as const } : item
      );

      const updatedPackage: ResolutionPackage = {
        ...resolutionPackage,
        items: updatedItems,
      };

      await saveResolutionPackage(sessionId, updatedPackage);

      // Write feedback to shared-context for agent learning
      const approvedItem = resolutionPackage.items.find(i => i.id === itemId);
      if (approvedItem) {
        writeFeedbackToSharedContext(
          sessionId,
          session.title || 'Boardroom Session',
          approvedItem,
          'approved'
        );
      }
    },
    [saveResolutionPackage]
  );

  /**
   * Reject a resolution package item
   */
  const rejectResolutionItem = useCallback(
    async (sessionId: string, itemId: string) => {
      const session = useBoardroomStore.getState().sessions.find(s => s.id === sessionId);
      if (!session) return;

      const metadata = session.metadata as BoardroomSessionMetadata;
      const resolutionPackage = metadata?.resolution_package;
      if (!resolutionPackage) return;

      const updatedItems = resolutionPackage.items.map(item =>
        item.id === itemId ? { ...item, status: 'rejected' as const } : item
      );

      const updatedPackage: ResolutionPackage = {
        ...resolutionPackage,
        items: updatedItems,
      };

      await saveResolutionPackage(sessionId, updatedPackage);

      // Write feedback to shared-context for agent learning
      const rejectedItem = resolutionPackage.items.find(i => i.id === itemId);
      if (rejectedItem) {
        writeFeedbackToSharedContext(
          sessionId,
          session.title || 'Boardroom Session',
          rejectedItem,
          'rejected'
        );
      }
    },
    [saveResolutionPackage]
  );

  /**
   * Approve all pending items
   */
  const approveAllItems = useCallback(
    async (sessionId: string) => {
      const session = useBoardroomStore.getState().sessions.find(s => s.id === sessionId);
      if (!session) return;

      const metadata = session.metadata as BoardroomSessionMetadata;
      const resolutionPackage = metadata?.resolution_package;
      if (!resolutionPackage) return;

      const updatedItems = resolutionPackage.items.map(item =>
        item.status === 'pending' ? { ...item, status: 'approved' as const } : item
      );

      const updatedPackage: ResolutionPackage = {
        ...resolutionPackage,
        items: updatedItems,
      };

      await saveResolutionPackage(sessionId, updatedPackage);
    },
    [saveResolutionPackage]
  );

  /**
   * Create system objects from approved resolution items
   */
  const executeResolutionPackage = useCallback(
    async (sessionId: string): Promise<void> => {
      const session = useBoardroomStore.getState().sessions.find(s => s.id === sessionId);
      if (!session) return;

      const metadata = session.metadata as BoardroomSessionMetadata;
      const resolutionPackage = metadata?.resolution_package;
      if (!resolutionPackage) return;

      const approvedItems = resolutionPackage.items.filter(
        item => item.status === 'approved'
      );

      for (const item of approvedItems) {
        try {
          let createdId: string | undefined;

          switch (item.type) {
            case 'mission':
              createdId = await createMissionFromResolution(sessionId, item);
              break;
            case 'follow_up':
              createdId = await createFollowUpSession(sessionId, session, item);
              break;
            case 'document':
              createdId = await createDocumentMission(sessionId, item);
              break;
            case 'crm':
              createdId = await createCrmEntityFromResolution(sessionId, item);
              break;
            case 'event':
              createdId = await createEventFromResolution(sessionId, item);
              break;
            case 'quote':
              createdId = await createQuoteFromResolution(sessionId, item);
              break;
            case 'project':
              createdId = await createProjectFromResolution(sessionId, item, resolutionPackage);
              break;
            default:
              console.log(`[ResolutionExecution] Unknown item type: ${item.type}`);
          }

          // Update item status to created
          const updatedItems = resolutionPackage.items.map(i =>
            i.id === item.id
              ? { ...i, status: 'created' as const, created_id: createdId }
              : i
          );

          const updatedPackage: ResolutionPackage = {
            ...resolutionPackage,
            items: updatedItems,
          };

          await saveResolutionPackage(sessionId, updatedPackage);
        } catch (err) {
          console.error(`[ResolutionExecution] Failed to create ${item.type}:`, err);

          // Mark item with error
          const updatedItems = resolutionPackage.items.map(i =>
            i.id === item.id
              ? { ...i, error: err instanceof Error ? err.message : String(err) }
              : i
          );

          const updatedPackage: ResolutionPackage = {
            ...resolutionPackage,
            items: updatedItems,
          };

          await saveResolutionPackage(sessionId, updatedPackage);
        }
      }

      // Write decision summary to shared-context after all items are processed
      writeDecisionToSharedContext(
        sessionId,
        session.title || 'Boardroom Session',
        resolutionPackage.items,
        session.participant_agent_ids || []
      );
    },
    [saveResolutionPackage]
  );

  return {
    generateResolutionPackage,
    saveResolutionPackage,
    approveResolutionItem,
    rejectResolutionItem,
    approveAllItems,
    executeResolutionPackage,
  };
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

async function createMissionFromResolution(
  _sourceSessionId: string,
  item: ResolutionPackageItem
): Promise<string> {
  const data = item.data as ResolutionMission;

  // ── Agent ID Validation ────────────────────────────────────────────────
  const { AGENTS } = await import('../types/supabase');
  const validAgentIds = new Set(AGENTS.map(a => a.id));
  let agentId = data.agent_id;

  if (!agentId || !validAgentIds.has(agentId)) {
    console.warn(
      `[ResolutionExecution] Invalid agent_id "${agentId}" for mission "${data.title}". ` +
      `Falling back to "alexander" primary agent.`
    );
    agentId = 'alexander';
  }

  // ── Date Validation ────────────────────────────────────────────────────
  // Prevent LLM-hallucinated past dates from triggering immediate dispatch
  let scheduledAt = data.scheduled_at;
  if (scheduledAt) {
    const scheduledDate = new Date(scheduledAt);
    const now = new Date();
    if (isNaN(scheduledDate.getTime())) {
      console.warn(`[ResolutionExecution] Invalid date "${scheduledAt}", using now`);
      scheduledAt = now.toISOString();
    } else if (scheduledDate < now) {
      // Past dates default to now — don't trigger immediate dispatch of a "yesterday" task
      scheduledAt = now.toISOString();
    }
  }

  const { data: mission, error } = await supabase
    .from('missions')
    .insert({
      title: data.title,
      description: data.description,
      status: 'scheduled',
      mission_status: 'scheduled',
      mission_phase: 'tasks',
      // SAFETY: Boardroom-created missions start as 'pending' so user sees them
      // before the dispatcher picks them up
      mission_phase_status: 'pending',
      priority: data.priority === 'urgent' ? 3 : data.priority === 'high' ? 2 : data.priority === 'medium' ? 1 : 0,
      agent_id: agentId,
      scheduled_at: scheduledAt || new Date().toISOString(),
      created_by: 'boardroom',
      metadata: {
        source_session_id: _sourceSessionId,
        source_type: 'boardroom',
        relevant_excerpt: data.source_excerpt,
      },
    })
    .select('id')
    .single();

  if (error) throw error;
  return mission.id;
}

async function createDocumentMission(
  _sourceSessionId: string,
  item: ResolutionPackageItem
): Promise<string> {
  const data = item.data as any;

  const description = `Create a ${data.type}: ${data.title}

${data.description}

Context from boardroom session:
"${data.source_excerpt}"`;

  const { data: mission, error } = await supabase
    .from('missions')
    .insert({
      title: `Write: ${data.title}`,
      description,
      status: 'scheduled',
      mission_status: 'scheduled',
      mission_phase: 'tasks',
      mission_phase_status: 'approved',
      priority: 1,
      agent_id: data.agent_id,
      scheduled_at: new Date().toISOString(),
      created_by: 'boardroom',
      metadata: {
        source_session_id: _sourceSessionId,
        source_type: 'boardroom',
        document_type: data.type,
        relevant_excerpt: data.source_excerpt,
      },
    })
    .select('id')
    .single();

  if (error) throw error;
  return mission.id;
}

const MAX_FOLLOW_UP_DEPTH = 2; // Prevent infinite recursion: max 2 levels of follow-ups

async function createFollowUpSession(
  _sourceSessionId: string,
  sourceSession: BoardroomSession,
  item: ResolutionPackageItem
): Promise<string> {
  const data = item.data as ResolutionFollowUpMeeting;
  const sourceMetadata = sourceSession.metadata as BoardroomSessionMetadata;

  // ── Recursion Guard ─────────────────────────────────────────────────────
  // Track follow-up depth to prevent infinite chains.
  // If source session was itself a follow-up, increment depth.
  const sourceDepth = (sourceMetadata as any)?.follow_up_depth ?? 0;
  const newDepth = sourceDepth + 1;

  if (newDepth > MAX_FOLLOW_UP_DEPTH) {
    console.warn(
      `[ResolutionExecution] Follow-up depth ${newDepth} exceeds max ${MAX_FOLLOW_UP_DEPTH}. ` +
      `Skipping follow-up for session ${_sourceSessionId}. Chain: depth ${sourceDepth} → would be ${newDepth}.`
    );
    throw new Error(`Follow-up depth limit (${MAX_FOLLOW_UP_DEPTH}) exceeded. Create manually if needed.`);
  }

  // Validate participant agent IDs against known agents
  const { AGENTS } = await import('../types/supabase');
  const validAgentIds = new Set(AGENTS.map(a => a.id));
  const validatedParticipants = (data.participant_agent_ids || []).filter(id => {
    if (!validAgentIds.has(id)) {
      console.warn(`[ResolutionExecution] Unknown agent_id "${id}" in follow-up participants, removing`);
      return false;
    }
    return true;
  });

  // Require at least 2 participants
  if (validatedParticipants.length < 2) {
    // Fall back to source session participants
    console.warn('[ResolutionExecution] Too few valid participants, using source session participants');
    validatedParticipants.length = 0;
    validatedParticipants.push(...sourceSession.participant_agent_ids);
  }

  const followUpMetadata: BoardroomSessionMetadata = {
    routing_mode: sourceMetadata?.routing_mode || 'smart',
    // SAFETY: Follow-up sessions NEVER auto-start. User must explicitly start them.
    auto_start: false,
    notify_whatsapp: false,
    agenda: data.agenda,
    // SAFETY: Follow-up sessions ALWAYS use 'propose' mode to prevent recursive auto-execution
    resolution_mode: 'propose',
    context: `Follow-up from: ${sourceSession.title}

Unresolved items to address:
${data.unresolved_items.map(item => `- ${item}`).join('\n')}

Previous session context:
"${data.source_excerpt}"`,
    entity_references: sourceMetadata?.entity_references,
    follow_up_depth: newDepth,
    source_session_id: _sourceSessionId,
  } as BoardroomSessionMetadata & { follow_up_depth: number; source_session_id: string };

  const { data: session, error } = await supabase
    .from('boardroom_sessions')
    .insert({
      title: data.title,
      topic: data.topic,
      session_type: sourceSession.session_type,
      // SAFETY: Always 'open' (never 'scheduled' with auto_start) to require manual start
      status: 'open',
      participant_agent_ids: validatedParticipants,
      max_turns: sourceSession.max_turns,
      scheduled_at: data.scheduled_at || null,
      created_by: 'boardroom',
      metadata: followUpMetadata,
    })
    .select('id')
    .single();

  if (error) throw error;
  return session.id;
}

// ─── CRM Entity Executor ──────────────────────────────────────────────────────

async function createCrmEntityFromResolution(
  _sourceSessionId: string,
  item: ResolutionPackageItem
): Promise<string> {
  const data = item.data as ResolutionCRMAction;

  // ── Validate entity name ────────────────────────────────────────────────
  if (!data.name || data.name.trim().length === 0) {
    throw new Error(`CRM ${data.type} name is empty — cannot create entity without a name`);
  }

  const details = data.details || {};
  const metadata = {
    ...(details.metadata || {}),
    source_session_id: _sourceSessionId,
    source_type: 'boardroom',
    source_excerpt: data.source_excerpt,
  };

  switch (data.type) {
    case 'company': {
      if (data.action === 'update' && details.id) {
        // Update existing company
        const { error } = await supabase
          .from('companies')
          .update({
            ...(details.industry ? { industry: details.industry } : {}),
            ...(details.website ? { website: details.website } : {}),
            ...(details.domain ? { domain: details.domain } : {}),
            ...(details.phone ? { phone: details.phone } : {}),
            ...(details.notes ? { notes: details.notes } : {}),
            custom_fields: metadata,
            updated_at: new Date().toISOString(),
          })
          .eq('id', details.id);
        if (error) throw error;
        // Update local store
        useCrmStore.getState().updateCompany(details.id, {
          ...(details.industry ? { industry: details.industry } : {}),
          ...(details.website ? { website: details.website } : {}),
          updated_at: new Date().toISOString(),
        });
        return details.id;
      }

      // Create new company
      const { data: company, error } = await supabase
        .from('companies')
        .insert({
          name: data.name.trim(),
          industry: details.industry || null,
          website: details.website || null,
          domain: details.domain || null,
          phone: details.phone || null,
          notes: details.notes || null,
          country: details.country || 'ZA',
          tags: details.tags || [],
          custom_fields: metadata,
        })
        .select()
        .single();
      if (error) throw error;
      useCrmStore.getState().addCompany(company);
      return company.id;
    }

    case 'contact': {
      // Parse name into first/last
      const nameParts = data.name.trim().split(/\s+/);
      const firstName = nameParts[0] || data.name.trim();
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      if (data.action === 'update' && details.id) {
        const { error } = await supabase
          .from('contacts')
          .update({
            ...(details.email ? { email: details.email } : {}),
            ...(details.phone ? { phone: details.phone } : {}),
            ...(details.job_title ? { job_title: details.job_title } : {}),
            ...(details.company_id ? { company_id: details.company_id } : {}),
            ...(details.notes ? { notes: details.notes } : {}),
            custom_fields: metadata,
            updated_at: new Date().toISOString(),
          })
          .eq('id', details.id);
        if (error) throw error;
        useCrmStore.getState().updateContact(details.id, {
          ...(details.email ? { email: details.email } : {}),
          ...(details.phone ? { phone: details.phone } : {}),
          updated_at: new Date().toISOString(),
        });
        return details.id;
      }

      // Create new contact
      const { data: contact, error } = await supabase
        .from('contacts')
        .insert({
          first_name: firstName,
          last_name: lastName,
          email: details.email || null,
          phone: details.phone || null,
          job_title: details.job_title || null,
          company_id: details.company_id || null,
          lifecycle_status: details.lifecycle_status || 'lead',
          lead_source: 'boardroom',
          tags: details.tags || [],
          custom_fields: metadata,
        })
        .select()
        .single();
      if (error) throw error;
      useCrmStore.getState().addContact(contact);
      return contact.id;
    }

    case 'deal': {
      if (data.action === 'update' && details.id) {
        const { error } = await supabase
          .from('deals')
          .update({
            ...(details.amount != null ? { amount: details.amount } : {}),
            ...(details.stage_id ? { stage_id: details.stage_id } : {}),
            ...(details.description ? { description: details.description } : {}),
            custom_fields: metadata,
            updated_at: new Date().toISOString(),
          })
          .eq('id', details.id);
        if (error) throw error;
        useCrmStore.getState().updateDeal(details.id, {
          ...(details.amount != null ? { amount: details.amount } : {}),
          updated_at: new Date().toISOString(),
        });
        return details.id;
      }

      // Create new deal — need a pipeline + stage
      const crmState = useCrmStore.getState();
      const defaultPipeline = crmState.pipelines.find(p => p.is_default) || crmState.pipelines[0];
      if (!defaultPipeline || !defaultPipeline.stages?.length) {
        throw new Error('No deal pipeline found — cannot create deal without a pipeline');
      }
      const firstStage = [...defaultPipeline.stages].sort(
        (a, b) => a.display_order - b.display_order
      )[0];

      const { data: deal, error } = await supabase
        .from('deals')
        .insert({
          title: data.name.trim(),
          description: details.description || null,
          pipeline_id: defaultPipeline.id,
          stage_id: details.stage_id || firstStage.id,
          amount: details.amount || null,
          currency: details.currency || 'ZAR',
          contact_id: details.contact_id || null,
          company_id: details.company_id || null,
          status: 'open',
          priority: details.priority || 'medium',
          tags: details.tags || [],
          custom_fields: metadata,
        })
        .select()
        .single();
      if (error) throw error;
      useCrmStore.getState().addDeal(deal);
      return deal.id;
    }

    default:
      throw new Error(`Unknown CRM entity type: ${data.type}`);
  }
}

// ─── Calendar Event Executor ──────────────────────────────────────────────────

async function createEventFromResolution(
  _sourceSessionId: string,
  item: ResolutionPackageItem
): Promise<string> {
  const data = item.data as ResolutionCalendarEvent;

  // ── Validate start_time ─────────────────────────────────────────────────
  if (!data.start_time) {
    throw new Error('Calendar event requires a start_time');
  }
  const startDate = new Date(data.start_time);
  if (isNaN(startDate.getTime())) {
    throw new Error(`Invalid start_time "${data.start_time}" — must be a valid ISO date`);
  }

  // ── Default duration to 60 minutes ──────────────────────────────────────
  const durationMinutes = data.duration_minutes && data.duration_minutes > 0
    ? data.duration_minutes
    : 60;

  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  // ── If start_time is in the past, push it to tomorrow at the same hour ──
  const now = new Date();
  let startAt = startDate.toISOString();
  let endAt = endDate.toISOString();
  if (startDate < now) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);
    const tomorrowEnd = new Date(tomorrow.getTime() + durationMinutes * 60 * 1000);
    startAt = tomorrow.toISOString();
    endAt = tomorrowEnd.toISOString();
    console.warn(
      `[ResolutionExecution] Event start_time "${data.start_time}" is in the past. ` +
      `Rescheduled to ${startAt}`
    );
  }

  const { data: event, error } = await supabase
    .from('calendar_events')
    .insert({
      title: data.title || 'Boardroom Event',
      description: data.description || null,
      event_type: 'meeting' as const,
      status: 'scheduled' as const,
      start_at: startAt,
      end_at: endAt,
      all_day: false,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      attendee_agent_ids: data.attendees || [],
      metadata: {
        source_session_id: _sourceSessionId,
        source_type: 'boardroom',
        source_excerpt: data.source_excerpt,
      },
    })
    .select('id')
    .single();

  if (error) throw error;
  return event.id;
}

// ─── Quote Executor ───────────────────────────────────────────────────────────

async function createQuoteFromResolution(
  _sourceSessionId: string,
  item: ResolutionPackageItem
): Promise<string> {
  const data = item.data as ResolutionQuote;

  // ── Validate customer name ──────────────────────────────────────────────
  if (!data.customer || data.customer.trim().length === 0) {
    throw new Error('Quote requires a customer name');
  }

  // ── Validate line items ─────────────────────────────────────────────────
  if (!data.items || data.items.length === 0) {
    throw new Error('Quote requires at least one line item');
  }

  // ── Resolve customer to contact or company ──────────────────────────────
  const crmState = useCrmStore.getState();
  const customerLower = data.customer.trim().toLowerCase();

  // Try matching against companies first (exact or partial match)
  const matchedCompany = crmState.companies.find(
    c => c.name.toLowerCase() === customerLower
  ) || crmState.companies.find(
    c => c.name.toLowerCase().includes(customerLower) || customerLower.includes(c.name.toLowerCase())
  );

  // Try matching against contacts
  const matchedContact = crmState.contacts.find(c => {
    const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
    return fullName === customerLower || fullName.includes(customerLower) || customerLower.includes(fullName);
  });

  // ── Generate quote number ───────────────────────────────────────────────
  const { data: lastQuote } = await supabase
    .from('quotes')
    .select('quote_number')
    .order('created_at', { ascending: false })
    .limit(1);

  let quoteNumber = 'Q-00001';
  if (lastQuote && lastQuote.length > 0) {
    const match = lastQuote[0].quote_number.match(/Q-(\d+)/);
    if (match) {
      quoteNumber = `Q-${String(parseInt(match[1], 10) + 1).padStart(5, '0')}`;
    }
  }

  // ── Insert quote ────────────────────────────────────────────────────────
  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({
      quote_number: quoteNumber,
      title: data.description || `Quote for ${data.customer}`,
      status: 'draft',
      contact_id: matchedContact?.id || null,
      company_id: matchedCompany?.id || null,
      currency: 'ZAR',
      internal_note: `Created from boardroom session.\n\nSource: "${data.source_excerpt}"`,
      customer_note: null,
    })
    .select()
    .single();

  if (error) throw error;

  // ── Insert line items ───────────────────────────────────────────────────
  if (data.items.length > 0) {
    const lineItems = data.items.map((li, idx) => ({
      quote_id: quote.id,
      name: li.description || `Item ${idx + 1}`,
      description: li.description || null,
      quantity: 1,
      unit_price: li.amount ?? 0,
      discount_percent: 0,
      tax_amount: 0,
      sort_order: idx,
    }));

    const { error: liError } = await supabase
      .from('quote_line_items')
      .insert(lineItems);

    if (liError) {
      console.error('[ResolutionExecution] Failed to insert quote line items:', liError);
    } else {
      // Recalculate totals
      const subtotal = lineItems.reduce(
        (sum, li) => sum + li.quantity * li.unit_price,
        0
      );
      const total = subtotal; // No tax/discount from resolution data

      await supabase
        .from('quotes')
        .update({ subtotal, tax_total: 0, discount_total: 0, total })
        .eq('id', quote.id);
    }
  }

  return quote.id;
}

// ─── Project Executor ─────────────────────────────────────────────────────────

async function createProjectFromResolution(
  _sourceSessionId: string,
  item: ResolutionPackageItem,
  resolutionPackage: ResolutionPackage
): Promise<string> {
  const data = item.data as ResolutionProject;

  // ── Validate project name ───────────────────────────────────────────────
  if (!data.name || data.name.trim().length === 0) {
    throw new Error('Project requires a name');
  }

  // ── Insert project ──────────────────────────────────────────────────────
  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name: data.name.trim(),
      description: data.description || null,
      status: 'planning',
      currency: 'ZAR',
      tags: [],
      custom_fields: {
        source_session_id: _sourceSessionId,
        source_type: 'boardroom',
        source_excerpt: data.source_excerpt,
      },
    })
    .select()
    .single();

  if (error) throw error;

  // ── Link missions that were already created in this resolution ──────────
  // data.mission_ids may reference item IDs within the same resolution package.
  // Resolve those to actual created_id values from already-executed items.
  if (data.mission_ids && data.mission_ids.length > 0) {
    const resolvedMissionIds: string[] = [];

    for (const missionRef of data.mission_ids) {
      // Check if this is a reference to another resolution item by ID
      const referencedItem = resolutionPackage.items.find(
        i => i.id === missionRef && i.type === 'mission' && i.status === 'created' && i.created_id
      );

      if (referencedItem?.created_id) {
        resolvedMissionIds.push(referencedItem.created_id);
      } else {
        // It might be a direct mission UUID (already exists in the system)
        // Verify it exists before linking
        const { data: existingMission } = await supabase
          .from('missions')
          .select('id')
          .eq('id', missionRef)
          .single();

        if (existingMission) {
          resolvedMissionIds.push(existingMission.id);
        } else {
          console.warn(
            `[ResolutionExecution] Mission reference "${missionRef}" could not be resolved — ` +
            `not a created resolution item or existing mission. Skipping link.`
          );
        }
      }
    }

    // Insert project_missions junction rows
    if (resolvedMissionIds.length > 0) {
      const junctionRows = resolvedMissionIds.map(missionId => ({
        project_id: project.id,
        mission_id: missionId,
      }));

      const { error: junctionError } = await supabase
        .from('project_missions')
        .insert(junctionRows);

      if (junctionError) {
        console.error('[ResolutionExecution] Failed to link missions to project:', junctionError);
      } else {
        console.log(
          `[ResolutionExecution] Linked ${resolvedMissionIds.length} mission(s) to project "${data.name}"`
        );
      }
    }
  }

  // Update local store
  const { useProjectsStore } = await import('../stores/projects');
  useProjectsStore.getState().addProject(project);

  return project.id;
}
