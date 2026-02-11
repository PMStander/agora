import { useState, Suspense, lazy } from 'react';
import { useCrmStore } from '../../../stores/crm';
import { ProfileTabBar, type ProfileTab } from './ProfileTabBar';
import { ProfileEmptyState } from './ProfileEmptyState';
import { LIFECYCLE_STATUS_CONFIG } from '../../../types/crm';
import { getAgent } from '../../../types/supabase';

const DealsTab = lazy(() => import('./tabs/DealsTab'));
const QuotesTab = lazy(() => import('./tabs/QuotesTab'));
const InvoicesTab = lazy(() => import('./tabs/InvoicesTab'));
const EmailsTab = lazy(() => import('./tabs/EmailsTab'));
const EventsTab = lazy(() => import('./tabs/EventsTab'));
const InteractionsTab = lazy(() => import('./tabs/InteractionsTab'));
const DocumentsTab = lazy(() => import('./tabs/DocumentsTab'));
const LeadScoreTab = lazy(() => import('./tabs/LeadScoreTab'));

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  subscriber: 'bg-zinc-500/20 text-zinc-400',
  lead: 'bg-blue-500/20 text-blue-400',
  marketing_qualified: 'bg-cyan-500/20 text-cyan-400',
  sales_qualified: 'bg-indigo-500/20 text-indigo-400',
  opportunity: 'bg-amber-500/20 text-amber-400',
  customer: 'bg-emerald-500/20 text-emerald-400',
  evangelist: 'bg-purple-500/20 text-purple-400',
  churned: 'bg-red-500/20 text-red-400',
  other: 'bg-zinc-500/20 text-zinc-400',
};

const TABS: ProfileTab[] = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'deals', label: 'Deals', icon: '💰' },
  { id: 'quotes', label: 'Quotes', icon: '📝' },
  { id: 'invoices', label: 'Invoices', icon: '🧾' },
  { id: 'emails', label: 'Emails', icon: '📧' },
  { id: 'events', label: 'Events', icon: '📅' },
  { id: 'interactions', label: 'Interactions', icon: '💬' },
  { id: 'documents', label: 'Documents', icon: '📁' },
  { id: 'lead_score', label: 'Lead Score', icon: '🎯' },
];

