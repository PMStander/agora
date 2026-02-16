import { useState, Suspense, lazy } from 'react';
import { useCrmStore } from '../../../stores/crm';
import { useCRM } from '../../../hooks/useCRM';
import { ProfileTabBar, type ProfileTab } from './ProfileTabBar';
import { ProfileEmptyState } from './ProfileEmptyState';
import type { CompanySizeCategory } from '../../../types/crm';
import { getAgent, AGENTS } from '../../../types/supabase';
import { CreateContactModal } from '../CreateContactModal';
import { CreateDealModal } from '../CreateDealModal';
import { LogInteractionModal } from '../LogInteractionModal';

const ContactsTab = lazy(() => import('./tabs/ContactsTab'));
const DealsTab = lazy(() => import('./tabs/DealsTab'));
const QuotesTab = lazy(() => import('./tabs/QuotesTab'));
const InvoicesTab = lazy(() => import('./tabs/InvoicesTab'));
const EmailsTab = lazy(() => import('./tabs/EmailsTab'));
const EventsTab = lazy(() => import('./tabs/EventsTab'));
const InteractionsTab = lazy(() => import('./tabs/InteractionsTab'));
const DocumentsTab = lazy(() => import('./tabs/DocumentsTab'));
const ProjectsTab = lazy(() => import('./tabs/ProjectsTab'));

// ─── Helpers ────────────────────────────────────────────────────────────────

const SIZE_LABELS: Record<CompanySizeCategory, string> = {
  solo: 'Solo (1)',
  micro: 'Micro (2-10)',
  small: 'Small (11-50)',
  medium: 'Medium (51-200)',
  large: 'Large (201-1000)',
  enterprise: 'Enterprise (1000+)',
};

const SIZE_BADGE_COLORS: Record<CompanySizeCategory, string> = {
  solo: 'bg-zinc-500/20 text-zinc-400',
  micro: 'bg-zinc-500/20 text-zinc-400',
  small: 'bg-blue-500/20 text-blue-400',
  medium: 'bg-cyan-500/20 text-cyan-400',
  large: 'bg-indigo-500/20 text-indigo-400',
  enterprise: 'bg-purple-500/20 text-purple-400',
};

const SIZE_OPTIONS: CompanySizeCategory[] = ['solo', 'micro', 'small', 'medium', 'large', 'enterprise'];

function formatRevenue(amount: number | null): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    notation: 'compact',
    compactDisplay: 'short',
  }).format(amount);
}

const TABS: ProfileTab[] = [
  { id: 'overview', label: 'Overview', icon: '📋' },
  { id: 'contacts', label: 'Contacts', icon: '👤' },
  { id: 'deals', label: 'Deals', icon: '💰' },
  { id: 'quotes', label: 'Quotes', icon: '📝' },
  { id: 'invoices', label: 'Invoices', icon: '🧾' },
  { id: 'emails', label: 'Emails', icon: '📧' },
  { id: 'events', label: 'Events', icon: '📅' },
  { id: 'interactions', label: 'Interactions', icon: '💬' },
  { id: 'projects', label: 'Projects', icon: '📐' },
  { id: 'documents', label: 'Documents', icon: '📁' },
];

