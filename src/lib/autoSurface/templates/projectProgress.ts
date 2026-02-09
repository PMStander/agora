import type { A2UIMessage, A2UIComponent } from '../../../hooks/useA2UI';
import { registerTemplate } from '../registry';

// --- Pattern matching ---

const PROJECT_KEYWORDS = ['project', 'milestone', 'sprint', 'phase', 'deliverable', 'deadline'];
const PROJECT_STATUS_KEYWORDS = ['planning', 'active', 'on hold', 'on_hold', 'completed', 'cancelled'];
const MISSION_COUNT = /(\d+)\s*(?:missions?|tasks?)\s*(?:total|in\s+total|assigned|remaining)/i;
const COMPLETED_COUNT = /(\d+)\s*(?:missions?|tasks?)\s*(?:completed|done|finished)/i;
const IN_PROGRESS_COUNT = /(\d+)\s*(?:missions?|tasks?)\s*(?:in[_\s-]?progress|active|running|underway)/i;
const BLOCKED_COUNT = /(\d+)\s*(?:missions?|tasks?)\s*(?:blocked|stuck|stalled)/i;
const PROJECT_NAME = /(?:project)[:\s]+["']?([^"'\n]+?)["']?(?:\s*[-–—]|\s*$|\s*\n)/im;
const PROJECT_STATUS = /(?:project\s*)?status[:\s]*(planning|active|on[_\s]hold|completed|cancelled)/i;
const PROGRESS_PERCENT = /(\d+(?:\.\d+)?)\s*%\s*(?:complete|done|finished|progress)/i;
const PROGRESS_FRACTION = /(\d+)\s*(?:\/|of|out\s+of)\s*(\d+)\s*(?:missions?|tasks?|items?)?/i;

registerTemplate({
  id: 'project-progress',
  name: 'Project Progress',

  match(text: string): number {
    const lower = text.toLowerCase();
    let score = 0;

    // Project keywords
    const hits = PROJECT_KEYWORDS.filter(kw => lower.includes(kw));
    score += Math.min(hits.length * 0.12, 0.35);

    // Project status keywords
    const statusHits = PROJECT_STATUS_KEYWORDS.filter(kw => lower.includes(kw));
    if (statusHits.length > 0) score += 0.1;

    // Mission/task counts
    if (MISSION_COUNT.test(text) || COMPLETED_COUNT.test(text)) score += 0.2;

    // Progress percentage or fraction
    if (PROGRESS_PERCENT.test(text) || PROGRESS_FRACTION.test(text)) score += 0.2;

    // Explicit project status
    if (PROJECT_STATUS.test(text)) score += 0.1;

    return score;
  },

  extract(text: string): Record<string, unknown> {
    // Project name
    const nameMatch = text.match(PROJECT_NAME);
    const name = nameMatch ? nameMatch[1].trim() : 'Project';

    // Status
    const statusMatch = text.match(PROJECT_STATUS);
    const status = statusMatch ? statusMatch[1].toLowerCase().replace(/\s+/g, '_') : 'active';

    // Counts
    const totalMatch = text.match(MISSION_COUNT);
    const completedMatch = text.match(COMPLETED_COUNT);
    const inProgressMatch = text.match(IN_PROGRESS_COUNT);
    const blockedMatch = text.match(BLOCKED_COUNT);

    let total = totalMatch ? parseInt(totalMatch[1], 10) : 0;
    const completed = completedMatch ? parseInt(completedMatch[1], 10) : 0;
    const inProgress = inProgressMatch ? parseInt(inProgressMatch[1], 10) : 0;
    const blocked = blockedMatch ? parseInt(blockedMatch[1], 10) : 0;

    // Progress from percentage or fraction
    let percent = 0;
    const percentMatch = text.match(PROGRESS_PERCENT);
    const fractionMatch = text.match(PROGRESS_FRACTION);

    if (percentMatch) {
      percent = parseFloat(percentMatch[1]);
    } else if (fractionMatch) {
      const done = parseInt(fractionMatch[1], 10);
      const all = parseInt(fractionMatch[2], 10);
      if (total === 0) total = all;
      percent = all > 0 ? Math.round((done / all) * 100) : 0;
    } else if (total > 0) {
      percent = Math.round((completed / total) * 100);
    }

    if (total === 0 && (completed + inProgress + blocked) > 0) {
      total = completed + inProgress + blocked;
    }

    return {
      name,
      status,
      total,
      completed,
      inProgress,
      blocked,
      percent,
    };
  },

  generate(data: Record<string, unknown>, surfaceId: string): A2UIMessage[] {
    const components: A2UIComponent[] = [
      { id: 'root', type: 'Column', children: ['project'] },
      {
        id: 'project', type: 'ProjectProgress', props: {
          name: '{{name}}',
          status: '{{status}}',
          total: '{{total}}',
          completed: '{{completed}}',
          inProgress: '{{inProgress}}',
          blocked: '{{blocked}}',
        },
      },
    ];

    const rootChildren = ['project'];

    // Add KPI breakdown
    const kpiItems = [
      { label: 'Total', value: String(data.total), tone: 'neutral' },
      { label: 'Done', value: String(data.completed), tone: 'success' },
      { label: 'Active', value: String(data.inProgress), tone: 'info' },
    ];
    if ((data.blocked as number) > 0) {
      kpiItems.push({ label: 'Blocked', value: String(data.blocked), tone: 'danger' });
    }

    components.push({
      id: 'project-kpis', type: 'KpiGrid', props: {
        items: '{{projectKpis}}',
        columns: Math.min(kpiItems.length, 4),
      },
    });
    rootChildren.push('project-kpis');
    (data as Record<string, unknown>).projectKpis = kpiItems;

    const root = components.find(c => c.id === 'root')!;
    root.children = rootChildren;

    return [
      { type: 'dataModelUpdate', surfaceId, data },
      { type: 'surfaceUpdate', surfaceId, components },
      { type: 'beginRendering', surfaceId, rootId: 'root', catalog: 'auto-project-progress' },
    ];
  },
});
