import type { AgentFull } from '../types/supabase';

/**
 * Converts an AgentFull's SoulProfile to a markdown system prompt.
 */
export function renderSoulToSystemPrompt(agent: AgentFull): string {
  const { soul, name, role } = agent;
  const sections: string[] = [];

  sections.push(`# SOUL: ${name}\n`);
  sections.push(`> Role: ${role}\n`);

  if (soul.origin) {
    sections.push(`## Origin\n${soul.origin}\n`);
  }

  if (soul.philosophy.length > 0) {
    sections.push(`## Philosophy\n${soul.philosophy.map(p => `- ${p}`).join('\n')}\n`);
  }

  if (soul.inspirations.length > 0) {
    sections.push(
      `## Inspirations\n${soul.inspirations.map(i => `- **${i.name}** - ${i.relationship}`).join('\n')}\n`
    );
  }

  const cs = soul.communicationStyle;
  sections.push(
    `## Communication Style\n${cs.tone}\n- Formality: ${cs.formality}\n- Verbosity: ${cs.verbosity}\n${cs.quirks.map(q => `- ${q}`).join('\n')}\n`
  );

  if (soul.neverDos.length > 0) {
    sections.push(`## Rules (Never Do)\n${soul.neverDos.map(n => `- NEVER: ${n}`).join('\n')}\n`);
  }

  if (soul.preferredWorkflows.length > 0) {
    sections.push(
      `## Preferred Workflows\n${soul.preferredWorkflows.map(w => `- ${w}`).join('\n')}\n`
    );
  }

  if (soul.additionalNotes) {
    sections.push(`## Additional Notes\n${soul.additionalNotes}\n`);
  }

  return sections.join('\n');
}
