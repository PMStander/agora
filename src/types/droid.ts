// Factory AI Droid CLI types for stream-json output

export interface DroidSystemEvent {
  type: 'system';
  subtype: 'init';
  cwd: string;
  session_id: string;
  tools: string[];
  model: string;
  reasoning_effort: string;
}

export interface DroidMessageEvent {
  type: 'message';
  role: 'user' | 'assistant';
  id: string;
  text: string;
  timestamp: number;
  session_id: string;
}

export interface DroidToolCallEvent {
  type: 'tool_call';
  id: string;
  messageId: string;
  toolId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  timestamp: number;
  session_id: string;
}

export interface DroidToolResultEvent {
  type: 'tool_result';
  id: string;
  messageId: string;
  toolId: string;
  isError: boolean;
  value: string;
  timestamp: number;
  session_id: string;
}

export interface DroidCompletionEvent {
  type: 'completion';
  finalText: string;
  numTurns: number;
  durationMs: number;
  session_id: string;
  timestamp: number;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
}

export type DroidEvent =
  | DroidSystemEvent
  | DroidMessageEvent
  | DroidToolCallEvent
  | DroidToolResultEvent
  | DroidCompletionEvent;

export type DroidAutonomyLevel = 'readonly' | 'low' | 'medium' | 'high';

export interface DroidModel {
  id: string;
  label: string;
  group: 'builtin' | 'custom';
}

export const DROID_BUILTIN_MODELS: DroidModel[] = [
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6', group: 'builtin' },
  { id: 'claude-opus-4-6-fast', label: 'Claude Opus 4.6 Fast', group: 'builtin' },
  { id: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', group: 'builtin' },
  { id: 'gpt-5.2-codex', label: 'GPT-5.2 Codex', group: 'builtin' },
  { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex', group: 'builtin' },
  { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro', group: 'builtin' },
  { id: 'glm-4.7', label: 'Droid Core (GLM-4.7)', group: 'builtin' },
  { id: 'kimi-k2.5', label: 'Droid Core (Kimi K2.5)', group: 'builtin' },
];

export const DROID_AUTONOMY_LEVELS: { value: DroidAutonomyLevel; label: string; description: string }[] = [
  { value: 'readonly', label: 'Read-only', description: 'Analysis only — no file modifications' },
  { value: 'low', label: 'Low', description: 'File creation/modification, no installs' },
  { value: 'medium', label: 'Medium', description: 'Install packages, build, git commit' },
  { value: 'high', label: 'High', description: 'Git push, deploy, database migrations' },
];
