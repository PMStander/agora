# Performance Review & Shared Context System -- Design Document

## Overview

Two interconnected systems that close the feedback loop on agent performance and enable knowledge sharing across the multi-agent roster.

**System A** -- Performance Reviews: Collect metrics from missions/tasks, generate AI narratives, accept user ratings, produce level recommendations, and store feedback in agent profiles.

**System B** -- Shared Context: Per-project knowledge containers, a searchable agent registry, structured handoff protocol, and three-tier memory (daily notes, long-term, project).

---

## A. Performance Review System

### A.1 Review Triggers

| Trigger | Source | Condition |
|---------|--------|-----------|
| `manual` | User clicks "Start Review" on agent profile | Immediate |
| `scheduled` | `review_schedules` table, checked by `useMissionScheduler` tick | `next_review_at <= now()` |
| `milestone` | Activity feed listener in `useMissionControl` | Agent's `total_missions_completed` crosses `milestone_threshold` |
| `alert` | Post-task quality check in `useAgentRun` | Rolling `avg_quality_score` drops below `quality_alert_threshold` |

### A.2 Review Workflow (6 Steps)

```
[Trigger fires]
    |
    v
Step 1: COLLECTING
    - Query missions/tasks for period (period_start..period_end)
    - Compute TaskCompletionMetrics, QualityMetrics, SpeedMetrics,
      CollaborationMetrics, DomainPerformance[], GuardrailMetrics
    - Store as metrics JSONB on performance_reviews row
    |
    v
Step 2: NARRATIVE_READY
    - Send metrics + recent activity log to LLM
    - Prompt: "Generate a performance narrative for {agent.name} ({agent.role})
      covering {period}. Metrics: {metrics}. Be specific, cite examples."
    - Store narrative TEXT on review row
    |
    v
Step 3: USER_REVIEW
    - Present dashboard: metrics charts + narrative + rating sliders
    - User fills in ratings (1-5 stars per category), user_notes
    - User selects level_recommendation: maintain | promote | demote
    - User writes level_justification
    |
    v
Step 4: LEVEL DECISION
    - If promote/demote: compute new_level = previous_level +/- 1
    - Validate against leveling framework constraints (from Task #2)
    - Store level_recommendation + level_justification
    |
    v
Step 5: FEEDBACK GENERATION
    - Send metrics + ratings + user_notes to LLM
    - Prompt: "Generate actionable feedback for {agent.name}.
      Strengths: ..., Areas for improvement: ..., Specific directives: ..."
    - Store agent_feedback on review row
    - Insert rows into agent_feedback table (type = review_summary, praise,
      improvement_area, directive)
    |
    v
Step 6: FINALIZE
    - If level change approved:
      - Insert level_changes row
      - Update agents.level
      - Emit activity: "Leonidas promoted to Level 3"
    - Set review.status = 'finalized', finalized_at = now()
    - Update review_schedules.next_review_at for next cadence
```

### A.3 Metrics Collection Logic

**Source data**: `missions` table filtered by `agent_id` and `period_start <= completed_at <= period_end`.

