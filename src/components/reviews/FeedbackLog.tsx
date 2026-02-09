import type { PerformanceReview } from '../../types/reviews';

interface FeedbackLogProps {
  reviews: PerformanceReview[];
}

export function FeedbackLog({ reviews }: FeedbackLogProps) {
  const reviewsWithFeedback = reviews.filter((r) => r.agent_feedback);

  if (reviewsWithFeedback.length === 0) {
    return (
      <div className="text-center text-zinc-600 py-4">
        <p className="text-sm">No feedback entries yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviewsWithFeedback.map((review) => (
        <div key={review.id} className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-500">
              {review.finalized_at
                ? new Date(review.finalized_at).toLocaleDateString()
                : new Date(review.created_at).toLocaleDateString()}
            </span>
            {review.ratings && (
              <span className="text-xs text-amber-400">
                Overall: {review.ratings.overall}/5
              </span>
            )}
          </div>
          <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
            {review.agent_feedback}
          </pre>
        </div>
      ))}
    </div>
  );
}
