import { useState } from 'react';
import { useReviewsForAgent } from '../../stores/reviews';
import { AGENTS } from '../../types/supabase';
import { MetricsCharts } from './MetricsCharts';
import { DomainBreakdown } from './DomainBreakdown';
import { ReviewTimeline } from './ReviewTimeline';
import { FeedbackLog } from './FeedbackLog';

interface AgentPerformanceDashboardProps {
  agentId: string;
  onReviewSelect?: (reviewId: string) => void;
}

type DashboardTab = 'metrics' | 'domains' | 'timeline' | 'feedback';

export function AgentPerformanceDashboard({ agentId, onReviewSelect }: AgentPerformanceDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('metrics');
  const reviews = useReviewsForAgent(agentId);
  const agent = AGENTS.find((a) => a.id === agentId);

  const latestFinalized = reviews.find((r) => r.status === 'finalized');
  const latestMetrics = latestFinalized?.metrics || reviews[0]?.metrics;

  const tabs: { id: DashboardTab; label: string }[] = [
    { id: 'metrics', label: 'Metrics' },
    { id: 'domains', label: 'Domains' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'feedback', label: 'Feedback' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Agent Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{agent?.emoji || '🤖'}</span>
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">{agent?.name || agentId}</h2>
            <p className="text-xs text-zinc-500">{agent?.role || 'Agent'} | {reviews.length} review(s)</p>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              activeTab === tab.id
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'metrics' && latestMetrics && (
          <MetricsCharts metrics={latestMetrics} />
        )}
        {activeTab === 'metrics' && !latestMetrics && (
          <div className="text-center text-zinc-600 py-8">
            <p className="text-sm">No metrics data available</p>
            <p className="text-xs mt-1">Start a review to collect metrics</p>
          </div>
        )}

        {activeTab === 'domains' && latestMetrics && (
          <DomainBreakdown domains={latestMetrics.domain_breakdown} />
        )}
        {activeTab === 'domains' && !latestMetrics && (
          <div className="text-center text-zinc-600 py-8">
            <p className="text-sm">No domain data available</p>
          </div>
        )}

        {activeTab === 'timeline' && (
          <ReviewTimeline reviews={reviews} onSelect={onReviewSelect} />
        )}

        {activeTab === 'feedback' && (
          <FeedbackLog reviews={reviews} />
        )}
      </div>
    </div>
  );
}