```
TaskCompletionMetrics:
  total_assigned  = COUNT(missions WHERE agent_id = X AND created_at in period)
  completed       = COUNT(... AND status = 'done')
  failed          = COUNT(... AND status = 'failed')
  timed_out       = COUNT(... AND status = 'failed' AND error like '%timeout%')
  completion_rate = completed / total_assigned

QualityMetrics:
  review_pass_rate     = COUNT(missions WHERE revision_round = 0 AND status = 'done')
                         / COUNT(missions WHERE review_enabled = true AND status = 'done')
  avg_revision_rounds  = AVG(revision_round) for reviewed missions
  proof_verified_rate  = parsed from output_text using parseMissionProofReport()
                         COUNT(state = 'verified') / COUNT(requiresProof = true)

SpeedMetrics:
  For each mission with started_at and completed_at:
    duration_minutes = (completed_at - started_at) / 60000
  avg_completion_minutes = AVG(duration_minutes)
  Compare against estimated durations (future: store on mission/task)

CollaborationMetrics:
  handoffs_initiated  = COUNT(handoff_requests WHERE requesting_agent_id = X in period)
  handoffs_received   = COUNT(handoff_requests WHERE target_agent_id = X in period)
  handoff_success_rate = COUNT(... status = 'completed') / COUNT(total)
  help_provided_count = handoffs_received with status = 'completed'
  cross_team_collaborations = COUNT(handoffs WHERE teams differ)

DomainPerformance[]:
  Group missions by domains[], compute per-domain completion rate + quality.

GuardrailMetrics:
  violations  = COUNT(mission_logs WHERE type = 'guardrail_violation' AND agent_id = X)
  near_misses = COUNT(mission_logs WHERE type = 'guardrail_warning' AND agent_id = X)
  compliance_rate = 1 - (violations / total_assigned)
```

### A.4 Integration with Existing Systems

**Proof System** (`src/lib/missionProof.ts`, `src/lib/proofGenerator.ts`):
- `parseMissionProofReport(mission.output_text)` extracts proof state
- QualityMetrics.proof_verified_rate counts verified proofs in the period
- The existing `MissionProofAssessment.state` directly maps: `verified` = pass, `missing`/`invalid` = fail

**Activity Feed** (`src/components/mission-control/ActivityFeed.tsx`):
- New activity types to add to `activityIcons`:
  - `review_started`: Review initiated for agent
  - `review_finalized`: Review completed with outcome
  - `level_changed`: Agent promoted/demoted
  - `feedback_posted`: New feedback entry for agent
  - `handoff_requested`: Agent requested help
  - `handoff_completed`: Handoff resolved
  - `context_updated`: Project context document updated
  - `insight_flagged`: Cross-project insight detected

**Mission Control Store** (`src/stores/missionControl.ts`):
- The scheduler tick loop (`schedulerForceTickVersion`) already runs periodic checks
- Add review schedule checking to the same tick: if any `review_schedules.next_review_at <= now()`, auto-create a review

**Agent Store** (`src/stores/agents.ts`):
- Extend `Agent` interface with `level`, `skills`, `availability`, `totalMissionsCompleted`, `avgQualityScore`
- These sync from the DB `agents` table columns added in the migration

---

## B. Shared Context System

### B.1 Project Context Structure

Each mission (or future project) gets a `project_contexts` row. Under it:

```
project_contexts (id, project_id, title)
  |
  +-- context_access[]        -- ACCESS.md equivalent
  |     (agent_id, access_level: read|write|admin)
  |
  +-- context_documents[]     -- living documents
  |     doc_type = 'context'  -- CONTEXT.md: learnings, decisions, state
  |     doc_type = 'research' -- research/: supporting docs
  |     doc_type = 'decision_log' -- chronological decisions
  |     doc_type = 'access'   -- rendered ACCESS.md view
  |
  +-- context_revisions[]     -- append-only edit history per document
        (agent_id, diff_summary, content_snapshot, version)
```

**Auto-creation**: When a mission transitions to `in_progress`, create a `project_contexts` row + a default `context` document + grant `write` access to the assigned agent and `read` to all same-team agents.

**Document header**: Each context document renders a "Last updated by {Agent Name} at {timestamp}" header derived from `last_updated_by_agent_id` + `updated_at`.

### B.2 Context Conflict Resolution

When two agents attempt to update the same `context_documents` row:
1. Each update includes the `version` the agent read
2. On save, check: `WHERE id = X AND version = expected_version`
3. If version mismatch (0 rows updated): return conflict error
4. UI shows diff between the two versions and lets user/agent merge
5. Simple strategy for automated merges: append-only sections (each agent writes under a `## {Agent Name} Notes` heading, reducing conflicts)

