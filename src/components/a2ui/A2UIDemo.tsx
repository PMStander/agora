import { useState } from 'react';
import { A2UIRenderer } from './A2UIRenderer';
import type { A2UISurface, A2UIComponent } from '../../hooks/useA2UI';

// Demo surfaces to test the renderer
const createDemoSurface = (type: 'stats' | 'list' | 'form' | 'dashboard' | 'personal' | 'business'): A2UISurface => {
  const components = new Map<string, A2UIComponent>();
  
  switch (type) {
    case 'stats':
      components.set('root', { id: 'root', type: 'Column', children: ['heading', 'row1'] });
      components.set('heading', { id: 'heading', type: 'Heading', props: { text: '📊 Weekly Stats', level: 2 } });
      components.set('row1', { id: 'row1', type: 'Row', children: ['stat1', 'stat2', 'stat3'] });
      components.set('stat1', { id: 'stat1', type: 'Stat', props: { value: '{{tasks.completed}}', label: 'Completed' } });
      components.set('stat2', { id: 'stat2', type: 'Stat', props: { value: '{{tasks.pending}}', label: 'Pending' } });
      components.set('stat3', { id: 'stat3', type: 'Stat', props: { value: '{{tasks.streak}}', label: 'Day Streak' } });
      return {
        id: 'stats-demo',
        rootId: 'root',
        components,
        dataModel: {
          tasks: { completed: 42, pending: 7, streak: 12 }
        }
      };

    case 'list':
      components.set('root', { id: 'root', type: 'Card', props: { title: '✅ Today\'s Focus' }, children: ['list', 'progress'] });
      components.set('list', { id: 'list', type: 'List', props: { items: '{{items}}' } });
      components.set('progress', { id: 'progress', type: 'Progress', props: { value: '{{progress}}', max: 100, label: 'Daily Progress' } });
      return {
        id: 'list-demo',
        rootId: 'root',
        components,
        dataModel: {
          items: ['Review quarterly report', 'Team standup at 10am', 'Client call at 2pm', 'Code review'],
          progress: 65
        }
      };

    case 'form':
      components.set('root', { id: 'root', type: 'Column', children: ['heading', 'text', 'divider', 'buttons'] });
      components.set('heading', { id: 'heading', type: 'Heading', props: { text: '💡 Quick Action', level: 3 } });
      components.set('text', { id: 'text', type: 'Text', props: { text: 'Would you like me to schedule a follow-up meeting?' } });
      components.set('divider', { id: 'divider', type: 'Spacer', props: { size: 12 } });
      components.set('buttons', { id: 'buttons', type: 'Row', children: ['btn1', 'btn2'] });
      components.set('btn1', { id: 'btn1', type: 'Button', props: { label: 'Yes, schedule it', variant: 'primary', action: 'schedule' } });
      components.set('btn2', { id: 'btn2', type: 'Button', props: { label: 'Not now', action: 'dismiss' } });
      return {
        id: 'form-demo',
        rootId: 'root',
        components,
        dataModel: {}
      };

    case 'dashboard':
      components.set('root', { id: 'root', type: 'Column', children: ['header', 'stats', 'divider', 'activity'] });
      components.set('header', { id: 'header', type: 'Heading', props: { text: '🏛️ Agora Dashboard', level: 2 } });
      components.set('stats', { id: 'stats', type: 'Row', children: ['s1', 's2'] });
      components.set('s1', { id: 's1', type: 'Stat', props: { value: '{{agents}}', label: 'Active Agents' } });
      components.set('s2', { id: 's2', type: 'Stat', props: { value: '{{sessions}}', label: 'Sessions Today' } });
      components.set('divider', { id: 'divider', type: 'Divider' });
      components.set('activity', { id: 'activity', type: 'Card', props: { title: 'Recent Activity' }, children: ['actlist'] });
      components.set('actlist', { id: 'actlist', type: 'List', props: { items: '{{activity}}' } });
      return {
        id: 'dashboard-demo',
        rootId: 'root',
        components,
        dataModel: {
          agents: 10,
          sessions: 23,
          activity: [
            'Marcus delegated task to Achilles',
            'Seneca completed financial review',
            'Hippocrates created workout plan'
          ]
        }
      };

    case 'personal':
      components.set('root', { id: 'root', type: 'Column', children: ['header', 'status', 'agendaCard', 'habitsCard', 'actions'] });
      components.set('header', { id: 'header', type: 'Heading', props: { text: '🏡 Personal Command Center', level: 2 } });
      components.set('status', { id: 'status', type: 'KpiGrid', props: { items: '{{wellbeing}}', columns: 3 } });
      components.set('agendaCard', { id: 'agendaCard', type: 'Card', props: { title: 'Today\'s Agenda' }, children: ['agenda'] });
      components.set('agenda', { id: 'agenda', type: 'Agenda', props: { items: '{{agenda}}' } });
      components.set('habitsCard', { id: 'habitsCard', type: 'Card', props: { title: 'Habits & Follow-ups' }, children: ['habits', 'focusTags', 'habitProgress'] });
      components.set('habits', { id: 'habits', type: 'Checklist', props: { items: '{{habits}}' } });
      components.set('focusTags', { id: 'focusTags', type: 'TagList', props: { items: '{{focusAreas}}' } });
      components.set('habitProgress', { id: 'habitProgress', type: 'Progress', props: { value: '{{habitProgress}}', max: 100, label: 'Consistency' } });
      components.set('actions', { id: 'actions', type: 'ActionBar', props: { actions: '{{personalActions}}' } });
      return {
        id: 'personal-demo',
        rootId: 'root',
        components,
        dataModel: {
          wellbeing: [
            { label: 'Sleep', value: '7h 42m', delta: '+8%', tone: 'success' },
            { label: 'Workout', value: '42 min', delta: 'On Track', tone: 'info' },
            { label: 'Nutrition', value: '1,980 kcal', delta: '-3%', tone: 'warning' },
          ],
          agenda: [
            { time: '07:00', title: 'Mobility + cardio', subtitle: 'Hippocrates plan', status: 'Done' },
            { time: '12:30', title: 'Family lunch call', subtitle: 'Confucius reminder', status: 'Upcoming' },
            { time: '18:00', title: 'Review personal budget', subtitle: 'Seneca checklist', status: 'Pending' },
          ],
          habits: [
            { label: 'Hydration goal (3L)', done: true, owner: 'You' },
            { label: 'Journal reflections', done: false, owner: 'Marcus', due: 'Tonight' },
            { label: 'No-spend day', done: false, owner: 'Seneca', due: 'Today' },
          ],
          focusAreas: ['Health', 'Family', 'Finance', 'Learning'],
          habitProgress: 68,
          personalActions: [
            { label: 'Reschedule evening review', action: 'reschedule_review' },
            { label: 'Generate meal plan', action: 'generate_meal_plan', variant: 'primary' },
          ],
        },
      };

    case 'business':
      components.set('root', { id: 'root', type: 'Column', children: ['header', 'kpis', 'pipelineCard', 'financeCard', 'actions'] });
      components.set('header', { id: 'header', type: 'Heading', props: { text: '⚔️ Business Operations Deck', level: 2 } });
      components.set('kpis', { id: 'kpis', type: 'KpiGrid', props: { items: '{{businessKpis}}', columns: 4 } });
      components.set('pipelineCard', { id: 'pipelineCard', type: 'Card', props: { title: 'Execution Pipeline' }, children: ['pipelineChecklist'] });
      components.set('pipelineChecklist', { id: 'pipelineChecklist', type: 'Checklist', props: { items: '{{pipeline}}' } });
      components.set('financeCard', { id: 'financeCard', type: 'Card', props: { title: 'Finance Snapshot' }, children: ['financeTable'] });
      components.set('financeTable', { id: 'financeTable', type: 'FinanceTable', props: { rows: '{{financeRows}}', currency: 'USD' } });
      components.set('actions', { id: 'actions', type: 'ActionBar', props: { actions: '{{businessActions}}' } });
      return {
        id: 'business-demo',
        rootId: 'root',
        components,
        dataModel: {
          businessKpis: [
            { label: 'MRR', value: '$86.2k', delta: '+5.1%', tone: 'success' },
            { label: 'Gross Margin', value: '62%', delta: '+1.4%', tone: 'success' },
            { label: 'Churn', value: '2.8%', delta: '-0.6%', tone: 'success' },
            { label: 'Sales Cycle', value: '19 days', delta: '+2 days', tone: 'warning' },
          ],
          pipeline: [
            { label: 'Finalize hiring plan (HR)', done: true, owner: 'Spartacus' },
            { label: 'Ship onboarding automation', done: false, owner: 'Achilles', due: 'Tomorrow' },
            { label: 'Prepare board memo', done: false, owner: 'Leonidas', due: 'Friday' },
          ],
          financeRows: [
            { category: 'Revenue', amount: 86200, change: 5.1 },
            { category: 'Payroll', amount: 28400, change: 1.2 },
            { category: 'Infrastructure', amount: 9900, change: -3.4 },
            { category: 'Marketing', amount: 14300, change: 6.8 },
          ],
          businessActions: [
            { label: 'Open Risk Review', action: 'open_risk_review' },
            { label: 'Draft Weekly Exec Brief', action: 'draft_exec_brief', variant: 'primary' },
            { label: 'Pause Campaign', action: 'pause_campaign', variant: 'danger' },
          ],
        },
      };
  }
};

export function A2UIDemo() {
  const [activeDemo, setActiveDemo] = useState<'stats' | 'list' | 'form' | 'dashboard' | 'personal' | 'business'>('dashboard');
  const surface = createDemoSurface(activeDemo);

  return (
    <div className="space-y-4">
      {/* Demo selector */}
      <div className="flex gap-2 flex-wrap">
        {(['dashboard', 'personal', 'business', 'stats', 'list', 'form'] as const).map(demo => (
          <button
            key={demo}
            onClick={() => setActiveDemo(demo)}
            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
              activeDemo === demo 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            {demo}
          </button>
        ))}
      </div>

      {/* Render surface */}
      <div className="border border-border rounded-lg p-4 bg-background">
        <A2UIRenderer surface={surface} />
      </div>

      {/* Data model preview */}
      <details className="text-xs">
        <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
          View data model
        </summary>
        <pre className="mt-2 p-2 rounded bg-muted overflow-auto">
          {JSON.stringify(surface.dataModel, null, 2)}
        </pre>
      </details>
    </div>
  );
}
