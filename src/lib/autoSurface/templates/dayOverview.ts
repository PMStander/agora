import type { A2UIMessage, A2UIComponent } from '../../../hooks/useA2UI';
import { registerTemplate } from '../registry';

// --- Pattern matching ---

const TIME_12H = /\b(\d{1,2})\s*:\s*(\d{2})\s*(am|pm)\b/gi;
const TIME_24H = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;
const CALENDAR_KEYWORDS = [
  'calendar', 'schedule', 'events', 'agenda',
  'today', 'tomorrow', 'morning', 'afternoon', 'evening',
  'appointment', 'meeting', 'call',
];
const EMPTY_CALENDAR = /no\s+events|clear\s+(day|calendar|schedule)|blank\s+slate|nothing\s+(?:on\s+)?(?:the\s+)?(?:books|calendar|schedule)|empty\s+(day|calendar)/i;

// Parse event-like lines: "10:00 AM - Team standup" or "- 2pm: Client call"
const EVENT_LINE = /(?:^|\n)\s*[\-•*]?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?(?:\s*[-–—]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)\s*[-–—:]\s*(.+?)(?:\n|$)/gi;

const DATE_LABEL_PATTERNS: [RegExp, string][] = [
  [/\btoday\b/i, 'Today'],
  [/\btomorrow\b/i, 'Tomorrow'],
  [/\bmonday\b/i, 'Monday'],
  [/\btuesday\b/i, 'Tuesday'],
  [/\bwednesday\b/i, 'Wednesday'],
  [/\bthursday\b/i, 'Thursday'],
  [/\bfriday\b/i, 'Friday'],
  [/\bsaturday\b/i, 'Saturday'],
  [/\bsunday\b/i, 'Sunday'],
];

function detectDateLabel(text: string): string {
  for (const [pattern, label] of DATE_LABEL_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return 'Today';
}

interface ParsedEvent {
  time: string;
  title: string;
  subtitle?: string;
  status?: string;
}

function parseEvents(text: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex for global regex
  EVENT_LINE.lastIndex = 0;
  while ((match = EVENT_LINE.exec(text)) !== null) {
    const time = match[1].trim();
    let title = match[2].trim();
    let subtitle: string | undefined;

    // Extract subtitle in parentheses
    const parenMatch = title.match(/^(.+?)\s*\((.+?)\)\s*$/);
    if (parenMatch) {
      title = parenMatch[1].trim();
      subtitle = parenMatch[2].trim();
    }

    events.push({ time, title, subtitle });
  }

  return events;
}

registerTemplate({
  id: 'day-overview',
  name: 'Day Overview',

  match(text: string): number {
    const lower = text.toLowerCase();
    let score = 0;

    // Empty calendar is a strong positive signal
    if (EMPTY_CALENDAR.test(text)) return 0.7;

    // Calendar keywords
    const hits = CALENDAR_KEYWORDS.filter(kw => lower.includes(kw));
    score += Math.min(hits.length * 0.15, 0.45);

    // Time patterns
    const times12 = (text.match(TIME_12H) || []).length;
    const times24 = (text.match(TIME_24H) || []).length;
    const totalTimes = times12 + times24;
    if (totalTimes >= 2) score += 0.3;
    else if (totalTimes === 1) score += 0.1;

    return score;
  },

  extract(text: string): Record<string, unknown> {
    const isEmpty = EMPTY_CALENDAR.test(text);
    const dateLabel = detectDateLabel(text);
    const events = parseEvents(text);

    return {
      dateLabel,
      isEmpty,
      eventCount: isEmpty ? 0 : events.length,
      nextEventTime: events.length > 0 ? events[0].time : 'None',
      events: isEmpty ? [] : events,
      emptyMessage: isEmpty ? 'No events scheduled. A clear day full of possibility.' : null,
    };
  },

  generate(data: Record<string, unknown>, surfaceId: string): A2UIMessage[] {
    const isEmpty = data.isEmpty as boolean;
    const components: A2UIComponent[] = [
      { id: 'root', type: 'Column', children: ['main-card'] },
      { id: 'main-card', type: 'Card', props: { title: `${data.dateLabel} Schedule` }, children: ['kpis'] },
      {
        id: 'kpis', type: 'KpiGrid', props: {
          items: '{{kpiItems}}',
          columns: 2,
        },
      },
    ];

    const cardChildren = ['kpis'];

    if (isEmpty) {
      components.push({ id: 'empty-msg', type: 'Text', props: { text: '{{emptyMessage}}' } });
      cardChildren.push('empty-msg');
    } else {
      components.push({ id: 'agenda', type: 'Agenda', props: { items: '{{events}}' } });
      cardChildren.push('agenda');
    }

    // Update card children
    const mainCard = components.find(c => c.id === 'main-card')!;
    mainCard.children = cardChildren;

    // Build KPI items
    const kpiItems = [
      { label: 'Events', value: String(data.eventCount), tone: (data.eventCount as number) > 0 ? 'info' : 'neutral' },
      { label: 'Next', value: String(data.nextEventTime), tone: 'neutral' },
    ];

    return [
      { type: 'dataModelUpdate', surfaceId, data: { ...data, kpiItems } },
      { type: 'surfaceUpdate', surfaceId, components },
      { type: 'beginRendering', surfaceId, rootId: 'root', catalog: 'auto-day-overview' },
    ];
  },
});
