import { useState, useEffect, useCallback, useRef, createElement } from 'react';
import { openclawClient, type ConnectionStatus } from '../lib/openclawClient';
import {
  AnthropicIcon,
  OpenAIIcon,
  GeminiIcon,
  ZaiIcon,
  OllamaIcon,
  DeepSeekIcon,
  MiniMaxIcon,
  OpenRouterIcon,
} from '../components/icons/ProviderIcons';

// ── Provider / Model Catalog ──────────────────────────────────────────

export interface ModelEntry {
  id: string;
  label: string;
  note?: string;
}

export interface ProviderEntry {
  id: string;
  label: string;
  icon: React.ReactNode;
  iconText?: string; // Fallback text for select dropdowns (can't render React components)
  note?: string;
  models: ModelEntry[];
  /** Format: how the primary string is built. Default: "provider/model" */
  format?: (model: string) => string;
  /** Parse: extract model id from a primary string. Default: strip "provider/" prefix */
  parse?: (primary: string) => string | null;
}

export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

// Icon factory functions to avoid JSX in object literals
function getProviderIcon(providerId: string): React.ReactNode {
  switch (providerId) {
    case 'anthropic':
      return createElement(AnthropicIcon, { className: 'text-orange-400' });
    case 'openai-codex':
      return createElement(OpenAIIcon, { className: 'text-green-400' });
    case 'google':
      return createElement(GeminiIcon, { className: 'text-blue-400' });
    case 'ollama':
      return createElement(OllamaIcon, { className: 'text-zinc-300' });
    case 'zai':
      return createElement(ZaiIcon, { className: 'text-purple-400' });
    case 'deepseek':
      return createElement(DeepSeekIcon, { className: 'text-cyan-400' });
    case 'minimax':
      return createElement(MiniMaxIcon, { className: 'text-indigo-400' });
    case 'openrouter':
      return createElement(OpenRouterIcon, { className: 'text-emerald-400' });
    default:
      return '⚡';
  }
}

