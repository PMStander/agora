/**
 * Extract text from an OpenClaw chat payload.
 * Mirrors the extractText() logic in useOpenClaw.ts to parse
 * Anthropic-format messages (string, content blocks, direct .text).
 */
export function extractTextFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const p = payload as Record<string, unknown>;
  const message = p.message;
  if (!message) return '';
  if (typeof message === 'string') return message;
  if (typeof message === 'object' && message !== null) {
    const m = message as Record<string, unknown>;
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.content)) {
      return m.content
        .filter((c: Record<string, unknown>) => c?.type === 'text')
        .map((c: Record<string, unknown>) => (c?.text as string) || '')
        .join('');
    }
    if (typeof m.text === 'string') return m.text;
  }
  return '';
}

/**
 * Check if the payload already contains agent-emitted A2UI messages.
 * If so, auto-surface should not generate a competing surface.
 */
export function hasAgentA2UI(payload: unknown): boolean {
  const text = JSON.stringify(payload);
  return /(surfaceUpdate|dataModelUpdate|beginRendering)/.test(text);
}
