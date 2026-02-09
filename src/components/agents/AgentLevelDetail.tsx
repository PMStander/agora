import { useEffect, useMemo } from 'react';
import { LevelBadge } from './LevelBadge';
import { LevelTimeline } from './LevelTimeline';
import { useAgentLevel } from '../../hooks/useAgentLevel';
import { evaluateLevelUp } from '../../lib/permissions';
import { cn } from '../../lib/utils';
import {
  AGENT_LEVEL_LABELS,
  DEFAULT_LEVEL_UP_CRITERIA,
  type AgentLevel,
} from '../../types/supabase';

const LEVEL_DESCRIPTIONS: Record<AgentLevel, string> = {
  1: 'New agent. All actions require human approval. Cannot create tasks or missions autonomously.',
  2: 'Can produce work and recommend actions. Executes on human approval. Read-only shared context.',
  3: 'Autonomous execution within defined guardrails. Creates sub-tasks, updates shared context.',
  4: 'Full authority over permissioned domains. Creates and assigns missions to lower-level agents.',
};

interface ProgressBarProps {
  label: string;
  current: number;
  target: number;
  format?: (value: number) => string;
}

function ProgressBar({ label, current, target, format }: ProgressBarProps) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const met = current >= target;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className={met ? 'text-emerald-400' : 'text-zinc-300'}>
          {format ? format(current) : current} / {format ? format(target) : target}
          {met && ' (met)'}
        </span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            met ? 'bg-emerald-500' : 'bg-amber-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

interface AgentLevelDetailProps {
  agentId: string;
}

export function AgentLevelDetail({ agentId }: AgentLevelDetailProps) {
  const {
    getAgentLevel,
    requestPromotion,
    setAgentLevel,
    fetchLevelHistory,
    levelHistory,
  } = useAgentLevel();

  const state = getAgentLevel(agentId);
  const level = state?.current_level || 1;
  const metrics = state?.metrics || {
    tasks_completed: 0,
    avg_review_score: 0,
    violations_30d: 0,
    critical_violations_7d: 0,
    consecutive_failures: 0,
    time_in_level_days: 0,
  };

  useEffect(() => {
    fetchLevelHistory(agentId);
  }, [agentId, fetchLevelHistory]);

  const criteria = DEFAULT_LEVEL_UP_CRITERIA[level];
  const evaluation = useMemo(
    () => evaluateLevelUp(agentId, metrics, level),
    [agentId, metrics, level],
  );

  const history = levelHistory[agentId] || [];

  const handleDemote = async () => {
    if (level <= 1) return;
    const confirmed = window.confirm(
      `Demote this agent from L${level} to L${level - 1}? This action takes effect immediately.`,
    );
    if (!confirmed) return;
    await setAgentLevel(
      agentId,
      (level - 1) as AgentLevel,
      'manual_override',
      'Manual demotion by human operator',
    );
  };

  return (
    <div className="space-y-4">
      {/* Current level header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LevelBadge level={level} size="md" />
          <div>
            <div className="text-sm font-medium text-zinc-200">
              {AGENT_LEVEL_LABELS[level]}
            </div>
            <div className="text-xs text-zinc-500">
              {LEVEL_DESCRIPTIONS[level]}
            </div>
          </div>
        </div>
      </div>

      {/* Progress toward next level */}
      {criteria && (
        <div className="p-3 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-3">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Progress to L{level + 1}
          </div>
          <ProgressBar
            label="Tasks Completed"
            current={metrics.tasks_completed}
            target={criteria.min_tasks_completed}
          />
          <ProgressBar
            label="Avg Review Score"
            current={metrics.avg_review_score}
            target={criteria.min_avg_review_score}
            format={(v) => v.toFixed(2)}
          />
          <ProgressBar
            label="Time in Level (days)"
            current={metrics.time_in_level_days}
            target={criteria.min_time_in_level_days}
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Violations (30d)</span>
            <span
              className={
                metrics.violations_30d <= criteria.max_warning_violations_30d
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }
            >
              {metrics.violations_30d} (max {criteria.max_warning_violations_30d})
            </span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {evaluation.eligible && (
          <button
            onClick={() => requestPromotion(agentId)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
          >
            Request Promotion to L{level + 1}
          </button>
        )}
        {level > 1 && (
          <button
            onClick={handleDemote}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
          >
            Demote
          </button>
        )}
      </div>

      {/* Level timeline */}
      {history.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Level History
          </div>
          <LevelTimeline entries={history} />
        </div>
      )}
    </div>
  );
}
