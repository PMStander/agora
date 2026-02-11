import { useState, useMemo, useEffect } from 'react';
import { useCrmStore, useFilteredContacts } from '../../stores/crm';
import { useCRM } from '../../hooks/useCRM';
import { useDuplicateDetection } from '../../hooks/useDuplicateDetection';
import { LIFECYCLE_STATUS_CONFIG, type LifecycleStatus, type LeadScoreLabel } from '../../types/crm';
import type { Contact } from '../../types/crm';
import { AGENTS, getAgent } from '../../types/supabase';
import { LeadScoreBadge } from './LeadScoreBadge';
import { DuplicateBadge } from './DuplicateBadge';
import { DuplicateDetectionModal } from './DuplicateDetectionModal';
import { ImportContactsModal } from './ImportContactsModal';
import { CreateContactModal } from './CreateContactModal';
import { ExportButton } from './ExportButton';
import { SaveViewButton } from './SaveViewButton';

type ContactSortField = 'name' | 'email' | 'lifecycle_status' | 'last_contacted_at' | 'created_at';
type SortDirection = 'asc' | 'desc';

const LIFECYCLE_ORDER: Record<string, number> = {
  subscriber: 0,
  lead: 1,
  marketing_qualified: 2,
  sales_qualified: 3,
  opportunity: 4,
  customer: 5,
  evangelist: 6,
  churned: 7,
  other: 8,
};

