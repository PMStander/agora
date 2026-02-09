#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT_DIR = process.cwd();
const DEFAULT_LIMIT = 250;
const AGENT_ALIASES = {
  'marcus-aurelius': 'main',
};

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function parseArgs(argv) {
  const options = {
    apply: false,
    limit: DEFAULT_LIMIT,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (arg === '--limit') {
      const raw = argv[index + 1];
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.limit = Math.floor(parsed);
      }
      index += 1;
      continue;
    }
  }
  return options;
}

function resolveAgentId(agentId) {
  if (!agentId) return agentId;
  return AGENT_ALIASES[agentId] || agentId;
}

function extractJsonFencePayloads(text) {
  if (!text) return [];
  const payloads = [];
  const regex = /```json\s*([\s\S]*?)```/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) payloads.push(match[1].trim());
  }
  return payloads;
}

function normalizeChangedFiles(value) {
  if (!Array.isArray(value)) return [];
  const files = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      const path = entry.trim();
      if (path) files.push({ path, status: 'modified' });
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const path = typeof entry.path === 'string' ? entry.path.trim() : '';
    if (!path) continue;
    const status = typeof entry.status === 'string' ? entry.status.trim().toLowerCase() : 'modified';
    files.push({ path, status: status || 'modified' });
  }
  return files;
}

function parseImplementationReport(outputText) {
  const candidates = extractJsonFencePayloads(outputText || '');
  if (candidates.length === 0) return null;

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== 'object') continue;
      if (!('result' in parsed) || !('changed_files' in parsed)) continue;
      return {
        result: typeof parsed.result === 'string' ? parsed.result.trim().toLowerCase() : '',
        changed_files: normalizeChangedFiles(parsed.changed_files),
      };
    } catch {
      // Ignore malformed JSON blocks.
    }
  }
  return null;
}

