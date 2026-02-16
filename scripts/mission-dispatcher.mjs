#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { open, stat, unlink } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const LOCK_PATH = '/tmp/agora-mission-dispatcher.lock';
const DEFAULT_LIMIT = 6;
const DEFAULT_AGENT_TIMEOUT_SEC = 600;
const DEFAULT_MISSION_REPO_ROOT = '/Users/peetstander/Developer/agora';
const IMPLEMENTATION_MTIME_SKEW_MS = 5000;
const AGENT_ALIASES = {
  'marcus-aurelius': 'main',
};

function log(message, details) {
  const stamp = new Date().toISOString();
  if (details !== undefined) {
    console.log(`[MissionDispatcher] ${stamp} ${message}`, details);
    return;
  }
  console.log(`[MissionDispatcher] ${stamp} ${message}`);
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    limit: DEFAULT_LIMIT,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      options.dryRun = true;
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

function toIsoNow() {
  return new Date().toISOString();
}

function mergeTextPayloads(payloads) {
  if (!Array.isArray(payloads)) return '';
  return payloads
    .map((entry) => (entry && typeof entry.text === 'string' ? entry.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
}

function parseOpenClawJson(stdout) {
  const raw = stdout.trim();
  const braceStartByLine = raw.lastIndexOf('\n{');
  const start = braceStartByLine >= 0 ? braceStartByLine + 1 : raw.indexOf('{');
  const end = raw.lastIndexOf('}');

  if (start < 0 || end <= start) {
    throw new Error('Unable to parse JSON payload from `openclaw agent --json` output.');
  }

  const jsonText = raw.slice(start, end + 1);
  return JSON.parse(jsonText);
}

function extractAgentText(parsed) {
  const text = mergeTextPayloads(parsed?.result?.payloads);
  if (text) return text;
  if (typeof parsed?.summary === 'string' && parsed.summary.trim().length > 0) {
    return parsed.summary.trim();
  }
  return '';
}

function parseReviewDecision(rawText) {
  const fallback = {
    approved: false,
    summary: 'Reviewer requested changes.',
    followUpInstructions: rawText.trim() || 'Please revise based on reviewer feedback.',
  };

  const text = rawText.trim();
  const jsonCandidates = [];
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) jsonCandidates.push(fenced[1]);
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) jsonCandidates.push(objectMatch[0]);

  for (const candidate of jsonCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      return {
        approved: parsed?.approved === true,
        summary: typeof parsed?.summary === 'string'
          ? parsed.summary
          : parsed?.approved === true
          ? 'Review approved.'
          : 'Reviewer requested changes.',
        followUpInstructions: typeof parsed?.follow_up_instructions === 'string'
          ? parsed.follow_up_instructions
          : typeof parsed?.followUpInstructions === 'string'
          ? parsed.followUpInstructions
          : null,
      };
    } catch {
      // Try the next parse candidate.
    }
  }

  const lowered = text.toLowerCase();
  if (lowered.includes('approved') || lowered.includes('looks good') || lowered.includes('pass')) {
    return {
      approved: true,
      summary: text || 'Review approved.',
      followUpInstructions: null,
    };
  }

  return fallback;
}

function parseMissionPlanTaskCount(missionPlan) {
  if (!missionPlan || typeof missionPlan !== 'string') return 0;
  const trimmed = missionPlan.trim();
  if (!trimmed) return 0;

  const candidates = [];
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1]);
  candidates.push(trimmed);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed.length;
      if (Array.isArray(parsed?.missions)) return parsed.missions.length;
      if (Array.isArray(parsed?.tasks)) return parsed.tasks.length;
      if (Array.isArray(parsed?.plan)) return parsed.plan.length;
    } catch {
      // Ignore malformed JSON plan blocks.
    }
  }

  return 0;
}

function isLifecycleExecutionReady(mission) {
  const phase = mission?.mission_phase || 'tasks';
  const phaseStatus = mission?.mission_phase_status || 'approved';
  return phase === 'tasks' && phaseStatus === 'approved';
}

function isAggregateLifecycleMission(mission) {
  if (mission?.parent_mission_id) return false;
  return parseMissionPlanTaskCount(mission?.mission_plan || null) > 0;
}

