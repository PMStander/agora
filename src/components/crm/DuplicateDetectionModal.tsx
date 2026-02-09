import { useState, useMemo, useCallback } from 'react';
import type { Contact } from '../../types/crm';
import type { DuplicateGroup, MatchType, MatchConfidence } from '../../lib/duplicateDetection';
import { useCrmStore } from '../../stores/crm';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DuplicateDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: DuplicateGroup[];
  merging: string | null;
  onMerge: (primaryId: string, duplicateIds: string[]) => Promise<boolean>;
  onDismiss: (groupIndex: number) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MATCH_TYPE_CONFIG: Record<MatchType, { label: string; bgClass: string; textClass: string }> = {
  email: { label: 'Email Match', bgClass: 'bg-red-500/20', textClass: 'text-red-400' },
  phone: { label: 'Phone Match', bgClass: 'bg-amber-500/20', textClass: 'text-amber-400' },
  name: { label: 'Similar Name', bgClass: 'bg-blue-500/20', textClass: 'text-blue-400' },
};

const CONFIDENCE_CONFIG: Record<MatchConfidence, { label: string; bgClass: string; textClass: string }> = {
  high: { label: 'High', bgClass: 'bg-red-500/15', textClass: 'text-red-400' },
  medium: { label: 'Medium', bgClass: 'bg-amber-500/15', textClass: 'text-amber-400' },
  low: { label: 'Low', bgClass: 'bg-zinc-500/15', textClass: 'text-zinc-400' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Pick the most recently updated contact as default primary */
function defaultPrimary(contacts: Contact[]): string {
  let best = contacts[0];
  for (const c of contacts) {
    if (c.updated_at > best.updated_at) best = c;
  }
  return best.id;
}

// ─── Contact Comparison Fields ──────────────────────────────────────────────

interface ComparisonField {
  label: string;
  getValue: (c: Contact) => string;
}

const COMPARISON_FIELDS: ComparisonField[] = [
  { label: 'First Name', getValue: (c) => c.first_name },
  { label: 'Last Name', getValue: (c) => c.last_name },
  { label: 'Email', getValue: (c) => c.email ?? '--' },
  { label: 'Phone', getValue: (c) => c.phone ?? '--' },
  { label: 'Job Title', getValue: (c) => c.job_title ?? '--' },
  { label: 'Status', getValue: (c) => c.lifecycle_status },
  { label: 'Lead Score', getValue: (c) => String(c.lead_score) },
  { label: 'Lead Source', getValue: (c) => c.lead_source ?? '--' },
  { label: 'Tags', getValue: (c) => c.tags.length > 0 ? c.tags.join(', ') : '--' },
  { label: 'Notes', getValue: (c) => c.notes ? (c.notes.length > 60 ? c.notes.slice(0, 60) + '...' : c.notes) : '--' },
  { label: 'Created', getValue: (c) => formatDate(c.created_at) },
  { label: 'Updated', getValue: (c) => formatDate(c.updated_at) },
  { label: 'Last Contact', getValue: (c) => formatDate(c.last_contacted_at) },
];

// ─── Group Card ─────────────────────────────────────────────────────────────

function DuplicateGroupCard({
  group,
  groupIndex,
  primaryId,
  onSelectPrimary,
  onMerge,
  onDismiss,
  isMerging,
}: {
  group: DuplicateGroup;
  groupIndex: number;
  primaryId: string;
  onSelectPrimary: (id: string) => void;
  onMerge: () => void;
  onDismiss: () => void;
  isMerging: boolean;
}) {
  const companies = useCrmStore((s) => s.companies);

  const getCompanyName = (companyId: string | null): string => {
    if (!companyId) return '--';
    return companies.find((c) => c.id === companyId)?.name ?? '--';
  };

  const matchConfig = MATCH_TYPE_CONFIG[group.matchType];
  const confConfig = CONFIDENCE_CONFIG[group.confidence];

  return (
    <div className="border border-zinc-700 rounded-lg bg-zinc-800/50 overflow-hidden">
      {/* Group header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 bg-zinc-800/80">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs rounded-full ${matchConfig.bgClass} ${matchConfig.textClass}`}>
            {matchConfig.label}
          </span>
          <span className={`px-2 py-0.5 text-xs rounded-full ${confConfig.bgClass} ${confConfig.textClass}`}>
            {confConfig.label} confidence
          </span>
          <span className="text-xs text-zinc-500">
            {group.contacts.length} contacts
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDismiss}
            disabled={isMerging}
            className="px-3 py-1.5 text-xs text-zinc-400 bg-zinc-700/50 border border-zinc-600 rounded-lg hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-50 transition-colors"
          >
            Not a Duplicate
          </button>
          <button
            onClick={onMerge}
            disabled={isMerging}
            className="px-3 py-1.5 text-xs text-black bg-amber-500 rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isMerging ? 'Merging...' : 'Merge'}
          </button>
        </div>
      </div>

      {/* Side-by-side comparison table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700">
              <th className="px-4 py-2 text-left text-xs font-medium text-zinc-500 w-32">
                Field
              </th>
              {group.contacts.map((contact) => (
                <th key={contact.id} className="px-4 py-2 text-left text-xs font-medium text-zinc-400 min-w-[200px]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`primary-${groupIndex}`}
                      checked={primaryId === contact.id}
                      onChange={() => onSelectPrimary(contact.id)}
                      className="accent-amber-500"
                    />
                    <span className={primaryId === contact.id ? 'text-amber-400' : ''}>
                      {primaryId === contact.id ? 'Primary' : 'Duplicate'}
                    </span>
                  </label>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Avatar + Name row */}
            <tr className="border-b border-zinc-800/50">
              <td className="px-4 py-2 text-xs text-zinc-500">Contact</td>
              {group.contacts.map((contact) => (
                <td key={contact.id} className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    {contact.avatar_url ? (
                      <img
                        src={contact.avatar_url}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border border-zinc-600"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-semibold border border-zinc-600">
                        {contact.first_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-zinc-200 font-medium">
                        {contact.first_name} {contact.last_name}
                      </div>
                      {contact.job_title && (
                        <div className="text-xs text-zinc-500">{contact.job_title}</div>
                      )}
                    </div>
                  </div>
                </td>
              ))}
            </tr>

            {/* Company row */}
            <tr className="border-b border-zinc-800/50">
              <td className="px-4 py-2 text-xs text-zinc-500">Company</td>
              {group.contacts.map((contact) => (
                <td key={contact.id} className="px-4 py-2 text-zinc-300">
                  {getCompanyName(contact.company_id)}
                </td>
              ))}
            </tr>

            {/* Comparison fields */}
            {COMPARISON_FIELDS.map((field) => {
              const values = group.contacts.map((c) => field.getValue(c));
              const allSame = values.every((v) => v === values[0]);

              return (
                <tr key={field.label} className="border-b border-zinc-800/50">
                  <td className="px-4 py-2 text-xs text-zinc-500">{field.label}</td>
                  {group.contacts.map((contact, idx) => {
                    const value = values[idx];
                    const isDifferent = !allSame && value !== '--';
                    return (
                      <td
                        key={contact.id}
                        className={`px-4 py-2 text-xs ${
                          isDifferent
                            ? 'text-amber-300 bg-amber-500/5'
                            : 'text-zinc-400'
                        }`}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

export function DuplicateDetectionModal({
  isOpen,
  onClose,
  groups,
  merging,
  onMerge,
  onDismiss,
}: DuplicateDetectionModalProps) {
  // Track selected primary for each group
  const [primarySelections, setPrimarySelections] = useState<Record<number, string>>({});

  // Resolved count
  const totalGroups = groups.length;
  const [resolvedCount, setResolvedCount] = useState(0);

  const getPrimary = useCallback(
    (groupIndex: number): string => {
      return primarySelections[groupIndex] ?? defaultPrimary(groups[groupIndex]?.contacts ?? []);
    },
    [primarySelections, groups]
  );

  const handleSelectPrimary = useCallback(
    (groupIndex: number, contactId: string) => {
      setPrimarySelections((prev) => ({ ...prev, [groupIndex]: contactId }));
    },
    []
  );

  const handleMerge = useCallback(
    async (groupIndex: number) => {
      const group = groups[groupIndex];
      if (!group) return;

      const primaryId = getPrimary(groupIndex);
      const duplicateIds = group.contacts
        .filter((c) => c.id !== primaryId)
        .map((c) => c.id);

      const success = await onMerge(primaryId, duplicateIds);
      if (success) {
        setResolvedCount((c) => c + 1);
      }
    },
    [groups, getPrimary, onMerge]
  );

  const handleDismiss = useCallback(
    (groupIndex: number) => {
      onDismiss(groupIndex);
      setResolvedCount((c) => c + 1);
    },
    [onDismiss]
  );

  const handleMergeAll = useCallback(async () => {
    for (let i = 0; i < groups.length; i++) {
      const primaryId = getPrimary(i);
      const duplicateIds = groups[i].contacts
        .filter((c) => c.id !== primaryId)
        .map((c) => c.id);

      const success = await onMerge(primaryId, duplicateIds);
      if (success) {
        setResolvedCount((c) => c + 1);
      }
    }
  }, [groups, getPrimary, onMerge]);

  // Stable groups reference for rendering
  const displayGroups = useMemo(() => groups, [groups]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-5xl max-h-[85vh] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Duplicate Contacts Found
            </h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              {totalGroups === 0
                ? 'No duplicates detected'
                : `${totalGroups} group${totalGroups !== 1 ? 's' : ''} of potential duplicates`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {totalGroups > 0 && (
              <span className="text-xs text-zinc-500">
                {resolvedCount} of {resolvedCount + totalGroups} resolved
              </span>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {displayGroups.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3 text-zinc-600">
                <svg className="w-12 h-12 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-zinc-400 text-sm">All clear -- no duplicate contacts found.</p>
              <p className="text-zinc-600 text-xs mt-1">
                Your contact list looks clean.
              </p>
            </div>
          ) : (
            displayGroups.map((group, idx) => (
              <DuplicateGroupCard
                key={group.contacts.map((c) => c.id).join('-')}
                group={group}
                groupIndex={idx}
                primaryId={getPrimary(idx)}
                onSelectPrimary={(id) => handleSelectPrimary(idx, id)}
                onMerge={() => handleMerge(idx)}
                onDismiss={() => handleDismiss(idx)}
                isMerging={merging === getPrimary(idx)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        {displayGroups.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-700">
            <p className="text-xs text-zinc-500">
              Merging will keep the primary contact and reassign all deals, interactions, emails, and events from duplicates.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-lg hover:text-zinc-200 hover:border-zinc-500 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleMergeAll}
                disabled={merging !== null}
                className="px-4 py-2 text-sm text-black bg-amber-500 rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {merging ? 'Merging...' : `Merge All (${displayGroups.length})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