function missionLooksLikeImplementationWork(mission) {
  const text = [
    mission.title || '',
    mission.description || '',
    mission.input_text || '',
    mission.mission_statement || '',
  ]
    .join(' ')
    .toLowerCase();

  if (/\bnon[-\s]?code\b/.test(text) || /\bno[-\s]?code\b/.test(text)) return false;

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
  if (analysisOnlyHints.some((hint) => text.includes(hint))) return false;

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

function isSuspiciousDoneMission(mission) {
  if ((mission.created_by || '').toLowerCase() === 'proof-rerun') return false;
  if ((mission.title || '').toLowerCase().includes('proof rerun')) return false;
  if (!missionLooksLikeImplementationWork(mission)) return false;
  const report = parseImplementationReport(mission.output_text || '');
  if (!report) return true;
  if (report.result !== 'implemented') return true;
  if (report.changed_files.length === 0) return true;
  return false;
}

function buildRerunInstructions(mission) {
  const outputPreview = (mission.output_text || '')
    .replace(/\s+/g, ' ')
    .slice(0, 800);

  return [
    mission.input_text || mission.description || mission.title,
    '',
    'SYSTEM CONTEXT:',
    `- Previous mission ${mission.id} was auto-flagged as done without verifiable implementation proof.`,
    '- Re-execute this mission with real implementation in /Users/peetstander/Developer/agora.',
    '- Do not return plan-only output if implementation is requested.',
    '- End with JSON report in a fenced block:',
    '```json',
    '{"result":"implemented|analysis_only","repo_root":"<absolute path>","changed_files":[{"path":"relative/or/absolute/path","status":"modified|added|deleted"}],"verification":["checks run"],"summary":"short outcome"}',
    '```',
    '',
    'Previous output preview:',
    outputPreview || '(no previous output)',
  ].join('\n');
}

function logSummary(prefix, data) {
  console.log(`[ProofRequeue] ${prefix}`, data);
}

async function main() {
  const options = parseArgs(process.argv);
  loadDotEnv(resolve(ROOT_DIR, '.env'));

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase config in environment.');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from('missions')
    .select('*')
    .eq('mission_phase', 'tasks')
    .eq('mission_status', 'done')
    .order('updated_at', { ascending: false })
    .limit(options.limit);

  if (error) throw new Error(`Failed to fetch done missions: ${error.message}`);

  const doneMissions = data || [];
  const suspicious = doneMissions.filter(isSuspiciousDoneMission);
  logSummary('scan', {
    apply: options.apply,
    scanned: doneMissions.length,
    suspicious: suspicious.length,
  });

  if (suspicious.length === 0) {
    logSummary('result', 'No suspicious done missions found.');
    return;
  }

  if (!options.apply) {
    for (const mission of suspicious) {
      console.log(`${mission.id}\t${mission.title}`);
    }
    logSummary('next', 'Run with --apply to create reruns and mark originals as failed.');
    return;
  }

  const now = new Date().toISOString();
  const created = [];
  const skipped = [];

  for (const mission of suspicious) {
    const { data: existingReruns, error: existingError } = await supabase
      .from('missions')
      .select('id,mission_status')
      .eq('parent_mission_id', mission.id)
      .eq('created_by', 'proof-rerun')
      .in('mission_status', ['scheduled', 'assigned', 'in_progress', 'pending_review', 'revision'])
      .limit(1);

    if (existingError) {
      skipped.push({ missionId: mission.id, reason: `lookup failed: ${existingError.message}` });
      continue;
    }
    if ((existingReruns || []).length > 0) {
      skipped.push({ missionId: mission.id, reason: 'active proof rerun already exists' });
      continue;
    }

    const rerunPayload = {
      title: `${mission.title} (Proof Rerun)`,
      description: mission.description || null,
      status: 'assigned',
      mission_status: 'assigned',
      mission_phase: 'tasks',
      mission_phase_status: 'approved',
      mission_statement: mission.mission_statement || mission.input_text || mission.description || mission.title,
      mission_plan: null,
      priority: mission.priority || 'medium',
      scheduled_at: now,
      agent_id: resolveAgentId(mission.agent_id),
      input_text: buildRerunInstructions(mission),
      input_media: Array.isArray(mission.input_media) ? mission.input_media : [],
      review_enabled: Boolean(mission.review_enabled),
      review_agent_id: mission.review_enabled ? resolveAgentId(mission.review_agent_id) : null,
      output_text: null,
      output_media: [],
      parent_mission_id: mission.id,
      revision_round: (mission.revision_round || 0) + 1,
      max_revisions: Math.max(mission.max_revisions || 1, (mission.revision_round || 0) + 1),
      review_notes: `Auto-rerun queued on ${now} due to missing implementation proof.`,
      created_by: 'proof-rerun',
      session_key: null,
      domains: mission.domains || null,
    };

    const { data: createdRerun, error: createError } = await supabase
      .from('missions')
      .insert(rerunPayload)
      .select('id,title')
      .single();

    if (createError) {
      skipped.push({ missionId: mission.id, reason: `create failed: ${createError.message}` });
      continue;
    }

    const note = `Auto-requeued due to missing implementation proof. Rerun mission: ${createdRerun.id}`;
    const { error: markError } = await supabase
      .from('missions')
      .update({
        status: 'failed',
        mission_status: 'failed',
        review_notes: note,
        updated_at: now,
      })
      .eq('id', mission.id);

    if (markError) {
      skipped.push({ missionId: mission.id, reason: `mark failed: ${markError.message}` });
      continue;
    }

    await supabase.from('mission_logs').insert([
      {
        mission_id: mission.id,
        type: 'proof_requeue',
        agent_id: resolveAgentId(mission.agent_id),
        message: note,
        metadata: { rerun_mission_id: createdRerun.id, reason: 'missing_implementation_proof' },
      },
      {
        mission_id: createdRerun.id,
        type: 'mission_created',
        agent_id: resolveAgentId(mission.agent_id),
        message: `Proof rerun created from ${mission.id}`,
        metadata: { source_mission_id: mission.id, reason: 'missing_implementation_proof' },
      },
    ]);

    created.push({ sourceMissionId: mission.id, rerunMissionId: createdRerun.id, title: mission.title });
  }

  logSummary('apply-result', {
    created: created.length,
    skipped: skipped.length,
  });

  if (created.length > 0) {
    console.log('Created reruns:');
    for (const entry of created) {
      console.log(`${entry.sourceMissionId} -> ${entry.rerunMissionId}\t${entry.title}`);
    }
  }
  if (skipped.length > 0) {
    console.log('Skipped missions:');
    for (const entry of skipped) {
      console.log(`${entry.missionId}\t${entry.reason}`);
    }
  }
}

main().catch((error) => {
  console.error('[ProofRequeue] failed', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