function getMissionRepoRoot() {
  return resolve(process.env.MISSION_REPO_ROOT || DEFAULT_MISSION_REPO_ROOT);
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function missionLooksLikeImplementationWork(mission) {
  const text = [
    mission?.title || '',
    mission?.description || '',
    mission?.input_text || '',
    mission?.mission_statement || '',
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

function normalizeChangedFiles(report) {
  if (!report || !Array.isArray(report.changed_files)) return [];
  const normalized = [];
  for (const entry of report.changed_files) {
    if (typeof entry === 'string') {
      const path = entry.trim();
      if (path) normalized.push({ path, status: 'modified' });
      continue;
    }
    if (entry && typeof entry === 'object' && typeof entry.path === 'string') {
      const path = entry.path.trim();
      if (!path) continue;
      const status = typeof entry.status === 'string' ? entry.status.trim().toLowerCase() : 'modified';
      normalized.push({ path, status: status || 'modified' });
    }
  }
  return normalized;
}

function parseImplementationReport(primaryOutput) {
  const candidates = extractJsonFencePayloads(primaryOutput || '');
  if (candidates.length === 0) return null;

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && 'result' in parsed && 'changed_files' in parsed) {
        return parsed;
      }
    } catch {
      // Ignore malformed JSON blocks and continue.
    }
  }

  return null;
}

function pathInsideRoot(rootPath, absolutePath) {
  const rel = relative(rootPath, absolutePath);
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith('../'));
}

function gitStatusForPath(repoRoot, relativePath) {
  const statusResult = spawnSync('git', ['-C', repoRoot, 'status', '--porcelain', '--', relativePath], {
    encoding: 'utf8',
  });
  if (statusResult.status !== 0) return '';
  return statusResult.stdout.trim();
}

