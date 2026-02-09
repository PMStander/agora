import { useEffect, useMemo, useState } from 'react';
import { useMissionControl } from '../../hooks/useMissionControl';
import { useMissionControlStore } from '../../stores/missionControl';
import type { Mission } from '../../types/supabase';
import { buildMissionPlanTemplate } from '../../lib/missionPlan';

interface PlanningCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function isPlanningMission(mission: Mission): boolean {
  const phase = mission.mission_phase || 'tasks';
  const phaseStatus = mission.mission_phase_status || 'approved';
  return phase !== 'tasks' || phaseStatus !== 'approved';
}

function phaseLabel(mission: Mission): string {
  if (mission.mission_phase === 'statement') return 'Statement';
  if (mission.mission_phase === 'plan') return 'Plan';
  if ((mission.mission_phase_status || 'approved') !== 'approved') return 'Approval Pending';
  return 'Missions';
}

export function PlanningCenterModal({ isOpen, onClose }: PlanningCenterModalProps) {
  const missions = useMissionControlStore((s) => s.missions);
  const selectMission = useMissionControlStore((s) => s.selectMission);
  const selectTask = useMissionControlStore((s) => s.selectTask);
  const { updateMissionDetails, approveMissionStatement, approveMissionPlan } = useMissionControl();

  const planningMissions = useMemo(() => {
    return missions
      .filter((mission) => isPlanningMission(mission))
      .sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
  }, [missions]);

  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [statementDraft, setStatementDraft] = useState('');
  const [planDraft, setPlanDraft] = useState('');
  const [feedbackDraft, setFeedbackDraft] = useState('');
  const [busyAction, setBusyAction] = useState<'save' | 'approve-statement' | 'approve-plan' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedMission = useMemo(() => {
    if (!selectedMissionId) return null;
    return planningMissions.find((mission) => mission.id === selectedMissionId) || null;
  }, [planningMissions, selectedMissionId]);

  useEffect(() => {
    if (!isOpen) return;
    if (!selectedMissionId || !planningMissions.some((mission) => mission.id === selectedMissionId)) {
      setSelectedMissionId(planningMissions[0]?.id || null);
    }
  }, [isOpen, planningMissions, selectedMissionId]);

  useEffect(() => {
    if (!selectedMission) return;
    setStatementDraft(selectedMission.mission_statement || selectedMission.input_text || selectedMission.description || '');
    setPlanDraft(selectedMission.mission_plan || buildMissionPlanTemplate(selectedMission));
    setFeedbackDraft(selectedMission.review_notes || '');
    setMessage(null);
    setError(null);
  }, [selectedMission?.id]);

  if (!isOpen) return null;

  const saveDrafts = async () => {
    if (!selectedMission) return;
    setBusyAction('save');
    setMessage(null);
    setError(null);
    try {
      await updateMissionDetails(selectedMission.id, {
        mission_statement: statementDraft.trim() || null,
        mission_plan: planDraft.trim() || null,
        review_notes: feedbackDraft.trim() || null,
        mission_phase_status: selectedMission.mission_phase === 'tasks'
          ? selectedMission.mission_phase_status
          : 'awaiting_approval',
      });
      setMessage('Draft updates saved.');
    } catch (err) {
      setError(String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const approveStatement = async () => {
    if (!selectedMission) return;
    setBusyAction('approve-statement');
    setMessage(null);
    setError(null);
    try {
      const result = await approveMissionStatement(selectedMission.id, statementDraft);
      if (result !== true) {
        const errorMsg = typeof result === 'object' && result.error ? result.error : 'Failed to approve statement.';
        setError(errorMsg);
        return;
      }
      if (feedbackDraft.trim()) {
        await updateMissionDetails(selectedMission.id, { review_notes: feedbackDraft.trim() });
      }
      setMessage('Statement approved. Mission moved to planning phase.');
    } catch (err) {
      setError(String(err));
    } finally {
      setBusyAction(null);
    }
  };

  const approvePlan = async () => {
    if (!selectedMission) return;
    setBusyAction('approve-plan');
    setMessage(null);
    setError(null);
    try {
      const result = await approveMissionPlan(selectedMission.id, planDraft);
      if (!result.ok) {
        const errorLines = result.errors?.length
          ? result.errors.join('\n')
          : 'Failed to approve plan. Ensure JSON includes a non-empty missions array.';
        setError(errorLines);
        return;
      }
      if (feedbackDraft.trim()) {
        await updateMissionDetails(selectedMission.id, { review_notes: feedbackDraft.trim() });
      }
      setMessage(`Plan approved and ${result.createdTasks} mission(s) generated.`);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="w-[min(1200px,95vw)] h-[min(86vh,880px)] bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl flex">
        <div className="w-[320px] border-r border-zinc-800 flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">Planning Center</h2>
              <span className="text-xs text-zinc-500">{planningMissions.length} pending</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {planningMissions.length === 0 && (
              <div className="text-xs text-zinc-500 p-3">No missions waiting for planning approval.</div>
            )}
            {planningMissions.map((mission) => {
              const selected = mission.id === selectedMissionId;
              return (
                <button
                  key={mission.id}
                  onClick={() => setSelectedMissionId(mission.id)}
                  className={`
                    w-full text-left p-3 rounded-lg border transition-colors
                    ${selected
                      ? 'border-amber-500/60 bg-amber-500/10'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                    }
                  `}
                >
                  <div className="text-sm text-zinc-100 line-clamp-2">{mission.title}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                      {phaseLabel(mission)}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {new Date(mission.scheduled_at).toLocaleString()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-zinc-100">
                {selectedMission?.title || 'Select a mission'}
              </div>
              {selectedMission && (
                <div className="text-xs text-zinc-500 mt-0.5">
                  Phase: {phaseLabel(selectedMission)} · Status: {selectedMission.mission_phase_status}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedMission && (
                <button
                  onClick={() => {
                    selectTask(null);
                    selectMission(selectedMission.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs border border-zinc-700 text-zinc-300 rounded hover:border-zinc-500"
                >
                  Open Side Panel
                </button>
              )}
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs border border-zinc-700 text-zinc-300 rounded hover:border-zinc-500"
              >
                Close
              </button>
            </div>
          </div>

          {!selectedMission ? (
            <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
              No planning mission selected.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Mission Statement</label>
                <textarea
                  value={statementDraft}
                  onChange={(event) => setStatementDraft(event.target.value)}
                  rows={7}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 resize-y"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1">Mission Plan (JSON)</label>
                <textarea
                  value={planDraft}
                  onChange={(event) => setPlanDraft(event.target.value)}
                  rows={12}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs font-mono text-zinc-200 resize-y"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1">Planning Feedback</label>
                <textarea
                  value={feedbackDraft}
                  onChange={(event) => setFeedbackDraft(event.target.value)}
                  rows={4}
                  placeholder="Add internal feedback or revision instructions..."
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 resize-y"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={saveDrafts}
                  disabled={busyAction !== null}
                  className="px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded hover:border-zinc-500 disabled:opacity-50"
                >
                  Save Drafts
                </button>
                {selectedMission.mission_phase === 'statement' && (
                  <button
                    onClick={approveStatement}
                    disabled={busyAction !== null || !statementDraft.trim()}
                    className="px-3 py-1.5 text-xs bg-amber-500 text-black rounded hover:bg-amber-400 disabled:opacity-50"
                  >
                    {'Approve Statement -> Plan'}
                  </button>
                )}
                {selectedMission.mission_phase === 'plan' && (
                  <button
                    onClick={approvePlan}
                    disabled={busyAction !== null || !planDraft.trim()}
                    className="px-3 py-1.5 text-xs bg-emerald-500 text-black rounded hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {'Approve Plan -> Missions'}
                  </button>
                )}
              </div>

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
          )}
        </div>
      </div>
    </div>
  );
}
