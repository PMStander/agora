import { useState, useMemo } from 'react';
import {
  useCrmStore,
  useSelectedDeal,
  useInteractionsForEntity,
} from '../../stores/crm';
import { useCRM } from '../../hooks/useCRM';
import {
  DEAL_STATUS_CONFIG,
  INTERACTION_TYPE_CONFIG,
} from '../../types/crm';
import { AGENTS, getAgent } from '../../types/supabase';
import { useQuotesForDeal, useInvoicesForDeal } from '../../stores/invoicing';
import { QUOTE_STATUS_CONFIG, INVOICE_STATUS_CONFIG } from '../../types/invoicing';
import { CreateQuoteModal } from '../invoicing/CreateQuoteModal';
import { useEmailsForDeal } from '../../stores/email';
import { EmailComposer } from '../email/EmailComposer';
import { EMAIL_STATUS_CONFIG } from '../../types/email';
import { useEventsForDeal } from '../../stores/calendar';
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

function formatCurrency(amount: number | null, currency = 'USD'): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function statusBadgeClasses(color: string): string {
  const map: Record<string, string> = {
    zinc: 'bg-zinc-500/20 text-zinc-400',
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
    amber: 'bg-amber-500/20 text-amber-400',
  };
  return map[color] || map.zinc;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-zinc-400' },
  medium: { label: 'Medium', color: 'text-blue-400' },
  high: { label: 'High', color: 'text-orange-400' },
  urgent: { label: 'Urgent', color: 'text-red-400' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export function DealDetail() {
  const deal = useSelectedDeal();
  const { selectDeal, selectContact, selectCompany } = useCrmStore();
  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);
  const pipelines = useCrmStore((s) => s.pipelines);
  const { updateDealDetails, moveDeal, deleteDeal } = useCRM();

  const interactions = useInteractionsForEntity('deal', deal?.id ?? null);
  const dealQuotes = useQuotesForDeal(deal?.id ?? null);
  const dealInvoices = useInvoicesForDeal(deal?.id ?? null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCreateQuote, setShowCreateQuote] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [showScheduleEvent, setShowScheduleEvent] = useState(false);

  const dealEmails = useEmailsForDeal(deal?.id ?? null);
  const dealEvents = useEventsForDeal(deal?.id ?? null);

  // Reset delete confirmation on deal change
  useState(() => {
    setConfirmDelete(false);
  });

  const pipeline = useMemo(
    () => (deal ? pipelines.find((p) => p.id === deal.pipeline_id) : null),
    [pipelines, deal?.pipeline_id]
  );

  const currentStage = useMemo(
    () => (pipeline && deal ? pipeline.stages.find((s) => s.id === deal.stage_id) : null),
    [pipeline, deal?.stage_id]
  );

  const contact = useMemo(
    () => (deal?.contact_id ? contacts.find((c) => c.id === deal.contact_id) : null),
    [contacts, deal?.contact_id]
  );

  const company = useMemo(
    () => (deal?.company_id ? companies.find((c) => c.id === deal.company_id) : null),
    [companies, deal?.company_id]
  );

  const recentInteractions = useMemo(
    () => interactions.slice(0, 10),
    [interactions]
  );

  if (!deal) return null;

  const agent = deal.owner_agent_id ? getAgent(deal.owner_agent_id) : null;
  const dealStatusConfig = DEAL_STATUS_CONFIG[deal.status];
  const priorityConfig = PRIORITY_CONFIG[deal.priority] || PRIORITY_CONFIG.medium;

  const handleStageChange = (stageId: string) => {
    moveDeal(deal.id, stageId);
  };

  const handleAgentChange = (newAgentId: string) => {
    updateDealDetails(deal.id, { owner_agent_id: newAgentId || null });
  };

  const handleMarkWon = () => {
    updateDealDetails(deal.id, {
      status: 'won',
      close_date: new Date().toISOString(),
    });
  };

  const handleMarkLost = () => {
    updateDealDetails(deal.id, {
      status: 'lost',
      close_date: new Date().toISOString(),
    });
  };

  const handleReopenDeal = () => {
    updateDealDetails(deal.id, {
      status: 'open',
      close_date: null,
    });
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteDeal(deal.id);
    selectDeal(null);
  };

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-900/50 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-400">Deal Details</h2>
        <button
          onClick={() => selectDeal(null)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Title + Amount */}
        <div className="text-center">
          <h3 className="text-lg font-medium text-zinc-100">{deal.title}</h3>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {formatCurrency(deal.amount, deal.currency)}
          </div>
          {deal.description && (
            <p className="text-sm text-zinc-400 mt-2">{deal.description}</p>
          )}
        </div>

        {/* Deal Info */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Deal Info
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 w-16 shrink-0">Status</span>
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${statusBadgeClasses(dealStatusConfig.color)}`}
              >
                {dealStatusConfig.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500 w-16 shrink-0">Priority</span>
              <span className={`text-sm ${priorityConfig.color}`}>
                {priorityConfig.label}
              </span>
            </div>
            {pipeline && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 w-16 shrink-0">Pipeline</span>
                <span className="text-zinc-300">{pipeline.name}</span>
              </div>
            )}
            {currentStage && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 w-16 shrink-0">Stage</span>
                <span className="text-zinc-300">{currentStage.name}</span>
                <span className="text-zinc-600 text-xs">
                  ({currentStage.probability}%)
                </span>
              </div>
            )}
            {deal.close_date && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-500 w-16 shrink-0">Close</span>
                <span className="text-zinc-300">
                  {new Date(deal.close_date).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stage Selector */}
        {pipeline && deal.status === 'open' && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Update Stage
            </h4>
            <select
              value={deal.stage_id}
              onChange={(e) => handleStageChange(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
            >
              {pipeline.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name} ({stage.probability}%)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Contact + Company */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Contact & Company
          </h4>
          {contact ? (
            <button
              onClick={() => selectContact(contact.id)}
              className="w-full flex items-center gap-2 bg-zinc-800/50 border border-zinc-700 rounded-lg p-2.5 text-left hover:border-zinc-600 transition-colors mb-2"
            >
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm font-semibold shrink-0">
                {contact.first_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-zinc-200 truncate">
                  {contact.first_name} {contact.last_name}
                </div>
                <div className="text-[10px] text-zinc-500 truncate">
                  {contact.job_title || contact.email || 'Contact'}
                </div>
              </div>
            </button>
          ) : (
            <p className="text-xs text-zinc-600 mb-2">No contact linked</p>
          )}
          {company ? (
            <button
              onClick={() => selectCompany(company.id)}
              className="w-full flex items-center gap-2 bg-zinc-800/50 border border-zinc-700 rounded-lg p-2.5 text-left hover:border-zinc-600 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm font-semibold shrink-0">
                {company.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-zinc-200 truncate">
                  {company.name}
                </div>
                <div className="text-[10px] text-zinc-500 truncate">
                  {company.industry || company.domain || 'Company'}
                </div>
              </div>
            </button>
          ) : (
            <p className="text-xs text-zinc-600">No company linked</p>
          )}
        </div>

        {/* Agent Assignment */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Deal Owner
          </h4>
          {agent && (
            <div className="text-sm text-zinc-300 mb-2">
              {agent.emoji} {agent.name}
              <span className="text-zinc-500 ml-1">({agent.role})</span>
            </div>
          )}
          <select
            value={deal.owner_agent_id || ''}
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
        {deal.tags.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Tags
            </h4>
            <div className="flex flex-wrap gap-1">
              {deal.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-300 rounded-full border border-zinc-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Quotes & Invoices */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Quotes ({dealQuotes.length})
            </h4>
            <button
              onClick={() => setShowCreateQuote(true)}
              className="px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors"
            >
              + Quote
            </button>
          </div>
          {dealQuotes.length === 0 ? (
            <p className="text-xs text-zinc-600 mb-3">No quotes linked</p>
          ) : (
            <div className="space-y-1 mb-3">
              {dealQuotes.map((q) => {
                const qsc = QUOTE_STATUS_CONFIG[q.status];
                return (
                  <div
                    key={q.id}
                    className="flex items-center gap-2 bg-zinc-800/30 border border-zinc-800 rounded p-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-300 truncate">{q.quote_number}</div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-${qsc.color}-500/20 text-${qsc.color}-400`}>
                        {qsc.label}
                      </span>
                    </div>
                    <span className="text-xs text-amber-400 shrink-0">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: q.currency, minimumFractionDigits: 0 }).format(q.total)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Invoices ({dealInvoices.length})
          </h4>
          {dealInvoices.length === 0 ? (
            <p className="text-xs text-zinc-600">No invoices linked</p>
          ) : (
            <div className="space-y-1">
              {dealInvoices.map((inv) => {
                const isc = INVOICE_STATUS_CONFIG[inv.status];
                return (
                  <div
                    key={inv.id}
                    className="flex items-center gap-2 bg-zinc-800/30 border border-zinc-800 rounded p-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-300 truncate">{inv.invoice_number}</div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-${isc.color}-500/20 text-${isc.color}-400`}>
                        {isc.label}
                      </span>
                    </div>
                    <span className="text-xs text-amber-400 shrink-0">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: inv.currency, minimumFractionDigits: 0 }).format(inv.total)}
                    </span>
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
              Emails ({dealEmails.length})
            </h4>
            <button
              onClick={() => setShowEmailComposer(true)}
              className="px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors"
            >
              Send Email
            </button>
          </div>
          {dealEmails.length === 0 ? (
            <p className="text-xs text-zinc-600">No emails linked</p>
          ) : (
            <div className="space-y-1.5">
              {dealEmails.slice(0, 5).map((email) => (
                <div
                  key={email.id}
                  className="flex items-start gap-2 bg-zinc-800/30 border border-zinc-800 rounded p-2"
                >
                  <span className="text-sm shrink-0">
                    {email.direction === 'inbound' ? '\u2199\uFE0F' : '\u2197\uFE0F'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-300 truncate">
                      {email.subject || '(no subject)'}
                    </div>
                    <div className="text-[10px] text-zinc-600">
                      {relativeTime(email.sent_at || email.received_at || email.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Events */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Events ({dealEvents.length})
            </h4>
            <button
              onClick={() => setShowScheduleEvent(true)}
              className="px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors"
            >
              Schedule
            </button>
          </div>
          {dealEvents.length === 0 ? (
            <p className="text-xs text-zinc-600">No events scheduled</p>
          ) : (
            <div className="space-y-1.5">
              {dealEvents.slice(0, 5).map((event) => {
                const typeConfig = EVENT_TYPE_CONFIG[event.event_type];
                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-2 bg-zinc-800/30 border border-zinc-800 rounded p-2"
                  >
                    <span className="text-sm shrink-0">{typeConfig?.icon || '📅'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-300 truncate">{event.title}</div>
                      <div className="text-[10px] text-zinc-600">
                        {new Date(event.start_at).toLocaleDateString()} {new Date(event.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-${typeConfig?.color || 'zinc'}-500/20 text-${typeConfig?.color || 'zinc'}-400`}>
                      {typeConfig?.label || event.event_type}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Documents */}
        <DocumentSection entityType="deal" entityId={deal.id} />

        {/* Activity */}
        <div>
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Activity ({interactions.length})
          </h4>
          {recentInteractions.length === 0 ? (
            <p className="text-xs text-zinc-600">No activity recorded</p>
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
      </div>

      {/* Actions Footer */}
      <div className="border-t border-zinc-800 p-3 space-y-2">
        {deal.status === 'open' ? (
          <div className="flex gap-2">
            <button
              onClick={handleMarkWon}
              className="flex-1 px-3 py-2 text-xs bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
            >
              Mark Won
            </button>
            <button
              onClick={handleMarkLost}
              className="flex-1 px-3 py-2 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              Mark Lost
            </button>
          </div>
        ) : (
          <button
            onClick={handleReopenDeal}
            className="w-full px-3 py-2 text-xs bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
          >
            Reopen Deal
          </button>
        )}
        <button
          onClick={handleDelete}
          className={`w-full px-3 py-2 text-xs rounded-lg transition-colors ${
            confirmDelete
              ? 'bg-red-500/30 text-red-300 border border-red-500/50'
              : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
          }`}
        >
          {confirmDelete ? 'Click again to confirm delete' : 'Delete Deal'}
        </button>
      </div>

      {/* Create Quote Modal */}
      {showCreateQuote && (
        <CreateQuoteModal
          isOpen={showCreateQuote}
          onClose={() => setShowCreateQuote(false)}
          prefillDealId={deal.id}
        />
      )}

      {/* Email Composer Modal */}
      {showEmailComposer && (
        <EmailComposer
          prefillTo={contact?.email || undefined}
          prefillContactId={deal.contact_id || undefined}
          prefillCompanyId={deal.company_id || undefined}
          prefillDealId={deal.id}
          onClose={() => setShowEmailComposer(false)}
        />
      )}

      {/* Schedule Event Modal */}
      {showScheduleEvent && (
        <CreateEventModal
          isOpen={showScheduleEvent}
          onClose={() => setShowScheduleEvent(false)}
          prefillDealId={deal.id}
          prefillContactId={deal.contact_id || undefined}
          prefillCompanyId={deal.company_id || undefined}
        />
      )}
    </div>
  );
}
