import { useState, useMemo } from 'react';
import {
  useCrmStore,
  useSelectedContact,
  useInteractionsForEntity,
} from '../../stores/crm';
import { useCRM } from '../../hooks/useCRM';
import {
  LIFECYCLE_STATUS_CONFIG,
  INTERACTION_TYPE_CONFIG,
  DEAL_STATUS_CONFIG,
} from '../../types/crm';
import { AGENTS, getAgent } from '../../types/supabase';
import { LogInteractionModal } from './LogInteractionModal';
import { CreateDealModal } from './CreateDealModal';
import { LeadScoreDetail } from './LeadScoreDetail';
import { useEmailsForContact } from '../../stores/email';
import { EmailComposer } from '../email/EmailComposer';
import { EMAIL_STATUS_CONFIG } from '../../types/email';
import { useEventsForContact } from '../../stores/calendar';
import { CreateEventModal } from '../calendar/CreateEventModal';
import { EVENT_TYPE_CONFIG } from '../../types/calendar';
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

function statusBadgeClasses(color: string): string {
  const map: Record<string, string> = {
    zinc: 'bg-zinc-500/20 text-zinc-400',
    blue: 'bg-blue-500/20 text-blue-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    indigo: 'bg-indigo-500/20 text-indigo-400',
    amber: 'bg-amber-500/20 text-amber-400',
    green: 'bg-green-500/20 text-green-400',
    purple: 'bg-purple-500/20 text-purple-400',
    red: 'bg-red-500/20 text-red-400',
  };
  return map[color] || map.zinc;
}