### B.3 Agent Registry

Extends the existing `agents` DB table with new columns (see migration). The `AgentRegistryEntry` type maps 1:1 to the agents table row.

**"Find an Expert" query**:
```sql
SELECT * FROM agents
WHERE domains @> ARRAY['marketing']
  OR skills @> ARRAY['seo']
ORDER BY avg_quality_score DESC, level DESC
LIMIT 5;
```

This is exposed via a `useAgentRegistry()` hook with a `findExpert(domain: string)` method.

### B.4 Handoff Protocol

```
Agent A encounters domain outside its expertise
    |
    v
1. REQUESTED: Agent A creates handoff_request
   (reason, context_summary, priority, target_agent_id)
   Target found via findExpert() or manual selection
    |
    v
2. ACCEPTED: Target agent B picks up the handoff
   accepted_at = now(), status = 'accepted'
    |
    v
3. IN_PROGRESS: Agent B works on the sub-problem
   Context from context_summary + linked task/mission
    |
    v
4. COMPLETED: Agent B posts outcome
   outcome = "...", time_taken_minutes = X, status = 'completed'
   |-- OR --
4b. DECLINED / TIMED_OUT: if target can't help
    |
    v
5. Metrics updated:
   - Both agents' collaboration metrics updated
   - Activity feed entry emitted
   - If handoff was for a task, task.output_text appended with handoff result
```

### B.5 Three-Tier Memory

**Tier 1 -- Daily Notes** (`daily_notes` table):
- One row per agent per day (UNIQUE constraint on agent_id + note_date)
- `entries` JSONB array of `DailyNoteEntry` objects
- Auto-populated by the task runner: when a task starts, completes, fails, or produces an insight, append to today's daily note
- Retention: kept indefinitely (cheap storage), but UI defaults to last 30 days

**Tier 2 -- Long-term Memory** (`long_term_memories` table):
- Curated from daily notes, either:
  - Manually: user promotes a daily note entry to long-term
  - Automatically: after task completion, LLM prompt: "From this task output, extract any reusable insights, patterns, or lessons learned"
- `relevance_score` starts at 1.0, decays by 0.05/week, boosted by 0.2 when referenced
- Referenced = when an agent's prompt includes this memory as context

**Tier 3 -- Project Context** (described in B.1):
- Shared across agents working on the same project
- Survives beyond individual agent sessions
- Cross-project insights propagate applicable learnings

**Memory Flow**:
```
Task execution
    |
    v
Daily Note entry (auto, Tier 1)
    |
    v
LLM extraction OR manual promotion
    |
    v
Long-term Memory (Tier 2, per agent)
    |
    v
If applicable to project --> append to CONTEXT.md (Tier 3)
    |
    v
If applicable beyond project --> CrossProjectInsight (flagged for propagation)
```

---

## C. Component Hierarchy

### C.1 Performance Review Components

```
src/components/reviews/
  |
  +-- PerformanceReviewPage.tsx         -- Top-level page/tab
  |     |
  |     +-- ReviewOverview.tsx          -- Summary cards: pending reviews, recent reviews
  |     +-- ReviewList.tsx              -- Table of all reviews with filters
  |
  +-- AgentPerformanceDashboard.tsx     -- Per-agent deep-dive
  |     |
  |     +-- MetricsCharts.tsx           -- Bar/line charts for completion, quality, speed
  |     +-- DomainBreakdown.tsx         -- Radar chart of domain performance
  |     +-- ReviewTimeline.tsx          -- Chronological list of past reviews
  |     +-- LevelHistory.tsx            -- Level changes over time
  |     +-- FeedbackLog.tsx             -- List of feedback entries
  |
  +-- ReviewWorkflowModal.tsx           -- The 6-step review wizard
  |     |
  |     +-- Step1_MetricsCollection.tsx -- Shows auto-collected metrics, loading state
  |     +-- Step2_NarrativeGeneration.tsx -- Shows AI narrative, edit button
  |     +-- Step3_UserRating.tsx        -- Star rating sliders, notes textarea
  |     +-- Step4_LevelDecision.tsx     -- Maintain/promote/demote radio, justification
  |     +-- Step5_FeedbackPreview.tsx   -- Shows generated feedback, edit before saving
  |     +-- Step6_Finalize.tsx          -- Summary + confirm button
  |
  +-- ReviewInitiationButton.tsx        -- Placed on agent profile sidebar
```

