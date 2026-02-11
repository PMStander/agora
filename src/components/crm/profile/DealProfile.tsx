import { useState, Suspense, lazy } from 'react';
import { useCrmStore } from '../../../stores/crm';
import { ProfileTabBar, type ProfileTab } from './ProfileTabBar';
import { ProfileEmptyState } from './ProfileEmptyState';
import { DEAL_STATUS_CONFIG } from '../../../types/crm';
import { getAgent } from '../../../types/supabase';

const QuotesTab = lazy(() => import('./tabs/QuotesTab'));
const InvoicesTab = lazy(() => import('./tabs/InvoicesTab'));
const EmailsTab = lazy(() => import('./tabs/EmailsTab'));
const EventsTab = lazy(() => import('./tabs/EventsTab'));
const InteractionsTab = lazy(() => import('./tabs/InteractionsTab'));
const DocumentsTab = lazy(() => import('./tabs/DocumentsTab'));

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-400',
  won: 'bg-emerald-500/20 text-emerald-400',
  lost: 'bg-red-500/20 text-red-400',
  abandoned: 'bg-zinc-500/20 text-zinc-400',
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-zinc-500/20 text-zinc-400' },
  medium: { label: 'Medium', color: 'bg-blue-500/20 text-blue-400' },
  high: { label: 'High', color: 'bg-orange-500/20 text-orange-400' },
  urgent: { label: 'Urgent', color: 'bg-red-500/20 text-red-400' },
};

function formatCurrency(amount: number | null, currency = 'USD'): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

const TABS: ProfileTab[] = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'quotes', label: 'Quotes', icon: '📝' },
  { id: 'invoices', label: 'Invoices', icon: '🧾' },
  { id: 'emails', label: 'Emails', icon: '📧' },
  { id: 'events', label: 'Events', icon: '📅' },
  { id: 'interactions', label: 'Interactions', icon: '💬' },
  { id: 'documents', label: 'Documents', icon: '📁' },
];

function TabLoading() {
  return (
    <div className="flex items-center justify-center h-32 text-zinc-500">Loading...</div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function DealProfile({ dealId }: { dealId: string }) {
  const deal = useCrmStore((s) => s.deals).find((d) => d.id === dealId);
  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);
  const pipelines = useCrmStore((s) => s.pipelines);
  const navigateToProfile = useCrmStore((s) => s.navigateToProfile);
  const [activeTab, setActiveTab] = useState('overview');

  if (!deal) {
    return <ProfileEmptyState message="Deal not found" />;
  }

  const pipeline = pipelines.find((p) => p.id === deal.pipeline_id);
  const currentStage = pipeline?.stages.find((s) => s.id === deal.stage_id);
  const contact = deal.contact_id ? contacts.find((c) => c.id === deal.contact_id) : null;
  const company = deal.company_id ? companies.find((c) => c.id === deal.company_id) : null;
  const agent = deal.owner_agent_id ? getAgent(deal.owner_agent_id) : undefined;
  const dealStatusConfig = DEAL_STATUS_CONFIG[deal.status];
  const priorityConfig = PRIORITY_CONFIG[deal.priority] || PRIORITY_CONFIG.medium;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-zinc-100 truncate">
              {deal.title}
            </h1>
            <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[deal.status] ?? STATUS_COLORS.open}`}>
              {dealStatusConfig.label}
            </span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${priorityConfig.color}`}>
              {priorityConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-400 mt-0.5">
            <span className="text-xl font-bold text-amber-400">
              {formatCurrency(deal.amount, deal.currency)}
            </span>
            {currentStage && (
              <>
                <span className="text-zinc-600">&middot;</span>
                <span>{currentStage.name}</span>
              </>
            )}
            {deal.close_date && (
              <>
                <span className="text-zinc-600">&middot;</span>
                <span>Close: {new Date(deal.close_date).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <ProfileTabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'overview' && (
          <OverviewContent
            deal={deal}
            pipeline={pipeline}
            currentStage={currentStage}
            contact={contact}
            company={company}
            agent={agent}
            navigateToProfile={navigateToProfile}
          />
        )}

        {activeTab === 'quotes' && (
          <Suspense fallback={<TabLoading />}>
            <QuotesTab entityType="deal" entityId={dealId} />
          </Suspense>
        )}

        {activeTab === 'invoices' && (
          <Suspense fallback={<TabLoading />}>
            <InvoicesTab entityType="deal" entityId={dealId} />
          </Suspense>
        )}

        {activeTab === 'emails' && (
          <Suspense fallback={<TabLoading />}>
            <EmailsTab entityType="deal" entityId={dealId} />
          </Suspense>
        )}

        {activeTab === 'events' && (
          <Suspense fallback={<TabLoading />}>
            <EventsTab entityType="deal" entityId={dealId} />
          </Suspense>
        )}

        {activeTab === 'interactions' && (
          <Suspense fallback={<TabLoading />}>
            <InteractionsTab entityType="deal" entityId={dealId} />
          </Suspense>
        )}

        {activeTab === 'documents' && (
          <Suspense fallback={<TabLoading />}>
            <DocumentsTab entityType="deal" entityId={dealId} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

// ─── Overview Tab (Inline) ──────────────────────────────────────────────────

function OverviewContent({
  deal,
  pipeline,
  currentStage,
  contact,
  company,
  agent,
  navigateToProfile,
}: {
  deal: NonNullable<ReturnType<typeof useCrmStore.getState>['deals'][number]>;
  pipeline: ReturnType<typeof useCrmStore.getState>['pipelines'][number] | undefined;
  currentStage: { id: string; name: string; probability: number } | undefined;
  contact: ReturnType<typeof useCrmStore.getState>['contacts'][number] | null | undefined;
  company: ReturnType<typeof useCrmStore.getState>['companies'][number] | null | undefined;
  agent: ReturnType<typeof getAgent>;
  navigateToProfile: ReturnType<typeof useCrmStore.getState>['navigateToProfile'];
}) {
  const dealStatusConfig = DEAL_STATUS_CONFIG[deal.status];
  const priorityConfig = PRIORITY_CONFIG[deal.priority] || PRIORITY_CONFIG.medium;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Deal Info */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Deal Info
        </h3>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Amount</span>
            <span className="text-amber-400 font-semibold">{formatCurrency(deal.amount, deal.currency)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Status</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[deal.status] ?? STATUS_COLORS.open}`}>
              {dealStatusConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Priority</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${priorityConfig.color}`}>
              {priorityConfig.label}
            </span>
          </div>
          <InfoRow label="Pipeline" value={pipeline?.name} />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Stage</span>
            <span className="text-zinc-300">
              {currentStage?.name || '--'}
              {currentStage && <span className="text-zinc-600 ml-1">({currentStage.probability}%)</span>}
            </span>
          </div>
          <InfoRow label="Close Date" value={deal.close_date ? new Date(deal.close_date).toLocaleDateString() : null} />
          {deal.description && (
            <div className="pt-2 border-t border-zinc-800">
              <p className="text-sm text-zinc-400">{deal.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Contact */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Contact
        </h3>
        {contact ? (
          <button
            onClick={() => navigateToProfile('contact', contact.id, deal.title)}
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

        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 mt-5">
          Company
        </h3>
        {company ? (
          <button
            onClick={() => navigateToProfile('company', company.id, deal.title)}
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

      {/* Agent */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Deal Owner
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

      {/* Tags */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Tags
        </h3>
        {deal.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {deal.tags.map((tag) => (
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