function TabLoading() {
  return (
    <div className="flex items-center justify-center h-32 text-zinc-500">Loading...</div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ContactProfile({ contactId }: { contactId: string }) {
  const contact = useCrmStore((s) => s.contacts).find((c) => c.id === contactId);
  const companies = useCrmStore((s) => s.companies);
  const navigateToProfile = useCrmStore((s) => s.navigateToProfile);
  const [activeTab, setActiveTab] = useState('overview');

  if (!contact) {
    return <ProfileEmptyState message="Contact not found" />;
  }

  const company = contact.company_id
    ? companies.find((c) => c.id === contact.company_id)
    : null;

  const agent = contact.owner_agent_id ? getAgent(contact.owner_agent_id) : undefined;
  const lifecycleConfig = LIFECYCLE_STATUS_CONFIG[contact.lifecycle_status];
  const initials = `${contact.first_name.charAt(0)}${contact.last_name.charAt(0)}`.toUpperCase();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-zinc-800 bg-zinc-900/60">
        {contact.avatar_url ? (
          <img
            src={contact.avatar_url}
            alt={`${contact.first_name} ${contact.last_name}`}
            className="w-14 h-14 rounded-full object-cover border-2 border-zinc-700 shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xl font-semibold border-2 border-zinc-700 shrink-0">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-zinc-100 truncate">
              {contact.first_name} {contact.last_name}
            </h1>
            <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[contact.lifecycle_status] ?? STATUS_COLORS.other}`}>
              {lifecycleConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-400 mt-0.5">
            {contact.job_title && <span>{contact.job_title}</span>}
            {contact.job_title && company && <span className="text-zinc-600">&middot;</span>}
            {company && (
              <button
                onClick={() => navigateToProfile('company', company.id, `${contact.first_name} ${contact.last_name}`)}
                className="text-amber-400 hover:text-amber-300 transition-colors"
              >
                {company.name}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
            {contact.email && <span>{contact.email}</span>}
            {contact.email && contact.phone && <span className="text-zinc-700">&middot;</span>}
            {contact.phone && <span>{contact.phone}</span>}
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <ProfileTabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'overview' && (
          <OverviewContent
            contact={contact}
            company={company}
            agent={agent}
            navigateToProfile={navigateToProfile}
          />
        )}

        {activeTab === 'deals' && (
          <Suspense fallback={<TabLoading />}>
            <DealsTab entityType="contact" entityId={contactId} />
          </Suspense>
        )}

        {activeTab === 'quotes' && (
          <Suspense fallback={<TabLoading />}>
            <QuotesTab entityType="contact" entityId={contactId} />
          </Suspense>
        )}

        {activeTab === 'invoices' && (
          <Suspense fallback={<TabLoading />}>
            <InvoicesTab entityType="contact" entityId={contactId} />
          </Suspense>
        )}

        {activeTab === 'emails' && (
          <Suspense fallback={<TabLoading />}>
            <EmailsTab entityType="contact" entityId={contactId} />
          </Suspense>
        )}

        {activeTab === 'events' && (
          <Suspense fallback={<TabLoading />}>
            <EventsTab entityType="contact" entityId={contactId} />
          </Suspense>
        )}

        {activeTab === 'interactions' && (
          <Suspense fallback={<TabLoading />}>
            <InteractionsTab entityType="contact" entityId={contactId} />
          </Suspense>
        )}

        {activeTab === 'documents' && (
          <Suspense fallback={<TabLoading />}>
            <DocumentsTab entityType="contact" entityId={contactId} />
          </Suspense>
        )}

        {activeTab === 'lead_score' && (
          <Suspense fallback={<TabLoading />}>
            <LeadScoreTab contactId={contactId} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

// ─── Overview Tab (Inline) ──────────────────────────────────────────────────

function OverviewContent({
  contact,
  company,
  agent,
  navigateToProfile,
}: {
  contact: NonNullable<ReturnType<typeof useCrmStore.getState>['contacts'][number]>;
  company: ReturnType<typeof useCrmStore.getState>['companies'][number] | null | undefined;
  agent: ReturnType<typeof getAgent>;
  navigateToProfile: ReturnType<typeof useCrmStore.getState>['navigateToProfile'];
}) {
  const lifecycleConfig = LIFECYCLE_STATUS_CONFIG[contact.lifecycle_status];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Contact Info */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Contact Info
        </h3>
        <div className="space-y-2.5">
          <InfoRow label="Email" value={contact.email} />
          <InfoRow label="Phone" value={contact.phone} />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500 w-24 shrink-0">Status</span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${STATUS_COLORS[contact.lifecycle_status] ?? STATUS_COLORS.other}`}>
              {lifecycleConfig.label}
            </span>
          </div>
          <InfoRow label="Lead Source" value={contact.lead_source} />
          <InfoRow label="Created" value={contact.created_at ? new Date(contact.created_at).toLocaleDateString() : null} />
        </div>
      </div>

      {/* Company */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Company
        </h3>
        {company ? (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 w-24 shrink-0">Name</span>
              <button
                onClick={() => navigateToProfile('company', company.id, `${contact.first_name} ${contact.last_name}`)}
                className="text-amber-400 hover:text-amber-300 truncate transition-colors"
              >
                {company.name}
              </button>
            </div>
            <InfoRow label="Job Title" value={contact.job_title} />
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No company linked</p>
        )}
      </div>

      {/* Agent */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Assigned Agent
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
        {contact.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {contact.tags.map((tag) => (
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

      {/* Notes */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 md:col-span-2">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          Notes
        </h3>
        {contact.notes ? (
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{contact.notes}</p>
        ) : (
          <p className="text-sm text-zinc-600">No notes</p>
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
