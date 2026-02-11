import { useState, Suspense, lazy } from 'react';
import { useCrmStore } from '../../../stores/crm';
import { useProjectsStore, PROJECT_STATUS_CONFIG } from '../../../stores/projects';
import { ProfileTabBar, type ProfileTab } from './ProfileTabBar';
import { ProfileEmptyState } from './ProfileEmptyState';
import { getAgent } from '../../../types/supabase';

const MissionsTab = lazy(() => import('./tabs/MissionsTab'));
const DocumentsTab = lazy(() => import('./tabs/DocumentsTab'));

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  planning: 'bg-zinc-500/20 text-zinc-400',
  active: 'bg-emerald-500/20 text-emerald-400',
  on_hold: 'bg-amber-500/20 text-amber-400',
  completed: 'bg-blue-500/20 text-blue-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

function formatCurrency(amount: number | null, currency = 'USD'): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

const TABS: ProfileTab[] = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'missions', label: 'Missions', icon: '🚀' },
  { id: 'documents', label: 'Documents', icon: '📁' },
];

function TabLoading() {
  return (
    <div className="flex items-center justify-center h-32 text-zinc-500">Loading...</div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProjectProfile({ projectId }: { projectId: string }) {
  const project = useProjectsStore((s) => s.projects).find((p) => p.id === projectId);
  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);
  const deals = useCrmStore((s) => s.deals);
  const navigateToProfile = useCrmStore((s) => s.navigateToProfile);
  const [activeTab, setActiveTab] = useState('overview');

  if (!project) {
    return <ProfileEmptyState message="Project not found" />;
  }

  const statusConfig = PROJECT_STATUS_CONFIG[project.status];
  const agent = project.owner_agent_id ? getAgent(project.owner_agent_id) : undefined;
  const contact = project.contact_id ? contacts.find((c) => c.id === project.contact_id) : null;
  const company = project.company_id ? companies.find((c) => c.id === project.company_id) : null;
  const deal = project.deal_id ? deals.find((d) => d.id === project.deal_id) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-zinc-100 truncate">
              {project.name}
            </h1>
            <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[project.status] ?? STATUS_COLORS.planning}`}>
              {statusConfig.label}
            </span>
          </div>
          {project.description && (
            <p className="text-sm text-zinc-400 mt-0.5 truncate">{project.description}</p>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <ProfileTabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'overview' && (
          <OverviewContent
            project={project}
            agent={agent}
            contact={contact}
            company={company}
            deal={deal}
            navigateToProfile={navigateToProfile}
          />
        )}

        {activeTab === 'missions' && (
          <Suspense fallback={<TabLoading />}>
            <MissionsTab projectId={projectId} />
          </Suspense>
        )}

        {activeTab === 'documents' && (
          <Suspense fallback={<TabLoading />}>
            <DocumentsTab entityType="project" entityId={projectId} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

// ─── Overview Tab (Inline) ──────────────────────────────────────────────────

function OverviewContent({
  project,
  agent,
  contact,
  company,
  deal,
  navigateToProfile,
}: {
  project: NonNullable<ReturnType<typeof useProjectsStore.getState>['projects'][number]>;
  agent: ReturnType<typeof getAgent>;
  contact: ReturnType<typeof useCrmStore.getState>['contacts'][number] | null | undefined;
  company: ReturnType<typeof useCrmStore.getState>['companies'][number] | null | undefined;
  deal: ReturnType<typeof useCrmStore.getState>['deals'][number] | null | undefined;
  navigateToProfile: ReturnType<typeof useCrmStore.getState>['navigateToProfile'];
}) {
  const statusConfig = PROJECT_STATUS_CONFIG[project.status];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Project Info */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Project Info
        </h3>
        <div className="space-y-2.5">
          <InfoRow label="Name" value={project.name} />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Status</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[project.status] ?? STATUS_COLORS.planning}`}>
              {statusConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Budget</span>
            <span className="text-amber-400 font-semibold">{formatCurrency(project.budget, project.currency)}</span>
          </div>
          <InfoRow label="Start Date" value={project.start_date ? new Date(project.start_date).toLocaleDateString() : null} />
          <InfoRow label="Target End" value={project.target_end_date ? new Date(project.target_end_date).toLocaleDateString() : null} />
          <InfoRow label="Actual End" value={project.actual_end_date ? new Date(project.actual_end_date).toLocaleDateString() : null} />
          <InfoRow label="Created" value={project.created_at ? new Date(project.created_at).toLocaleDateString() : null} />
          {project.description && (
            <div className="pt-2 border-t border-zinc-800">
              <span className="text-xs text-zinc-500">Description</span>
              <p className="text-sm text-zinc-400 mt-1 whitespace-pre-wrap">{project.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Related Entities */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-5">
        {/* Agent */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Project Owner
          </h3>
          {agent ? (
            <div className="flex items-center gap-2">
              <span className="text-lg">{agent.emoji}</span>
              <div>
                <div className="text-sm text-zinc-200">{agent.name}</div>
                <div className="text-xs text-zinc-500">{agent.role}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-600">Unassigned</p>
          )}
        </div>

        {/* Contact */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Contact
          </h3>
          {contact ? (
            <button
              onClick={() => navigateToProfile('contact', contact.id, project.name)}
              className="w-full flex items-center gap-3 bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-left hover:border-zinc-600 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-semibold shrink-0">
                {contact.first_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-zinc-200 truncate">
                  {contact.first_name} {contact.last_name}
                </div>
                <div className="text-xs text-zinc-500 truncate">
                  {contact.job_title || contact.email || 'Contact'}
                </div>
              </div>
            </button>
          ) : (
            <p className="text-sm text-zinc-600">No contact linked</p>
          )}
        </div>

        {/* Company */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Company
          </h3>
          {company ? (
            <button
              onClick={() => navigateToProfile('company', company.id, project.name)}
              className="w-full flex items-center gap-3 bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-left hover:border-zinc-600 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-semibold shrink-0">
                {company.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-zinc-200 truncate">{company.name}</div>
                <div className="text-xs text-zinc-500 truncate">
                  {company.industry || company.domain || 'Company'}
                </div>
              </div>
            </button>
          ) : (
            <p className="text-sm text-zinc-600">No company linked</p>
          )}
        </div>

        {/* Deal */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Deal
          </h3>
          {deal ? (
            <button
              onClick={() => navigateToProfile('deal', deal.id, project.name)}
              className="w-full flex items-center gap-3 bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-left hover:border-zinc-600 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-sm font-semibold shrink-0">
                💰
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-zinc-200 truncate">{deal.title}</div>
                <div className="text-xs text-zinc-500 truncate">
                  {formatCurrency(deal.amount, deal.currency)}
                </div>
              </div>
            </button>
          ) : (
            <p className="text-sm text-zinc-600">No deal linked</p>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Tags
        </h3>
        {project.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 text-xs bg-zinc-800 text-zinc-300 rounded-full border border-zinc-700"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No tags</p>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-zinc-500 w-24 shrink-0">{label}</span>
      <span className="text-zinc-300 truncate">{value || '--'}</span>
    </div>
  );
}