### C.2 Shared Context Components

```
src/components/context/
  |
  +-- ContextBrowser.tsx                -- Browse all project contexts
  |     |
  |     +-- ProjectContextCard.tsx      -- Card per project with last-updated info
  |
  +-- ContextEditor.tsx                 -- View/edit a single CONTEXT.md
  |     |
  |     +-- ContextDocumentView.tsx     -- Markdown renderer with "Last updated by" header
  |     +-- ContextDocumentEditor.tsx   -- Markdown editor with save + version check
  |     +-- RevisionHistory.tsx         -- Sidebar showing revision timeline
  |
  +-- AgentDirectory.tsx                -- Searchable agent registry
  |     |
  |     +-- AgentDirectoryCard.tsx      -- Agent card with skills, level, availability
  |     +-- ExpertSearchBar.tsx         -- Domain/skill search input
  |
  +-- HandoffPanel.tsx                  -- Handoff tracking interface
  |     |
  |     +-- HandoffRequestForm.tsx      -- Create new handoff request
  |     +-- HandoffCard.tsx             -- Single handoff status card
  |     +-- HandoffTimeline.tsx         -- Full handoff history for a task
  |
  +-- MemoryViewer.tsx                  -- Per-agent memory browser
        |
        +-- DailyNotesTab.tsx           -- Calendar view + daily note entries
        +-- LongTermMemoryTab.tsx       -- Searchable/filterable memory list
        +-- ProjectContextsTab.tsx      -- Projects this agent has access to
```

### C.3 Integration into Existing Layout

```
src/App.tsx
  |
  +-- activeTab = 'reviews'    --> PerformanceReviewPage
  +-- activeTab = 'context'    --> ContextBrowser
  |
  +-- AgentSidebar
  |     +-- [existing content]
  |     +-- ReviewInitiationButton     (new)
  |     +-- AgentLevelBadge            (new, shows current level)
  |     +-- QuickMemoryPreview         (new, last 3 daily note entries)
  |
  +-- ContextPanel (right sidebar)
        +-- [existing content]
        +-- HandoffPanel               (new, shows active handoffs)
        +-- ContextQuickView           (new, current mission's CONTEXT.md)
```

---

## D. New Hooks

```
src/hooks/usePerformanceReview.ts
  - createReview(agentId, trigger, periodStart, periodEnd)
  - collectMetrics(reviewId): ReviewMetrics
  - generateNarrative(reviewId): string
  - submitRatings(reviewId, ratings, userNotes)
  - setLevelRecommendation(reviewId, recommendation, justification)
  - generateFeedback(reviewId): string
  - finalizeReview(reviewId)
  - getReviewsForAgent(agentId): PerformanceReview[]
  - getPendingReviews(): PerformanceReview[]

src/hooks/useAgentRegistry.ts
  - getAllAgents(): AgentRegistryEntry[]
  - findExpert(query: { domain?: string; skill?: string }): AgentRegistryEntry[]
  - updateAvailability(agentId, availability)
  - getAgentProfile(agentId): AgentRegistryEntry & reviews & feedback

src/hooks/useHandoff.ts
  - createHandoff(request: Omit<HandoffRequest, 'id' | timestamps>)
  - acceptHandoff(handoffId)
  - completeHandoff(handoffId, outcome)
  - declineHandoff(handoffId, reason)
  - getActiveHandoffs(agentId): HandoffRequest[]
  - getHandoffHistory(agentId): HandoffRequest[]

src/hooks/useProjectContext.ts
  - createProjectContext(projectId, title)
  - getProjectContext(projectId): ProjectContext & documents & access
  - updateDocument(docId, content, expectedVersion): { success: boolean; conflict?: true }
  - grantAccess(projectContextId, agentId, accessLevel)
  - revokeAccess(projectContextId, agentId)
  - getRevisionHistory(docId): ContextRevision[]

src/hooks/useAgentMemory.ts
  - getDailyNotes(agentId, dateRange): DailyNote[]
  - appendDailyNote(agentId, entry: DailyNoteEntry)
  - getLongTermMemories(agentId, filters?): LongTermMemory[]
  - promoteToLongTerm(dailyNoteEntryId, category, title)
  - autoExtractInsights(taskId): LongTermMemory[] (calls LLM)
  - flagCrossProjectInsight(memoryId, applicableDomains)
  - decayRelevanceScores(): void (called weekly by scheduler)
```

