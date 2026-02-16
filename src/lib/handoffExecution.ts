/**
 * Smart Handoff Execution
 *
 * Agents embed a handoffIntent JSON block on a standalone line in their response.
 * The frontend detects it, strips it from visible text, and auto-executes the
 * appropriate action (switch chat, create mission, or both).
 */
import { supabase, isSupabaseConfigured } from './supabase';
import { useAgentStore } from '../stores/agents';
import { useMissionControlStore } from '../stores/missionControl';
import { useProjectsStore } from '../stores/projects';
import { createNotificationDirect } from '../hooks/useNotifications';
import type { MissionPriority } from '../types/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HandoffIntent {
  type: 'handoffIntent';
  target_agent_id: string;
  action: 'switch_chat' | 'create_mission' | 'switch_and_mission';
  reason: string;
  context_summary: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

/** Regex to detect a handoffIntent JSON block on a standalone line. */
const HANDOFF_JSON_LINE =
  /^\s*\{[^}]*"type"\s*:\s*"handoffIntent"[^]*\}\s*$/;

// ─── Extraction ───────────────────────────────────────────────────────────────

/**
 * Scan text for a handoffIntent JSON block.
 * Returns the cleaned text (block removed) and the parsed intent (or null).
 */
export function extractHandoffIntent(text: string): {
  cleaned: string;
  intent: HandoffIntent | null;
} {
  if (!text || !text.includes('handoffIntent')) {
    return { cleaned: text, intent: null };
  }

  const lines = text.split('\n');
  const kept: string[] = [];
  let intent: HandoffIntent | null = null;
  let inCodeFence = false;
  let fenceLines: string[] = [];
  let fenceHasHandoff = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Track code fences
    if (trimmed.startsWith('```')) {
      if (!inCodeFence) {
        inCodeFence = true;
        fenceHasHandoff = false;
        fenceLines = [line];
        continue;
      } else {
        fenceLines.push(line);
        inCodeFence = false;
        if (!fenceHasHandoff) {
          kept.push(...fenceLines);
        }
        fenceLines = [];
        continue;
      }
    }

    if (inCodeFence) {
      fenceLines.push(line);
      if (HANDOFF_JSON_LINE.test(trimmed)) {
        fenceHasHandoff = true;
        intent = tryParseHandoff(trimmed) ?? intent;
      }
      continue;
    }

    // Outside code fences: check standalone JSON lines
    if (trimmed.startsWith('{') && HANDOFF_JSON_LINE.test(trimmed)) {
      const parsed = tryParseHandoff(trimmed);
      if (parsed) {
        intent = parsed;
        continue; // strip this line
      }
    }

    kept.push(line);
  }

  // Unclosed fence — keep those lines
  if (inCodeFence && fenceLines.length > 0) {
    kept.push(...fenceLines);
  }

  const cleaned = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { cleaned, intent };
}

