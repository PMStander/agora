import { useCallback, useEffect, useRef } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useReviewStore } from '../stores/reviews';
import { useMissionControlStore } from '../stores/missionControl';
import type {
  PerformanceReview,
  ReviewMetrics,
  ReviewRatings,
  ReviewTrigger,
  LevelRecommendation,
  TaskCompletionMetrics,
  QualityMetrics,
  SpeedMetrics,
  CollaborationMetrics,
  DomainPerformance,
  GuardrailMetrics,
  ReviewSchedule,
} from '../types/reviews';
import { AGENTS } from '../types/supabase';

function generateId(): string {
  return `review-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function agentDisplay(agentId: string) {
  const agent = AGENTS.find((a) => a.id === agentId);
  return agent
    ? { id: agent.id, name: agent.name, emoji: agent.emoji }
    : { id: agentId, name: agentId, emoji: '🤖' };
}

function addActivity(type: string, message: string, agentId?: string) {
  useMissionControlStore.getState().addActivity({
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    message,
    agent: agentId ? agentDisplay(agentId) : null,
    created_at: new Date().toISOString(),
  });
}

export function usePerformanceReview() {
  const initializedRef = useRef(false);

  // Step 1: Create a new review
  const createReview = useCallback(async (
    agentId: string,
    trigger: ReviewTrigger,
    periodStart: string,
    periodEnd: string,
  ): Promise<PerformanceReview> => {
    const now = new Date().toISOString();
    const review: PerformanceReview = {
      id: generateId(),
      agent_id: agentId,
      trigger,
      status: 'collecting',
      period_start: periodStart,
      period_end: periodEnd,
      metrics: {
        period_start: periodStart,
        period_end: periodEnd,
        task_completion: { total_assigned: 0, completed: 0, failed: 0, timed_out: 0, completion_rate: 0 },
        quality: { review_pass_rate: 0, avg_revision_rounds: 0, proof_verified_rate: 0 },
        speed: { avg_completion_minutes: 0, avg_vs_estimate_ratio: 1, fastest_task_minutes: 0, slowest_task_minutes: 0 },
        collaboration: { handoffs_initiated: 0, handoffs_received: 0, handoff_success_rate: 0, help_provided_count: 0, cross_team_collaborations: 0 },
        domain_breakdown: [],
        guardrails: { violations: 0, near_misses: 0, compliance_rate: 1 },
      },
      narrative: null,
      ratings: null,
      user_notes: null,
      level_recommendation: null,
      level_justification: null,
      agent_feedback: null,
      level_change_applied: false,
      previous_level: null,
      new_level: null,
      created_at: now,
      finalized_at: null,
    };

    useReviewStore.getState().addReview(review);
    addActivity('review_started', `Performance review started for ${agentDisplay(agentId).name}`, agentId);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('performance_reviews').insert(review);
      } catch {
        // Ignore errors, local state is already updated
      }
    }

    return review;
  }, []);

  // Step 1b: Collect metrics from missions/tasks for the review period
  const collectMetrics = useCallback(async (reviewId: string): Promise<ReviewMetrics> => {
    const store = useReviewStore.getState();
    const review = store.reviews.find((r) => r.id === reviewId);
    if (!review) throw new Error('Review not found');

    const { missions, tasks } = useMissionControlStore.getState();
    const periodStart = new Date(review.period_start).getTime();
    const periodEnd = new Date(review.period_end).getTime();

    // Filter missions/tasks for this agent in period
    const agentMissions = missions.filter((m) => {
      const completedAt = m.completed_at ? new Date(m.completed_at).getTime() : 0;
      const createdAt = new Date(m.created_at).getTime();
      return m.agent_id === review.agent_id &&
        ((completedAt >= periodStart && completedAt <= periodEnd) ||
         (createdAt >= periodStart && createdAt <= periodEnd));
    });

    const agentTasks = tasks.filter((t) => {
      const createdAt = new Date(t.created_at).getTime();
      return t.primary_agent_id === review.agent_id &&
        createdAt >= periodStart && createdAt <= periodEnd;
    });

    // TaskCompletionMetrics
    const totalAssigned = agentMissions.length || agentTasks.length;
    const completed = agentMissions.filter((m) => m.status === 'done').length ||
      agentTasks.filter((t) => t.status === 'done').length;
    const failed = agentMissions.filter((m) => m.status === 'failed').length ||
      agentTasks.filter((t) => t.status === 'failed').length;
    const timedOut = agentTasks.filter((t) =>
      t.status === 'failed' && t.error_message?.toLowerCase().includes('timeout')
    ).length;

    const taskCompletion: TaskCompletionMetrics = {
      total_assigned: totalAssigned,
      completed,
      failed,
      timed_out: timedOut,
      completion_rate: totalAssigned > 0 ? completed / totalAssigned : 0,
    };

    // QualityMetrics
    const reviewedTasks = agentTasks.filter((t) => t.review_enabled && t.status === 'done');
    const firstPassTasks = reviewedTasks.filter((t) => t.revision_round === 0);
    const revisionRounds = reviewedTasks.map((t) => t.revision_round);
    const avgRevisionRounds = revisionRounds.length > 0
      ? revisionRounds.reduce((a, b) => a + b, 0) / revisionRounds.length
      : 0;

    const quality: QualityMetrics = {
      review_pass_rate: reviewedTasks.length > 0 ? firstPassTasks.length / reviewedTasks.length : 0,
      avg_revision_rounds: avgRevisionRounds,
      proof_verified_rate: 0, // Would be computed from parseMissionProofReport
    };

    // SpeedMetrics
    const durations = agentMissions
      .filter((m) => m.started_at && m.completed_at)
      .map((m) => (new Date(m.completed_at!).getTime() - new Date(m.started_at!).getTime()) / 60000);

    const speed: SpeedMetrics = {
      avg_completion_minutes: durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0,
      avg_vs_estimate_ratio: 1,
      fastest_task_minutes: durations.length > 0 ? Math.min(...durations) : 0,
      slowest_task_minutes: durations.length > 0 ? Math.max(...durations) : 0,
    };

    // CollaborationMetrics (placeholder - handoff_requests table would be queried in real scenario)
    const collaboration: CollaborationMetrics = {
      handoffs_initiated: 0,
      handoffs_received: 0,
      handoff_success_rate: 0,
      help_provided_count: 0,
      cross_team_collaborations: 0,
    };

    // DomainPerformance
    const domainMap = new Map<string, { completed: number; total: number }>();
    for (const m of agentMissions) {
      const domains = m.domains || [];
      for (const d of domains) {
        const entry = domainMap.get(d) || { completed: 0, total: 0 };
        entry.total++;
        if (m.status === 'done') entry.completed++;
        domainMap.set(d, entry);
      }
    }
    const domainBreakdown: DomainPerformance[] = Array.from(domainMap.entries()).map(([domain, stats]) => ({
      domain,
      tasks_completed: stats.completed,
      avg_quality_score: stats.total > 0 ? stats.completed / stats.total : 0,
      avg_speed_ratio: 1,
    }));

    // GuardrailMetrics (placeholder - guardrail_violations would be queried)
    const guardrails: GuardrailMetrics = {
      violations: 0,
      near_misses: 0,
      compliance_rate: totalAssigned > 0 ? 1 : 1,
    };

    const metrics: ReviewMetrics = {
      period_start: review.period_start,
      period_end: review.period_end,
      task_completion: taskCompletion,
      quality,
      speed,
      collaboration,
      domain_breakdown: domainBreakdown,
      guardrails,
    };

    useReviewStore.getState().updateReview(reviewId, { metrics, status: 'collecting' });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('performance_reviews')
          .update({ metrics, status: 'collecting' })
          .eq('id', reviewId);
      } catch {
        // Ignore errors, local state is already updated
      }
    }

    return metrics;
  }, []);

  // Step 2: Generate narrative (mock LLM call - in real scenario would call OpenClaw)
  const generateNarrative = useCallback(async (reviewId: string): Promise<string> => {
    const review = useReviewStore.getState().reviews.find((r) => r.id === reviewId);
    if (!review) throw new Error('Review not found');

    const agent = agentDisplay(review.agent_id);
    const m = review.metrics;
    const narrative = [
      `Performance Review for ${agent.name}`,
      `Period: ${new Date(m.period_start).toLocaleDateString()} - ${new Date(m.period_end).toLocaleDateString()}`,
      '',
      `${agent.name} completed ${m.task_completion.completed} of ${m.task_completion.total_assigned} assigned tasks (${(m.task_completion.completion_rate * 100).toFixed(0)}% completion rate).`,
      '',
      m.task_completion.failed > 0
        ? `There were ${m.task_completion.failed} failed task(s) during this period that warrant attention.`
        : 'No task failures were recorded during this period.',
      '',
      m.quality.review_pass_rate > 0
        ? `Quality: ${(m.quality.review_pass_rate * 100).toFixed(0)}% first-pass review approval rate with an average of ${m.quality.avg_revision_rounds.toFixed(1)} revision rounds.`
        : 'Quality metrics are pending more reviewed tasks.',
      '',
      m.speed.avg_completion_minutes > 0
        ? `Speed: Average task completion time of ${m.speed.avg_completion_minutes.toFixed(0)} minutes (fastest: ${m.speed.fastest_task_minutes.toFixed(0)}min, slowest: ${m.speed.slowest_task_minutes.toFixed(0)}min).`
        : 'Speed metrics are pending completed tasks with timing data.',
      '',
      m.domain_breakdown.length > 0
        ? `Domain expertise spans ${m.domain_breakdown.map((d) => d.domain).join(', ')}.`
        : 'No domain-specific data available yet.',
      '',
      `Guardrail compliance rate: ${(m.guardrails.compliance_rate * 100).toFixed(0)}%.`,
    ].join('\n');

    useReviewStore.getState().updateReview(reviewId, {
      narrative,
      status: 'narrative_ready',
    });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('performance_reviews')
          .update({ narrative, status: 'narrative_ready' })
          .eq('id', reviewId);
      } catch {
        // Ignore errors, local state is already updated
      }
    }

    return narrative;
  }, []);

  // Step 3: Submit user ratings
  const submitRatings = useCallback(async (
    reviewId: string,
    ratings: ReviewRatings,
    userNotes: string,
  ) => {
    useReviewStore.getState().updateReview(reviewId, {
      ratings,
      user_notes: userNotes,
      status: 'user_review',
    });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('performance_reviews')
          .update({ ratings, user_notes: userNotes, status: 'user_review' })
          .eq('id', reviewId);
      } catch {
        // Ignore errors, local state is already updated
      }
    }
  }, []);

  // Step 4: Set level recommendation
  const setLevelRecommendation = useCallback(async (
    reviewId: string,
    recommendation: LevelRecommendation,
    justification: string,
  ) => {
    useReviewStore.getState().updateReview(reviewId, {
      level_recommendation: recommendation,
      level_justification: justification,
    });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('performance_reviews')
          .update({ level_recommendation: recommendation, level_justification: justification })
          .eq('id', reviewId);
      } catch {
        // Ignore errors, local state is already updated
      }
    }
  }, []);

  // Step 5: Generate feedback
  const generateFeedback = useCallback(async (reviewId: string): Promise<string> => {
    const review = useReviewStore.getState().reviews.find((r) => r.id === reviewId);
    if (!review) throw new Error('Review not found');

    const agent = agentDisplay(review.agent_id);
    const r = review.ratings;

    const feedback = [
      `Feedback for ${agent.name}:`,
      '',
      '## Strengths',
      r && r.overall >= 4
        ? `- Strong overall performance rated ${r.overall}/5.`
        : '- Consistent effort across assigned tasks.',
      r && r.task_completion >= 4
        ? `- Excellent task completion rate.`
        : '',
      r && r.collaboration >= 4
        ? `- Outstanding collaboration with team members.`
        : '',
      '',
      '## Areas for Improvement',
      r && r.speed <= 2
        ? '- Task completion speed needs improvement. Consider breaking tasks into smaller chunks.'
        : '',
      r && r.quality <= 2
        ? '- Work quality needs attention. Aim for fewer revision rounds.'
        : '',
      review.metrics.task_completion.failed > 0
        ? `- Address the ${review.metrics.task_completion.failed} task failure(s) from this period.`
        : '',
      '',
      '## Directives',
      review.level_recommendation === 'promote'
        ? `- Continue current trajectory for level advancement.`
        : review.level_recommendation === 'demote'
        ? '- Focus on core competencies and reducing errors.'
        : '- Maintain current performance level and seek growth opportunities.',
      '',
      review.user_notes ? `## Additional Notes\n${review.user_notes}` : '',
    ].filter(Boolean).join('\n');

    useReviewStore.getState().updateReview(reviewId, { agent_feedback: feedback });

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('performance_reviews')
          .update({ agent_feedback: feedback })
          .eq('id', reviewId);
      } catch {
        // Ignore errors, local state is already updated
      }
    }

    return feedback;
  }, []);

  // Step 6: Finalize review
  const finalizeReview = useCallback(async (reviewId: string) => {
    const review = useReviewStore.getState().reviews.find((r) => r.id === reviewId);
    if (!review) throw new Error('Review not found');

    const now = new Date().toISOString();
    const agent = agentDisplay(review.agent_id);
    const levelChangeApplied = review.level_recommendation !== 'maintain' && review.level_recommendation !== null;

    const updates: Partial<PerformanceReview> = {
      status: 'finalized',
      finalized_at: now,
      level_change_applied: levelChangeApplied,
    };

    if (levelChangeApplied) {
      const previousLevel = review.previous_level ?? 1;
      const newLevel = review.level_recommendation === 'promote'
        ? Math.min(4, previousLevel + 1)
        : Math.max(1, previousLevel - 1);
      updates.previous_level = previousLevel;
      updates.new_level = newLevel;

      addActivity(
        'level_changed',
        `${agent.name} ${review.level_recommendation === 'promote' ? 'promoted' : 'demoted'} from Level ${previousLevel} to Level ${newLevel}`,
        review.agent_id,
      );
    }

    useReviewStore.getState().updateReview(reviewId, updates);
    addActivity('review_finalized', `Performance review finalized for ${agent.name}`, review.agent_id);

    if (isSupabaseConfigured()) {
      try {
        await supabase.from('performance_reviews')
          .update(updates)
          .eq('id', reviewId);
      } catch {
        // Ignore errors, local state is already updated
      }
    }
  }, []);

  // Fetch reviews for a specific agent
  const getReviewsForAgent = useCallback(async (agentId: string) => {
    if (!isSupabaseConfigured()) {
      return useReviewStore.getState().reviews.filter((r) => r.agent_id === agentId);
    }

    const { data } = await supabase
      .from('performance_reviews')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (data) {
      const store = useReviewStore.getState();
      for (const r of data) {
        store.addReview(r as PerformanceReview);
      }
    }

    return useReviewStore.getState().reviews.filter((r) => r.agent_id === agentId);
  }, []);

  // Fetch all pending reviews
  const getPendingReviews = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      return useReviewStore.getState().reviews.filter((r) => r.status !== 'finalized');
    }

    const { data } = await supabase
      .from('performance_reviews')
      .select('*')
      .neq('status', 'finalized')
      .order('created_at', { ascending: false });

    if (data) {
      const store = useReviewStore.getState();
      for (const r of data) {
        store.addReview(r as PerformanceReview);
      }
    }

    return useReviewStore.getState().reviews.filter((r) => r.status !== 'finalized');
  }, []);

  // Check review schedules
  const checkReviewSchedules = useCallback(async () => {
    const schedules = useReviewStore.getState().reviewSchedules;
    const now = Date.now();

    for (const schedule of schedules) {
      if (!schedule.enabled) continue;
      const nextAt = new Date(schedule.next_review_at).getTime();
      if (nextAt > now) continue;

      // Create auto-scheduled review
      const periodEnd = new Date().toISOString();
      const periodDays = schedule.cadence === 'weekly' ? 7 : schedule.cadence === 'monthly' ? 30 : 90;
      const periodStart = new Date(now - periodDays * 86400000).toISOString();

      await createReview(schedule.agent_id, 'scheduled', periodStart, periodEnd);

      // Update next_review_at
      const nextReviewMs = now + periodDays * 86400000;
      const updatedSchedule: Partial<ReviewSchedule> = {
        next_review_at: new Date(nextReviewMs).toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured()) {
        try {
          await supabase.from('review_schedules')
            .update(updatedSchedule)
            .eq('id', schedule.id);
        } catch {
          // Ignore errors
        }
      }
    }
  }, [createReview]);

  // Load schedules and subscribe to realtime
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (!isSupabaseConfigured()) return;

    // Load existing reviews
    supabase
      .from('performance_reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) useReviewStore.getState().setReviews(data as PerformanceReview[]);
      });

    // Load schedules
    supabase
      .from('review_schedules')
      .select('*')
      .eq('enabled', true)
      .then(({ data }) => {
        if (data) useReviewStore.getState().setSchedules(data as ReviewSchedule[]);
      });

    // Realtime subscription
    const channel = supabase
      .channel('performance-reviews-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'performance_reviews' },
        (payload) => {
          const review = payload.new as PerformanceReview;
          if (payload.eventType === 'DELETE') return;
          useReviewStore.getState().addReview(review);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      initializedRef.current = false;
    };
  }, []);

  return {
    createReview,
    collectMetrics,
    generateNarrative,
    submitRatings,
    setLevelRecommendation,
    generateFeedback,
    finalizeReview,
    getReviewsForAgent,
    getPendingReviews,
    checkReviewSchedules,
  };
}