---

## E. Store Extensions

### E.1 Review Store (`src/stores/reviews.ts`)

```typescript
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
```

### E.2 Context Store (`src/stores/context.ts`)

```typescript
interface ContextState {
  projectContexts: ProjectContext[];
  activeContextId: string | null;
  handoffRequests: HandoffRequest[];
  dailyNotes: Record<string, DailyNote[]>; // keyed by agent_id

  setProjectContexts: (contexts: ProjectContext[]) => void;
  setActiveContext: (id: string | null) => void;
  setHandoffRequests: (requests: HandoffRequest[]) => void;
  addHandoffRequest: (request: HandoffRequest) => void;
  updateHandoffRequest: (id: string, updates: Partial<HandoffRequest>) => void;
  setDailyNotes: (agentId: string, notes: DailyNote[]) => void;
  appendDailyNoteEntry: (agentId: string, entry: DailyNoteEntry) => void;
}
```

---

## F. New Activity Types

Add to `activityIcons` in `ActivityFeed.tsx`:

```typescript
const newActivityIcons = {
  review_started: '📊',
  review_finalized: '📋',
  level_changed: '⬆️',
  feedback_posted: '💡',
  handoff_requested: '🤝',
  handoff_completed: '✅',
  context_updated: '📝',
  insight_flagged: '🔍',
  memory_promoted: '🧠',
  daily_note_added: '📓',
};
```

---

## G. Data Flow Diagrams

### G.1 Review Trigger to Finalization

```
review_schedules.next_review_at <= now()
  OR user clicks "Start Review"
  OR agent.total_missions_completed >= milestone_threshold
  OR agent.avg_quality_score < quality_alert_threshold
         |
         v
  INSERT performance_reviews (status='collecting')
  --> emit activity: review_started
         |
         v
  usePerformanceReview.collectMetrics()
    --> SELECT FROM missions, tasks, handoff_requests, mission_logs
    --> Compute ReviewMetrics
    --> UPDATE performance_reviews SET metrics = {...}
         |
         v
  usePerformanceReview.generateNarrative()
    --> Send metrics to LLM via OpenClaw
    --> UPDATE performance_reviews SET narrative = '...', status = 'narrative_ready'
         |
         v
  ReviewWorkflowModal opens (Step 3)
    --> User rates, writes notes
    --> UPDATE performance_reviews SET ratings, user_notes, status = 'user_review'
         |
         v
  User selects level recommendation
    --> UPDATE performance_reviews SET level_recommendation, level_justification
         |
         v
  usePerformanceReview.generateFeedback()
    --> LLM generates actionable feedback
    --> INSERT agent_feedback rows
    --> UPDATE performance_reviews SET agent_feedback = '...'
         |
         v
  usePerformanceReview.finalizeReview()
    --> If level change:
        INSERT level_changes
        UPDATE agents SET level = new_level
        emit activity: level_changed
    --> UPDATE performance_reviews SET status = 'finalized', finalized_at = now()
    --> UPDATE review_schedules SET next_review_at = next cadence date
    --> emit activity: review_finalized
```

