import { useProjects } from '../../hooks/useProjects';
import {
  useProjectsStore,
  useFilteredProjects,
  PROJECT_STATUS_CONFIG,
  type ProjectStatus,
} from '../../stores/projects';
import { useCrmStore } from '../../stores/crm';
import { getAgent } from '../../types/supabase';

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

export function ProjectList() {
  const { getProjectProgress } = useProjects();
  const projects = useFilteredProjects();
  const selectedProjectId = useProjectsStore((s) => s.selectedProjectId);
  const selectProject = useProjectsStore((s) => s.selectProject);
  const filters = useProjectsStore((s) => s.filters);
  const setFilters = useProjectsStore((s) => s.setFilters);

  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
        <span className="text-xs text-zinc-500">{projects.length} projects</span>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value as ProjectStatus | 'all' })}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300"
        >
          <option value="all">All Statuses</option>
          {(Object.keys(PROJECT_STATUS_CONFIG) as ProjectStatus[]).map((status) => (
            <option key={status} value={status}>
              {PROJECT_STATUS_CONFIG[status].label}
            </option>
          ))}
        </select>
      </div>

      {/* Card Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-zinc-500 text-sm">No projects found</p>
            <p className="text-zinc-600 text-xs mt-1">
              Create a project to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {projects.map((project) => {
              const statusConfig = PROJECT_STATUS_CONFIG[project.status];
              const agent = project.owner_agent_id ? getAgent(project.owner_agent_id) : null;
              const contact = project.contact_id
                ? contacts.find((c) => c.id === project.contact_id)
                : null;
              const company = project.company_id
                ? companies.find((c) => c.id === project.company_id)
                : null;
              const progress = getProjectProgress(project.id);
              const isSelected = selectedProjectId === project.id;

              const clientName = contact
                ? `${contact.first_name} ${contact.last_name}`
                : company
                ? company.name
                : null;

              return (
                <button
                  key={project.id}
                  onClick={() => selectProject(project.id)}
                  className={`
                    text-left bg-zinc-800 border rounded-lg p-4 cursor-pointer
                    hover:border-amber-500/50 transition-colors
                    ${isSelected ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-zinc-700'}
                  `}
                >
                  {/* Top row: name + status */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-medium text-zinc-100 line-clamp-1">
                      {project.name}
                    </h3>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                        statusBadgeColors[statusConfig.color] ?? statusBadgeColors.zinc
                      }`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Agent + Client */}
                  <div className="flex items-center gap-2 mb-3 text-xs text-zinc-400">
                    {agent && (
                      <span className="flex items-center gap-1" title={agent.role}>
                        <span>{agent.emoji}</span>
                        <span>{agent.name}</span>
                      </span>
                    )}
                    {agent && clientName && <span className="text-zinc-600">|</span>}
                    {clientName && <span className="truncate">{clientName}</span>}
                  </div>

                  {/* Progress bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                      <span>
                        {progress.completed}/{progress.total} missions
                      </span>
                      <span>{progress.percent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Budget + Date range */}
                  <div className="flex items-center justify-between text-[10px] text-zinc-500">
                    <span>{formatCurrency(project.budget, project.currency)}</span>
                    <span>
                      {formatDate(project.start_date)}
                      {project.target_end_date ? ` - ${formatDate(project.target_end_date)}` : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
