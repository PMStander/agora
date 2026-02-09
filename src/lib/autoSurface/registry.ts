import type { SurfaceTemplate } from '../../types/autoSurface';

export const templateRegistry = new Map<string, SurfaceTemplate>();

export function registerTemplate(template: SurfaceTemplate): void {
  templateRegistry.set(template.id, template);
}
