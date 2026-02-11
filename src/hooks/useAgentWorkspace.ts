import { useState, useEffect, useCallback } from 'react';

const OPENCLAW_BASE = '/Users/peetstander/.openclaw';
const WORKSPACE_AGENTS = `${OPENCLAW_BASE}/workspace/agents`;
const WORKSPACE_SKILLS = `${OPENCLAW_BASE}/workspace/skills`;
const AGENTS_DIR = `${OPENCLAW_BASE}/agents`;

// Map agent store IDs to OpenClaw directory names
const AGENT_DIR_MAP: Record<string, string> = {
  main: 'marcus-aurelius',
  hippocrates: 'hippocrates',
  confucius: 'confucius',
  seneca: 'seneca',
  archimedes: 'archimedes',
  leonidas: 'leonidas',
  odysseus: 'odysseus',
  spartacus: 'spartacus',
  achilles: 'achilles',
  alexander: 'alexander',
  athena: 'athena',
  hephaestus: 'hephaestus',
  prometheus: 'prometheus',
  heracles: 'heracles',
  daedalus: 'daedalus',
  icarus: 'icarus',
  ajax: 'ajax',
  cleopatra: 'cleopatra',
  homer: 'homer',
  hermes: 'hermes',
  artemis: 'artemis',
  ares: 'ares',
  perseus: 'perseus',
  theseus: 'theseus',
};

export function getAgentDirName(agentId: string): string | null {
  return AGENT_DIR_MAP[agentId] ?? null;
}

// --- Types ---

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface SessionEntry {
  id: string;
  updatedAt: string;
  chatType?: string;
  filePath: string;
}

export interface SessionLogMessage {
  type: string;
  role?: string;
  content?: Array<{ type: string; text?: string; thinking?: string }>;
  timestamp?: string;
  provider?: string;
  modelId?: string;
}

export interface CronJob {
  id: string;
  agentId: string;
  name: string;
  enabled: boolean;
  schedule: { kind: string; at?: string; cron?: string };
  state?: { nextRunAtMs?: number; lastRunAtMs?: number; lastStatus?: string };
}

export interface AgentWorkspaceData {
  // Identity files from workspace
  soulMd: string;
  identityMd: string;
  skillsMd: string;

  // Session history
  sessions: SessionEntry[];

  // Cron jobs for this agent
  cronJobs: CronJob[];

  // Workspace directory listing
  workspaceFiles: FileEntry[];

  // Loading & error
  loading: boolean;
  error: string | null;
}

// --- Cache ---
const cache = new Map<string, Omit<AgentWorkspaceData, 'loading' | 'error'>>();

// --- Hook ---

export function useAgentWorkspace(agentId: string | null) {
  const [data, setData] = useState<AgentWorkspaceData>({
    soulMd: '',
    identityMd: '',
    skillsMd: '',
    sessions: [],
    cronJobs: [],
    workspaceFiles: [],
    loading: true,
    error: null,
  });

  const dirName = agentId ? getAgentDirName(agentId) : null;

  // Load all data on mount / agent change
  useEffect(() => {
    if (!agentId || !dirName) {
      setData((d) => ({ ...d, loading: false }));
      return;
    }

    const cached = cache.get(agentId);
    if (cached) {
      setData({ ...cached, loading: false, error: null });
      return;
    }

    setData((d) => ({ ...d, loading: true, error: null }));

    loadAll(agentId, dirName)
      .then((result) => {
        cache.set(agentId, result);
        setData({ ...result, loading: false, error: null });
      })
      .catch((err) => {
        setData((d) => ({ ...d, loading: false, error: String(err) }));
      });
  }, [agentId, dirName]);

  // Read a file from the workspace
  const readFile = useCallback(
    async (path: string): Promise<string> => {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      return readTextFile(path).catch(() => '');
    },
    []
  );

  // Write a file to the workspace
  const writeFile = useCallback(
    async (path: string, content: string): Promise<void> => {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      await writeTextFile(path, content);
      // Invalidate cache for this agent
      if (agentId) cache.delete(agentId);
    },
    [agentId]
  );

  // Read a JSONL session log
  const readSessionLog = useCallback(
    async (sessionFilePath: string): Promise<SessionLogMessage[]> => {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const raw = await readTextFile(sessionFilePath).catch(() => '');
      if (!raw) return [];
      const messages: SessionLogMessage[] = [];
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          messages.push(JSON.parse(trimmed));
        } catch {
          // skip malformed lines
        }
      }
      return messages;
    },
    []
  );

  // Force refresh
  const refresh = useCallback(async () => {
    if (!agentId || !dirName) return;
    cache.delete(agentId);
    setData((d) => ({ ...d, loading: true }));
    try {
      const result = await loadAll(agentId, dirName);
      cache.set(agentId, result);
      setData({ ...result, loading: false, error: null });
    } catch (err) {
      setData((d) => ({ ...d, loading: false, error: String(err) }));
    }
  }, [agentId, dirName]);

  return {
    ...data,
    readFile,
    writeFile,
    readSessionLog,
    refresh,
    workspacePath: dirName ? `${WORKSPACE_AGENTS}/${dirName}` : null,
    sessionsPath: dirName ? `${AGENTS_DIR}/${dirName}/sessions` : null,
  };
}

