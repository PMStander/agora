import { useState, useMemo, useEffect } from 'react';
import { useCRM } from '../../hooks/useCRM';
import { useCrmStore, useActivePipeline } from '../../stores/crm';
import { AGENTS } from '../../types/supabase';

// ─── Props ──────────────────────────────────────────────────────────────────

interface CreateDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefillContactId?: string;
  prefillCompanyId?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CreateDealModal({
  isOpen,
  onClose,
  prefillContactId,
  prefillCompanyId,
}: CreateDealModalProps) {
  const { createDeal } = useCRM();
  const contacts = useCrmStore((s) => s.contacts);
  const companies = useCrmStore((s) => s.companies);
  const pipelines = useCrmStore((s) => s.pipelines);
  const defaultPipeline = useActivePipeline();

  // ── Form State ──
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [contactId, setContactId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [tagsInput, setTagsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize pipeline + stage from default pipeline
  useEffect(() => {
    if (defaultPipeline && !pipelineId) {
      setPipelineId(defaultPipeline.id);
      if (defaultPipeline.stages.length > 0) {
        setStageId(defaultPipeline.stages[0].id);
      }
    }
  }, [defaultPipeline, pipelineId]);

  // Prefill contact
  useEffect(() => {
    if (prefillContactId) {
      setContactId(prefillContactId);
    }
  }, [prefillContactId]);

  // Prefill company (only when no contact auto-populates it)
  useEffect(() => {
    if (prefillCompanyId && !contactId) {
      setCompanyId(prefillCompanyId);
    }
  }, [prefillCompanyId, contactId]);

  // Auto-populate company from selected contact
  useEffect(() => {
    if (contactId) {
      const contact = contacts.find((c) => c.id === contactId);
      if (contact?.company_id) {
        setCompanyId(contact.company_id);
      }
    }
  }, [contactId, contacts]);

  // Get stages for selected pipeline
  const selectedPipeline = useMemo(
    () => pipelines.find((p) => p.id === pipelineId) || null,
    [pipelines, pipelineId]
  );

  const stages = useMemo(
    () => selectedPipeline?.stages || [],
    [selectedPipeline]
  );

  // When pipeline changes, reset stage to first
  const handlePipelineChange = (newPipelineId: string) => {
    setPipelineId(newPipelineId);
    const pipeline = pipelines.find((p) => p.id === newPipelineId);
    if (pipeline && pipeline.stages.length > 0) {
      setStageId(pipeline.stages[0].id);
    } else {
      setStageId('');
    }
  };

  if (!isOpen) return null;

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPipelineId(defaultPipeline?.id || '');
    setStageId(defaultPipeline?.stages[0]?.id || '');
    setAmount('');
    setCurrency('USD');
    setContactId(prefillContactId || '');
    setCompanyId(prefillCompanyId || '');
    setAgentId('');
    setCloseDate('');
    setPriority('medium');
    setTagsInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !pipelineId || !stageId) return;

    setIsSubmitting(true);

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await createDeal({
        title: title.trim(),
        pipeline_id: pipelineId,
        stage_id: stageId,
        description: description.trim() || undefined,
        amount: amount ? parseFloat(amount) : undefined,
        currency: currency || 'USD',
        contact_id: contactId || undefined,
        company_id: companyId || undefined,
        owner_agent_id: agentId || undefined,
        close_date: closeDate || undefined,
        priority: priority,
        tags: tags.length > 0 ? tags : undefined,
      });

      resetForm();
      onClose();
    } catch (err) {
      console.error('Failed to create deal:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Group agents for dropdown
  const orchestrators = AGENTS.filter((a) => a.team === 'orchestrator');
  const personalAgents = AGENTS.filter((a) => a.team === 'personal');
  const businessAgents = AGENTS.filter((a) => a.team === 'business');

  const priorityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  const currencyOptions = ['USD', 'EUR', 'GBP', 'ZAR', 'AUD', 'CAD', 'JPY'];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Create Deal</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enterprise SaaS Deal"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Details about this deal..."
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none resize-none transition-colors"
            />
          </div>

          {/* Pipeline + Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Pipeline *
              </label>
              <select
                value={pipelineId}
                onChange={(e) => handlePipelineChange(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                {pipelines.length === 0 && (
                  <option value="">No pipelines</option>
                )}
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.is_default ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Stage *
              </label>
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                {stages.length === 0 && (
                  <option value="">No stages</option>
                )}
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.probability}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm text-zinc-400 mb-1">Amount</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
                min="0"
                step="0.01"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

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

          {/* Company (auto-populated from contact or manual) */}
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

          {/* Agent */}
          <div>
            <label className="block text-sm text-zinc-400 mb-1">
              Deal Owner
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

          {/* Close Date + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Close Date
              </label>
              <input
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                {priorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
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
              placeholder="enterprise, q1-target, upsell"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
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
              disabled={
                !title.trim() || !pipelineId || !stageId || isSubmitting
              }
              className="px-5 py-2 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