async function verifyImplementationEvidence(mission, primaryOutput) {
  const proofEnabled = parseBoolean(process.env.MISSION_REQUIRE_IMPLEMENTATION_PROOF, true);
  const forceProof = parseBoolean(process.env.MISSION_REQUIRE_IMPLEMENTATION_PROOF_FORCE, false);
  const requiresProof = forceProof || (proofEnabled && missionLooksLikeImplementationWork(mission));

  if (!requiresProof) {
    return {
      ok: true,
      reason: 'Implementation proof not required for this mission.',
      metadata: {
        required: false,
      },
    };
  }

  const report = parseImplementationReport(primaryOutput);
  if (!report) {
    return {
      ok: false,
      reason: 'Missing implementation report JSON block with `result` and `changed_files`.',
      metadata: {
        required: true,
      },
    };
  }

  const result = typeof report.result === 'string' ? report.result.trim().toLowerCase() : '';
  if (result !== 'implemented') {
    return {
      ok: false,
      reason: `Mission requires implementation evidence, but report.result is '${result || 'missing'}'.`,
      metadata: {
        required: true,
        report,
      },
    };
  }

  const repoRoot = getMissionRepoRoot();
  const changes = normalizeChangedFiles(report);
  if (changes.length === 0) {
    return {
      ok: false,
      reason: 'Implementation report has no changed files.',
      metadata: {
        required: true,
        report,
      },
    };
  }

  const startedMs = Number.isFinite(Date.parse(mission?.started_at || ''))
    ? Date.parse(mission.started_at)
    : Date.now();

  const verified = [];
  const failures = [];

  for (const change of changes) {
    const rawPath = change.path;
    const absolutePath = rawPath.startsWith('/')
      ? resolve(rawPath)
      : resolve(repoRoot, rawPath);

    if (!pathInsideRoot(repoRoot, absolutePath)) {
      failures.push(`${rawPath}: outside configured repo root (${repoRoot}).`);
      continue;
    }

    const relPath = relative(repoRoot, absolutePath);
    const normalizedStatus = change.status || 'modified';
    const isDeletion = normalizedStatus === 'deleted' || normalizedStatus === 'remove' || normalizedStatus === 'removed';

    if (isDeletion) {
      const gitStatus = gitStatusForPath(repoRoot, relPath);
      if (!gitStatus) {
        failures.push(`${rawPath}: deletion not visible in git status.`);
        continue;
      }
      verified.push({ path: relPath, status: 'deleted', gitStatus });
      continue;
    }

    try {
      const fileStats = await stat(absolutePath);
      const isRecent = fileStats.mtimeMs >= (startedMs - IMPLEMENTATION_MTIME_SKEW_MS)
        || fileStats.ctimeMs >= (startedMs - IMPLEMENTATION_MTIME_SKEW_MS);

      if (!isRecent) {
        failures.push(`${rawPath}: file timestamp predates mission start.`);
        continue;
      }

      verified.push({
        path: relPath,
        status: normalizedStatus,
        mtime: new Date(fileStats.mtimeMs).toISOString(),
      });
    } catch (error) {
      failures.push(`${rawPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failures.length > 0 || verified.length === 0) {
    return {
      ok: false,
      reason: failures.length > 0
        ? `Implementation evidence check failed: ${failures.join(' | ')}`
        : 'Implementation evidence check failed: no verified file changes.',
      metadata: {
        required: true,
        repoRoot,
        report,
        verified,
        failures,
      },
    };
  }

  return {
    ok: true,
    reason: 'Implementation evidence verified.',
    metadata: {
      required: true,
      repoRoot,
      report,
      verified,
    },
  };
}

function buildPrimaryPrompt(mission) {
  const repoRoot = getMissionRepoRoot();
  const mediaSection = Array.isArray(mission.input_media) && mission.input_media.length > 0
    ? [
        'Attached media metadata (process if relevant):',
        ...mission.input_media.map((media) => `- ${media.name} (${media.type}) ${media.url}`),
      ].join('\n')
    : 'No media attached.';

  return [
    'You are executing a mission.',
    `Mission title: ${mission.title}`,
    mission.description ? `Mission description:\n${mission.description}` : 'Mission description: none.',
    mission.mission_statement ? `Mission statement:\n${mission.mission_statement}` : 'Mission statement: none.',
    mission.input_text ? `Instructions:\n${mission.input_text}` : 'Instructions: none provided.',
    mediaSection,
    '',
    'Execution contract:',
    `- If implementation/code changes are requested, perform the work inside this repo: ${repoRoot}`,
    '- Do not return only a proposal when implementation is requested.',
    '- End your response with a fenced JSON implementation report using this exact shape:',
    '```json',
    '{"result":"implemented|analysis_only","repo_root":"<absolute path>","changed_files":[{"path":"relative/or/absolute/path","status":"modified|added|deleted"}],"verification":["checks/commands run"],"summary":"short outcome"}',
    '```',
    '- `changed_files` must include every file actually modified, added, or deleted.',
    '',
    'Return your complete final work as plain text before the JSON report.',
    'Do not ask follow-up questions; make reasonable assumptions and execute.',
  ].join('\n');
}

function buildReviewPrompt(mission, primaryOutput) {
  return [
    'You are a strict reviewer for an AI mission.',
    `Original mission title: ${mission.title}`,
    mission.mission_statement
      ? `Mission statement:\n${mission.mission_statement}`
      : 'Mission statement: none provided.',
    mission.input_text
      ? `Original mission instructions:\n${mission.input_text}`
      : 'Original mission instructions: none.',
    '',
    'Agent output to review:',
    primaryOutput || '(no output provided)',
    '',
    'Review criteria:',
    '- Check completeness, correctness, and instruction adherence.',
    '- Approve only if done and high quality.',
    '- If changes are required, provide precise, actionable revision instructions.',
    '',
    'Respond ONLY as JSON with this shape:',
    '{"approved": true|false, "summary": "short summary", "follow_up_instructions": "required if approved=false"}',
  ].join('\n');
}

function buildRevisionInputText(mission, feedbackSummary, feedbackInstructions) {
  const safeFeedback = feedbackInstructions || feedbackSummary || 'Please revise based on reviewer feedback.';

  return [
    'You are executing a revision of a mission based on reviewer feedback.',
    `Original mission title: ${mission.title}`,
    mission.description ? `Mission description:\n${mission.description}` : 'Mission description: none.',
    mission.mission_statement ? `Mission statement:\n${mission.mission_statement}` : 'Mission statement: none.',
    mission.input_text ? `Original instructions:\n${mission.input_text}` : 'Original instructions: none provided.',
    '',
    feedbackSummary ? `Reviewer summary:\n${feedbackSummary}` : null,
    `Reviewer feedback instructions:\n${safeFeedback}`,
    '',
    mission.output_text ? `Previous agent output:\n${mission.output_text}` : 'Previous agent output: none provided.',
    '',
    'Revise the implementation and response to address the feedback while keeping the original intent.',
  ].filter(Boolean).join('\n');
}

function resolveOpenClawBinary() {
  // 1. Try OPENCLAW_HOME env var (new in 2026.2.9)
  if (process.env.OPENCLAW_HOME) {
    const homeCandidate = resolve(process.env.OPENCLAW_HOME, 'bin', 'openclaw');
    if (existsSync(homeCandidate)) {
      return homeCandidate;
    }
  }

  // 2. Try openclaw in PATH first (handles nvm when PATH is inherited)
  const pathResult = spawnSync('which', ['openclaw'], {
    encoding: 'utf8',
    env: process.env,
  });
  if (pathResult.status === 0 && pathResult.stdout.trim()) {
    return pathResult.stdout.trim();
  }

  // 3. Search common installation paths
  const homeDir = process.env.HOME || '/Users/peetstander';
  const nvmNodeVersion = process.env.NVM_BIN
    ? process.env.NVM_BIN.split('/').slice(-2, -1)[0]
    : null;

  const candidatePaths = [
    // nvm (current version from NVM_BIN)
    nvmNodeVersion ? `${homeDir}/.nvm/versions/node/${nvmNodeVersion}/bin/openclaw` : null,
    // nvm (fallback to common LTS versions)
    `${homeDir}/.nvm/versions/node/v22.19.0/bin/openclaw`,
    `${homeDir}/.nvm/versions/node/v20.18.1/bin/openclaw`,
    `${homeDir}/.nvm/versions/node/v18.20.5/bin/openclaw`,
    // Homebrew
    '/opt/homebrew/bin/openclaw',
    '/usr/local/bin/openclaw',
    // Global npm (homebrew node)
    '/opt/homebrew/Cellar/node/23.2.0/bin/openclaw',
    `${homeDir}/.npm-global/bin/openclaw`,
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      log(`Resolved openclaw binary: ${candidate}`);
      return candidate;
    }
  }

  // 4. Fallback to 'openclaw' and hope it's in PATH
  log('Warning: openclaw binary not found in common paths, using PATH fallback');
  return 'openclaw';
}

function runOpenClawAgent(agentId, prompt, timeoutSec) {
  return new Promise((resolve, reject) => {
    const openclawBinary = resolveOpenClawBinary();
    const args = [
      'agent',
      '--agent',
      agentId,
      '--message',
      prompt,
      '--json',
      '--timeout',
      String(timeoutSec),
    ];

    const child = spawn(openclawBinary, args, {
      cwd: ROOT_DIR,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    const timeout = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
      }, 4000);
    }, (timeoutSec + 10) * 1000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (killed) {
        reject(new Error(`openclaw agent timed out after ${timeoutSec}s`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`openclaw agent exited ${code}: ${stderr || stdout}`));
        return;
      }

      try {
        const parsed = parseOpenClawJson(stdout);
        const text = extractAgentText(parsed);
        resolve({ text, parsed, stdout, stderr });
      } catch (error) {
        reject(new Error(`Failed parsing openclaw output: ${error instanceof Error ? error.message : String(error)}\n${stdout}`));
      }
    });
  });
}

