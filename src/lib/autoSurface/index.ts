export { classifyResponse } from './classifier';
export { templateRegistry, registerTemplate } from './registry';
export { extractTextFromPayload, hasAgentA2UI } from './extractText';

// Ensure all templates are registered
import './templates';