function formatCurrency(amount: number | null, currency = 'USD'): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ContactDetail() {
  const contact = useSelectedContact();
  const { selectContact } = useCrmStore();
  const companies = useCrmStore((s) => s.companies);
  const deals = useCrmStore((s) => s.deals);
  const pipelines = useCrmStore((s) => s.pipelines);
  const { updateContactDetails, deleteContact } = useCRM();

  const interactions = useInteractionsForEntity('contact', contact?.id ?? null);

  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showLogInteraction, setShowLogInteraction] = useState(false);
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [showScheduleMeeting, setShowScheduleMeeting] = useState(false);

  const contactEmails = useEmailsForContact(contact?.id ?? null);
  const contactEvents = useEventsForContact(contact?.id ?? null);

  // Sync notes from contact when selection changes
  useState(() => {
    if (contact) {
      setNotes(contact.notes || '');
      setNotesDirty(false);
      setConfirmDelete(false);
    }
  });

  const company = useMemo(
    () => (contact?.company_id ? companies.find((c) => c.id === contact.company_id) : null),
    [companies, contact?.company_id]
  );

  const contactDeals = useMemo(
    () => deals.filter((d) => d.contact_id === contact?.id),
    [deals, contact?.id]
  );

  const recentInteractions = useMemo(
    () => interactions.slice(0, 10),
    [interactions]
  );

  const getStageName = (stageId: string): string => {
    for (const p of pipelines) {
      const stage = p.stages.find((s) => s.id === stageId);
      if (stage) return stage.name;
    }
    return 'Unknown';
  };

  if (!contact) return null;

  const agent = contact.owner_agent_id ? getAgent(contact.owner_agent_id) : null;
  const lifecycleConfig = LIFECYCLE_STATUS_CONFIG[contact.lifecycle_status];

  const handleAgentChange = (newAgentId: string) => {
    updateContactDetails(contact.id, { owner_agent_id: newAgentId || null });
  };

  const handleSaveNotes = () => {
    updateContactDetails(contact.id, { notes });
    setNotesDirty(false);
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (!tag || contact.tags.includes(tag)) {
      setTagInput('');
      return;
    }
    updateContactDetails(contact.id, { tags: [...contact.tags, tag] });
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    updateContactDetails(contact.id, {
      tags: contact.tags.filter((t) => t !== tag),
    });
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteContact(contact.id);
    selectContact(null);
  };

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-900/50 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-400">Contact Details</h2>
        <button
          onClick={() => selectContact(null)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Avatar + Name */}
        <div className="flex flex-col items-center text-center gap-2">
          {contact.avatar_url ? (
            <img
              src={contact.avatar_url}
              alt={`${contact.first_name} ${contact.last_name}`}
              className="w-16 h-16 rounded-full object-cover border-2 border-zinc-700"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl font-semibold border-2 border-zinc-700">
              {contact.first_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="text-lg font-medium text-zinc-100">
              {contact.first_name} {contact.last_name}
            </h3>
            {contact.job_title && (
              <p className="text-sm text-zinc-400">{contact.job_title}</p>
            )}
            {company && (
              <p className="text-xs text-zinc-500">{company.name}</p>
            )}
          </div>
        </div>

        {/* Contact Info */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Contact Info
          </h4>
          <div className="space-y-2">
            {contact.email && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 w-14 shrink-0">Email</span>
                <a
                  href={`mailto:${contact.email}`}
                  className="text-amber-400 hover:text-amber-300 truncate transition-colors"
                >
                  {contact.email}
                </a>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 w-14 shrink-0">Phone</span>
                <span className="text-zinc-300">{contact.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 w-14 shrink-0">Status</span>
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${statusBadgeClasses(lifecycleConfig.color)}`}
              >
                {lifecycleConfig.label}
              </span>
            </div>
            {contact.lead_source && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 w-14 shrink-0">Source</span>
                <span className="text-zinc-300">{contact.lead_source}</span>
              </div>
            )}
          </div>
        </div>

        {/* Lead Score */}
        <LeadScoreDetail contact={contact} />

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
            value={contact.owner_agent_id || ''}
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
            {contact.tags.map((tag) => (
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
            {contact.tags.length === 0 && (
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

        {/* Deals */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Deals ({contactDeals.length})
          </h4>
          {contactDeals.length === 0 ? (
            <p className="text-xs text-zinc-600">No deals linked</p>
          ) : (
            <div className="space-y-2">
              {contactDeals.map((deal) => {
                const dealStatusConfig = DEAL_STATUS_CONFIG[deal.status];
                return (
                  <div
                    key={deal.id}
                    className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-2.5 cursor-pointer hover:border-zinc-600 transition-colors"
                    onClick={() => useCrmStore.getState().selectDeal(deal.id)}
                  >
                    <div className="text-sm text-zinc-200 font-medium truncate">
                      {deal.title}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-zinc-400">
                        {formatCurrency(deal.amount, deal.currency)}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 text-[10px] rounded ${statusBadgeClasses(dealStatusConfig.color)}`}
                      >
                        {getStageName(deal.stage_id)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Emails */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Emails ({contactEmails.length})
            </h4>
            {contact.email && (
              <button
                onClick={() => setShowEmailComposer(true)}
                className="px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors"
              >
                Send Email
              </button>
            )}
          </div>
          {contactEmails.length === 0 ? (
            <p className="text-xs text-zinc-600">No emails</p>
          ) : (
            <div className="space-y-1.5">
              {contactEmails.slice(0, 5).map((email) => {
                const statusConfig = EMAIL_STATUS_CONFIG[email.status];
                return (
                  <div
                    key={email.id}
                    className="flex items-start gap-2 bg-zinc-800/30 border border-zinc-800 rounded p-2"
                  >
                    <span className="text-sm shrink-0">
                      {email.direction === 'inbound' ? '\u2199\uFE0F' : '\u2197\uFE0F'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-zinc-300 truncate">
                          {email.subject || '(no subject)'}
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-${statusConfig.color}-500/20 text-${statusConfig.color}-400 shrink-0`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-600">
                        {relativeTime(email.sent_at || email.received_at || email.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Events ({contactEvents.length})
            </h4>
            <button
              onClick={() => setShowScheduleMeeting(true)}
              className="px-2 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
            >
              Schedule
            </button>
          </div>
          {contactEvents.length === 0 ? (
            <p className="text-xs text-zinc-600">No events scheduled</p>
          ) : (
            <div className="space-y-1.5">
              {contactEvents.slice(0, 5).map((event) => {
                const typeConfig = EVENT_TYPE_CONFIG[event.event_type];
                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-2 bg-zinc-800/30 border border-zinc-800 rounded p-2"
                  >
                    <span className="text-xs font-bold shrink-0 mt-0.5 w-5 h-5 rounded flex items-center justify-center bg-blue-500/20 text-blue-400">
                      {typeConfig.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-300 truncate">
                        {event.title}
                      </div>
                      <div className="text-[10px] text-zinc-600">
                        {new Date(event.start_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Documents */}
        <DocumentSection entityType="contact" entityId={contact.id} />

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
                const typeConfig = INTERACTION_TYPE_CONFIG[interaction.interaction_type];
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
            placeholder="Add notes about this contact..."
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
      <div className="border-t border-zinc-800 p-3 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={() => setShowLogInteraction(true)}
            className="flex-1 px-3 py-2 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors"
          >
            Log Interaction
          </button>
          <button
            onClick={() => setShowCreateDeal(true)}
            className="flex-1 px-3 py-2 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:border-zinc-500 hover:text-zinc-100 transition-colors"
          >
            Create Deal
          </button>
        </div>
        <button
          onClick={handleDelete}
          className={`w-full px-3 py-2 text-xs rounded-lg transition-colors ${
            confirmDelete
              ? 'bg-red-500/30 text-red-300 border border-red-500/50'
              : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
          }`}
        >
          {confirmDelete ? 'Click again to confirm delete' : 'Delete Contact'}
        </button>
      </div>

      {/* Modals */}
      <LogInteractionModal
        isOpen={showLogInteraction}
        onClose={() => setShowLogInteraction(false)}
        prefillContactId={contact.id}
      />
      <CreateDealModal
        isOpen={showCreateDeal}
        onClose={() => setShowCreateDeal(false)}
        prefillContactId={contact.id}
      />
      {showEmailComposer && (
        <EmailComposer
          prefillTo={contact.email || undefined}
          prefillContactId={contact.id}
          prefillCompanyId={contact.company_id || undefined}
          onClose={() => setShowEmailComposer(false)}
        />
      )}
      <CreateEventModal
        isOpen={showScheduleMeeting}
        onClose={() => setShowScheduleMeeting(false)}
        prefillContactId={contact.id}
        prefillCompanyId={contact.company_id || undefined}
      />
    </div>
  );
}
