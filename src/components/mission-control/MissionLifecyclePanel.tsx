import { useEffect, useMemo, useState } from 'react';
import { buildMissionPlanTemplate } from '../../lib/missionPlan';
import { getIncompleteDependencyTitles } from '../../lib/taskDependencies';
import { useMissionControl } from '../../hooks/useMissionControl';
import { useMissionControlStore, useSelectedMission } from '../../stores/missionControl';
import type { MissionPhase } from '../../types/supabase';

const phaseOrder: MissionPhase[] = ['statement', 'plan', 'tasks'];

const phaseLabel: Record<MissionPhase, string> = {
  statement: 'Statement',
  plan: 'Plan',
  tasks: 'Missions',
};

const statusPillClasses: Record<string, string> = {
  todo: 'bg-zinc-700 text-zinc-200',
  blocked: 'bg-rose-500/20 text-rose-300',
  in_progress: 'bg-amber-500/20 text-amber-300',
  review: 'bg-purple-500/20 text-purple-300',
  done: 'bg-emerald-500/20 text-emerald-300',
  failed: 'bg-red-500/20 text-red-300',
};

export function MissionLifecyclePanel() {
  const mission = useSelectedMission();
  const tasks = useMissionControlStore((s) => s.tasks);
  const selectMission = useMissionControlStore((s) => s.selectMission);
  const selectTask = useMissionControlStore((s) => s.selectTask);
  const { updateMissionDetails, approveMissionStatement, approveMissionPlan, reopenMissionWithFeedback } = useMissionControl();

  const [statementDraft, setStatementDraft] = useState('');
  const [planDraft, setPlanDraft] = useState('');
  const [busyAction, setBusyAction] = useState<'save-statement' | 'save-plan' | 'approve-statement' | 'approve-plan' | 'reopen' | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mission) return;
    setStatementDraft(mission.mission_statement || mission.input_text || mission.description || '');
    setPlanDraft(mission.mission_plan || buildMissionPlanTemplate(mission));
    setFeedbackDraft('');
    setMessage(null);
    setError(null);
  }, [mission]);

  const missionTasks = useMemo(() => {
    if (!mission) return [];
    return tasks
      .filter((task) => (task.root_task_id || task.id) === mission.id && task.id !== mission.id)
      .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
  }, [mission, tasks]);

  if (!mission) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-zinc-500">
        Select a mission to manage lifecycle.
      </div>
    );
  }

  const currentPhaseIndex = phaseOrder.indexOf(mission.mission_phase || 'tasks');

  const saveStatement = async () => {
    setBusyAction('save-statement');
    setError(null);
    setMessage(null);
    try {
      await updateMissionDetails(mission.id, {
        mission_statement: statementDraft.trim() || null,
        mission_phase_status: mission.mission_phase === 'statement'
          ? 'awaiting_approval'
          : mission.mission_phase_status,
      });
      setMessage('Mission statement saved.');
    } catch (err) {
      setError(String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const savePlan = async () => {
    setBusyAction('save-plan');
    setError(null);
    setMessage(null);
    try {
      await updateMissionDetails(mission.id, {
        mission_plan: planDraft.trim() || null,
        mission_phase_status: mission.mission_phase === 'plan'
          ? 'awaiting_approval'
          : mission.mission_phase_status,
      });
      setMessage('Mission plan saved.');
    } catch (err) {
      setError(String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const approveStatement = async () => {
    setBusyAction('approve-statement');
    setError(null);
    setMessage(null);
    try {
      const result = await approveMissionStatement(mission.id, statementDraft);
      if (result !== true) {
        const errorMsg = typeof result === 'object' && result.error ? result.error : 'Failed to approve mission statement.';
        setError(errorMsg);
        return;
      }
      setMessage('Statement approved. Mission moved to planning phase.');
    } catch (err) {
      setError(String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const approvePlan = async () => {
    setBusyAction('approve-plan');
    setError(null);
    setMessage(null);
    try {
      const result = await approveMissionPlan(mission.id, planDraft);
      if (!result.ok) {
        const errorLines = result.errors?.length
          ? result.errors.join('\n')
          : 'Failed to approve mission plan. Ensure plan JSON has a non-empty tasks array.';
        setError(errorLines);
        return;
      }
      setMessage(`Plan approved. Created ${result.createdTasks} tasks.`);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const submitFeedback = async () => {
    setBusyAction('reopen');
    setError(null);
    setMessage(null);
    try {
      const ok = await reopenMissionWithFeedback(mission.id, feedbackDraft);
      if (!ok) {
        setError('Failed to reopen mission with feedback.');
        return;
      }
      setMessage('Feedback submitted. Mission reopened.');
      setFeedbackDraft('');
    } catch (err) {
      setError(String(err));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">Mission Lifecycle</h2>
          <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[240px]">{mission.title}</p>
        </div>
        <button
          onClick={() => {
            selectTask(null);
            selectMission(null);
          }}
          className="text-zinc-500 hover:text-zinc-300"
          title="Close mission panel"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-lg border border-zinc-800 p-3">
          <div className="text-xs text-zinc-500 mb-2">Lifecycle Progress</div>
          <div className="flex items-center gap-2">
            {phaseOrder.map((phase, index) => {
              const active = index === currentPhaseIndex;
              const completed = index < currentPhaseIndex;
              return (
                <div key={phase} className="flex items-center gap-2 text-xs">
                  <span
                    className={`
                      px-2 py-1 rounded border
                      ${active
                        ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                        : completed
                        ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
                        : 'border-zinc-700 text-zinc-500 bg-zinc-900'}
                    `}
                  >
                    {phaseLabel[phase]}
                  </span>
                  {index < phaseOrder.length - 1 && <span className="text-zinc-600">→</span>}
                </div>
              );
            })}
          </div>
          <div className="text-xs text-zinc-500 mt-2">
            Phase status: <span className="text-zinc-300">{mission.mission_phase_status || 'approved'}</span>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 p-3 space-y-2">
          <div className="text-xs text-zinc-500">Mission Statement</div>
          <textarea
            value={statementDraft}
            onChange={(e) => setStatementDraft(e.target.value)}
            rows={5}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-xs text-zinc-200 resize-y"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={saveStatement}
              disabled={busyAction !== null}
              className="px-2.5 py-1.5 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded hover:border-zinc-500 disabled:opacity-50"
            >
              Save Statement
            </button>
            {mission.mission_phase === 'statement' && (
              <button
                onClick={approveStatement}
                disabled={busyAction !== null || !statementDraft.trim()}
                className="px-2.5 py-1.5 text-xs bg-amber-500 text-black rounded hover:bg-amber-400 disabled:opacity-50"
              >
                Approve Statement → Plan
              </button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 p-3 space-y-2">
          <div className="text-xs text-zinc-500">Mission Plan (JSON)</div>
          <textarea
            value={planDraft}
            onChange={(e) => setPlanDraft(e.target.value)}
            rows={10}
            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-xs text-zinc-200 resize-y font-mono"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={savePlan}
              disabled={busyAction !== null}
              className="px-2.5 py-1.5 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded hover:border-zinc-500 disabled:opacity-50"
            >
              Save Plan
            </button>
            {(mission.mission_phase === 'plan' || mission.mission_phase === 'tasks') && (
              <button
                onClick={approvePlan}
                disabled={busyAction !== null || !planDraft.trim()}
                className="px-2.5 py-1.5 text-xs bg-emerald-500 text-black rounded hover:bg-emerald-400 disabled:opacity-50"
              >
                {mission.mission_phase === 'tasks' ? 'Regenerate Tasks' : 'Generate Tasks'}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 p-3 space-y-2">
          <div className="text-xs text-zinc-500">Mission Tasks</div>
          {missionTasks.length === 0 && (
            <div className="text-xs text-zinc-600">No tasks yet. Approve the mission plan to generate tasks.</div>
          )}
          {missionTasks.map((task) => {
            const unmetDependencies = getIncompleteDependencyTitles(task, missionTasks);
            return (
              <button
                key={task.id}
                onClick={() => selectTask(task.id)}
                className="w-full text-left p-2 rounded border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-zinc-100 truncate">{task.title}</div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusPillClasses[task.status] || 'bg-zinc-700 text-zinc-200'}`}>
                    {task.status}
                  </span>
                </div>
                {task.dependency_task_ids.length > 0 && (
                  <div className="text-[11px] text-zinc-500 mt-1">
                    Dependencies: {task.dependency_task_ids.length}
                  </div>
                )}
                {unmetDependencies.length > 0 && (
                  <div className="text-[11px] text-rose-300 mt-1">
                    Waiting for: {unmetDependencies.join(', ')}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {mission.status === 'done' && (
          <div className="rounded-lg border border-zinc-800 p-3 space-y-2">
            <div className="text-xs text-zinc-500">Feedback to Reopen</div>
            <textarea
              value={feedbackDraft}
              onChange={(e) => setFeedbackDraft(e.target.value)}
              rows={4}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-2 text-xs text-zinc-200 resize-y"
              placeholder="What should be improved or reworked?"
            />
            <button
              onClick={submitFeedback}
              disabled={busyAction !== null || !feedbackDraft.trim()}
              className="px-2.5 py-1.5 text-xs bg-amber-500 text-black rounded hover:bg-amber-400 disabled:opacity-50"
            >
              Reopen Mission with Feedback
            </button>
          </div>
        )}

        {message && (
          <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded p-2">
            {message}
          </div>
        )}
        {error && (
          <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded p-2 whitespace-pre-line">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