function compareContacts(a: Contact, b: Contact, field: ContactSortField, dir: SortDirection): number {
  let cmp = 0;
  switch (field) {
    case 'name':
      cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      break;
    case 'email':
      cmp = (a.email ?? '').localeCompare(b.email ?? '');
      break;
    case 'lifecycle_status':
      cmp = (LIFECYCLE_ORDER[a.lifecycle_status] ?? 99) - (LIFECYCLE_ORDER[b.lifecycle_status] ?? 99);
      break;
    case 'last_contacted_at':
      cmp = (a.last_contacted_at ?? '').localeCompare(b.last_contacted_at ?? '');
      break;
    case 'created_at':
      cmp = a.created_at.localeCompare(b.created_at);
      break;
  }
  return dir === 'asc' ? cmp : -cmp;
}

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

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ContactList() {
  const { isConfigured } = useCRM();
  const filteredContacts = useFilteredContacts();
  const companies = useCrmStore((s) => s.companies);
  const selectedContactId = useCrmStore((s) => s.selectedContactId);
  const selectContact = useCrmStore((s) => s.selectContact);
  const searchQuery = useCrmStore((s) => s.searchQuery);
  const setSearchQuery = useCrmStore((s) => s.setSearchQuery);
  const filters = useCrmStore((s) => s.filters);
  const setFilters = useCrmStore((s) => s.setFilters);

  const [sortField, setSortField] = useState<ContactSortField>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateContactModal, setShowCreateContactModal] = useState(false);

  const {
    findDuplicates,
    activeGroups,
    isScanning,
    merging,
    mergeContacts,
    dismissDuplicate,
  } = useDuplicateDetection();

  // Auto-scan for duplicates when contacts change (debounced)
  useEffect(() => {
    if (filteredContacts.length < 2) return;
    const timer = setTimeout(() => {
      findDuplicates();
    }, 500);
    return () => clearTimeout(timer);
  }, [filteredContacts.length, findDuplicates]);

  const handleSort = (field: ContactSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortIndicator = (field: ContactSortField) =>
    sortField === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const contacts = useMemo(
    () => [...filteredContacts].sort((a, b) => compareContacts(a, b, sortField, sortDir)),
    [filteredContacts, sortField, sortDir]
  );

  const getCompanyName = (companyId: string | null): string => {
    if (!companyId) return '--';
    return companies.find((c) => c.id === companyId)?.name ?? '--';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-100">Contacts</h2>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
            {contacts.length}
          </span>
          {!isConfigured && (
            <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              Local Mode
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DuplicateBadge
            count={activeGroups.length}
            onClick={() => setShowDuplicateModal(true)}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 w-64"
          />
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-1.5 text-sm text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
          >
            Import
          </button>
          <ExportButton
            data={contacts.map((c) => ({
              first_name: c.first_name,
              last_name: c.last_name,
              email: c.email ?? '',
              phone: c.phone ?? '',
              job_title: c.job_title ?? '',
              company: getCompanyName(c.company_id),
              lifecycle_status: c.lifecycle_status,
              lead_source: c.lead_source ?? '',
              lead_score: c.lead_score,
              tags: c.tags.join(', '),
              notes: c.notes ?? '',
            }))}
            columns={[
              { key: 'first_name', label: 'First Name' },
              { key: 'last_name', label: 'Last Name' },
              { key: 'email', label: 'Email' },
              { key: 'phone', label: 'Phone' },
              { key: 'job_title', label: 'Job Title' },
              { key: 'company', label: 'Company' },
              { key: 'lifecycle_status', label: 'Lifecycle Status' },
              { key: 'lead_source', label: 'Lead Source' },
              { key: 'lead_score', label: 'Lead Score' },
              { key: 'tags', label: 'Tags' },
              { key: 'notes', label: 'Notes' },
            ]}
            filename="contacts-export"
            label="Export"
          />
          <button
            onClick={() => {
              findDuplicates();
              setShowDuplicateModal(true);
            }}
            disabled={isScanning}
            className="px-4 py-1.5 bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-medium rounded-lg hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50 transition-colors"
          >
            {isScanning ? 'Scanning...' : 'Find Duplicates'}
          </button>
          <button
            onClick={() => setShowCreateContactModal(true)}
            className="px-4 py-1.5 bg-amber-500 text-black text-sm font-medium rounded-lg hover:bg-amber-400 transition-colors"
          >
            New Contact
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/30">
        <select
          value={filters.lifecycleStatus}
          onChange={(e) =>
            setFilters({ lifecycleStatus: e.target.value as LifecycleStatus | 'all' })
          }
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300"
        >
          <option value="all">All Statuses</option>
          {(Object.keys(LIFECYCLE_STATUS_CONFIG) as LifecycleStatus[]).map((status) => (
            <option key={status} value={status}>
              {LIFECYCLE_STATUS_CONFIG[status].label}
            </option>
          ))}
        </select>
        <select
          value={filters.ownerAgent ?? ''}
          onChange={(e) =>
            setFilters({ ownerAgent: e.target.value || null })
          }
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-300"
        >
          <option value="">All Agents</option>
          {AGENTS.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.emoji} {agent.name}
            </option>
          ))}
        </select>
        <SaveViewButton entityType="contacts" />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1.5fr_2fr_1fr_0.5fr_1fr_1fr] gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 text-xs text-zinc-500 font-medium sticky top-0">
          <button onClick={() => handleSort('name')} className="text-left hover:text-zinc-300 transition-colors">
            Name{sortIndicator('name')}
          </button>
          <span>Company</span>
          <button onClick={() => handleSort('email')} className="text-left hover:text-zinc-300 transition-colors">
            Email{sortIndicator('email')}
          </button>
          <button onClick={() => handleSort('lifecycle_status')} className="text-left hover:text-zinc-300 transition-colors">
            Status{sortIndicator('lifecycle_status')}
          </button>
          <span>Score</span>
          <span>Agent</span>
          <button onClick={() => handleSort('last_contacted_at')} className="text-left hover:text-zinc-300 transition-colors">
            Last Contact{sortIndicator('last_contacted_at')}
          </button>
        </div>

        {/* Table rows */}
        {contacts.length === 0 ? (
          <div className="text-center text-zinc-600 py-12">
            <p className="text-sm">No contacts found</p>
            <p className="text-xs mt-1">
              {searchQuery || filters.lifecycleStatus !== 'all' || filters.ownerAgent
                ? 'Try adjusting your filters'
                : 'Create a contact to get started'}
            </p>
          </div>
        ) : (
          contacts.map((contact) => {
            const statusConfig = LIFECYCLE_STATUS_CONFIG[contact.lifecycle_status];
            const agent = contact.owner_agent_id
              ? getAgent(contact.owner_agent_id)
              : null;

            return (
              <div
                key={contact.id}
                onClick={() => selectContact(contact.id)}
                className={`
                  grid grid-cols-[2fr_1.5fr_2fr_1fr_0.5fr_1fr_1fr] gap-2 px-4 py-2.5 border-b border-zinc-800/50
                  cursor-pointer transition-colors
                  ${selectedContactId === contact.id
                    ? 'bg-zinc-800'
                    : 'hover:bg-zinc-800/50'
                  }
                `}
              >
                {/* Name */}
                <span className="text-sm text-zinc-100 truncate">
                  {contact.first_name} {contact.last_name}
                </span>

                {/* Company */}
                <span className="text-sm text-zinc-400 truncate">
                  {getCompanyName(contact.company_id)}
                </span>

                {/* Email */}
                <span className="text-sm text-zinc-400 truncate">
                  {contact.email ?? '--'}
                </span>

                {/* Lifecycle Status */}
                <span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      statusBadgeColors[statusConfig.color] ?? statusBadgeColors.zinc
                    }`}
                  >
                    {statusConfig.label}
                  </span>
                </span>

                {/* Lead Score */}
                <span>
                  <LeadScoreBadge
                    score={contact.lead_score ?? 0}
                    label={(contact.lead_score_label as LeadScoreLabel) ?? 'cold'}
                  />
                </span>

                {/* Agent */}
                <span className="text-sm text-zinc-400 truncate">
                  {agent ? (
                    <span title={`${agent.name} — ${agent.role}`}>
                      {agent.emoji} {agent.name}
                    </span>
                  ) : (
                    '--'
                  )}
                </span>

                {/* Last Contact */}
                <span className="text-xs text-zinc-500">
                  {formatRelativeTime(contact.last_contacted_at)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Duplicate Detection Modal */}
      <DuplicateDetectionModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        groups={activeGroups}
        merging={merging}
        onMerge={mergeContacts}
        onDismiss={dismissDuplicate}
      />

      {/* Import Contacts Modal */}
      <ImportContactsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />

      {/* Create Contact Modal */}
      <CreateContactModal
        isOpen={showCreateContactModal}
        onClose={() => setShowCreateContactModal(false)}
      />
    </div>
  );
}
