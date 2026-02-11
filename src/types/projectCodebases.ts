// ─── Project Codebases ────────────────────────────────────────────────────────

export type CodebaseSourceType = 'local' | 'github' | 'gitlab' | 'bitbucket' | 'url';

export interface ProjectCodebase {
  id: string;
  project_id: string;
  name: string;
  source_type: CodebaseSourceType;
  path: string;
  branch: string | null;
  description: string | null;
  local_path: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const SOURCE_TYPE_ICONS: Record<CodebaseSourceType, string> = {
  local: '\uD83D\uDCC1',
  github: '\uD83D\uDC19',
  gitlab: '\uD83E\uDD8A',
  bitbucket: '\uD83E\uDEA3',
  url: '\uD83C\uDF10',
};

export const SOURCE_TYPE_LABELS: Record<CodebaseSourceType, string> = {
  local: 'Local Path',
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  url: 'URL',
};
