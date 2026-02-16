import { useState, useEffect } from 'react';
import { useCRM } from '../../hooks/useCRM';
import { useCrmStore } from '../../stores/crm';
import type { LifecycleStatus } from '../../types/crm';
import { LIFECYCLE_STATUS_CONFIG } from '../../types/crm';
import { AGENTS } from '../../types/supabase';

// ─── Props ──────────────────────────────────────────────────────────────────

interface CreateContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillCompanyId?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CreateContactModal({ isOpen, onClose, prefillCompanyId }: CreateContactModalProps) {
  const { createContact } = useCRM();
  const companies = useCrmStore((s) => s.companies);

  // ── Form State ──
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyId, setCompanyId] = useState(prefillCompanyId ?? '');
  const [jobTitle, setJobTitle] = useState('');

  // Sync prefill when it changes
  useEffect(() => {
    if (prefillCompanyId) setCompanyId(prefillCompanyId);
  }, [prefillCompanyId]);
  const [lifecycleStatus, setLifecycleStatus] = useState<LifecycleStatus>('lead');
  const [leadSource, setLeadSource] = useState('');
  const [agentId, setAgentId] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setCompanyId(prefillCompanyId ?? '');
    setJobTitle('');
    setLifecycleStatus('lead');
    setLeadSource('');
    setAgentId('');
    setTagsInput('');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    setIsSubmitting(true);

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await createContact({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        company_id: companyId || undefined,
        job_title: jobTitle.trim() || undefined,
        lifecycle_status: lifecycleStatus,
        lead_source: leadSource.trim() || undefined,
        owner_agent_id: agentId || undefined,
        tags: tags.length > 0 ? tags : undefined,
        notes: notes.trim() || undefined,
      });

      resetForm();
      onClose();
    } catch (err) {
      console.error('Failed to create contact:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group agents for dropdown
  const orchestrators = AGENTS.filter((a) => a.team === 'orchestrator');
  const personalAgents = AGENTS.filter((a) => a.team === 'personal');
  const businessAgents = AGENTS.filter((a) => a.team === 'business');

  const lifecycleOptions = Object.entries(LIFECYCLE_STATUS_CONFIG) as [
    LifecycleStatus,
    { label: string; color: string },
  ][];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Create Contact</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                First Name *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Company */}
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
                  {c.domain ? ` (${c.domain})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Job Title */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="VP of Sales"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Lifecycle Status + Lead Source */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Lifecycle Status
              </label>
              <select
                value={lifecycleStatus}
                onChange={(e) =>
                  setLifecycleStatus(e.target.value as LifecycleStatus)
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                {lifecycleOptions.map(([value, config]) => (
                  <option key={value} value={value}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Lead Source
              </label>
              <input
                type="text"
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                placeholder="Website, Referral..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Agent */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Assign Agent
            </label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
            >
              <option value="">Unassigned</option>
              <optgroup label="Orchestrator">
                {orchestrators.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name} -- {a.role}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Personal Team">
                {personalAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name} -- {a.role}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Business Team">
                {businessAgents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.emoji} {a.name} -- {a.role}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Tags
              <span className="text-zinc-600 ml-1">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="vip, enterprise, inbound"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this contact..."
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none resize-none transition-colors"
            />
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
              disabled={!firstName.trim() || !lastName.trim() || isSubmitting}
              className="px-5 py-2 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
