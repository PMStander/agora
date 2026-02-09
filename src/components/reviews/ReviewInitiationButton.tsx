import { useState } from 'react';
import { usePerformanceReview } from '../../hooks/usePerformanceReview';
import { useReviewStore } from '../../stores/reviews';
import { ReviewWorkflowModal } from './ReviewWorkflowModal';

interface ReviewInitiationButtonProps {
  agentId: string;
  compact?: boolean;
}

export function ReviewInitiationButton({ agentId, compact = false }: ReviewInitiationButtonProps) {
  const [loading, setLoading] = useState(false);
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const { createReview } = usePerformanceReview();

  const handleStart = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const periodEnd = now.toISOString();
      const periodStart = new Date(now.getTime() - 30 * 86400000).toISOString();
      const review = await createReview(agentId, 'manual', periodStart, periodEnd);
      useReviewStore.getState().setActiveReview(review.id);
      setActiveReviewId(review.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleStart}
        disabled={loading}
        className={`${
          compact
            ? 'px-2 py-1 text-xs'
            : 'px-3 py-1.5 text-sm'
        } bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 disabled:opacity-50 rounded-lg font-medium transition-colors`}
      >
        {loading ? 'Starting...' : 'Start Review'}
      </button>

      {activeReviewId && (
        <ReviewWorkflowModal
          reviewId={activeReviewId}
          onClose={() => setActiveReviewId(null)}
        />
      )}
    </>
  );
}
