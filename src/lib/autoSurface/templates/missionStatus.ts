import type { A2UIMessage, A2UIComponent } from '../../../hooks/useA2UI';
import { registerTemplate } from '../registry';

// --- Pattern matching ---

const MISSION_KEYWORDS = ['mission', 'missions', 'task', 'tasks'];
const STATUS_KEYWORDS = ['in progress', 'in-progress', 'completed', 'done', 'pending', 'failed', 'scheduled', 'assigned', 'blocked', 'queued'];
const COUNT_STATUS = /(\d+)\s*(?:missions?|tasks?)\s*(?:are|is|:)?\s*(in[\s-]?progress|completed|done|pending|failed|blocked|queued|scheduled)/gi;
const STATUS_COUNT = /(in[\s-]?progress|completed|done|pending|failed|blocked|queued|scheduled)\s*(?::)?\s*(\d+)/gi;
const PROGRESS_PATTERN = /(\d+)\s*(?:\/|of)\s*(\d+)/;
const PERCENT_PATTERN = /(\d+(?:\.\d+)?)\s*%\s*(?:complete|done|progress|finished)/i;

// Bullet/list items with status markers
const MISSION_ITEM = /(?:^|\n)\s*[\-•*\d.]+\s*(?:\[([xX✓✅ ])?\])?\s*(.+?)(?:\s*[-–—]\s*(completed|done|in[\s-]?progress|pending|failed|blocked))?\s*(?:\n|$)/g;

interface MissionItem {
  label: string;
  done: boolean;
  owner?: string;
}

function parseStatusCounts(text: string): { completed: number; inProgress: number; pending: number; failed: number } {
  const counts = { completed: 0, inProgress: 0, pending: 0, failed: 0 };

  // Try "3 missions completed" pattern
  COUNT_STATUS.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = COUNT_STATUS.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    const status = match[2].toLowerCase().replace(/[\s-]+/g, '');
    if (status === 'completed' || status === 'done') counts.completed += num;
    else if (status === 'inprogress') counts.inProgress += num;
    else if (status === 'pending' || status === 'scheduled' || status === 'queued') counts.pending += num;
    else if (status === 'failed' || status === 'blocked') counts.failed += num;
  }

  // Try "completed: 3" pattern
  STATUS_COUNT.lastIndex = 0;
  while ((match = STATUS_COUNT.exec(text)) !== null) {
    const status = match[1].toLowerCase().replace(/[\s-]+/g, '');
    const num = parseInt(match[2], 10);
    if (status === 'completed' || status === 'done') counts.completed += num;
    else if (status === 'inprogress') counts.inProgress += num;
    else if (status === 'pending' || status === 'scheduled' || status === 'queued') counts.pending += num;
    else if (status === 'failed' || status === 'blocked') counts.failed += num;
  }

  return counts;
}

function parseMissionItems(text: string): MissionItem[] {
  const items: MissionItem[] = [];
  MISSION_ITEM.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MISSION_ITEM.exec(text)) !== null) {
    const checkbox = match[1];
    const label = match[2].trim();
    const statusHint = match[3]?.toLowerCase().replace(/[\s-]+/g, '');

    // Skip very short or header-like items
    if (label.length < 3) continue;
    if (/^(mission|task|status|summary|overview)/i.test(label)) continue;

    const done = checkbox === 'x' || checkbox === 'X' || checkbox === '✓' || checkbox === '✅'
      || statusHint === 'completed' || statusHint === 'done';

    items.push({ label, done });
  }
  return items;
}

registerTemplate({
  id: 'mission-status',
  name: 'Mission Status',

  match(text: string): number {
    const lower = text.toLowerCase();
    let score = 0;

    // Mission/task keywords
    const missionHits = MISSION_KEYWORDS.filter(kw => lower.includes(kw));
    if (missionHits.length > 0) score += 0.2;

    // Status keywords
    const statusHits = STATUS_KEYWORDS.filter(kw => lower.includes(kw));
    score += Math.min(statusHits.length * 0.1, 0.3);

    // Count + status patterns ("3 missions in progress")
    COUNT_STATUS.lastIndex = 0;
    STATUS_COUNT.lastIndex = 0;
    if (COUNT_STATUS.test(text) || STATUS_COUNT.test(text)) score += 0.3;

    // Progress fraction or percentage
    if (PROGRESS_PATTERN.test(text) || PERCENT_PATTERN.test(text)) score += 0.2;

    return score;
  },

  extract(text: string): Record<string, unknown> {
    const counts = parseStatusCounts(text);
    const items = parseMissionItems(text);
    const total = counts.completed + counts.inProgress + counts.pending + counts.failed;

    // Try to detect completion percentage
    let completionPercent = 0;
    const percentMatch = text.match(PERCENT_PATTERN);
    if (percentMatch) {
      completionPercent = parseFloat(percentMatch[1]);
    } else if (total > 0) {
      completionPercent = Math.round((counts.completed / total) * 100);
    }

    const progressMatch = text.match(PROGRESS_PATTERN);
    if (progressMatch && total === 0) {
      const done = parseInt(progressMatch[1], 10);
      const all = parseInt(progressMatch[2], 10);
      counts.completed = done;
      counts.pending = all - done;
      completionPercent = all > 0 ? Math.round((done / all) * 100) : 0;
    }

    return {
      totalMissions: total || (items.length > 0 ? items.length : 0),
      completed: counts.completed,
      inProgress: counts.inProgress,
      pending: counts.pending,
      failed: counts.failed,
      completionPercent,
      missions: items,
    };
  },

  generate(data: Record<string, unknown>, surfaceId: string): A2UIMessage[] {
    const missions = data.missions as MissionItem[];
    const components: A2UIComponent[] = [
      { id: 'root', type: 'Column', children: ['main-card'] },
      { id: 'main-card', type: 'Card', props: { title: 'Mission Status' }, children: ['kpis', 'progress'] },
      {
        id: 'kpis', type: 'KpiGrid', props: {
          items: '{{kpiItems}}',
          columns: 3,
        },
      },
      {
        id: 'progress', type: 'Progress', props: {
          value: '{{completionPercent}}',
          max: 100,
          label: 'Completion',
        },
      },
    ];

    const cardChildren = ['kpis', 'progress'];

    // Add checklist if there are parsed mission items
    if (missions.length > 0) {
      components.push({ id: 'checklist', type: 'Checklist', props: { items: '{{missions}}' } });
      cardChildren.push('checklist');
    }

    const mainCard = components.find(c => c.id === 'main-card')!;
    mainCard.children = cardChildren;

    const kpiItems = [
      { label: 'Completed', value: String(data.completed), tone: 'success' },
      { label: 'In Progress', value: String(data.inProgress), tone: 'info' },
      { label: 'Pending', value: String(data.pending), tone: 'warning' },
    ];
    if ((data.failed as number) > 0) {
      kpiItems.push({ label: 'Failed', value: String(data.failed), tone: 'danger' });
    }

    return [
      { type: 'dataModelUpdate', surfaceId, data: { ...data, kpiItems } },
      { type: 'surfaceUpdate', surfaceId, components },
      { type: 'beginRendering', surfaceId, rootId: 'root', catalog: 'auto-mission-status' },
    ];
  },
});