async function insertMissionLog(supabase, missionId, type, message, agentId = null, metadata = null) {
  const { error } = await supabase.from('mission_logs').insert({
    mission_id: missionId,
    type,
    agent_id: agentId,
    message,
    metadata,
  });
  if (error) {
    log(`log insert failed for mission ${missionId}: ${error.message}`);
  }
}

async function markMissionFailed(supabase, mission, errorMessage, options = {}) {
  const now = toIsoNow();
  const patch = {
    status: 'failed',
    mission_status: 'failed',
    review_notes: errorMessage,
    completed_at: now,
    updated_at: now,
  };
  if (typeof options.outputText === 'string') {
    patch.output_text = options.outputText;
  }

  const { error } = await supabase
    .from('missions')
    .update(patch)
    .eq('id', mission.id);

  if (error) {
    log(`failed to mark mission ${mission.id} as failed: ${error.message}`);
  }

  await insertMissionLog(
    supabase,
    mission.id,
    'mission_failed',
    `Mission failed: ${errorMessage}`,
    mission.agent_id,
  );
}

async function runReviewStep(supabase, mission, primaryOutput, timeoutSec) {
  const reviewer = resolveAgentId(mission.review_agent_id);
  if (!reviewer) {
    return { approved: true, summary: 'No review agent configured.' };
  }

  const reviewPrompt = buildReviewPrompt(mission, primaryOutput);
  const reviewResult = await runOpenClawAgent(reviewer, reviewPrompt, timeoutSec);
  const decision = parseReviewDecision(reviewResult.text || '');

  if (decision.approved) {
    const now = toIsoNow();
    const patch = {
      status: 'done',
      mission_status: 'done',
      review_notes: decision.summary || 'Review approved.',
      output_text: primaryOutput,
      completed_at: now,
      updated_at: now,
    };

    const { error } = await supabase
      .from('missions')
      .update(patch)
      .eq('id', mission.id);

    if (error) {
      throw new Error(`failed to finalize approved mission: ${error.message}`);
    }

    await insertMissionLog(
      supabase,
      mission.id,
      'review_approved',
      patch.review_notes,
      reviewer,
    );

    return { approved: true, summary: patch.review_notes };
  }

  const reachedMaxRevisions = mission.max_revisions > 0 && mission.revision_round >= mission.max_revisions;
  if (reachedMaxRevisions) {
    const now = toIsoNow();
    const patch = {
      status: 'failed',
      mission_status: 'failed',
      review_notes: decision.summary || 'Revision limit reached.',
      completed_at: now,
      updated_at: now,
    };

    const { error } = await supabase
      .from('missions')
      .update(patch)
      .eq('id', mission.id);

    if (error) {
      throw new Error(`failed to mark mission after revision limit: ${error.message}`);
    }

    await insertMissionLog(
      supabase,
      mission.id,
      'review_failed',
      patch.review_notes,
      reviewer,
    );

    return { approved: false, summary: patch.review_notes };
  }

  const revisionRound = (mission.revision_round || 0) + 1;
  const feedbackSummary = decision.summary || 'Reviewer requested changes.';
  const feedbackInstructions = decision.followUpInstructions || decision.summary || 'Please revise based on reviewer feedback.';
  const revisionInputText = buildRevisionInputText(mission, feedbackSummary, feedbackInstructions);
  const mergedMedia = [
    ...(Array.isArray(mission.input_media) ? mission.input_media : []),
    ...(Array.isArray(mission.output_media) ? mission.output_media : []),
  ];
  const now = toIsoNow();

  const { data: revisionMission, error: revisionInsertError } = await supabase
    .from('missions')
    .insert({
      title: `${mission.title} (Revision ${revisionRound})`,
      description: mission.description,
      status: 'scheduled',
      mission_status: 'scheduled',
      mission_phase: 'tasks',
      mission_phase_status: 'approved',
      mission_statement: mission.mission_statement,
      mission_plan: null,
      priority: mission.priority,
      scheduled_at: now,
      agent_id: resolveAgentId(mission.agent_id),
      input_text: revisionInputText,
      input_media: mergedMedia,
      review_enabled: mission.review_enabled,
      review_agent_id: resolveAgentId(mission.review_agent_id),
      output_text: null,
      output_media: [],
      parent_mission_id: mission.id,
      revision_round: revisionRound,
      max_revisions: mission.max_revisions,
      review_notes: feedbackSummary,
      created_by: 'review-agent',
      session_key: null,
      domains: mission.domains,
    })
    .select('id')
    .single();

  if (revisionInsertError) {
    throw new Error(`failed to create revision mission: ${revisionInsertError.message}`);
  }

  const { error: parentUpdateError } = await supabase
    .from('missions')
    .update({
      status: 'revision',
      mission_status: 'revision',
      review_notes: decision.summary || 'Reviewer requested changes.',
      updated_at: now,
    })
    .eq('id', mission.id);

  if (parentUpdateError) {
    throw new Error(`failed to update parent mission revision status: ${parentUpdateError.message}`);
  }

  await insertMissionLog(
    supabase,
    mission.id,
    'revision_requested',
    `Revision requested: ${decision.summary || 'Reviewer requested changes.'}`,
    reviewer,
    { revisionMissionId: revisionMission.id },
  );

  return {
    approved: false,
    summary: decision.summary || 'Revision mission created.',
    revisionMissionId: revisionMission.id,
  };
}

