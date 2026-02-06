import { useState, useEffect, useCallback, useRef } from 'react';
import { openclawClient, type ConnectionStatus } from '../lib/openclawClient';

// ── Provider / Model Catalog ──────────────────────────────────────────

export interface ModelEntry {
  id: string;
  label: string;
  note?: string;
}

export interface ProviderEntry {
  id: string;
  label: string;
  icon: string;
  note?: string;
  models: ModelEntry[];
  /** Format: how the primary string is built. Default: "provider/model" */
  format?: (model: string) => string;
  /** Parse: extract model id from a primary string. Default: strip "provider/" prefix */
  parse?: (primary: string) => string | null;
}

export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

export const MODEL_CATALOG: ProviderEntry[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    icon: '🟠',
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
    icon: '🟢',
    note: 'OAuth auth',
    models: [
      { id: 'gpt-5.2', label: 'GPT-5.2' },
      { id: 'o3', label: 'o3' },
      { id: 'o3-mini', label: 'o3-mini' },
      { id: 'o4-mini', label: 'o4-mini' },
    ],
  },
  {
    id: 'google-gemini-cli',
    label: 'Google Gemini',
    icon: '🔵',
    note: 'CLI OAuth',
    models: [
      { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    ],
  },
  {
    id: 'ollama',
    label: 'Ollama',
    icon: '🦙',
    note: 'Local · Free',
    models: [
      { id: 'minimax-m2:cloud', label: 'minimax-m2:cloud' },
    ],
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    icon: '🌐',
    format: (model: string) => `openrouter/${model}`,
    parse: (primary: string) => {
      if (!primary.startsWith('openrouter/')) return null;
      return primary.slice('openrouter/'.length);
    },
    models: [
      { id: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { id: 'openai/gpt-4o', label: 'GPT-4o' },
      { id: 'meta-llama/llama-3.3-70b', label: 'Llama 3.3 70B' },
      { id: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    ],
  },
];

// ── Skill metadata ────────────────────────────────────────────────────

export interface SkillMeta {
  id: string;
  label: string;
  icon: string;
  category: string;
}

export const SKILL_CATALOG: Record<string, Omit<SkillMeta, 'id'>> = {
  'goplaces':           { label: 'Google Places',    icon: '📍', category: 'API' },
  'local-places':       { label: 'Local Places',     icon: '🗺️', category: 'API' },
  'nano-banana-pro':    { label: 'Gemini Images',    icon: '🖼️', category: 'AI' },
  'openai-image-gen':   { label: 'DALL-E',           icon: '🎨', category: 'AI' },
  'openai-whisper-api': { label: 'Whisper',          icon: '🎙️', category: 'AI' },
  'sag':                { label: 'ElevenLabs TTS',   icon: '🔊', category: 'AI' },
  'apple-notes':        { label: 'Apple Notes',      icon: '📝', category: 'Apple' },
  'apple-reminders':    { label: 'Reminders',        icon: '⏰', category: 'Apple' },
  'bird':               { label: 'X / Twitter',      icon: '🐦', category: 'Social' },
  'coding-agent':       { label: 'Coding Agent',     icon: '💻', category: 'Dev' },
  'github':             { label: 'GitHub',            icon: '🐙', category: 'Dev' },
  'gog':                { label: 'Google Workspace',  icon: '📧', category: 'Productivity' },
  'himalaya':           { label: 'Email (IMAP)',      icon: '✉️', category: 'Comms' },
  'imsg':               { label: 'iMessage',          icon: '💬', category: 'Comms' },
  'peekaboo':           { label: 'macOS UI',          icon: '👁️', category: 'System' },
  'things-mac':         { label: 'Things 3',          icon: '✅', category: 'Productivity' },
  'tmux':               { label: 'tmux',              icon: '🖥️', category: 'Dev' },
  'video-frames':       { label: 'Video Frames',      icon: '🎬', category: 'Media' },
  'wacli':              { label: 'WhatsApp',           icon: '📱', category: 'Comms' },
  'weather':            { label: 'Weather',            icon: '🌤️', category: 'Info' },
  'nano-pdf':           { label: 'PDF Tools',          icon: '📄', category: 'Productivity' },
  'session-logs':       { label: 'Session Logs',       icon: '📋', category: 'System' },
  'skill-creator':      { label: 'Skill Creator',      icon: '🛠️', category: 'Dev' },
  'agent-orchestrator': { label: 'Orchestrator',       icon: '🎭', category: 'System' },
  'mission-control':    { label: 'Mission Control',    icon: '🚀', category: 'System' },
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

// Skills status response from skills.status RPC
interface SkillStatusEntry {
  key: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  eligible?: boolean;
  [key: string]: unknown;
}

interface SkillsStatusResponse {
  skills?: SkillStatusEntry[];
  [key: string]: unknown;
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useGatewayConfig() {
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [patching, setPatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ollamaModels, setOllamaModels] = useState<ModelEntry[]>([]);
  const [skillsFromGateway, setSkillsFromGateway] = useState<SkillStatusEntry[]>([]);
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

  // Fetch gateway config when connected
  useEffect(() => {
    const unsub = openclawClient.onStatusChange((s: ConnectionStatus) => {
      if (s === 'connected' && !fetchedRef.current) {
        fetchConfig();
        fetchSkillsStatus();
      }
    });

    // Also try immediately if already connected
    if (openclawClient.isConnected && !fetchedRef.current) {
      fetchConfig();
      fetchSkillsStatus();
    }

    return () => { unsub(); };
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Strategy 1: Try config.get (needs operator.admin scope)
      let cfg: GatewayConfig | null = null;
      try {
        const result = await openclawClient.send('config.get', {}) as Record<string, unknown> | undefined;
        console.log('[useGatewayConfig] config.get raw result keys:', result ? Object.keys(result) : 'empty');

        if (result) {
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
      } else {
        console.warn('[useGatewayConfig] ❌ Could not determine model from any source');
        if (cfg) setConfig(cfg); // Set partial config anyway
      }

      fetchedRef.current = true;
    } catch (err) {
      console.error('[useGatewayConfig] Failed to fetch config:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSkillsStatus = useCallback(async () => {
    try {
      const result = await openclawClient.send('skills.status', {}) as SkillsStatusResponse | undefined;
      console.log('[useGatewayConfig] skills.status result:', result ? 'ok' : 'empty');
      if (result?.skills && Array.isArray(result.skills)) {
        setSkillsFromGateway(result.skills);
        console.log('[useGatewayConfig] Skills loaded:', result.skills.length, 'skills');
      }
    } catch (err) {
      console.warn('[useGatewayConfig] skills.status failed (may not be available):', String(err));
    }
  }, []);

  const patchConfig = useCallback(async (patch: Record<string, unknown>) => {
    try {
      setPatching(true);
      setError(null);
      await openclawClient.send('config.patch', { patch });
      // Re-fetch to get updated config
      await fetchConfig();
    } catch (err) {
      console.error('[useGatewayConfig] Patch failed:', err);
      setError(String(err));
      throw err;
    } finally {
      setPatching(false);
    }
  }, [fetchConfig]);

  const setModel = useCallback(async (primary: string) => {
    await patchConfig({
      agents: { defaults: { model: { primary } } },
    });
  }, [patchConfig]);

  const setThinking = useCallback(async (level: ThinkingLevel) => {
    await patchConfig({
      agents: { defaults: { thinkingDefault: level } },
    });
  }, [patchConfig]);

  // Build catalog with dynamic Ollama models merged in
  const catalog = MODEL_CATALOG.map(p => {
    if (p.id === 'ollama' && ollamaModels.length > 0) {
      return { ...p, models: ollamaModels };
    }
    return p;
  });

  // Derived values
  const primary = config?.agents?.defaults?.model?.primary ?? '';
  const thinkingLevel = (config?.agents?.defaults?.thinkingDefault ?? 'high') as ThinkingLevel;
  const parsed = parsePrimary(primary);
  const skillEntries = config?.skills?.entries ? Object.keys(config.skills.entries) : [];
  const availableSkills = (config as Record<string, unknown>)?.available_skills as string[] | undefined;
  // Merge skills from config entries, available_skills array, and skills.status RPC
  const gatewaySkillKeys = skillsFromGateway
    .filter(s => s.eligible !== false)
    .map(s => s.key);
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
    thinkingLevel,
    skillEntries,
    availableSkills: availableSkills ?? [],
    allSkills,
    skillsFromGateway,
    fetchConfig,
    fetchSkillsStatus,
    patchConfig,
    setModel,
    setThinking,
  };
}
