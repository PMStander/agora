import { useMemo, useState } from 'react';
import { useProjects } from '../../hooks/useProjects';
import {
  useProjectsStore,
  PROJECT_STATUS_CONFIG,
  type ProjectStatus,
  type WorkspaceTab,
} from '../../stores/projects';
import { useMissionControlStore } from '../../stores/missionControl';
import type { Project } from '../../stores/projects';

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_FLOW: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];

function formatCurrency(amount: number | null, currency = 'USD'): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  project: Project;
}

export function ProjectWorkspaceOverview({ project }: Props) {
  const { updateProjectDetails, getProjectProgress } = useProjects();
  const setWorkspaceTab = useProjectsStore((s) => s.setWorkspaceTab);
  const allMissions = useMissionControlStore((s) => s.missions);

  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState('');

  const linkedMissions = useMemo(() => {
    const ids = project.mission_ids || [];
    return allMissions.filter((m) => ids.includes(m.id));
  }, [project, allMissions]);

  const progress = useMemo(
    () => getProjectProgress(project.id),
    [project.id, getProjectProgress]
  );

  const inProgressCount = useMemo(
    () =>
      linkedMissions.filter(
        (m) => m.status === 'in_progress' || m.status === 'assigned'
      ).length,
    [linkedMissions]
  );

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    await updateProjectDetails(project.id, { status: newStatus });
  };

  const handleSaveDescription = async () => {
    await updateProjectDetails(project.id, {
      description: editDescription || null,
    });
    setIsEditing(false);
  };

  const startEditing = () => {
    setEditDescription(project.description || '');
    setIsEditing(true);
  };

  const navigateToTab = (tab: WorkspaceTab) => {
    setWorkspaceTab(tab);
  };

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Missions</div>
          <div className="text-lg font-semibold text-zinc-100">{progress.total}</div>
          <div className="text-xs text-zinc-400 mt-0.5">
            {progress.completed} completed / {inProgressCount} in progress
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Progress</div>
          <div className="text-lg font-semibold text-zinc-100">{progress.percent}%</div>
          <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Budget</div>
          <div className="text-lg font-semibold text-zinc-100">
            {formatCurrency(project.budget, project.currency)}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Timeline</div>
          <div className="text-xs text-zinc-300">
            {formatDate(project.start_date)} - {formatDate(project.target_end_date)}
          </div>
          {project.actual_end_date && (
            <div className="text-[10px] text-zinc-500 mt-1">
              Actual: {formatDate(project.actual_end_date)}
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => navigateToTab('missions')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:border-amber-500/50 hover:text-amber-300 transition-colors"
        >
          <span>{'\uD83D\uDCCB'}</span>
          <span>{linkedMissions.length} missions</span>
        </button>
        <button
          onClick={() => navigateToTab('files')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:border-amber-500/50 hover:text-amber-300 transition-colors"
        >
          <span>{'\uD83D\uDCCE'}</span>
          <span>Files & Media</span>
        </button>
        <button
          onClick={() => navigateToTab('context')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:border-amber-500/50 hover:text-amber-300 transition-colors"
        >
          <span>{'\uD83D\uDCD6'}</span>
          <span>Context Docs</span>
        </button>
        <button
          onClick={() => navigateToTab('settings')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:border-amber-500/50 hover:text-amber-300 transition-colors"
        >
          <span>{'\uD83D\uDC65'}</span>
          <span>Team & Settings</span>
        </button>
      </div>

      {/* Status update buttons */}
      <div>
        <label className="block text-xs text-zinc-500 mb-2">Update Status</label>
        <div className="flex flex-wrap gap-2">
          {STATUS_FLOW.map((status) => {
            const cfg = PROJECT_STATUS_CONFIG[status];
            const isCurrent = project.status === status;
            return (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={isCurrent}
                className={`
                  px-2.5 py-1 text-xs rounded border transition-colors
                  ${
                    isCurrent
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 cursor-default'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                  }
                `}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Description (editable) */}
      <div>
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={4}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-300 resize-none focus:outline-none focus:border-amber-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveDescription}
                className="px-3 py-1 text-xs bg-amber-500 text-black rounded"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1 text-xs text-zinc-400"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-zinc-500">Description</label>
              <button
                onClick={startEditing}
                className="text-[10px] text-zinc-600 hover:text-zinc-400"
              >
                Edit
              </button>
            </div>
            <p className="text-sm text-zinc-400 whitespace-pre-wrap">
              {project.description || 'No description.'}
            </p>
          </div>
        )}
      </div>

      {/* Tags */}
      {project.tags && project.tags.length > 0 && (
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Tags</label>
          <div className="flex flex-wrap gap-1">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-400 rounded border border-zinc-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