// --- Loaders ---

async function loadAll(
  agentId: string,
  dirName: string
): Promise<Omit<AgentWorkspaceData, 'loading' | 'error'>> {
  const { readDir, readTextFile } = await import('@tauri-apps/plugin-fs');

  const workspacePath = `${WORKSPACE_AGENTS}/${dirName}`;
  const sessionsPath = `${AGENTS_DIR}/${dirName}/sessions`;

  const [soulMd, identityMd, skillsMd, workspaceFiles, sessions, cronJobs] =
    await Promise.all([
      readTextFile(`${workspacePath}/SOUL.md`).catch(() => ''),
      readTextFile(`${workspacePath}/IDENTITY.md`).catch(() => ''),
      readTextFile(`${workspacePath}/SKILLS.md`).catch(() => ''),
      loadDirectoryListing(workspacePath, readDir),
      loadSessions(sessionsPath, readTextFile),
      loadCronJobs(agentId, readTextFile),
    ]);

  return { soulMd, identityMd, skillsMd, workspaceFiles, sessions, cronJobs };
}

type ReadDirFn = (path: string | URL) => Promise<{ name: string; isDirectory: boolean; isFile: boolean }[]>;
type ReadTextFileFn = (path: string | URL) => Promise<string>;

async function loadDirectoryListing(
  dirPath: string,
  readDir: ReadDirFn
): Promise<FileEntry[]> {
  try {
    const entries = await readDir(dirPath);
    return entries
      .map((e) => ({
        name: e.name,
        path: `${dirPath}/${e.name}`,
        isDirectory: e.isDirectory,
      }))
      .sort((a, b) => {
        // Directories first, then alphabetical
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  } catch {
    return [];
  }
}

async function loadSessions(
  sessionsPath: string,
  readTextFile: ReadTextFileFn
): Promise<SessionEntry[]> {
  try {
    const raw = await readTextFile(`${sessionsPath}/sessions.json`);
    const parsed = JSON.parse(raw);
    const sessions: SessionEntry[] = [];

    if (parsed.sessions && typeof parsed.sessions === 'object') {
      for (const [id, meta] of Object.entries(parsed.sessions)) {
        const m = meta as Record<string, unknown>;
        sessions.push({
          id,
          updatedAt: (m.updatedAt as string) ?? '',
          chatType: (m.chatType as string) ?? 'direct',
          filePath: `${sessionsPath}/${id}.jsonl`,
        });
      }
    }

    // Sort by most recent first
    sessions.sort((a, b) => {
      const ta = new Date(a.updatedAt).getTime() || 0;
      const tb = new Date(b.updatedAt).getTime() || 0;
      return tb - ta;
    });

    return sessions;
  } catch {
    return [];
  }
}

async function loadCronJobs(
  agentId: string,
  readTextFile: ReadTextFileFn
): Promise<CronJob[]> {
  try {
    const raw = await readTextFile(`${OPENCLAW_BASE}/cron/jobs.json`);
    const parsed = JSON.parse(raw);
    if (!parsed.jobs || !Array.isArray(parsed.jobs)) return [];
    return parsed.jobs
      .filter((j: CronJob) => j.agentId === agentId || j.agentId === getAgentDirName(agentId))
      .map((j: CronJob) => ({
        id: j.id,
        agentId: j.agentId,
        name: j.name,
        enabled: j.enabled,
        schedule: j.schedule,
        state: j.state,
      }));
  } catch {
    return [];
  }
}

// --- Skill file reader ---

/**
 * Read SKILL.md from any of the three skill locations:
 * 1. Agent-specific skills: workspace/agents/{agent}/skills/{skill}/SKILL.md
 * 2. Shared workspace skills: workspace/skills/{skill}/SKILL.md
 * 3. OpenClaw installed skills: workspace/openclaw-dev/skills/{skill}/SKILL.md
 */
export async function readSkillFile(skillName: string, agentId?: string): Promise<string> {
  const { readTextFile } = await import('@tauri-apps/plugin-fs');

  const paths: string[] = [];

  // 1. Agent-specific skills (if we know the agent)
  if (agentId) {
    const dirName = AGENT_DIR_MAP[agentId];
    if (dirName) {
      paths.push(`${WORKSPACE_AGENTS}/${dirName}/skills/${skillName}/SKILL.md`);
    }
  }

  // 2. Shared workspace skills
  paths.push(`${WORKSPACE_SKILLS}/${skillName}/SKILL.md`);

  // 3. OpenClaw installed skills
  paths.push(`${OPENCLAW_BASE}/workspace/openclaw-dev/skills/${skillName}/SKILL.md`);

  for (const p of paths) {
    const content = await readTextFile(p).catch(() => '');
    if (content) return content;
  }

  return '';
}
