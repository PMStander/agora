import { useState } from 'react';
import { useReviewStore, usePendingReviews } from '../../stores/reviews';
import { AGENTS } from '../../types/supabase';
import { AgentPerformanceDashboard } from './AgentPerformanceDashboard';
import { ReviewWorkflowModal } from './ReviewWorkflowModal';
import { ReviewInitiationButton } from './ReviewInitiationButton';
import type { PerformanceReview, ReviewStatus } from '../../types/reviews';

type ViewMode = 'overview' | 'agent';

const statusBadge: Record<ReviewStatus, { label: string; className: string }> = {
  collecting: { label: 'Collecting', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  narrative_ready: { label: 'Narrative Ready', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  user_review: { label: 'Needs Review', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  finalized: { label: 'Finalized', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
};

export function PerformanceReviewPage() {
  const reviews = useReviewStore((s) => s.reviews);
  const pendingReviews = usePendingReviews();
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'all'>('all');
  const [agentFilter, setAgentFilter] = useState<string | 'all'>('all');

  const filteredReviews = reviews.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (agentFilter !== 'all' && r.agent_id !== agentFilter) return false;
    return true;
  });

  const handleReviewClick = (review: PerformanceReview) => {
    setActiveWorkflowId(review.id);
  };

  const handleAgentClick = (agentId: string) => {
    setSelectedAgentId(agentId);
    setViewMode('agent');
  };

  // Get unique agents that have reviews
  const agentsWithReviews = [...new Set(reviews.map((r) => r.agent_id))];

  if (viewMode === 'agent' && selectedAgentId) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
          <button
            onClick={() => setViewMode('overview')}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            &larr; Back to Overview
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <AgentPerformanceDashboard
            agentId={selectedAgentId}
            onReviewSelect={(id) => setActiveWorkflowId(id)}
          />
        </div>

        {activeWorkflowId && (
          <ReviewWorkflowModal
            reviewId={activeWorkflowId}
            onClose={() => setActiveWorkflowId(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Performance Reviews</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {pendingReviews.length} pending | {reviews.length} total
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="px-6 py-4 border-b border-zinc-800">
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
            <p className="text-xs text-zinc-500">Pending Reviews</p>
            <p className="text-2xl font-bold text-amber-400">{pendingReviews.length}</p>
          </div>
          <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
            <p className="text-xs text-zinc-500">Finalized</p>
            <p className="text-2xl font-bold text-emerald-400">
              {reviews.filter((r) => r.status === 'finalized').length}
            </p>
          </div>
          <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
            <p className="text-xs text-zinc-500">Agents Reviewed</p>
            <p className="text-2xl font-bold text-zinc-100">{agentsWithReviews.length}</p>
          </div>
          <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
            <p className="text-xs text-zinc-500">Level Changes</p>
            <p className="text-2xl font-bold text-purple-400">
              {reviews.filter((r) => r.level_change_applied).length}
            </p>
          </div>
        </div>
      </div>

      {/* Agent Quick Access */}
      <div className="px-6 py-3 border-b border-zinc-800">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase mb-2">Agents</h3>
        <div className="flex flex-wrap gap-2">
          {AGENTS.map((agent) => (
            <div key={agent.id} className="flex items-center gap-1.5">
              <button
                onClick={() => handleAgentClick(agent.id)}
                title={agent.role}
                className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 hover:bg-zinc-800 rounded text-xs text-zinc-300 transition-colors"
              >
                <span>{agent.emoji}</span>
                <span>{agent.name}</span>
              </button>
              <ReviewInitiationButton agentId={agent.id} compact />
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-2 border-b border-zinc-800 flex gap-3 items-center">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ReviewStatus | 'all')}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="collecting">Collecting</option>
          <option value="narrative_ready">Narrative Ready</option>
          <option value="user_review">Needs Review</option>
          <option value="finalized">Finalized</option>
        </select>
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none"
        >
          <option value="all">All Agents</option>
          {AGENTS.map((a) => (
            <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
          ))}
        </select>
        <span className="text-xs text-zinc-600">{filteredReviews.length} review(s)</span>
      </div>

      {/* Review List */}
      <div className="flex-1 overflow-y-auto px-6 py-3">
        {filteredReviews.length === 0 ? (
          <div className="text-center text-zinc-600 py-12">
            <p className="text-sm">No reviews found</p>
            <p className="text-xs mt-1">Click "Start Review" on an agent to begin</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredReviews.map((review) => {
              const agent = AGENTS.find((a) => a.id === review.agent_id);
              const badge = statusBadge[review.status];

              return (
                <button
                  key={review.id}
                  onClick={() => handleReviewClick(review)}
                  className="w-full text-left p-3 bg-zinc-800/30 hover:bg-zinc-800/60 rounded-lg border border-zinc-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{agent?.emoji || '🤖'}</span>
                      <div>
                        <p className="text-sm text-zinc-200">{agent?.name || review.agent_id}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(review.period_start).toLocaleDateString()} -{' '}
                          {new Date(review.period_end).toLocaleDateString()} | {review.trigger}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {review.ratings && (
                        <span className="text-xs text-amber-400">{review.ratings.overall}/5</span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Workflow Modal */}
      {activeWorkflowId && (
        <ReviewWorkflowModal
          reviewId={activeWorkflowId}
          onClose={() => setActiveWorkflowId(null)}
        />
      )}
    </div>
  );
}