const MODEL_CATALOG_DATA: Omit<ProviderEntry, 'icon'>[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    iconText: '🅰️',
    models: [
      { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
      { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
      { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { id: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
      { id: 'claude-haiku-3-5', label: 'Claude Haiku 3.5' },
    ],
  },
  {
    id: 'openai-codex',
    label: 'OpenAI Codex',
    iconText: '⭘',
    note: 'OAuth auth',
    models: [
      { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
      { id: 'gpt-5.2-codex', label: 'GPT-5.2 Codex' },
      { id: 'gpt-5.2', label: 'GPT-5.2' },
      { id: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max' },
      { id: 'gpt-5.1-codex-mini', label: 'GPT-5.1 Codex Mini' },
      { id: 'gpt-5.1', label: 'GPT-5.1' },
    ],
  },
  {
    id: 'google',
    label: 'Google Gemini',
    iconText: '✦',
    note: 'API key auth',
    models: [
      { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    ],
  },
  {
    id: 'ollama',
    label: 'Ollama',
    iconText: '🦙',
    note: 'Local · Free',
    models: [],
  },
  {
    id: 'zai',
    label: 'Zai',
    iconText: 'Z',
    note: 'Local · Free',
    models: [
      { id: 'glm-4.7', label: 'glm-4.7' },
      { id: 'glm-4.7-flash', label: 'glm-4.7-flash' },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    iconText: '🔷',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
    ],
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    iconText: 'Ⓜ️',
    models: [
      { id: 'MiniMax-M2', label: 'MiniMax M2' },
      { id: 'MiniMax-M2.1', label: 'MiniMax M2.1' },
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    iconText: '⚡',
    format: (model: string) => `openrouter/${model}`,
    parse: (primary: string) => {
      if (!primary.startsWith('openrouter/')) return null;
      return primary.slice('openrouter/'.length);
    },
    models: [
      { id: 'x-ai/grok-4-fast', label: 'Grok 4 Fast' },
      { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
      { id: 'openai/gpt-4o', label: 'GPT-4o' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
      { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    ],
  },
];

export const MODEL_CATALOG: ProviderEntry[] = MODEL_CATALOG_DATA.map(entry => ({
  ...entry,
  icon: getProviderIcon(entry.id),
}));

// ── Skill metadata ────────────────────────────────────────────────────

export interface SkillMeta {
  id: string;
  label: string;
  icon: string;
  category: string;
}

export const SKILL_CATALOG: Record<string, Omit<SkillMeta, 'id'>> = {
  'goplaces': { label: 'Google Places', icon: '📍', category: 'API' },
  'local-places': { label: 'Local Places', icon: '🗺️', category: 'API' },
  'nano-banana-pro': { label: 'Gemini Images', icon: '🖼️', category: 'AI' },
  'openai-image-gen': { label: 'DALL-E', icon: '🎨', category: 'AI' },
  'openai-whisper-api': { label: 'Whisper', icon: '🎙️', category: 'AI' },
  'sag': { label: 'ElevenLabs TTS', icon: '🔊', category: 'AI' },
  'apple-notes': { label: 'Apple Notes', icon: '📝', category: 'Apple' },
  'apple-reminders': { label: 'Reminders', icon: '⏰', category: 'Apple' },
  'bird': { label: 'X / Twitter', icon: '🐦', category: 'Social' },
  'coding-agent': { label: 'Coding Agent', icon: '💻', category: 'Dev' },
  'github': { label: 'GitHub', icon: '🐙', category: 'Dev' },
  'gog': { label: 'Google Workspace', icon: '📧', category: 'Productivity' },
  'himalaya': { label: 'Email (IMAP)', icon: '✉️', category: 'Comms' },
  'imsg': { label: 'iMessage', icon: '💬', category: 'Comms' },
  'peekaboo': { label: 'macOS UI', icon: '👁️', category: 'System' },
  'things-mac': { label: 'Things 3', icon: '✅', category: 'Productivity' },
  'tmux': { label: 'tmux', icon: '🖥️', category: 'Dev' },
  'video-frames': { label: 'Video Frames', icon: '🎬', category: 'Media' },
  'wacli': { label: 'WhatsApp', icon: '📱', category: 'Comms' },
  'weather': { label: 'Weather', icon: '🌤️', category: 'Info' },
  'nano-pdf': { label: 'PDF Tools', icon: '📄', category: 'Productivity' },
  'session-logs': { label: 'Session Logs', icon: '📋', category: 'System' },
  'skill-creator': { label: 'Skill Creator', icon: '🛠️', category: 'Dev' },
  'agent-orchestrator': { label: 'Orchestrator', icon: '🎭', category: 'System' },
  'agent-onboarding': { label: 'Agent Onboarding', icon: '🏛️', category: 'System' },
  'mission-control': { label: 'Mission Control', icon: '🚀', category: 'System' },
  'crm-contacts': { label: 'CRM Contacts', icon: '👤', category: 'CRM' },
  'crm-deals': { label: 'CRM Deals', icon: '💼', category: 'CRM' },
  'crm-products': { label: 'Products', icon: '📦', category: 'CRM' },
  'crm-orders': { label: 'Orders', icon: '🧾', category: 'CRM' },
  'crm-projects': { label: 'Projects', icon: '📂', category: 'CRM' },
  'exec': { label: 'Shell Exec', icon: '⚡', category: 'System' },
  'nodes': { label: 'Nodes', icon: '🔗', category: 'Dev' },
  'supabase': { label: 'Supabase', icon: '🗄️', category: 'Dev' },
  'web_fetch': { label: 'Web Fetch', icon: '🌐', category: 'Info' },
  'web_search': { label: 'Web Search', icon: '🔍', category: 'Info' },
  'discord': { label: 'Discord', icon: '🎮', category: 'Comms' },
  'whatsapp': { label: 'WhatsApp (Skill)', icon: '📱', category: 'Comms' },
  'healthcheck': { label: 'Healthcheck', icon: '🩺', category: 'System' },
  'mission-authoring-playbook': { label: 'Mission Authoring', icon: '📖', category: 'System' },
  'team-management': { label: 'Team Management', icon: '👥', category: 'System' },
  'company-bootstrap': { label: 'Company Bootstrap', icon: '🏢', category: 'System' },
};

// ── Parse primary string into provider + model ───────────────────────

export function parsePrimary(primary: string): { providerId: string; modelId: string } {
  // Try openrouter first (openrouter/vendor/model)
  if (primary.startsWith('openrouter/')) {
    return { providerId: 'openrouter', modelId: primary.slice('openrouter/'.length) };
  }
  // Standard: provider/model
  const slash = primary.indexOf('/');
  if (slash > 0) {
    return { providerId: primary.slice(0, slash), modelId: primary.slice(slash + 1) };
  }
  return { providerId: 'unknown', modelId: primary };
}

export function buildPrimary(providerId: string, modelId: string): string {
  const provider = MODEL_CATALOG.find(p => p.id === providerId);
  if (provider?.format) return provider.format(modelId);
  return `${providerId}/${modelId}`;
}

// ── Gateway Config types ──────────────────────────────────────────────

export interface GatewayConfig {
  agents?: {
    list?: GatewayAgentConfig[];
    defaults?: {
      model?: {
        primary?: string;
      };
      thinkingDefault?: string;
    };
  };
  skills?: {
    entries?: Record<string, unknown>;
  };
  available_skills?: string[];
  [key: string]: unknown;
}

export interface GatewayAgentConfig {
  id: string;
  name?: string;
  model?: string;
  skills?: string[];
  [key: string]: unknown;
}

// Skills status response from skills.status RPC
interface SkillStatusEntry {
  key: string;
  skillKey?: string;
  name?: string;
  description?: string;
  source?: string;
  filePath?: string;
  enabled?: boolean;
  eligible?: boolean;
  [key: string]: unknown;
}

interface SkillsStatusResponse {
  skills?: SkillStatusEntry[];
  [key: string]: unknown;
}

interface UseGatewayConfigOptions {
  agentId?: string;
}

function extractModelIds(payload: unknown): string[] {
  const models = new Set<string>();

  const add = (value: unknown) => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    // Expect provider/model format
    if (trimmed.includes('/')) {
      models.add(trimmed);
    }
  };

  const visit = (node: unknown, depth = 0) => {
    if (depth > 6 || node == null) return;

    if (typeof node === 'string') {
      add(node);
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }

    if (typeof node === 'object') {
      const record = node as Record<string, unknown>;
      add(record.model);
      add(record.id);
      add(record.name);
      add(record.primary);
      add(record.key);

      // models.list often returns provider + bare model id separately.
      // Normalize that into provider/model so UI checks work consistently.
      const provider = typeof record.provider === 'string' ? record.provider.trim() : '';
      const id = typeof record.id === 'string' ? record.id.trim() : '';
      if (provider && id && !id.includes('/')) {
        models.add(`${provider}/${id}`);
      }
      const model = typeof record.model === 'string' ? record.model.trim() : '';
      if (provider && model && !model.includes('/')) {
        models.add(`${provider}/${model}`);
      }

      if ('models' in record) visit(record.models, depth + 1);
      if ('items' in record) visit(record.items, depth + 1);
      if ('data' in record) visit(record.data, depth + 1);
      if ('entries' in record) visit(record.entries, depth + 1);
    }
  };

  visit(payload);
  return Array.from(models).sort();
}

function resolveSkillKey(entry: SkillStatusEntry): string {
  if (typeof entry.key === 'string' && entry.key.trim()) return entry.key.trim();
  if (typeof entry.skillKey === 'string' && entry.skillKey.trim()) return entry.skillKey.trim();
  if (typeof entry.name === 'string' && entry.name.trim()) return entry.name.trim();
  return '';
}

function deriveAgentScopedSkills(skills: SkillStatusEntry[], agentId?: string): string[] {
  const keys = new Set<string>();
  const agentNeedle = agentId ? `/agents/${agentId}/skills/` : '';

  for (const skill of skills) {
    const skillKey = resolveSkillKey(skill);
    if (!skillKey) continue;

    const filePath = typeof skill.filePath === 'string' ? skill.filePath : '';
    const source = typeof skill.source === 'string' ? skill.source : '';

    if (agentId && filePath.includes(agentNeedle)) {
      keys.add(skillKey);
      continue;
    }

    // Main can use shared workspace skills (for example orchestrator/missions).
    if ((!agentId || agentId === 'main') && source === 'openclaw-workspace' && filePath.includes('/workspace/skills/')) {
      keys.add(skillKey);
    }
  }

  return Array.from(keys).sort();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeConfig(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value)) {
      const baseValue = isPlainObject(base[key]) ? (base[key] as Record<string, unknown>) : {};
      output[key] = mergeConfig(baseValue, value);
    } else {
      output[key] = value;
    }
  }

  return output;
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useGatewayConfig(options: UseGatewayConfigOptions = {}) {
  const { agentId } = options;
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [configHash, setConfigHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [patching, setPatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ollamaModels, setOllamaModels] = useState<ModelEntry[]>([]);
  const [skillsFromGateway, setSkillsFromGateway] = useState<SkillStatusEntry[]>([]);
  const [supportedModelIds, setSupportedModelIds] = useState<string[]>([]);
  const [modelsFetched, setModelsFetched] = useState(false);
  const fetchedRef = useRef(false);

  // Fetch Ollama models
  useEffect(() => {
    fetch('http://127.0.0.1:11434/api/tags')
      .then(r => r.json())
      .then((data: { models?: Array<{ name: string }> }) => {
        if (data.models?.length) {
          setOllamaModels(data.models.map(m => ({ id: m.name, label: m.name })));
        }
      })
      .catch(() => { /* Ollama not running — fine */ });
  }, []);



  const fetchConfig = useCallback(async (): Promise<{ config: GatewayConfig | null; hash: string | null }> => {
    try {
      setLoading(true);
      setError(null);

      // Strategy 1: Try config.get (needs operator.admin scope)
      let cfg: GatewayConfig | null = null;
      let hash: string | null = null;
      try {
        const result = await openclawClient.send('config.get', {}) as Record<string, unknown> | undefined;
        console.log('[useGatewayConfig] config.get raw result keys:', result ? Object.keys(result) : 'empty');

        if (result) {
          // Store the hash for subsequent patch operations
          // Try multiple possible locations for the hash
          if (typeof result.hash === 'string' && result.hash.trim()) {
            hash = result.hash;
            console.log('[useGatewayConfig] Got config hash from result.hash:', hash);
          } else if (typeof result.configHash === 'string' && result.configHash.trim()) {
            hash = result.configHash;
            console.log('[useGatewayConfig] Got config hash from result.configHash:', hash);
          } else if (typeof result.baseHash === 'string' && result.baseHash.trim()) {
            hash = result.baseHash;
            console.log('[useGatewayConfig] Got config hash from result.baseHash:', hash);
          } else if (typeof result.revision === 'string' && result.revision.trim()) {
            hash = result.revision;
            console.log('[useGatewayConfig] Got config hash from result.revision:', hash);
          } else if (typeof result.version === 'string' && result.version.trim()) {
            hash = result.version;
            console.log('[useGatewayConfig] Got config hash from result.version:', hash);
          }

          // Also check nested config object for hash
          const nestedConfig = result.config as Record<string, unknown> | undefined;
          if (!hash && nestedConfig) {
            if (typeof nestedConfig.hash === 'string' && nestedConfig.hash.trim()) {
              hash = nestedConfig.hash;
              console.log('[useGatewayConfig] Got config hash from result.config.hash:', hash);
            }
          }

          if (typeof result.config === 'object' && result.config !== null) {
            cfg = result.config as GatewayConfig;
            console.log('[useGatewayConfig] Using result.config');
          } else if (typeof result.parsed === 'object' && result.parsed !== null) {
            cfg = result.parsed as GatewayConfig;
            console.log('[useGatewayConfig] Using result.parsed');
          } else if ('agents' in result || 'skills' in result) {
            cfg = result as unknown as GatewayConfig;
            console.log('[useGatewayConfig] Using result directly');
          }

          // If we have a config but no hash, log a warning
          if (cfg && !hash) {
            console.warn('[useGatewayConfig] Config loaded but no hash found. Patch operations may fail.');
            console.log('[useGatewayConfig] Full result for debugging:', JSON.stringify(result, null, 2).slice(0, 2000));
          }

          // Log full config for debugging patch issues
          if (cfg) {
            console.log('[useGatewayConfig] Full loaded config keys:', Object.keys(cfg));
            console.log('[useGatewayConfig] Full loaded config (first 1500 chars):', JSON.stringify(cfg, null, 2).slice(0, 1500));
          }
        }
      } catch (configErr) {
        console.warn('[useGatewayConfig] config.get failed:', configErr);
      }

      // Strategy 2: If config.get failed, try status + models.list for model info
      if (!cfg || !cfg.agents?.defaults?.model?.primary) {
        console.log('[useGatewayConfig] Falling back to status for model info');
        try {
          const statusResult = await openclawClient.send('status', {}) as Record<string, unknown> | undefined;
          console.log('[useGatewayConfig] status result keys:', statusResult ? Object.keys(statusResult) : 'empty');
          console.log('[useGatewayConfig] status result:', JSON.stringify(statusResult).slice(0, 1000));

          // Extract model from status response
          const model = (statusResult as Record<string, unknown>)?.model as string
            ?? (statusResult as Record<string, unknown>)?.defaultModel as string
            ?? ((statusResult as Record<string, unknown>)?.session as Record<string, unknown>)?.model as string;

          if (model) {
            console.log('[useGatewayConfig] Got model from status:', model);
            cfg = cfg ?? {} as GatewayConfig;
            cfg.agents = cfg.agents ?? {};
            cfg.agents.defaults = cfg.agents.defaults ?? {};
            cfg.agents.defaults.model = cfg.agents.defaults.model ?? {};
            cfg.agents.defaults.model.primary = model;
          }
        } catch (statusErr) {
          console.warn('[useGatewayConfig] status fallback failed:', statusErr);
        }
      }

      // Strategy 3: Try health endpoint
      if (!cfg || !cfg.agents?.defaults?.model?.primary) {
        try {
          const healthResult = await openclawClient.send('health', {}) as Record<string, unknown> | undefined;
          console.log('[useGatewayConfig] health result:', JSON.stringify(healthResult).slice(0, 500));
        } catch (e) {
          console.warn('[useGatewayConfig] health failed:', e);
        }
      }

      if (cfg?.agents?.defaults?.model?.primary) {
        console.log('[useGatewayConfig] ✅ Config loaded. Primary:', cfg.agents.defaults.model.primary,
          'Skills:', cfg?.skills?.entries ? Object.keys(cfg.skills.entries) : 'none');
        setConfig(cfg);
        setConfigHash(hash);
      } else {
        console.warn('[useGatewayConfig] ❌ Could not determine model from any source');
        if (cfg) setConfig(cfg); // Set partial config anyway
        setConfigHash(hash);
      }

      fetchedRef.current = true;
      return { config: cfg, hash };
    } catch (err) {
      console.error('[useGatewayConfig] Failed to fetch config:', err);
      setError(String(err));
      return { config: null, hash: null };
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSkillsStatus = useCallback(async () => {
    try {
      const params = agentId ? { agentId } : {};
      const result = await openclawClient.send('skills.status', params) as SkillsStatusResponse | undefined;
      console.log('[useGatewayConfig] skills.status result:', result ? 'ok' : 'empty');
      if (result?.skills && Array.isArray(result.skills)) {
        setSkillsFromGateway(result.skills);
        console.log('[useGatewayConfig] Skills loaded:', result.skills.length, 'skills');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
      console.warn('[useGatewayConfig] skills.status failed (may not be available):', errorMessage);
    }
  }, [agentId]);

  // Refresh skills when switching the UI-selected agent.
  useEffect(() => {
    if (!openclawClient.isConnected) return;
    fetchSkillsStatus();
  }, [agentId, fetchSkillsStatus]);

  const fetchModelsList = useCallback(async () => {
    try {
      const attempts: Array<Record<string, unknown>> = [{}];

      for (const params of attempts) {
        try {
          const result = await openclawClient.send('models.list', params);
          const ids = extractModelIds(result);
          if (ids.length > 0) {
            setSupportedModelIds(ids);
            setModelsFetched(true);
            console.log('[useGatewayConfig] models.list loaded:', ids.length, 'models');
            return;
          }
        } catch (err) {
          console.warn('[useGatewayConfig] models.list attempt failed:', String(err));
        }
      }
    } finally {
      setModelsFetched(true);
    }
  }, []);

  // Fetch gateway config when connected
  useEffect(() => {
    const unsub = openclawClient.onStatusChange((s: ConnectionStatus) => {
      if (s === 'connected' && !fetchedRef.current) {
        fetchConfig();
        fetchSkillsStatus();
        fetchModelsList();
      }
    });

    // Also try immediately if already connected
    if (openclawClient.isConnected && !fetchedRef.current) {
      fetchConfig();
      fetchSkillsStatus();
      fetchModelsList();
    }

    return () => { unsub(); };
  }, [fetchConfig, fetchSkillsStatus, fetchModelsList]);

  const patchConfig = useCallback(async (patch: Record<string, unknown>) => {
    try {
      setPatching(true);
      setError(null);

      // Check if we have a config hash, if not try to fetch it first
      let currentHash = configHash;
      if (!currentHash) {
        console.log('[useGatewayConfig] No config hash available, attempting to fetch config...');
        const { hash } = await fetchConfig();
        if (!hash) {
          throw new Error('Config hash not available. Please reload the config or check gateway permissions.');
        }
        currentHash = hash;
      }

      const fullConfig = mergeConfig((config ?? {}) as Record<string, unknown>, patch);

      // Gateway config.patch expects { raw: string, baseHash: string }
      const raw = JSON.stringify(fullConfig, null, 2);
      console.log('[useGatewayConfig] Sending config.patch with hash:', currentHash?.slice(0, 16) + '...');
      console.log('[useGatewayConfig] Full config patch payload (first 1000 chars):', raw.slice(0, 1000));
      console.log('[useGatewayConfig] Current config keys:', Object.keys(config || {}));
      await openclawClient.send('config.patch', { raw, baseHash: currentHash });
      // Re-fetch to get updated config and new hash
      await fetchConfig();
      await fetchModelsList();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('[useGatewayConfig] Patch failed:', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setPatching(false);
    }
  }, [fetchConfig, fetchModelsList, configHash, config]);


  const setModel = useCallback(async (primary: string, targetAgentId?: string) => {
    console.log('[useGatewayConfig] setModel called with:', { primary, targetAgentId, agentId });
    const resolvedAgentId = targetAgentId ?? agentId;
    const currentList = config?.agents?.list;
    console.log('[useGatewayConfig] resolvedAgentId:', resolvedAgentId, 'currentList length:', currentList?.length);

    // Prefer per-agent model updates when an agent is selected.
    if (resolvedAgentId && Array.isArray(currentList) && currentList.length > 0) {
      // Preserve all original fields, only update the model field
      const updatedList = currentList.map((entry) => {
        if (entry.id === resolvedAgentId) {
          // Preserve all fields, only update model
          return {
            ...entry,
            model: primary,
          };
        }
        // Preserve all fields for other agents
        return entry;
      });

      console.log('[useGatewayConfig] Sending patch with updated list:', JSON.stringify(updatedList, null, 2).slice(0, 1000));
      await patchConfig({
        agents: { list: updatedList },
      });
      return;
    }

    // Fallback to defaults for gateways/configs without explicit agent list support.
    await patchConfig({
      agents: { defaults: { model: { primary } } },
    });
  }, [agentId, config, patchConfig]);

  const setThinking = useCallback(async (level: ThinkingLevel) => {
    await patchConfig({
      agents: { defaults: { thinkingDefault: level } },
    });
  }, [patchConfig]);

  const setSkills = useCallback(async (skills: string[], targetAgentId?: string) => {
    const resolvedAgentId = targetAgentId ?? agentId;
    const currentList = config?.agents?.list;

    // Prefer per-agent skill updates when an agent is selected.
    if (resolvedAgentId && Array.isArray(currentList) && currentList.length > 0) {
      const updatedList = currentList.map((entry) => {
        if (entry.id === resolvedAgentId) {
          return { ...entry, skills };
        }
        return entry;
      });

      await patchConfig({
        agents: { list: updatedList },
      });
      return;
    }

    // Fallback to skills.entries for gateways without explicit agent list support.
    await patchConfig({
      skills: { entries: skills.reduce((acc, skill) => ({ ...acc, [skill]: true }), {}) },
    });
  }, [agentId, config, patchConfig]);

  // Build catalog with dynamic Ollama models merged in
  const catalog = MODEL_CATALOG.map(p => {
    // Debug catalog
    if (p.id === 'zai') console.log('[useGatewayConfig] Zai provider present in catalog with models:', p.models);

    if (p.id === 'ollama' && ollamaModels.length > 0) {
      return { ...p, models: ollamaModels };
    }
    return p;
  });

  // Derived values
  const agentList = Array.isArray(config?.agents?.list) ? config.agents.list : [];
  const activeAgentConfig = agentId ? agentList.find((entry) => entry.id === agentId) : undefined;
  const primary = activeAgentConfig?.model ?? config?.agents?.defaults?.model?.primary ?? '';
  const thinkingLevel = (config?.agents?.defaults?.thinkingDefault ?? 'high') as ThinkingLevel;
  const parsed = parsePrimary(primary);
  const canValidateModels = modelsFetched && supportedModelIds.length > 0;
  const supportedProviders = new Set(
    supportedModelIds
      .map((id) => parsePrimary(id).providerId)
      .filter((id) => id && id !== 'unknown'),
  );
  const isModelSupported = (modelPrimary: string): boolean => {
    if (!canValidateModels) return true;
    if (supportedModelIds.includes(modelPrimary)) return true;

    // If runtime gave no entries for this provider, don't hard-fail selection.
    const { providerId } = parsePrimary(modelPrimary);
    if (!providerId || providerId === 'unknown') return true;
    if (!supportedProviders.has(providerId)) return true;

    return false;
  };
  const isProviderSupported = (providerId: string): boolean => {
    if (!canValidateModels) return true;
    return supportedProviders.has(providerId);
  };
  const skillEntries = config?.skills?.entries ? Object.keys(config.skills.entries) : [];
  const availableSkills = (config as Record<string, unknown>)?.available_skills as string[] | undefined;
  const configuredSkills = Array.isArray(activeAgentConfig?.skills)
    ? activeAgentConfig.skills.filter((skill): skill is string => typeof skill === 'string')
    : [];
  const agentScopedGatewaySkills = deriveAgentScopedSkills(skillsFromGateway, agentId);
  // Merge skills from config entries, available_skills array, and skills.status RPC
  const gatewaySkillKeys = skillsFromGateway
    .filter((s) => s.eligible !== false)
    .map((s) => resolveSkillKey(s))
    .filter(Boolean);
  const allSkills = Array.from(new Set([
    ...skillEntries,
    ...(availableSkills ?? []),
    ...gatewaySkillKeys,
  ])).sort();

  return {
    config,
    loading,
    patching,
    error,
    catalog,
    primary,
    providerId: parsed.providerId,
    modelId: parsed.modelId,
    activeAgentConfig,
    configuredSkills,
    agentScopedGatewaySkills,
    thinkingLevel,
    skillEntries,
    availableSkills: availableSkills ?? [],
    allSkills,
    skillsFromGateway,
    supportedModelIds,
    modelsFetched,
    canValidateModels,
    isModelSupported,
    isProviderSupported,
    fetchConfig,
    fetchSkillsStatus,
    fetchModelsList,
    patchConfig,
    setModel,
    setThinking,
    setSkills,
  };
}
