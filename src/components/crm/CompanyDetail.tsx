import { useState, useMemo } from 'react';
import {
  useCrmStore,
  useSelectedCompany,
  useContactsByCompany,
  useInteractionsForEntity,
} from '../../stores/crm';
import { useCRM } from '../../hooks/useCRM';
import {
  LIFECYCLE_STATUS_CONFIG,
  INTERACTION_TYPE_CONFIG,
  type CompanySizeCategory,
} from '../../types/crm';
import { AGENTS, getAgent } from '../../types/supabase';
import { DocumentSection } from '../documents/DocumentSection';

// ─── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

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

const SIZE_LABELS: Record<CompanySizeCategory, string> = {
  solo: 'Solo (1)',
  micro: 'Micro (2-10)',
  small: 'Small (11-50)',
  medium: 'Medium (51-200)',
  large: 'Large (201-1000)',
  enterprise: 'Enterprise (1000+)',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function CompanyDetail() {
  const company = useSelectedCompany();
  const { selectCompany, selectContact } = useCrmStore();
  const { updateCompanyDetails, deleteCompany } = useCRM();

  const contacts = useContactsByCompany(company?.id ?? '');
  const interactions = useInteractionsForEntity('company', company?.id ?? null);

  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync notes when selection changes
  useState(() => {
    if (company) {
      setNotes(company.notes || '');
      setNotesDirty(false);
      setConfirmDelete(false);
    }
  });

  const recentInteractions = useMemo(
    () => interactions.slice(0, 10),
    [interactions]
  );

  if (!company) return null;

  const agent = company.owner_agent_id ? getAgent(company.owner_agent_id) : null;

  const handleAgentChange = (newAgentId: string) => {
    updateCompanyDetails(company.id, { owner_agent_id: newAgentId || null });
  };

  const handleSaveNotes = () => {
    updateCompanyDetails(company.id, { notes });
    setNotesDirty(false);
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (!tag || company.tags.includes(tag)) {
      setTagInput('');
      return;
    }
    updateCompanyDetails(company.id, { tags: [...company.tags, tag] });
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    updateCompanyDetails(company.id, {
      tags: company.tags.filter((t) => t !== tag),
    });
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteCompany(company.id);
    selectCompany(null);
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

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-900/50 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-400">Company Details</h2>
        <button
          onClick={() => selectCompany(null)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Logo + Name */}
        <div className="flex flex-col items-center text-center gap-2">
          {company.logo_url ? (
            <img
              src={company.logo_url}
              alt={company.name}
              className="w-16 h-16 rounded-lg object-cover border-2 border-zinc-700"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-2xl font-semibold border-2 border-zinc-700">
              {company.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="text-lg font-medium text-zinc-100">{company.name}</h3>
            {company.domain && (
              <p className="text-xs text-zinc-500">{company.domain}</p>
            )}
          </div>
        </div>

        {/* Company Info */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Company Info
          </h4>
          <div className="space-y-2">
            {company.industry && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 w-16 shrink-0">Industry</span>
                <span className="text-zinc-300">{company.industry}</span>
              </div>
            )}
            {company.size_category && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 w-16 shrink-0">Size</span>
                <span className="text-zinc-300">
                  {SIZE_LABELS[company.size_category]}
                </span>
              </div>
            )}
            {company.website && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 w-16 shrink-0">Website</span>
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
            {company.phone && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 w-16 shrink-0">Phone</span>
                <span className="text-zinc-300">{company.phone}</span>
              </div>
            )}
            {fullAddress && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-zinc-500 w-16 shrink-0">Address</span>
                <span className="text-zinc-300">{fullAddress}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 w-16 shrink-0">Revenue</span>
              <span className="text-zinc-300">
                {formatRevenue(company.annual_revenue)}
              </span>
            </div>
          </div>
        </div>

        {/* Agent Assignment */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Agent Assignment
          </h4>
          {agent && (
            <div className="text-sm text-zinc-300 mb-2">
              {agent.emoji} {agent.name}
              <span className="text-zinc-500 ml-1">({agent.role})</span>
            </div>
          )}
          <select
            value={company.owner_agent_id || ''}
            onChange={(e) => handleAgentChange(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
          >
            <option value="">Unassigned</option>
            {AGENTS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.emoji} {a.name} -- {a.role}
              </option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Tags
          </h4>
          <div className="flex flex-wrap gap-1 mb-2">
            {company.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-zinc-800 text-zinc-300 rounded-full border border-zinc-700"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="text-zinc-500 hover:text-red-400 transition-colors"
                >
                  ✕
                </button>
              </span>
            ))}
            {company.tags.length === 0 && (
              <span className="text-xs text-zinc-600">No tags</span>
            )}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Add tag..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
            />
            <button
              onClick={handleAddTag}
              disabled={!tagInput.trim()}
              className="px-2 py-1.5 text-xs bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-50 transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* Contacts at this Company */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Contacts ({contacts.length})
          </h4>
          {contacts.length === 0 ? (
            <p className="text-xs text-zinc-600">No contacts at this company</p>
          ) : (
            <div className="space-y-1.5">
              {contacts.map((c) => {
                const lcConfig = LIFECYCLE_STATUS_CONFIG[c.lifecycle_status];
                return (
                  <button
                    key={c.id}
                    onClick={() => selectContact(c.id)}
                    className="w-full flex items-center gap-2 bg-zinc-800/50 border border-zinc-700 rounded-lg p-2 text-left hover:border-zinc-600 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-semibold shrink-0">
                      {c.first_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-zinc-200 truncate">
                        {c.first_name} {c.last_name}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate">
                        {c.job_title || c.email || lcConfig.label}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Documents */}
        <DocumentSection entityType="company" entityId={company.id} />

        {/* Interactions */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Recent Interactions ({interactions.length})
          </h4>
          {recentInteractions.length === 0 ? (
            <p className="text-xs text-zinc-600">No interactions recorded</p>
          ) : (
            <div className="space-y-1.5">
              {recentInteractions.map((interaction) => {
                const typeConfig =
                  INTERACTION_TYPE_CONFIG[interaction.interaction_type];
                return (
                  <div
                    key={interaction.id}
                    className="flex items-start gap-2 bg-zinc-800/30 border border-zinc-800 rounded p-2"
                  >
                    <span className="text-sm shrink-0">{typeConfig.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-300 truncate">
                        {interaction.subject || typeConfig.label}
                      </div>
                      <div className="text-[10px] text-zinc-600">
                        {relativeTime(interaction.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Notes
          </h4>
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setNotesDirty(true);
            }}
            rows={4}
            placeholder="Add notes about this company..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none resize-none transition-colors"
          />
          {notesDirty && (
            <button
              onClick={handleSaveNotes}
              className="mt-1 px-3 py-1.5 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
            >
              Save Notes
            </button>
          )}
        </div>
      </div>

      {/* Actions Footer */}
      <div className="border-t border-zinc-800 p-3">
        <button
          onClick={handleDelete}
          className={`w-full px-3 py-2 text-xs rounded-lg transition-colors ${
            confirmDelete
              ? 'bg-red-500/30 text-red-300 border border-red-500/50'
              : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
          }`}
        >
          {confirmDelete ? 'Click again to confirm delete' : 'Delete Company'}
        </button>
      </div>
    </div>
  );
}
