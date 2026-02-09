import type { ClassificationResult } from '../../types/autoSurface';
import { templateRegistry } from './registry';

const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;
const MIN_TEXT_LENGTH = 20;

/**
 * Classify an agent response text against all registered templates.
 * Returns the highest-confidence match above the threshold, or null.
 */
export function classifyResponse(
  text: string,
  threshold = DEFAULT_CONFIDENCE_THRESHOLD,
): ClassificationResult | null {
  if (!text || text.length < MIN_TEXT_LENGTH) return null;

  let bestMatch: { templateId: string; confidence: number } | null = null;

  for (const template of templateRegistry.values()) {
    const confidence = template.match(text);
    if (confidence >= threshold && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = { templateId: template.id, confidence };
    }
  }

  if (!bestMatch) return null;

  const template = templateRegistry.get(bestMatch.templateId)!;
  const extractedData = template.extract(text);

  return {
    templateId: bestMatch.templateId,
    confidence: bestMatch.confidence,
    extractedData,
  };
}