function TabLoading() {
  return (
    <div className="flex items-center justify-center h-32 text-zinc-500">Loading...</div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CompanyProfile({ companyId }: { companyId: string }) {
  const company = useCrmStore((s) => s.companies).find((c) => c.id === companyId);
  const [activeTab, setActiveTab] = useState('overview');

  // Modal states
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [showLogInteraction, setShowLogInteraction] = useState(false);

  if (!company) {
    return <ProfileEmptyState message="Company not found" />;
  }

  const agent = company.owner_agent_id ? getAgent(company.owner_agent_id) : undefined;
  const initial = company.name.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-zinc-800 bg-zinc-900/60">
        {company.logo_url ? (
          <img
            src={company.logo_url}
            alt={company.name}
            className="w-14 h-14 rounded-lg object-cover border-2 border-zinc-700 shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xl font-semibold border-2 border-zinc-700 shrink-0">
            {initial}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-zinc-100 truncate">
              {company.name}
            </h1>
            {company.size_category && (
              <span className={`px-2 py-0.5 text-xs rounded-full ${SIZE_BADGE_COLORS[company.size_category] ?? 'bg-zinc-500/20 text-zinc-400'}`}>
                {SIZE_LABELS[company.size_category]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-400 mt-0.5">
            {company.domain && <span>{company.domain}</span>}
            {company.domain && company.industry && <span className="text-zinc-600">&middot;</span>}
            {company.industry && <span>{company.industry}</span>}
          </div>
        </div>
        {/* Quick actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowCreateContact(true)} className="px-2.5 py-1 text-xs font-medium bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors">+ Contact</button>
          <button onClick={() => setShowCreateDeal(true)} className="px-2.5 py-1 text-xs font-medium bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors">+ Deal</button>
          <button onClick={() => setShowLogInteraction(true)} className="px-2.5 py-1 text-xs font-medium bg-zinc-700/50 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors">Log</button>
        </div>
      </div>

      {/* Tab Bar */}
      <ProfileTabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'overview' && (
          <OverviewContent company={company} agent={agent} companyId={companyId} />
        )}

        {activeTab === 'contacts' && (
          <Suspense fallback={<TabLoading />}>
            <ContactsTab entityType="company" entityId={companyId} onAddContact={() => setShowCreateContact(true)} />
          </Suspense>
        )}

        {activeTab === 'deals' && (
          <Suspense fallback={<TabLoading />}>
            <DealsTab entityType="company" entityId={companyId} onAddDeal={() => setShowCreateDeal(true)} />
          </Suspense>
        )}

        {activeTab === 'quotes' && (
          <Suspense fallback={<TabLoading />}>
            <QuotesTab entityType="company" entityId={companyId} />
          </Suspense>
        )}

        {activeTab === 'invoices' && (
          <Suspense fallback={<TabLoading />}>
            <InvoicesTab entityType="company" entityId={companyId} />
          </Suspense>
        )}

        {activeTab === 'emails' && (
          <Suspense fallback={<TabLoading />}>
            <EmailsTab entityType="company" entityId={companyId} />
          </Suspense>
        )}

        {activeTab === 'events' && (
          <Suspense fallback={<TabLoading />}>
            <EventsTab entityType="company" entityId={companyId} />
          </Suspense>
        )}

        {activeTab === 'interactions' && (
          <Suspense fallback={<TabLoading />}>
            <InteractionsTab entityType="company" entityId={companyId} onLogInteraction={() => setShowLogInteraction(true)} />
          </Suspense>
        )}

        {activeTab === 'projects' && (
          <Suspense fallback={<TabLoading />}>
            <ProjectsTab entityType="company" entityId={companyId} />
          </Suspense>
        )}

        {activeTab === 'documents' && (
          <Suspense fallback={<TabLoading />}>
            <DocumentsTab entityType="company" entityId={companyId} />
          </Suspense>
        )}
      </div>

      {/* Modals */}
      <CreateContactModal isOpen={showCreateContact} onClose={() => setShowCreateContact(false)} prefillCompanyId={companyId} />
      <CreateDealModal isOpen={showCreateDeal} onClose={() => setShowCreateDeal(false)} prefillCompanyId={companyId} />
      <LogInteractionModal isOpen={showLogInteraction} onClose={() => setShowLogInteraction(false)} prefillCompanyId={companyId} />
    </div>
  );
}

// ─── Overview Tab (Inline) ──────────────────────────────────────────────────

function OverviewContent({
  company,
  agent,
  companyId,
}: {
  company: NonNullable<ReturnType<typeof useCrmStore.getState>['companies'][number]>;
  agent: ReturnType<typeof getAgent>;
  companyId: string;
}) {
  const { updateCompanyDetails } = useCRM();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state
  const [editIndustry, setEditIndustry] = useState(company.industry ?? '');
  const [editSize, setEditSize] = useState(company.size_category ?? '');
  const [editWebsite, setEditWebsite] = useState(company.website ?? '');
  const [editPhone, setEditPhone] = useState(company.phone ?? '');
  const [editRevenue, setEditRevenue] = useState(company.annual_revenue?.toString() ?? '');
  const [editNotes, setEditNotes] = useState(company.notes ?? '');
  const [editTags, setEditTags] = useState(company.tags.join(', '));
  const [editAgentId, setEditAgentId] = useState(company.owner_agent_id ?? '');

  const startEdit = () => {
    setEditIndustry(company.industry ?? '');
    setEditSize(company.size_category ?? '');
    setEditWebsite(company.website ?? '');
    setEditPhone(company.phone ?? '');
    setEditRevenue(company.annual_revenue?.toString() ?? '');
    setEditNotes(company.notes ?? '');
    setEditTags(company.tags.join(', '));
    setEditAgentId(company.owner_agent_id ?? '');
    setIsEditing(true);
  };

  const cancelEdit = () => setIsEditing(false);

  const saveEdit = async () => {
    setIsSaving(true);
    try {
      const tags = editTags.split(',').map(t => t.trim()).filter(Boolean);
      await updateCompanyDetails(companyId, {
        industry: editIndustry || null,
        size_category: (editSize as CompanySizeCategory) || null,
        website: editWebsite || null,
        phone: editPhone || null,
        annual_revenue: editRevenue ? parseFloat(editRevenue) : null,
        notes: editNotes || null,
        tags,
        owner_agent_id: editAgentId || null,
      });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update company:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const fullAddress = [
    company.address_line1,
    company.address_line2,
    company.city,
    company.state,
    company.postal_code,
    company.country !== 'US' ? company.country : null,
  ]
    .filter(Boolean)
    .join(', ');

  const inputClass = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors';

  return (
    <div>
      {/* Edit/Save controls */}
      <div className="flex justify-end mb-3 gap-2">
        {isEditing ? (
          <>
            <button onClick={cancelEdit} className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
            <button onClick={saveEdit} disabled={isSaving} className="px-3 py-1 text-xs font-medium bg-amber-500 text-black rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors">
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </>
        ) : (
          <button onClick={startEdit} className="px-3 py-1 text-xs font-medium bg-zinc-700/50 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors">Edit</button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Company Info */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Company Info
          </h3>
          <div className="space-y-2.5">
            {isEditing ? (
              <>
                <EditRow label="Industry"><input type="text" value={editIndustry} onChange={e => setEditIndustry(e.target.value)} placeholder="Technology" className={inputClass} /></EditRow>
                <EditRow label="Size">
                  <select value={editSize} onChange={e => setEditSize(e.target.value)} className={inputClass}>
                    <option value="">Not set</option>
                    {SIZE_OPTIONS.map(s => <option key={s} value={s}>{SIZE_LABELS[s]}</option>)}
                  </select>
                </EditRow>
                <EditRow label="Website"><input type="text" value={editWebsite} onChange={e => setEditWebsite(e.target.value)} placeholder="example.com" className={inputClass} /></EditRow>
                <EditRow label="Phone"><input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+1..." className={inputClass} /></EditRow>
                <EditRow label="Revenue"><input type="number" value={editRevenue} onChange={e => setEditRevenue(e.target.value)} placeholder="0" className={inputClass} /></EditRow>
              </>
            ) : (
              <>
                <InfoRow label="Industry" value={company.industry} />
                <InfoRow label="Size" value={company.size_category ? SIZE_LABELS[company.size_category] : null} />
                {company.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-zinc-500 w-24 shrink-0">Website</span>
                    <a
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:text-amber-300 truncate transition-colors"
                    >
                      {company.website}
                    </a>
                  </div>
                )}
                <InfoRow label="Phone" value={company.phone} />
                <InfoRow label="Address" value={fullAddress || null} />
                <InfoRow label="Revenue" value={formatRevenue(company.annual_revenue)} />
                <InfoRow label="Created" value={company.created_at ? new Date(company.created_at).toLocaleDateString() : null} />
              </>
            )}
          </div>
        </div>

        {/* Agent */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Assigned Agent
          </h3>
          {isEditing ? (
            <select value={editAgentId} onChange={e => setEditAgentId(e.target.value)} className={inputClass}>
              <option value="">Unassigned</option>
              {AGENTS.map(a => <option key={a.id} value={a.id}>{a.emoji} {a.name} -- {a.role}</option>)}
            </select>
          ) : agent ? (
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
          {isEditing ? (
            <input type="text" value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="vip, enterprise" className={inputClass} />
          ) : company.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {company.tags.map((tag) => (
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
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Notes
          </h3>
          {isEditing ? (
            <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Notes..." rows={4} className={`${inputClass} resize-none`} />
          ) : company.notes ? (
            <p className="text-sm text-zinc-300 whitespace-pre-wrap">{company.notes}</p>
          ) : (
            <p className="text-sm text-zinc-600">No notes</p>
          )}
        </div>
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

function EditRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-zinc-500 w-24 shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
