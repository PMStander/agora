import { useCallback } from 'react';
import { useMissionControlStore } from '../../stores/missionControl';
import { useMissionControl } from '../../hooks/useMissionControl';
import { AGENTS } from '../../types/supabase';

export function MissionApprovalPanel() {
  const pendingApprovals = useMissionControlStore((s) => s.pendingApprovals);
  const approveMission = useMissionControlStore((s) => s.approveMission);
  const rejectApproval = useMissionControlStore((s) => s.rejectApproval);
  const { moveTask } = useMissionControl();

  const handleApprove = useCallback((taskId: string) => {
    // Remove from pending approvals
    approveMission(taskId);
    // Move task to in_progress
    moveTask(taskId, 'in_progress');
  }, [approveMission, moveTask]);

  const handleReject = useCallback((taskId: string) => {
    // Remove from pending approvals
    rejectApproval(taskId);
    // Task stays blocked, user can manually retry later
  }, [rejectApproval]);

  if (pendingApprovals.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10">
      <div className="px-4 py-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
          Mission Approvals Required ({pendingApprovals.length})
        </span>
      </div>
      <div className="px-4 pb-3 space-y-2">
        {pendingApprovals.map((approval) => {
          const agent = AGENTS.find((a) => a.id === approval.agentId);
          const agentName = agent?.name || approval.agentId;
          const agentEmoji = agent?.emoji || '🤖';

          return (
            <div
              key={approval.taskId}
              className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/50 border border-zinc-800"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-lg">{agentEmoji}</span>
                  <span className="text-zinc-300 font-medium truncate">
                    {agentName}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">
                    L{approval.agentLevel}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-0.5 truncate">
                  {approval.reason}
                </div>
                <div className="text-[10px] text-zinc-600 mt-0.5">
                  Task: {approval.taskId.slice(0, 8)}... • Mission: {approval.missionId.slice(0, 8)}...
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleApprove(approval.taskId)}
                  className="px-2 py-1 text-xs rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleReject(approval.taskId)}
                  className="px-2 py-1 text-xs rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
