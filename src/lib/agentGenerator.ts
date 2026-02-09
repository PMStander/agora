import type { HiringRoleSpec } from '../types/supabase';

/**
 * Builds the LLM prompt for generating 3 candidate agent profiles.
 */
export function buildCandidateGenerationPrompt(
  roleSpec: HiringRoleSpec,
  soulAnswers: Record<string, string>
): string {
  return `You are an expert at designing AI agent personalities for a multi-agent orchestration platform called Agora.

Given the following role specification and user preferences, generate exactly 3 candidate agent profiles. Each candidate should have a distinct personality angle: one more analytical/methodical, one more creative/narrative, one more action-oriented/pragmatic.

## Role Specification
- Title: ${roleSpec.roleTitle}
- Team: ${roleSpec.team}
- Domains: ${roleSpec.domains.join(', ')}
- Specialization: ${roleSpec.specialization}
${roleSpec.archetype ? `- Preferred Archetype: ${roleSpec.archetype}` : ''}

## User Preferences
${Object.entries(soulAnswers).map(([q, a]) => `Q: ${q}\nA: ${a}`).join('\n\n')}

Return a JSON array of 3 objects, each with this structure:
{
  "name": "string - a memorable name (can be historical, mythological, or invented)",
  "emoji": "string - single emoji",
  "origin": "string - one paragraph origin story",
  "philosophy": ["string array - 3-5 guiding principles"],
  "inspirations": [{"name": "string", "relationship": "string"}],
  "communicationStyle": {
    "tone": "string",
    "formality": "casual | balanced | formal",
    "verbosity": "concise | balanced | thorough",
    "quirks": ["string array"]
  },
  "neverDos": ["string array - 2-4 constraints"],
  "preferredWorkflows": ["string array"],
  "sampleResponse": "string - how this agent would respond to 'What is your approach to your first task?'"
}`;
}

/** The soul builder questions asked during the interactive Q&A. */
export const SOUL_BUILDER_QUESTIONS = [
  "What should be the core philosophy guiding this agent's decisions? For example: 'Always prioritize depth over breadth' or 'Move fast and iterate.'",
  'Who are the thinkers, frameworks, or methodologies this agent should draw from?',
  'How should this agent communicate? (Formal/casual, verbose/concise, any quirks?)',
  'What should this agent NEVER do? Any hard constraints?',
  'Describe any preferred workflows or working patterns.',
] as const;

/**
 * Builds a system prompt for the soul builder Q&A step.
 */
export function buildSoulBuilderQuestion(
  questionIndex: number,
  previousAnswers: Record<string, string>
): string {
  const answered = Object.entries(previousAnswers)
    .map(([q, a]) => `Q: ${q}\nA: ${a}`)
    .join('\n\n');

  const nextQ = SOUL_BUILDER_QUESTIONS[questionIndex];
  if (!nextQ) return '';

  return `You are helping a user build a personality profile (SOUL) for a new AI agent on the Agora platform.

${answered ? `Previous answers:\n${answered}\n\n` : ''}The next question to ask the user is:
"${nextQ}"

Acknowledge their previous answer briefly (if any), then ask this question in a friendly, conversational way.`;
}
