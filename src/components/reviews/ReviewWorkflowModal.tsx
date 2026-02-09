import { useState, useEffect } from 'react';
import { useReviewStore } from '../../stores/reviews';
import { usePerformanceReview } from '../../hooks/usePerformanceReview';
import { AGENTS } from '../../types/supabase';
import { MetricsCharts } from './MetricsCharts';
import type { ReviewRatings, StarRating, LevelRecommendation } from '../../types/reviews';

interface ReviewWorkflowModalProps {
  reviewId: string;
  onClose: () => void;
}

type WorkflowStep = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_LABELS: Record<WorkflowStep, string> = {
  1: 'Collect Metrics',
  2: 'Generate Narrative',
  3: 'Rate Performance',
  4: 'Level Decision',
  5: 'Review Feedback',
  6: 'Finalize',
};

function StarRatingInput({ value, onChange, label }: { value: StarRating; onChange: (v: StarRating) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-zinc-400">{label}</span>
      <div className="flex gap-1">
        {([1, 2, 3, 4, 5] as StarRating[]).map((star) => (
          <button
            key={star}
            onClick={() => onChange(star)}
            className={`w-7 h-7 rounded text-sm transition-colors ${
              star <= value ? 'bg-amber-500/30 text-amber-400' : 'bg-zinc-800 text-zinc-600'
            }`}
          >
            {star}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ReviewWorkflowModal({ reviewId, onClose }: ReviewWorkflowModalProps) {
  const review = useReviewStore((s) => s.reviews.find((r) => r.id === reviewId));
  const {
    collectMetrics,
    generateNarrative,
    submitRatings,
    setLevelRecommendation,
    generateFeedback,
    finalizeReview,
  } = usePerformanceReview();

  const [step, setStep] = useState<WorkflowStep>(1);
  const [loading, setLoading] = useState(false);
  const [editableNarrative, setEditableNarrative] = useState('');
  const [ratings, setRatings] = useState<ReviewRatings>({
    task_completion: 3 as StarRating,
    quality: 3 as StarRating,
    speed: 3 as StarRating,
    collaboration: 3 as StarRating,
    domain_expertise: 3 as StarRating,
    overall: 3 as StarRating,
  });
  const [userNotes, setUserNotes] = useState('');
  const [levelRec, setLevelRec] = useState<LevelRecommendation>('maintain');
  const [justification, setJustification] = useState('');
  const [editableFeedback, setEditableFeedback] = useState('');

  const agent = review ? AGENTS.find((a) => a.id === review.agent_id) : null;

  // Initialize step based on review status
  useEffect(() => {
    if (!review) return;
    switch (review.status) {
      case 'collecting': setStep(1); break;
      case 'narrative_ready': setStep(3); break;
      case 'user_review': setStep(5); break;
      case 'finalized': setStep(6); break;
    }
    if (review.narrative) setEditableNarrative(review.narrative);
    if (review.ratings) setRatings(review.ratings);
    if (review.user_notes) setUserNotes(review.user_notes);
    if (review.level_recommendation) setLevelRec(review.level_recommendation);
    if (review.level_justification) setJustification(review.level_justification);
    if (review.agent_feedback) setEditableFeedback(review.agent_feedback);
  }, [review?.id]);

  if (!review) return null;

  const handleStep1 = async () => {
    setLoading(true);
    try {
      await collectMetrics(reviewId);
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async () => {
    setLoading(true);
    try {
      const narrative = await generateNarrative(reviewId);
      setEditableNarrative(narrative);
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async () => {
    setLoading(true);
    try {
      await submitRatings(reviewId, ratings, userNotes);
      setStep(4);
    } finally {
      setLoading(false);
    }
  };

  const handleStep4 = async () => {
    setLoading(true);
    try {
      await setLevelRecommendation(reviewId, levelRec, justification);
      setStep(5);
    } finally {
      setLoading(false);
    }
  };

  const handleStep5 = async () => {
    setLoading(true);
    try {
      const feedback = await generateFeedback(reviewId);
      setEditableFeedback(feedback);
      setStep(6);
    } finally {
      setLoading(false);
    }
  };

  const handleStep6 = async () => {
    setLoading(true);
    try {
      await finalizeReview(reviewId);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Performance Review {agent ? `- ${agent.emoji} ${agent.name}` : ''}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Step {step} of 6: {STEP_LABELS[step]}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl">
            &times;
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 border-b border-zinc-800">
          <div className="flex gap-1">
            {([1, 2, 3, 4, 5, 6] as WorkflowStep[]).map((s) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  s <= step ? 'bg-amber-500' : 'bg-zinc-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Metrics Collection */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">
                Collect performance metrics for{' '}
                <span className="text-zinc-200">{agent?.name}</span> covering{' '}
                {new Date(review.period_start).toLocaleDateString()} to{' '}
                {new Date(review.period_end).toLocaleDateString()}.
              </p>
              {review.metrics.task_completion.total_assigned > 0 && (
                <MetricsCharts metrics={review.metrics} />
              )}
              <button
                onClick={handleStep1}
                disabled={loading}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? 'Collecting metrics...' : 'Collect Metrics'}
              </button>
            </div>
          )}

          {/* Step 2: Narrative Generation */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">Generate an AI performance narrative based on the collected metrics.</p>
              <MetricsCharts metrics={review.metrics} />
              <button
                onClick={handleStep2}
                disabled={loading}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? 'Generating narrative...' : 'Generate Narrative'}
              </button>
            </div>
          )}

          {/* Step 3: User Rating */}
          {step === 3 && (
            <div className="space-y-4">
              {editableNarrative && (
                <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-2">AI Narrative</h4>
                  <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">
                    {editableNarrative}
                  </pre>
                </div>
              )}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-zinc-500 uppercase">Rate Performance (1-5)</h4>
                <StarRatingInput
                  label="Task Completion"
                  value={ratings.task_completion}
                  onChange={(v) => setRatings({ ...ratings, task_completion: v })}
                />
                <StarRatingInput
                  label="Quality"
                  value={ratings.quality}
                  onChange={(v) => setRatings({ ...ratings, quality: v })}
                />
                <StarRatingInput
                  label="Speed"
                  value={ratings.speed}
                  onChange={(v) => setRatings({ ...ratings, speed: v })}
                />
                <StarRatingInput
                  label="Collaboration"
                  value={ratings.collaboration}
                  onChange={(v) => setRatings({ ...ratings, collaboration: v })}
                />
                <StarRatingInput
                  label="Domain Expertise"
                  value={ratings.domain_expertise}
                  onChange={(v) => setRatings({ ...ratings, domain_expertise: v })}
                />
                <StarRatingInput
                  label="Overall"
                  value={ratings.overall}
                  onChange={(v) => setRatings({ ...ratings, overall: v })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Notes</label>
                <textarea
                  value={userNotes}
                  onChange={(e) => setUserNotes(e.target.value)}
                  placeholder="Additional notes about this review period..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none h-20 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                onClick={handleStep3}
                disabled={loading}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? 'Saving ratings...' : 'Submit Ratings'}
              </button>
            </div>
          )}

          {/* Step 4: Level Decision */}
          {step === 4 && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase">Level Recommendation</h4>
              <div className="space-y-2">
                {(['maintain', 'promote', 'demote'] as LevelRecommendation[]).map((rec) => (
                  <label
                    key={rec}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      levelRec === rec
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="levelRec"
                      value={rec}
                      checked={levelRec === rec}
                      onChange={() => setLevelRec(rec)}
                      className="accent-amber-500"
                    />
                    <div>
                      <span className="text-sm text-zinc-200 capitalize">{rec}</span>
                      <p className="text-xs text-zinc-500">
                        {rec === 'maintain' && 'Keep current level'}
                        {rec === 'promote' && 'Advance to next level'}
                        {rec === 'demote' && 'Move down one level'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1">Justification</label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Explain your level recommendation..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none h-20 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                onClick={handleStep4}
                disabled={loading}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? 'Saving...' : 'Save Level Decision'}
              </button>
            </div>
          )}

          {/* Step 5: Feedback Preview */}
          {step === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400">Generate actionable feedback based on the review.</p>
              {editableFeedback ? (
                <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                  <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                    {editableFeedback}
                  </pre>
                </div>
              ) : null}
              <button
                onClick={handleStep5}
                disabled={loading}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? 'Generating feedback...' : 'Generate Feedback'}
              </button>
            </div>
          )}

          {/* Step 6: Finalize */}
          {step === 6 && (
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase">Review Summary</h4>

              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                  <p className="text-xs text-zinc-500">Completion Rate</p>
                  <p className="text-lg font-bold text-zinc-100">
                    {(review.metrics.task_completion.completion_rate * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                  <p className="text-xs text-zinc-500">Overall Rating</p>
                  <p className="text-lg font-bold text-amber-400">
                    {review.ratings?.overall || ratings.overall}/5
                  </p>
                </div>
                <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                  <p className="text-xs text-zinc-500">Level Decision</p>
                  <p className="text-lg font-bold text-zinc-100 capitalize">
                    {review.level_recommendation || levelRec}
                  </p>
                </div>
                <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                  <p className="text-xs text-zinc-500">Tasks Reviewed</p>
                  <p className="text-lg font-bold text-zinc-100">
                    {review.metrics.task_completion.total_assigned}
                  </p>
                </div>
              </div>

              {editableFeedback && (
                <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                  <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-2">Feedback</h4>
                  <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed max-h-40 overflow-y-auto">
                    {editableFeedback}
                  </pre>
                </div>
              )}

              {review.status === 'finalized' ? (
                <div className="text-center py-3">
                  <p className="text-sm text-emerald-400">Review finalized</p>
                </div>
              ) : (
                <button
                  onClick={handleStep6}
                  disabled={loading}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {loading ? 'Finalizing...' : 'Finalize Review'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-3 border-t border-zinc-800 flex justify-between">
          <button
            onClick={() => setStep(Math.max(1, step - 1) as WorkflowStep)}
            disabled={step === 1}
            className="px-4 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-30 transition-colors"
          >
            Back
          </button>
          <div className="text-xs text-zinc-600 flex items-center">
            Step {step}/6
          </div>
          {step < 6 && (
            <button
              onClick={() => setStep(Math.min(6, step + 1) as WorkflowStep)}
              className="px-4 py-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              Skip
            </button>
          )}
          {step === 6 && <div />}
        </div>
      </div>
    </div>
  );
}
