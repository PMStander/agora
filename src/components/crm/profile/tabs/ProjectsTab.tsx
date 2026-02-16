import { useProjectsByContact, useProjectsByCompany, useProjectsByDeal, PROJECT_STATUS_CONFIG } from '../../../../stores/projects';
import { useProjectsStore } from '../../../../stores/projects';
import { useCrmStore } from '../../../../stores/crm';
import { ProfileEmptyState } from '../ProfileEmptyState';
import { TabHeader } from './TabHeader';

function formatCurrency(amount: number | null, currency = 'USD'): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString();
}

const STATUS_COLORS: Record<string, string> = {
  blue: 'bg-blue-500/20 text-blue-400',
  green: 'bg-green-500/20 text-green-400',
  red: 'bg-red-500/20 text-red-400',
  amber: 'bg-amber-500/20 text-amber-400',
  zinc: 'bg-zinc-500/20 text-zinc-400',
};

interface ProjectsTabProps {
  entityType: string;
  entityId: string;
}

export default function ProjectsTab({ entityType, entityId }: ProjectsTabProps) {
  const selectProject = useProjectsStore(s => s.selectProject);
  const navigateToProfile = useCrmStore(s => s.navigateToProfile);

  const contactProjects = useProjectsByContact(entityType === 'contact' ? entityId : null);
  const companyProjects = useProjectsByCompany(entityType === 'company' ? entityId : null);
  const dealProjects = useProjectsByDeal(entityType === 'deal' ? entityId : null);

  const projects = entityType === 'contact'
    ? contactProjects
    : entityType === 'company'
      ? companyProjects
      : dealProjects;

  if (!projects.length) return <ProfileEmptyState message="No projects linked" />;

  return (
    <div>
      <TabHeader count={projects.length} noun="project" />
      <div className="space-y-2">
        {projects.map(project => {
          const statusCfg = PROJECT_STATUS_CONFIG[project.status];
          const colorClass = STATUS_COLORS[statusCfg?.color] ?? STATUS_COLORS.zinc;
          return (
            <div
              key={project.id}
              onClick={() => {
                selectProject(project.id);
                navigateToProfile('project', project.id, project.name);
              }}
              className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-zinc-200 truncate">{project.name}</span>
                <span className={`px-1.5 py-0.5 text-xs rounded ${colorClass}`}>
                  {statusCfg?.label ?? project.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                {project.budget != null && (
                  <span>{formatCurrency(project.budget, project.currency)}</span>
                )}
                {project.start_date && <span>Start: {formatDate(project.start_date)}</span>}
                {project.target_end_date && <span>Due: {formatDate(project.target_end_date)}</span>}
                <span className="ml-auto">{formatDate(project.created_at)}</span>
              </div>
              {project.description && (
                <p className="text-xs text-zinc-600 mt-1 truncate">{project.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