function tryParseHandoff(raw: string): HandoffIntent | null {
  try {
    const obj = JSON.parse(raw);
    if (
      obj &&
      obj.type === 'handoffIntent' &&
      typeof obj.target_agent_id === 'string' &&
      typeof obj.action === 'string' &&
      typeof obj.reason === 'string' &&
      typeof obj.context_summary === 'string' &&
      ['switch_chat', 'create_mission', 'switch_and_mission'].includes(obj.action)
    ) {
      return obj as HandoffIntent;
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

// ─── Execution ────────────────────────────────────────────────────────────────

const PRIORITY_MAP: Record<string, MissionPriority> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent',
};

export interface HandoffResult {
  success: boolean;
  requestingName: string;
  targetName: string;
  action: HandoffIntent['action'];
  missionId: string | null;
  error?: string;
}

/**
 * Execute a smart handoff:
 * 1. Record it in Supabase (audit trail)
 * 2. Perform the action (switch chat / create mission / both)
 * 3. Create a notification
 * Returns a result so callers can provide user feedback.
 */
export async function executeHandoffIntent(
  intent: HandoffIntent,
  requestingAgentId: string,
  /** Callback to send a message to a target agent. Provided by useOpenClaw. */
  sendMessageFn?: (message: string, agentId: string) => Promise<void>,
  /** Active project to auto-link handoff-created missions. */
  projectId?: string | null,
): Promise<HandoffResult> {
  const agentStore = useAgentStore.getState();
  const missionStore = useMissionControlStore.getState();

  // Resolve display names for logging
  const allAgents = agentStore.teams.flatMap((t) => t.agents);
  const requestingAgent = allAgents.find((a) => a.id === requestingAgentId);
  const targetAgent = allAgents.find((a) => a.id === intent.target_agent_id);
  const requestingName = requestingAgent?.name ?? requestingAgentId;
  const targetName = targetAgent?.name ?? intent.target_agent_id;

  console.log(
    `[SmartHandoff] ${requestingName} → ${targetName} (${intent.action}): ${intent.reason}`,
  );

  // 1. Record handoff in Supabase
  if (isSupabaseConfigured()) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('handoff_requests')
      .insert({
        requesting_agent_id: requestingAgentId,
        target_agent_id: intent.target_agent_id,
        reason: intent.reason,
        context_summary: intent.context_summary,
        priority: intent.priority,
        status: 'completed', // auto-executed = already completed
        accepted_at: now,
        completed_at: now,
        outcome: `Auto-executed: ${intent.action}`,
      });

    if (error) {
      console.error('[SmartHandoff] Failed to record handoff:', error);
      return { success: false, requestingName, targetName, action: intent.action, missionId: null, error: `DB error: ${error.message}` };
    }
  }

  // 2. Execute the action
  let missionId: string | null = null;

  if (intent.action === 'switch_chat' || intent.action === 'switch_and_mission') {
    // Switch the active chat to the target agent
    agentStore.setActiveAgent(intent.target_agent_id);

    // Send the context summary as the first message to the target agent
    // Note: This may fail if the target agent isn't connected — that's OK,
    // the handoff record exists and the chat is switched.
    if (sendMessageFn) {
      setTimeout(() => {
        const contextMessage = `[Handoff from ${requestingName}]\n\n${intent.context_summary}`;
        sendMessageFn(contextMessage, intent.target_agent_id).catch((err) => {
          console.warn('[SmartHandoff] Context message to target agent failed (agent may not be connected):', err);
        });
      }, 300);
    }
  }

  if (intent.action === 'create_mission' || intent.action === 'switch_and_mission') {
    // Create a mission for the target agent
    if (isSupabaseConfigured()) {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('missions')
        .insert({
          title: intent.reason,
          description: intent.context_summary,
          status: 'scheduled',
          mission_status: 'scheduled',
          mission_phase: 'statement',
          mission_phase_status: 'draft',
          priority: PRIORITY_MAP[intent.priority] || 'medium',
          agent_id: intent.target_agent_id,
          created_by: requestingAgentId,
          scheduled_at: now,
          input_text: intent.context_summary,
          review_enabled: false,
          revision_round: 0,
          max_revisions: 3,
          input_media: [],
          output_media: [],
        })
        .select('id')
        .single();

      if (error) {
        console.error('[SmartHandoff] Failed to create mission:', error);
      } else {
        missionId = data?.id ?? null;
        if (missionId) {
          // Add to local store
          missionStore.addMission({
            id: missionId,
            title: intent.reason,
            description: intent.context_summary,
            status: 'scheduled',
            mission_status: 'scheduled',
            mission_phase: 'statement',
            mission_phase_status: 'draft',
            mission_statement: null,
            mission_plan: null,
            priority: PRIORITY_MAP[intent.priority] || 'medium',
            agent_id: intent.target_agent_id,
            created_by: requestingAgentId,
            scheduled_at: now,
            started_at: null,
            completed_at: null,
            input_text: intent.context_summary,
            input_media: [],
            review_enabled: false,
            review_agent_id: null,
            output_text: null,
            output_media: [],
            parent_mission_id: null,
            revision_round: 0,
            max_revisions: 3,
            review_notes: null,
            feedback_text: null,
            reopened_at: null,
            session_key: null,
            domains: null,
            created_at: now,
            updated_at: now,
          });
        }

        // Auto-link mission to active project
        if (missionId && projectId) {
          const { error: linkErr } = await supabase
            .from('project_missions')
            .insert({ project_id: projectId, mission_id: missionId });
          if (linkErr) {
            console.error('[SmartHandoff] Failed to link mission to project:', linkErr);
          } else {
            // Update local store so UI reflects immediately
            const projectsStore = useProjectsStore.getState();
            const project = projectsStore.projects.find((p) => p.id === projectId);
            if (project) {
              projectsStore.updateProject(projectId, {
                mission_ids: [...(project.mission_ids || []), missionId],
              } as any);
            }
          }
        }
      }
    }
  }

  // 3. Activity log
  missionStore.addActivity({
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'handoff_completed',
    message: `${requestingName} handed off to ${targetName}: ${intent.reason}`,
    agent: requestingAgent
      ? { id: requestingAgent.id, name: requestingAgent.name, emoji: requestingAgent.emoji }
      : null,
    created_at: new Date().toISOString(),
  });

  // 4. Notification
  try {
    await createNotificationDirect(
      'system',
      `Handoff: ${requestingName} → ${targetName}`,
      intent.reason,
      missionId ? 'mission' : undefined,
      missionId ?? undefined,
      requestingAgentId,
      'info',
    );
  } catch (err) {
    console.error('[SmartHandoff] Notification failed:', err);
  }

  return { success: true, requestingName, targetName, action: intent.action, missionId };
}

// ─── Agent Roster Builder ─────────────────────────────────────────────────────

/**
 * Build a text roster of all available agents for injection into messages.
 * This lets agents know who they can hand off to.
 */
export function buildAgentRoster(): string {
  const teams = useAgentStore.getState().teams;
  const lines: string[] = [];

  for (const team of teams) {
    for (const agent of team.agents) {
      lines.push(`- ${agent.id}: ${agent.name}, ${agent.role}`);
    }
  }

  return lines.join('\n');
}

/**
 * System prompt fragment that teaches agents how to use handoffs.
 */
export const HANDOFF_SYSTEM_PROMPT = `When a user's request is better suited for another team member, you may hand it off by including this JSON block on its own line in your response:
{"type":"handoffIntent","target_agent_id":"<agent-id>","action":"<action>","reason":"<short reason>","context_summary":"<what the target agent needs to know>","priority":"<low|medium|high|urgent>"}

Actions:
- "switch_chat": Transfer the conversation to the target agent (user continues chatting with them)
- "create_mission": Create a background task/mission for the target agent (user stays in current chat)
- "switch_and_mission": Both transfer the conversation AND create a tracked mission

Guidelines:
- Only hand off when the request is clearly outside your expertise
- Always provide a thorough context_summary so the target agent can continue seamlessly
- Use switch_chat for interactive conversations, create_mission for background tasks
- Include the JSON on a single standalone line (not inside markdown code blocks)`;