async function processPrimaryMission(supabase, mission, timeoutSec) {
  const now = toIsoNow();
  const dispatcherSession = `dispatcher:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

  const { data: claimed, error: claimError } = await supabase
    .from('missions')
    .update({
      status: 'in_progress',
      mission_status: 'in_progress',
      started_at: mission.started_at || now,
      updated_at: now,
      session_key: dispatcherSession,
    })
    .eq('id', mission.id)
    .eq('mission_phase', 'tasks')
    .eq('mission_phase_status', 'approved')
    .in('mission_status', ['scheduled', 'assigned', 'revision'])
    .select('*')
    .maybeSingle();

  if (claimError) {
    log(`claim failed for mission ${mission.id}: ${claimError.message}`);
    return false;
  }

  if (!claimed) {
    return false;
  }

  await insertMissionLog(
    supabase,
    claimed.id,
    'mission_started',
    `Mission execution started by dispatcher for ${claimed.agent_id}`,
    claimed.agent_id,
  );

  try {
    const prompt = buildPrimaryPrompt(claimed);
    const primaryAgentId = resolveAgentId(claimed.agent_id);
    const primaryResult = await runOpenClawAgent(primaryAgentId, prompt, timeoutSec);
    const primaryOutput = (primaryResult.text || '').trim();
    const implementationCheck = await verifyImplementationEvidence(claimed, primaryOutput);

    if (!implementationCheck.ok) {
      await markMissionFailed(
        supabase,
        claimed,
        `Mission blocked: ${implementationCheck.reason}`,
        { outputText: primaryOutput },
      );
      await insertMissionLog(
        supabase,
        claimed.id,
        'mission_blocked',
        `Mission blocked before completion: ${implementationCheck.reason}`,
        claimed.agent_id,
        implementationCheck.metadata,
      );
      return true;
    }

    if (claimed.review_enabled && claimed.review_agent_id) {
      const pendingPatch = {
        status: 'pending_review',
        mission_status: 'pending_review',
        output_text: primaryOutput,
        updated_at: toIsoNow(),
      };
      const { error: pendingError } = await supabase
        .from('missions')
        .update(pendingPatch)
        .eq('id', claimed.id);

      if (pendingError) {
        throw new Error(`failed moving mission to pending review: ${pendingError.message}`);
      }

      await insertMissionLog(
        supabase,
        claimed.id,
        'review_started',
        `Primary output ready. Routing to reviewer ${resolveAgentId(claimed.review_agent_id)}`,
        resolveAgentId(claimed.review_agent_id),
      );

      await runReviewStep(supabase, claimed, primaryOutput, timeoutSec);
      return true;
    }

    const donePatch = {
      status: 'done',
      mission_status: 'done',
      output_text: primaryOutput,
      completed_at: toIsoNow(),
      updated_at: toIsoNow(),
    };
    const { error: doneError } = await supabase
      .from('missions')
      .update(donePatch)
      .eq('id', claimed.id);

    if (doneError) {
      throw new Error(`failed to complete mission: ${doneError.message}`);
    }

    await insertMissionLog(
      supabase,
      claimed.id,
      'mission_completed',
      implementationCheck.reason,
      claimed.agent_id,
      implementationCheck.metadata,
    );

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markMissionFailed(supabase, claimed, message);
    return true;
  }
}

async function processPendingReviewMission(supabase, mission, timeoutSec) {
  if (!mission.review_enabled || !mission.review_agent_id) {
    const donePatch = {
      status: 'done',
      mission_status: 'done',
      completed_at: toIsoNow(),
      updated_at: toIsoNow(),
    };
    const { error } = await supabase
      .from('missions')
      .update(donePatch)
      .eq('id', mission.id)
      .eq('mission_status', 'pending_review');
    if (error) {
      log(`failed to close orphan pending review mission ${mission.id}: ${error.message}`);
      return false;
    }
    return true;
  }

  if ((mission.session_key || '').startsWith('frontend:')) {
    return false;
  }

  const claimNow = toIsoNow();
  const { data: claimed, error: claimError } = await supabase
    .from('missions')
    .update({
      updated_at: claimNow,
      session_key: mission.session_key && mission.session_key.startsWith('dispatcher:')
        ? mission.session_key
        : `dispatcher:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    })
    .eq('id', mission.id)
    .eq('mission_status', 'pending_review')
    .select('*')
    .maybeSingle();

  if (claimError) {
    log(`review claim failed for mission ${mission.id}: ${claimError.message}`);
    return false;
  }
  if (!claimed) return false;

  try {
    await runReviewStep(supabase, claimed, claimed.output_text || '', timeoutSec);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markMissionFailed(supabase, claimed, message);
    return true;
  }
}

