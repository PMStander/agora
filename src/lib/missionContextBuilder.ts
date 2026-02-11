import type { Mission } from '../types/supabase';
import { getAgent } from '../types/supabase';

const MAX_OUTPUT_CHARS = 4000;
const MAX_PLAN_CHARS = 2000;

/**
 * Builds the mission context string for "Chat about it" sessions.
 *
 * Injected into the first user message in the new chat session so
 * the agent knows what mission the user is referring to.
 */
export function buildMissionChatContext(mission: Mission): string {
  const agent = getAgent(mission.agent_id);
  const agentLabel = agent ? `${agent.name} (${agent.role})` : mission.agent_id;

  const sections: string[] = [];

  // ── Instructions ────────────────────────────────────────────────────
  sections.push(
    `<instructions>\nYou are being asked about a mission you previously worked on. The user wants to discuss your output, ask follow-up questions, or understand your reasoning.\nAnswer questions about what you did, why you made certain choices, and help the user understand the output.\nDo NOT attempt to re-execute or reopen the mission. Just discuss it.\n</instructions>`
  );

  // ── Mission metadata ────────────────────────────────────────────────
  const meta = [
    `Title: ${mission.title}`,
    `Status: ${mission.status}`,
    `Agent: ${agentLabel}`,
    `Priority: ${mission.priority}`,
  ];
  if (mission.completed_at) {
    meta.push(`Completed: ${new Date(mission.completed_at).toLocaleString()}`);
  }
  if (mission.started_at) {
    meta.push(`Started: ${new Date(mission.started_at).toLocaleString()}`);
  }
  sections.push(`<mission_metadata>\n${meta.join('\n')}\n</mission_metadata>`);

  // ── Mission statement / original request ────────────────────────────
  const statement = mission.mission_statement || mission.input_text || mission.description;
  if (statement) {
    sections.push(`<original_request>\n${statement}\n</original_request>`);
  }

  // ── Mission plan (truncated) ────────────────────────────────────────
  if (mission.mission_plan) {
    const plan =
      mission.mission_plan.length > MAX_PLAN_CHARS
        ? mission.mission_plan.slice(0, MAX_PLAN_CHARS) + '\n[... plan truncated]'
        : mission.mission_plan;
    sections.push(`<mission_plan>\n${plan}\n</mission_plan>`);
  }

  // ── Mission output (truncated) ──────────────────────────────────────
  if (mission.output_text) {
    const totalChars = mission.output_text.length;
    const output =
      totalChars > MAX_OUTPUT_CHARS
        ? mission.output_text.slice(0, MAX_OUTPUT_CHARS) +
          `\n[... output truncated — ${totalChars.toLocaleString()} chars total]`
        : mission.output_text;
    sections.push(`<mission_output>\n${output}\n</mission_output>`);
  }

  // ── Review notes ────────────────────────────────────────────────────
  if (mission.review_notes) {
    sections.push(`<review_notes>\n${mission.review_notes}\n</review_notes>`);
  }

  // ── Revision history ────────────────────────────────────────────────
  if (mission.revision_round > 0) {
    const revisionInfo = [
      `Revision round: ${mission.revision_round} of ${mission.max_revisions}`,
    ];
    if (mission.feedback_text) {
      revisionInfo.push(`Feedback that triggered revision: ${mission.feedback_text}`);
    }
    sections.push(`<revision_history>\n${revisionInfo.join('\n')}\n</revision_history>`);
  }

  // ── Output media summary ────────────────────────────────────────────
  if (mission.output_media && mission.output_media.length > 0) {
    const mediaTypes = mission.output_media.map((m) => m.type || 'file');
    const summary = `${mission.output_media.length} attachment(s): ${mediaTypes.join(', ')}`;
    sections.push(`<output_media>\n${summary}\n</output_media>`);
  }

  return `<mission_context mission_id="${mission.id}" title="${escapeXmlAttr(mission.title)}" status="${mission.status}">\n${sections.join('\n\n')}\n</mission_context>`;
}

/**
 * Builds a short label for the context marker pill in the chat UI.
 */
export function buildMissionMarkerLabel(mission: Mission): string {
  const title =
    mission.title.length > 60 ? mission.title.slice(0, 57) + '...' : mission.title;
  return `📋 Mission: ${title} — ${mission.status}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function escapeXmlAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
