import { useState } from 'react';
import { useActiveAgent } from '../../stores/agents';
import { DailyNotesTab } from './DailyNotesTab';
import { LongTermMemoryTab } from './LongTermMemoryTab';
import { ProjectContextsTab } from './ProjectContextsTab';
import { SemanticSearchTab } from './SemanticSearchTab';
import { LearnedPatternsTab } from './LearnedPatternsTab';
import { PrioritiesTab } from './PrioritiesTab';
import { SummariesTab } from './SummariesTab';

type MemoryTab = 'search' | 'daily' | 'longterm' | 'patterns' | 'priorities' | 'summaries' | 'projects';

const tabs: { key: MemoryTab; label: string }[] = [
  { key: 'search', label: 'Search' },
  { key: 'daily', label: 'Daily Notes' },
  { key: 'longterm', label: 'Long-term' },
  { key: 'patterns', label: 'Patterns' },
  { key: 'priorities', label: 'Priorities' },
  { key: 'summaries', label: 'Summaries' },
  { key: 'projects', label: 'Contexts' },
];

export function MemoryViewer() {
  const activeAgent = useActiveAgent();
  const [activeTab, setActiveTab] = useState<MemoryTab>('search');
  const agentId = activeAgent?.id || '';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-200">
            Agent Memory
            {activeAgent && (
              <span className="text-zinc-500 font-normal ml-1">
                - {activeAgent.name}
              </span>
            )}
          </h2>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap gap-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                activeTab === key
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'search' && <SemanticSearchTab agentId={agentId} />}
        {activeTab === 'daily' && <DailyNotesTab agentId={agentId} />}
        {activeTab === 'longterm' && <LongTermMemoryTab agentId={agentId} />}
        {activeTab === 'patterns' && <LearnedPatternsTab agentId={agentId} />}
        {activeTab === 'priorities' && <PrioritiesTab agentId={agentId} />}
        {activeTab === 'summaries' && <SummariesTab agentId={agentId} />}
        {activeTab === 'projects' && <ProjectContextsTab agentId={agentId} />}
      </div>
    </div>
  );
}
