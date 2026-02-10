// ─── Project Agent Types ─────────────────────────────────────────────────────

export interface ProjectAgentSkill {
  id: string;
  project_id: string;
  agent_id: string;
  skill_key: string;
  skill_type: 'technology' | 'gateway';
  notes: string | null;
  created_at: string;
}

export interface ProjectAgentAssignment {
  id: string;
  agent_id: string;
  entity_type: 'project';
  entity_id: string;
  role: 'owner' | 'collaborator' | 'watcher';
  assigned_at: string;
}

export type ProjectAgentRole = 'owner' | 'collaborator' | 'watcher';
export type ProjectSkillType = 'technology' | 'gateway';

/** Common technology labels for the skill picker suggestions */
export const TECHNOLOGY_SUGGESTIONS = [
  // Frontend frameworks
  'angular', 'react', 'vuejs', 'svelte', 'nextjs', 'nuxtjs', 'astro', 'solidjs',
  // CSS / styling
  'tailwind', 'sass', 'css-modules', 'styled-components', 'bootstrap',
  // Languages
  'typescript', 'javascript', 'python', 'rust', 'go', 'ruby', 'php', 'java', 'swift', 'kotlin',
  // Backend frameworks
  'express', 'fastapi', 'django', 'rails', 'laravel', 'nestjs', 'actix', 'gin',
  // Databases
  'postgresql', 'mysql', 'mongodb', 'redis', 'supabase', 'firebase', 'prisma',
  // Mobile
  'react-native', 'flutter', 'ionic', 'capacitor', 'tauri',
  // DevOps / Cloud
  'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'vercel', 'netlify',
  // AI / ML
  'openai', 'langchain', 'pytorch', 'tensorflow', 'huggingface',
  // Testing
  'jest', 'vitest', 'playwright', 'cypress', 'pytest',
] as const;
