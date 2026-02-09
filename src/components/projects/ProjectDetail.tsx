import { useMemo, useState } from 'react';
import { useProjects } from '../../hooks/useProjects';
import {
  useProjectsStore,
  useSelectedProject,
  PROJECT_STATUS_CONFIG,
  type ProjectStatus,
} from '../../stores/projects';
import { useCrmStore } from '../../stores/crm';
import { useMissionControlStore } from '../../stores/missionControl';
import { getAgent, MISSION_COLUMNS } from '../../types/supabase';

// ─── Helpers ────────────────────────────────────────────────────────────────

const statusBadgeColors: Record<string, string> = {
  zinc: 'bg-zinc-500/20 text-zinc-300',
  blue: 'bg-blue-500/20 text-blue-300',
  cyan: 'bg-cyan-500/20 text-cyan-300',
  indigo: 'bg-indigo-500/20 text-indigo-300',
  amber: 'bg-amber-500/20 text-amber-300',
  green: 'bg-emerald-500/20 text-emerald-300',
  purple: 'bg-purple-500/20 text-purple-300',
  red: 'bg-red-500/20 text-red-300',
};

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

function missionStatusBadge(status: string): string {
  const col = MISSION_COLUMNS.find((c) => c.id === status);
  if (!col) return statusBadgeColors.zinc;
  return statusBadgeColors[col.color] ?? statusBadgeColors.zinc;
}