async function withLock(callback) {
  let handle;
  try {
    handle = await open(LOCK_PATH, 'wx');
    await handle.writeFile(`${process.pid}\n`);
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'EEXIST') {
      log('Another dispatcher run is still active. Skipping this tick.');
      return;
    }
    throw error;
  }

  try {
    await callback();
  } finally {
    if (handle) {
      await handle.close().catch(() => {});
    }
    await unlink(LOCK_PATH).catch(() => {});
  }
}

async function main() {
  loadDotEnv(resolve(ROOT_DIR, '.env'));

  const options = parseArgs(process.argv);
  const timeoutSec = Number(process.env.MISSION_DISPATCHER_AGENT_TIMEOUT_SEC || DEFAULT_AGENT_TIMEOUT_SEC);
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration. Set SUPABASE_URL/SUPABASE_SERVICE_KEY or VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY.');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const now = toIsoNow();

  const [pendingResult, dueResult] = await Promise.all([
    supabase
      .from('missions')
      .select('*')
      .eq('mission_phase', 'tasks')
      .eq('mission_phase_status', 'approved')
      .eq('mission_status', 'pending_review')
      .order('updated_at', { ascending: true })
      .limit(options.limit),
    supabase
      .from('missions')
      .select('*')
      .eq('mission_phase', 'tasks')
      .eq('mission_phase_status', 'approved')
      .in('mission_status', ['scheduled', 'assigned', 'revision'])
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(options.limit),
  ]);

  if (pendingResult.error) {
    throw new Error(`Failed fetching pending reviews: ${pendingResult.error.message}`);
  }
  if (dueResult.error) {
    throw new Error(`Failed fetching due missions: ${dueResult.error.message}`);
  }

  const pendingReviewMissions = (pendingResult.data || []).filter((mission) => isLifecycleExecutionReady(mission));
  const dueMissions = (dueResult.data || [])
    .filter((mission) => isLifecycleExecutionReady(mission))
    .filter((mission) => !isAggregateLifecycleMission(mission));

  if (options.dryRun) {
    log(`Dry run. Pending reviews: ${pendingReviewMissions.length}, due missions: ${dueMissions.length}`);
    if (pendingReviewMissions.length > 0) {
      log('Pending review mission ids:', pendingReviewMissions.map((mission) => mission.id));
    }
    if (dueMissions.length > 0) {
      log('Due mission ids:', dueMissions.map((mission) => mission.id));
    }
    return;
  }

  if (pendingReviewMissions.length === 0 && dueMissions.length === 0) {
    log('HEARTBEAT_OK — no due mission work this tick.');
    return;
  }

  log(`Tick start. Pending reviews: ${pendingReviewMissions.length}, due missions: ${dueMissions.length}`);

  let processedCount = 0;

  for (const mission of pendingReviewMissions) {
    const processed = await processPendingReviewMission(supabase, mission, timeoutSec);
    if (processed) processedCount += 1;
  }

  for (const mission of dueMissions) {
    const processed = await processPrimaryMission(supabase, mission, timeoutSec);
    if (processed) processedCount += 1;
  }

  if (processedCount === 0) {
    log('No missions claimed this tick (likely handled by another runner).');
    return;
  }

  log(`Tick complete. Missions processed: ${processedCount}`);
}

await withLock(async () => {
  try {
    await main();
  } catch (error) {
    log('Dispatcher tick failed.', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
});
