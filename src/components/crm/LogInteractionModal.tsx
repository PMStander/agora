import { useState, useEffect } from 'react';
import { useCRM } from '../../hooks/useCRM';
import { useCrmStore } from '../../stores/crm';
import {
  INTERACTION_TYPE_CONFIG,
  type InteractionType,
  type InteractionDirection,
} from '../../types/crm';
import { AGENTS } from '../../types/supabase';

interface LogInteractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillContactId?: string;
  prefillCompanyId?: string;
  prefillDealId?: string;
}

export function LogInteractionModal({
  isOpen,
  onClose,
  prefillContactId,
  prefillCompanyId,
  prefillDealId,
}: LogInteractionModalProps) {
  const { logInteraction } = useCRM();
  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);
  const deals = useCrmStore((s) => s.deals);

  const [interactionType, setInteractionType] = useState<InteractionType>('note');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [direction, setDirection] = useState<InteractionDirection | ''>('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [contactId, setContactId] = useState(prefillContactId ?? '');
  const [companyId, setCompanyId] = useState(prefillCompanyId ?? '');
  const [dealId, setDealId] = useState(prefillDealId ?? '');
  const [agentId, setAgentId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync prefills when they change
  useEffect(() => {
    if (prefillContactId) setContactId(prefillContactId);
  }, [prefillContactId]);
  useEffect(() => {
    if (prefillCompanyId) setCompanyId(prefillCompanyId);
  }, [prefillCompanyId]);
  useEffect(() => {
    if (prefillDealId) setDealId(prefillDealId);
  }, [prefillDealId]);

  if (!isOpen) return null;

  const resetForm = () => {
    setInteractionType('note');
    setSubject('');
    setBody('');
    setDirection('');
    setDurationMinutes('');
    setScheduledAt('');
    setContactId(prefillContactId ?? '');
    setCompanyId(prefillCompanyId ?? '');
    setDealId(prefillDealId ?? '');
    setAgentId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await logInteraction({
        interaction_type: interactionType,
        subject: subject.trim() || undefined,
        body: body.trim() || undefined,
        direction: direction || undefined,
        duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : undefined,
        contact_id: contactId || undefined,
        company_id: companyId || undefined,
        deal_id: dealId || undefined,
        agent_id: agentId || undefined,
      });

      resetForm();
      onClose();
    } catch (err) {
      console.error('Failed to log interaction:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const interactionTypes = Object.entries(INTERACTION_TYPE_CONFIG) as [
    InteractionType,
    { label: string; emoji: string },
  ][];

  const showDuration = interactionType === 'call' || interactionType === 'meeting';
  const showScheduled = interactionType === 'meeting';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Log Interaction</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Type + Direction */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Type *</label>
              <select
                value={interactionType}
                onChange={(e) => setInteractionType(e.target.value as InteractionType)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                {interactionTypes.map(([value, config]) => (
                  <option key={value} value={value}>
                    {config.emoji} {config.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Direction</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as InteractionDirection | '')}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                <option value="">Not specified</option>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
              autoFocus
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Details</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Notes about this interaction..."
              rows={4}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none resize-none transition-colors"
            />
          </div>

          {/* Duration + Scheduled At (conditional) */}
          {(showDuration || showScheduled) && (
            <div className="grid grid-cols-2 gap-3">
              {showDuration && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    placeholder="30"
                    min="0"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                  />
                </div>
              )}
              {showScheduled && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Scheduled At
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
                  />
                </div>
              )}
            </div>
          )}

          {/* Contact */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Contact</label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
            >
              <option value="">No contact</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                  {c.email ? ` (${c.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Company + Deal */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Company</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                <option value="">No company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Deal</label>
              <select
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                <option value="">No deal</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Agent */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Agent</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
            >
              <option value="">Not specified</option>
              {AGENTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.emoji} {a.name} -- {a.role}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Logging...' : 'Log Interaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
