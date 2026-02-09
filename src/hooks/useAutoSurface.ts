import { useEffect, useRef } from 'react';
import { openclawClient, type OpenClawMessage } from '../lib/openclawClient';
import { classifyResponse } from '../lib/autoSurface/classifier';
import { extractTextFromPayload, hasAgentA2UI } from '../lib/autoSurface/extractText';
import { templateRegistry } from '../lib/autoSurface/registry';
import type { A2UIMessage } from './useA2UI';

// Ensure all templates are registered on import
import '../lib/autoSurface/templates';

const AUTO_SURFACE_PREFIX = 'auto-';

interface UseAutoSurfaceOptions {
  enabled?: boolean;
  confidenceThreshold?: number;
  pushMessages: (messages: A2UIMessage[]) => void;
}

/**
 * Listens to completed agent chat responses and auto-generates
 * A2UI surfaces when the response text matches a known template.
 *
 * Skips responses that already contain agent-emitted A2UI JSON.
 */
export function useAutoSurface({
  enabled = true,
  confidenceThreshold = 0.6,
  pushMessages,
}: UseAutoSurfaceOptions) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const thresholdRef = useRef(confidenceThreshold);
  thresholdRef.current = confidenceThreshold;

  useEffect(() => {
    const unsub = openclawClient.onMessage((msg: OpenClawMessage) => {
      if (!enabledRef.current) return;
      if (msg.type !== 'event' || msg.event !== 'chat') return;

      const payload = msg.payload as Record<string, unknown> | undefined;
      if (!payload || payload.state !== 'final') return;

      // Don't compete with agent-emitted A2UI
      if (hasAgentA2UI(payload)) return;

      const text = extractTextFromPayload(payload);
      if (!text) return;

      const result = classifyResponse(text, thresholdRef.current);
      if (!result) return;

      const template = templateRegistry.get(result.templateId);
      if (!template) return;

      const surfaceId = `${AUTO_SURFACE_PREFIX}${result.templateId}-${Date.now()}`;
      const messages = template.generate(result.extractedData, surfaceId);

      if (messages.length > 0) {
        console.log(
          `[AutoSurface] "${result.templateId}" (confidence: ${result.confidence.toFixed(2)}) → ${surfaceId}`,
        );
        pushMessages(messages);
      }
    });

    return () => { unsub(); };
  }, [pushMessages]);
}
