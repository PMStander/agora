import type { Mission } from '../types/supabase';

export type MissionProofState = 'verified' | 'not_required' | 'missing' | 'invalid';

export interface MissionProofReportFile {
  path: string;
  status: string;
}

export interface MissionProofReport {
  result: string;
  repo_root: string | null;
  changed_files: MissionProofReportFile[];
  verification: string[];
  summary: string | null;
}

export interface MissionProofAssessment {
  state: MissionProofState;
  label: string;
  detail: string;
  report: MissionProofReport | null;
  requiresProof: boolean;
}

type MissionProofInput = Pick<Mission, 'title' | 'description' | 'input_text' | 'output_text' | 'status' | 'mission_status'>;

function extractJsonFencePayloads(text: string): string[] {
  const payloads: string[] = [];
  const regex = /```json\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) payloads.push(match[1].trim());
  }
  return payloads;
}

function normalizeReportFiles(value: unknown): MissionProofReportFile[] {
  if (!Array.isArray(value)) return [];
  const files: MissionProofReportFile[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      const path = entry.trim();
      if (path) files.push({ path, status: 'modified' });
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const objectEntry = entry as Record<string, unknown>;
    const path = typeof objectEntry.path === 'string' ? objectEntry.path.trim() : '';
    if (!path) continue;
    const status = typeof objectEntry.status === 'string' ? objectEntry.status.trim().toLowerCase() : 'modified';
    files.push({ path, status: status || 'modified' });
  }
  return files;
}

export function parseMissionProofReport(outputText: string | null | undefined): MissionProofReport | null {
  if (!outputText) return null;
  const candidates = extractJsonFencePayloads(outputText);
  if (candidates.length === 0) return null;

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object' || !('result' in parsed) || !('changed_files' in parsed)) {
        continue;
      }
      const result = typeof parsed.result === 'string' ? parsed.result.trim().toLowerCase() : '';
      return {
        result,
        repo_root: typeof parsed.repo_root === 'string' ? parsed.repo_root : null,
        changed_files: normalizeReportFiles(parsed.changed_files),
        verification: Array.isArray(parsed.verification)
          ? parsed.verification.filter((entry): entry is string => typeof entry === 'string')
          : [],
        summary: typeof parsed.summary === 'string' ? parsed.summary : null,
      };
    } catch {
      // Ignore invalid blocks.
    }
  }
  return null;
}

function missionLooksLikeImplementationWork(mission: MissionProofInput): boolean {
  const text = [
    mission.title || '',
    mission.description || '',
    mission.input_text || '',
  ]
    .join(' ')
    .toLowerCase();

  if (/\bnon[-\s]?code\b/.test(text) || /\bno[-\s]?code\b/.test(text)) {
    return false;
  }

  const analysisOnlyHints = [
    'plan only',
    'proposal',
    'propose',
    'draft plan',
    'analysis only',
    'spec only',
    'brainstorm',
    'outline',
  ];
  if (analysisOnlyHints.some((hint) => text.includes(hint))) {
    return false;
  }

  const implementationPatterns = [
    /\bimplement\b/,
    /\bbuild\b/,
    /\bcreate\b/,
    /\bupdate\b/,
    /\brefactor\b/,
    /\bfix\b/,
    /\bcode\b/,
    /\bfrontend\b/,
    /\bbackend\b/,
    /\bcomponent\b/,
    /\bhook\b/,
    /\bmigration\b/,
    /\bschema\b/,
    /\bsupabase\b/,
    /\bapi\b/,
    /\bwire\b/,
    /\bintegration\b/,
    /\btypescript\b/,
    /\breact\b/,
    /\bui\b/,
    /\bmission control\b/,
  ];

  return implementationPatterns.some((pattern) => pattern.test(text));
}

export function assessMissionProof(mission: MissionProofInput): MissionProofAssessment {
  const requiresProof = missionLooksLikeImplementationWork(mission);
  const report = parseMissionProofReport(mission.output_text);

  if (!requiresProof) {
    return {
      state: 'not_required',
      label: 'Proof N/A',
      detail: 'Implementation proof was not required for this mission type.',
      report,
      requiresProof,
    };
  }

  if (!report) {
    return {
      state: 'missing',
      label: 'Proof Missing',
      detail: 'No implementation report was found in mission output.',
      report: null,
      requiresProof,
    };
  }

  if (report.result === 'implemented' && report.changed_files.length > 0) {
    return {
      state: 'verified',
      label: 'Proof Verified',
      detail: `Reported ${report.changed_files.length} changed file(s).`,
      report,
      requiresProof,
    };
  }

  if (report.result === 'analysis_only') {
    return {
      state: 'missing',
      label: 'Proof Missing',
      detail: 'Mission output was analysis-only, but implementation proof was required.',
      report,
      requiresProof,
    };
  }

  return {
    state: 'invalid',
    label: 'Proof Invalid',
    detail: 'Implementation report exists but is incomplete or invalid.',
    report,
    requiresProof,
  };
}
