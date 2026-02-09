import type { PerformanceReview } from '../../types/reviews';

interface ReviewTimelineProps {
  reviews: PerformanceReview[];
  onSelect?: (reviewId: string) => void;
}

const statusColors: Record<string, string> = {
  collecting: 'border-blue-500 bg-blue-500/10',
  narrative_ready: 'border-purple-500 bg-purple-500/10',
  user_review: 'border-amber-500 bg-amber-500/10',
  finalized: 'border-emerald-500 bg-emerald-500/10',
};

const statusLabels: Record<string, string> = {
  collecting: 'Collecting',
  narrative_ready: 'Narrative Ready',
  user_review: 'User Review',
  finalized: 'Finalized',
};

export function ReviewTimeline({ reviews, onSelect }: ReviewTimelineProps) {
  if (reviews.length === 0) {
    return (
      <div className="text-center text-zinc-600 py-4">
        <p className="text-sm">No reviews yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {reviews.map((review, idx) => {
        const isLast = idx === reviews.length - 1;

        return (
          <div key={review.id} className="relative flex gap-3">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-[11px] top-6 bottom-0 w-px bg-zinc-700" />
            )}
            {/* Dot */}
            <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 mt-0.5 ${statusColors[review.status] || 'border-zinc-600'}`} />
            {/* Content */}
            <button
              onClick={() => onSelect?.(review.id)}
              className="flex-1 text-left p-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-300">
                  {new Date(review.period_start).toLocaleDateString()} - {new Date(review.period_end).toLocaleDateString()}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColors[review.status] || 'bg-zinc-800 border-zinc-600'} border`}>
                  {statusLabels[review.status] || review.status}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                {review.trigger} review
                {review.ratings && ` | Overall: ${review.ratings.overall}/5`}
                {review.level_change_applied && review.new_level && ` | Level -> ${review.new_level}`}
              </p>
            </button>
          </div>
        );
      })}
    </div>
  );
}
