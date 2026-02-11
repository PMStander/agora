import { supabase, isSupabaseConfigured } from './supabase';
import { getAgent } from '../types/supabase';

const MAX_DOC_CHARS = 4000;

/**
 * Builds the project context injection string for a given project + agent.
 *
 * This includes:
 * 1. Context documents (CONTEXT.md etc.) — truncated to MAX_DOC_CHARS each
 * 2. Technology stack instructions (from project_agent_skills where skill_type='technology')
 * 3. Team roster (from crm_agent_assignments)
 * 4. Linked codebases (from project_codebases)
 *
 * Returns null if no context is available or agent has no access.
 */
export async function buildProjectContextInjection(
  projectId: string,
  agentId: string
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  // 1. Get project info
  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .single();

  if (!project) return null;

  // Run all queries in parallel
  const [contextRes, skillsRes, teamRes, codebasesRes] = await Promise.all([
    // 2. Get context documents (if agent has access)
    getContextDocuments(projectId, agentId),
    // 3. Get project skills for this agent
    supabase
      .from('project_agent_skills')
      .select('skill_key, skill_type')
      .eq('project_id', projectId)
      .eq('agent_id', agentId),
    // 4. Get team roster
    supabase
      .from('crm_agent_assignments')
      .select('agent_id, role')
      .eq('entity_type', 'project')
      .eq('entity_id', projectId),
    // 5. Get linked codebases
    supabase
      .from('project_codebases')
      .select('name, source_type, path, branch, description, local_path')
      .eq('project_id', projectId),
  ]);

  const sections: string[] = [];

  // ── Context documents ──────────────────────────────────────────────
  if (contextRes && contextRes.length > 0) {
    const docSections = contextRes.map((doc) => {
      const content =
        doc.content.length > MAX_DOC_CHARS
          ? doc.content.slice(0, MAX_DOC_CHARS) + '\n[... truncated]'
          : doc.content;
      return `## ${doc.title}\n${content}`;
    });
    sections.push(`<context_documents>\n${docSections.join('\n\n')}\n</context_documents>`);
  }

  // ── Technology stack ───────────────────────────────────────────────
  const skills = skillsRes.data || [];
  const techSkills = skills
    .filter((s) => s.skill_type === 'technology')
    .map((s) => s.skill_key);

  if (techSkills.length > 0) {
    sections.push(
      `<project_technology_stack>\nFor this project, use these specific technologies:\n${techSkills
        .map((s) => `- ${s}`)
        .join('\n')}\nTailor all code examples and recommendations to this stack.\n</project_technology_stack>`
    );
  }

  // ── Team roster ────────────────────────────────────────────────────
  const team = teamRes.data || [];
  if (team.length > 0) {
    const lines = team.map((t) => {
      const agent = getAgent(t.agent_id);
      const label = agent ? `${agent.name} - ${agent.role}` : t.agent_id;
      return `- ${t.agent_id} (${t.role}) — ${label}`;
    });
    sections.push(
      `<project_team>\nTeam members on this project:\n${lines.join('\n')}\n</project_team>`
    );
  }

  // ── Linked codebases ─────────────────────────────────────────────
  const codebases = codebasesRes.data || [];
  if (codebases.length > 0) {
    const lines = codebases.map((cb: any) => {
      let line = `- ${cb.name} (${cb.source_type}): ${cb.path}`;
      if (cb.branch) line += ` [${cb.branch}]`;
      if (cb.local_path) line += ` — local: ${cb.local_path}`;
      if (cb.description) line += ` — ${cb.description}`;
      return line;
    });

    // Build workdir directive for codebases with a local filesystem path
    const localCodebases = codebases.filter((cb: any) => cb.local_path);
    const workdirDirective = localCodebases.length > 0
      ? [
          '',
          'IMPORTANT — Working Directory:',
          'When running coding tools (bash, codex, claude, pi, opencode), you MUST use the project\'s local codebase path as your working directory.',
          'Do NOT clone the repo or use your own workspace — the code is already checked out locally.',
          ...localCodebases.map((cb: any) => `- For "${cb.name}": use workdir:${cb.local_path}`),
          `Example: bash pty:true workdir:${localCodebases[0].local_path} command:"codex exec '...'"`,
        ].join('\n')
      : '';

    sections.push(
      `<project_codebases>\nLinked codebases:\n${lines.join('\n')}${workdirDirective}\n</project_codebases>`
    );
  }

  if (sections.length === 0) return null;

  return `<project_context project="${project.name}" project_id="${project.id}">\n${sections.join(
    '\n\n'
  )}\n</project_context>`;
}

// ── Helper: fetch context documents if agent has access ─────────────────

async function getContextDocuments(
  projectId: string,
  agentId: string
): Promise<{ title: string; content: string }[]> {
  // Find the project_context for this project
  const { data: ctx } = await supabase
    .from('project_contexts')
    .select('id')
    .eq('project_id', projectId)
    .maybeSingle();

  if (!ctx) return [];

  // Check access
  const { data: access } = await supabase
    .from('context_access')
    .select('access_level')
    .eq('project_context_id', ctx.id)
    .eq('agent_id', agentId)
    .maybeSingle();

  if (!access) return []; // No access

  // Fetch documents
  const { data: docs } = await supabase
    .from('context_documents')
    .select('title, content')
    .eq('project_context_id', ctx.id)
    .order('updated_at', { ascending: false });

  return (docs || []) as { title: string; content: string }[];
}
