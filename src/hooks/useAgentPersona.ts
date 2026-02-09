import { useState, useEffect } from 'react';
import { FALLBACK_PERSONAS } from '../data/agentPersonas';

const WORKSPACE_BASE = '/Users/peetstander/.openclaw/workspace/agents';
const WORKSPACE_SKILLS_BASE = '/Users/peetstander/.openclaw/workspace/skills';

// Map store agent IDs to workspace directory names
const AGENT_DIR_MAP: Record<string, string> = {
  'main': 'marcus-aurelius',
  'hippocrates': 'hippocrates',
  'confucius': 'confucius',
  'seneca': 'seneca',
  'archimedes': 'archimedes',
  'leonidas': 'leonidas',
  'odysseus': 'odysseus',
  'spartacus': 'spartacus',
  'achilles': 'achilles',
  'alexander': 'alexander',
};

const MAX_SOUL_CHARS = 2000;
const MAX_IDENTITY_CHARS = 2000;
const MAX_SKILLS_CHARS = 6000;
const MAX_SKILL_WALK_DEPTH = 4;
const MAX_SKILL_BLOCKS = 16;
const MAX_SKILL_BLOCK_CHARS = 700;

interface AgentPersona {
  soul: string;
  identity: string;
  skills: string;
  loading: boolean;
}

const cache = new Map<string, { soul: string; identity: string; skills: string }>();

export function useAgentPersona(agentId: string): AgentPersona {
  const [persona, setPersona] = useState<AgentPersona>({ soul: '', identity: '', skills: '', loading: true });

  useEffect(() => {
    const dirName = AGENT_DIR_MAP[agentId];
    if (!dirName) {
      setPersona({ soul: '', identity: '', skills: '', loading: false });
      return;
    }

    // Check cache first
    const cached = cache.get(agentId);
    if (cached) {
      setPersona({ ...cached, loading: false });
      return;
    }

    setPersona(p => ({ ...p, loading: true }));

    const basePath = `${WORKSPACE_BASE}/${dirName}`;

    // Try Tauri FS plugin first, fall back to bundled data
    loadPersonaFiles(basePath, dirName).then((result) => {
      cache.set(agentId, result);
      setPersona({ ...result, loading: false });
    }).catch(() => {
      setPersona({ soul: '', identity: '', skills: '', loading: false });
    });
  }, [agentId]);

  return persona;
}

async function loadPersonaFiles(basePath: string, dirName: string): Promise<{ soul: string; identity: string; skills: string }> {
  try {
    // Dynamically import Tauri FS plugin
    const { readDir, readTextFile } = await import('@tauri-apps/plugin-fs');

    const [soul, identity, legacySkills, folderSkills] = await Promise.all([
      readTextFile(`${basePath}/SOUL.md`).catch(() => ''),
      readTextFile(`${basePath}/IDENTITY.md`).catch(() => ''),
      readTextFile(`${basePath}/SKILLS.md`).catch(() => ''),
      readSkillsFromDirectory(basePath, readDir, readTextFile),
    ]);

    const sharedSkillDocs = await readSharedSkillDocs(extractSkillRefs(legacySkills), readTextFile);

    // Prefer explicit per-agent skill folders.
    // Fallback to shared workspace skill folders, then to legacy SKILLS.md text.
    const folderSkillsTrimmed = folderSkills.trim();
    const sharedSkillsTrimmed = sharedSkillDocs.trim();
    const legacySkillsTrimmed = legacySkills.trim();
    const skills = folderSkillsTrimmed || sharedSkillsTrimmed || legacySkillsTrimmed;

    // If we got any persona content from FS, use it (truncated)
    if (soul || identity || skills) {
      return {
        soul: soul.substring(0, MAX_SOUL_CHARS),
        identity: identity.substring(0, MAX_IDENTITY_CHARS),
        skills: skills.substring(0, MAX_SKILLS_CHARS),
      };
    }

    // Fall through to fallback
    throw new Error('Empty FS read');
  } catch {
    // Fallback to bundled persona data
    const fallbackSoul = FALLBACK_PERSONAS[dirName] || '';
    return {
      soul: fallbackSoul.substring(0, MAX_SOUL_CHARS),
      identity: '',
      skills: '',
    };
  }
}

interface FsDirEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

type ReadDirFn = (path: string | URL) => Promise<FsDirEntry[]>;
type ReadTextFileFn = (path: string | URL) => Promise<string>;

function extractSkillRefs(markdown: string): string[] {
  if (!markdown) return [];
  const pattern = /^\s*-\s+\*\*([^*]+)\*\*/gm;
  const names = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    const skill = match[1]?.trim().toLowerCase();
    if (skill) names.add(skill);
  }
  return Array.from(names);
}

async function readSharedSkillDocs(skillNames: string[], readTextFile: ReadTextFileFn): Promise<string> {
  const blocks: string[] = [];
  for (const skillName of skillNames) {
    const path = `${WORKSPACE_SKILLS_BASE}/${skillName}/SKILL.md`;
    const text = (await readTextFile(path).catch(() => '')).trim();
    if (!text) continue;
    blocks.push(`# shared/${skillName}/SKILL.md\n\n${text}`);
  }
  return blocks.join('\n\n').trim();
}

async function readSkillsFromDirectory(
  basePath: string,
  readDir: ReadDirFn,
  readTextFile: ReadTextFileFn
): Promise<string> {
  const skillRoot = `${basePath}/skills`;
  try {
    const blocks = await collectSkillBlocks(skillRoot, skillRoot, 0, readDir, readTextFile);
    const limited = blocks
      .slice(0, MAX_SKILL_BLOCKS)
      .map((b) => b.substring(0, MAX_SKILL_BLOCK_CHARS));
    return limited.join('\n\n').trim();
  } catch {
    return '';
  }
}

async function collectSkillBlocks(
  rootPath: string,
  currentPath: string,
  depth: number,
  readDir: ReadDirFn,
  readTextFile: ReadTextFileFn
): Promise<string[]> {
  if (depth > MAX_SKILL_WALK_DEPTH) return [];
  const entries = await readDir(currentPath);
  const blocks: string[] = [];

  for (const entry of entries) {
    const entryPath = `${currentPath}/${entry.name}`;
    if (entry.isDirectory) {
      const nested = await collectSkillBlocks(rootPath, entryPath, depth + 1, readDir, readTextFile);
      blocks.push(...nested);
      continue;
    }

    if (!entry.isFile || entry.name.toLowerCase() !== 'skill.md') continue;
    const text = (await readTextFile(entryPath).catch(() => '')).trim();
    if (!text) continue;

    const relativePath = entryPath.slice(rootPath.length + 1);
    blocks.push(`# ${relativePath}\n\n${text}`);
  }

  return blocks;
}