function missionStatusLabel(status: string): string {
  const col = MISSION_COLUMNS.find((c) => c.id === status);
  return col ? col.title : status;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ProjectDetail() {
  const project = useSelectedProject();
  const selectProject = useProjectsStore((s) => s.selectProject);
  const { updateProjectDetails, deleteProject, getProjectProgress, linkMissionToProject, unlinkMission } =
    useProjects();

  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);
  const deals = useCrmStore((s) => s.deals);
  const allMissions = useMissionControlStore((s) => s.missions);

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Linked missions
  const linkedMissions = useMemo(() => {
    if (!project) return [];
    const ids = project.mission_ids || [];
    return allMissions.filter((m) => ids.includes(m.id));
  }, [project, allMissions]);

  // Unlinked missions (for the link modal)
  const unlinkableMissions = useMemo(() => {
    if (!project) return [];
    const ids = new Set(project.mission_ids || []);
    return allMissions.filter((m) => !ids.has(m.id));
  }, [project, allMissions]);

  const progress = useMemo(() => {
    if (!project) return { total: 0, completed: 0, percent: 0 };
    return getProjectProgress(project.id);
  }, [project, getProjectProgress]);

  const inProgressCount = useMemo(() => {
    return linkedMissions.filter(
      (m) => m.status === 'in_progress' || m.status === 'assigned'
    ).length;
  }, [linkedMissions]);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-zinc-500 text-sm">Select a project to view details</p>
      </div>
    );
  }

  const statusConfig = PROJECT_STATUS_CONFIG[project.status];
  const agent = project.owner_agent_id ? getAgent(project.owner_agent_id) : null;
  const contact = project.contact_id ? contacts.find((c) => c.id === project.contact_id) : null;
  const company = project.company_id ? companies.find((c) => c.id === project.company_id) : null;
  const deal = project.deal_id ? deals.find((d) => d.id === project.deal_id) : null;

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    await updateProjectDetails(project.id, { status: newStatus });
  };

  const handleDelete = async () => {
    await deleteProject(project.id);
    selectProject(null);
  };

  const handleSaveEdit = async () => {
    await updateProjectDetails(project.id, {
      name: editName,
      description: editDescription || null,
    });
    setIsEditing(false);
  };

  const startEditing = () => {
    setEditName(project.name);
    setEditDescription(project.description || '');
    setIsEditing(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-100 truncate">{project.name}</h2>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              statusBadgeColors[statusConfig.color] ?? statusBadgeColors.zinc
            }`}
          >
            {statusConfig.label}
          </span>
        </div>
        <button
          onClick={() => selectProject(null)}
          className="text-zinc-500 hover:text-zinc-300"
        >
          ✕
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
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
                    ${isCurrent
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
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm text-zinc-300 resize-none focus:outline-none focus:border-amber-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
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
              <label className="block text-xs text-zinc-500 mb-1">Description</label>
              <p className="text-sm text-zinc-400 whitespace-pre-wrap">
                {project.description || 'No description.'}
              </p>
            </div>
          )}
        </div>

        {/* Client info */}
        <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
          <label className="block text-xs text-zinc-500">Client Information</label>
          <div className="space-y-1.5">
            {agent && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 w-20 shrink-0">Owner</span>
                <span className="text-zinc-300">
                  {agent.emoji} {agent.name} - {agent.role}
                </span>
              </div>
            )}
            {contact && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 w-20 shrink-0">Contact</span>
                <span className="text-zinc-300">
                  {contact.first_name} {contact.last_name}
                  {contact.email && (
                    <span className="text-zinc-500 ml-1">({contact.email})</span>
                  )}
                </span>
              </div>
            )}
            {company && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 w-20 shrink-0">Company</span>
                <span className="text-zinc-300">{company.name}</span>
              </div>
            )}
            {deal && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 w-20 shrink-0">Deal</span>
                <span className="text-zinc-300">
                  {deal.title}
                  {deal.amount != null && (
                    <span className="text-zinc-500 ml-1">
                      ({formatCurrency(deal.amount, deal.currency)})
                    </span>
                  )}
                </span>
              </div>
            )}
            {!agent && !contact && !company && !deal && (
              <p className="text-xs text-zinc-600">No client information linked.</p>
            )}
          </div>
        </div>

        {/* Linked Missions */}
        <div className="border border-zinc-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-zinc-500">
              Linked Missions ({linkedMissions.length})
            </label>
            <button
              onClick={() => setLinkModalOpen(true)}
              className="text-xs text-amber-400 hover:text-amber-300"
            >
              + Link Mission
            </button>
          </div>

          {linkedMissions.length === 0 ? (
            <p className="text-xs text-zinc-600">No missions linked to this project.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {linkedMissions.map((mission) => (
                <div
                  key={mission.id}
                  className="flex items-center justify-between gap-2 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${missionStatusBadge(
                        mission.status
                      )}`}
                    >
                      {missionStatusLabel(mission.status)}
                    </span>
                    <span className="text-xs text-zinc-300 truncate">{mission.title}</span>
                  </div>
                  <button
                    onClick={() => unlinkMission(project.id, mission.id)}
                    className="text-xs text-zinc-600 hover:text-red-400 shrink-0"
                    title="Unlink mission"
                  >
                    ✕
                  </button>
                </div>
              ))}
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

        {/* Actions */}
        <div className="flex items-center gap-2 pt-4 border-t border-zinc-800">
          <button
            onClick={startEditing}
            className="px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded hover:border-zinc-500 transition-colors"
          >
            Edit
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">Delete this project?</span>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 text-xs bg-red-500/20 border border-red-500/50 text-red-400 rounded hover:bg-red-500/30 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-1.5 text-xs bg-zinc-800 border border-zinc-700 text-red-400 rounded hover:border-red-500/50 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Link Mission Modal */}
      {linkModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100">Link Mission to Project</h3>
              <button
                onClick={() => setLinkModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {unlinkableMissions.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-4">
                  No unlinked missions available.
                </p>
              ) : (
                unlinkableMissions.map((mission) => (
                  <button
                    key={mission.id}
                    onClick={async () => {
                      await linkMissionToProject(project.id, mission.id);
                    }}
                    className="w-full text-left flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 hover:border-amber-500/50 transition-colors"
                  >
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${missionStatusBadge(
                        mission.status
                      )}`}
                    >
                      {missionStatusLabel(mission.status)}
                    </span>
                    <span className="text-xs text-zinc-300 truncate">{mission.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