### G.2 Task Completion to Memory Propagation

```
Task completes (status = 'done')
         |
         v
  appendDailyNote(agent_id, {
    type: 'task_completed',
    content: task.output_text summary,
    related_task_id: task.id
  })
         |
         v
  autoExtractInsights(task_id)
    --> LLM: "Extract reusable insights from this output"
    --> For each insight:
        INSERT long_term_memories (agent_id, category, title, content)
         |
         v
  If mission has project_context:
    UPDATE context_documents (doc_type='context')
      SET content = content + "\n## {agent} - {date}\n{learning}"
    INSERT context_revisions
         |
         v
  LLM check: "Is this insight applicable beyond this project?"
    --> If yes: INSERT cross_project_insights
        --> For each applicable project_context:
            Append to their CONTEXT.md
            emit activity: insight_flagged
```

### G.3 Handoff Flow

```
Agent A: findExpert('seo') --> returns Alexander
         |
         v
  createHandoff({
    requesting_agent_id: 'leonidas',
    target_agent_id: 'alexander',
    task_id: '...',
    reason: 'Need SEO keyword analysis',
    context_summary: 'Working on marketing plan for Q2...',
    priority: 'high'
  })
  --> INSERT handoff_requests (status='requested')
  --> emit activity: handoff_requested
  --> UPDATE agents SET availability = 'busy' WHERE id = 'alexander'
         |
         v
  Alexander accepts:
  --> UPDATE handoff_requests SET status='accepted', accepted_at=now()
         |
         v
  Alexander works, posts outcome:
  --> UPDATE handoff_requests SET
        status='completed', outcome='Keywords: ...', time_taken_minutes=45
  --> emit activity: handoff_completed
  --> UPDATE collaboration metrics for both agents
```

---

## H. Database Table Summary

| Table | Purpose | Realtime |
|-------|---------|----------|
| `review_schedules` | When to auto-trigger reviews per agent | No |
| `performance_reviews` | Core review records with metrics, ratings, feedback | Yes |
| `level_changes` | Audit trail of all level transitions | No |
| `agent_feedback` | Feedback entries per agent | No |
| `project_contexts` | Per-project context container | No |
| `context_access` | Agent access control per project | No |
| `context_documents` | Living documents (CONTEXT.md, research, etc.) | Yes |
| `context_revisions` | Append-only document edit history | No |
| `handoff_requests` | Agent-to-agent help requests | Yes |
| `daily_notes` | Raw daily activity logs per agent | Yes |
| `long_term_memories` | Curated insights per agent | No |
| `cross_project_insights` | Cross-project knowledge propagation | No |

**Extended existing table**: `agents` (added: `skills`, `availability`, `level`, `total_missions_completed`, `avg_quality_score`, `response_time_avg_minutes`, `last_active_at`)

---

## I. Integration Checklist

- [ ] Extend `MissionControlState.activeTab` union to include `'reviews'` and `'context'`
- [ ] Add `review_schedules` check to the existing scheduler tick in `useMissionScheduler`
- [ ] Call `appendDailyNote()` from task runner on task start/complete/fail
- [ ] Call `autoExtractInsights()` after task completion in `useAgentRun`
- [ ] Auto-create `project_contexts` when mission enters `in_progress`
- [ ] Update `agents` table row when metrics change (rolling avg_quality_score, etc.)
- [ ] Add new activity types to `ActivityFeed.tsx` icon map
- [ ] Wire `parseMissionProofReport()` into quality metrics collection
- [ ] Add level badge to `AgentSidebar.tsx` agent cards
- [ ] Add handoff panel to `ContextPanel.tsx` right sidebar
