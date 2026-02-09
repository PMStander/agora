import type { A2UIMessage } from '../hooks/useA2UI';

/** Result of classifying an agent response */
export interface ClassificationResult {
  templateId: string;
  confidence: number;
  extractedData: Record<string, unknown>;
}

/** A surface template definition */
export interface SurfaceTemplate {
  id: string;
  name: string;
  /** Return confidence 0-1 that this template matches the given text */
  match: (text: string) => number;
  /** Extract structured data from the text for this template's data model */
  extract: (text: string) => Record<string, unknown>;
  /** Generate A2UIMessage[] to create the surface */
  generate: (data: Record<string, unknown>, surfaceId: string) => A2UIMessage[];
}
