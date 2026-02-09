import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PerformanceReview, ReviewSchedule } from '../types/reviews';

interface ReviewState {
  reviews: PerformanceReview[];
  activeReviewId: string | null;
  reviewSchedules: ReviewSchedule[];

  setReviews: (reviews: PerformanceReview[]) => void;
  addReview: (review: PerformanceReview) => void;
  updateReview: (id: string, updates: Partial<PerformanceReview>) => void;
  setActiveReview: (id: string | null) => void;
  setSchedules: (schedules: ReviewSchedule[]) => void;
}

const REVIEW_STORAGE_KEY = 'agora-reviews-v1';

export const useReviewStore = create<ReviewState>()(persist((set) => ({
  reviews: [],
  activeReviewId: null,
  reviewSchedules: [],

  setReviews: (reviews) => set({ reviews }),

  addReview: (review) =>
    set((state) => {
      const idx = state.reviews.findIndex((r) => r.id === review.id);
      if (idx === -1) return { reviews: [review, ...state.reviews] };
      const reviews = [...state.reviews];
      reviews[idx] = { ...reviews[idx], ...review };
      return { reviews };
    }),

  updateReview: (id, updates) =>
    set((state) => ({
      reviews: state.reviews.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    })),

  setActiveReview: (id) => set({ activeReviewId: id }),

  setSchedules: (schedules) => set({ reviewSchedules: schedules }),
}), {
  name: REVIEW_STORAGE_KEY,
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    reviews: state.reviews,
    activeReviewId: state.activeReviewId,
    reviewSchedules: state.reviewSchedules,
  }),
}));

// Selectors
export const useActiveReview = () => {
  const reviews = useReviewStore((s) => s.reviews);
  const activeReviewId = useReviewStore((s) => s.activeReviewId);
  return reviews.find((r) => r.id === activeReviewId) || null;
};

export const useReviewsForAgent = (agentId: string) => {
  const reviews = useReviewStore((s) => s.reviews);
  return reviews.filter((r) => r.agent_id === agentId);
};

export const usePendingReviews = () => {
  const reviews = useReviewStore((s) => s.reviews);
  return reviews.filter((r) => r.status !== 'finalized');
};
