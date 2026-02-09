import { useState, useMemo } from 'react';
import { useEmailStore } from '../../stores/email';
import { useEmail } from '../../hooks/useEmail';
import { useCrmStore } from '../../stores/crm';

interface EmailComposerProps {
  prefillTo?: string;
  prefillContactId?: string;
  prefillCompanyId?: string;
  prefillDealId?: string;
  onClose?: () => void;
}

export function EmailComposer({
  prefillTo,
  prefillContactId,
  prefillCompanyId,
  prefillDealId,
  onClose,
}: EmailComposerProps) {
  const { sendEmail, saveDraft, applyTemplate, templates } = useEmail();
  const contacts = useCrmStore((s) => s.contacts);
  const setComposeOpen = useEmailStore((s) => s.setComposeOpen);

  const [to, setTo] = useState(prefillTo || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [sending, setSending] = useState(false);
  const [toQuery, setToQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Contact email suggestions
  const suggestions = useMemo(() => {
    if (!toQuery || toQuery.length < 2) return [];
    const q = toQuery.toLowerCase();
    return contacts
      .filter(
        (c) =>
          c.email &&
          (c.email.toLowerCase().includes(q) ||
            `${c.first_name} ${c.last_name}`.toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [contacts, toQuery]);

  const handleClose = () => {
    setComposeOpen(false);
    onClose?.();
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    // Find matching contact for variable substitution
    const contact = prefillContactId
      ? contacts.find((c) => c.id === prefillContactId)
      : null;

    const result = applyTemplate(templateId, contact);
    if (result) {
      setSubject(result.subject);
      setBody(result.body);
    }
  };

  const handleSend = async () => {
    if (!to.trim() || sending) return;
    setSending(true);

    const toAddresses = to.split(',').map((a) => a.trim()).filter(Boolean);
    const ccAddresses = cc ? cc.split(',').map((a) => a.trim()).filter(Boolean) : undefined;
    const bccAddresses = bcc ? bcc.split(',').map((a) => a.trim()).filter(Boolean) : undefined;

    await sendEmail({
      to: toAddresses,
      subject,
      body,
      cc: ccAddresses,
      bcc: bccAddresses,
      contact_id: prefillContactId,
      company_id: prefillCompanyId,
      deal_id: prefillDealId,
      template_id: selectedTemplateId || undefined,
    });

    setSending(false);
    handleClose();
  };

  const handleSaveDraft = async () => {
    const toAddresses = to ? to.split(',').map((a) => a.trim()).filter(Boolean) : undefined;

    await saveDraft({
      to: toAddresses,
      subject,
      body,
      contact_id: prefillContactId,
      company_id: prefillCompanyId,
      deal_id: prefillDealId,
    });
    handleClose();
  };

  const selectSuggestion = (email: string) => {
    setTo(to ? `${to}, ${email}` : email);
    setToQuery('');
    setShowSuggestions(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">New Email</h3>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Template Selector */}
          {templates.length > 0 && (
            <div>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                <option value="">Use a template...</option>
                {templates
                  .filter((t) => t.is_active)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* To */}
          <div className="relative">
            <label className="text-xs text-zinc-500 mb-1 block">To</label>
            <input
              type="text"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                // Extract last segment for suggestions
                const parts = e.target.value.split(',');
                const last = parts[parts.length - 1].trim();
                setToQuery(last);
                setShowSuggestions(last.length >= 2);
              }}
              onFocus={() => toQuery.length >= 2 && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="recipient@example.com"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg overflow-hidden">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSuggestion(c.email!);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
                  >
                    <span className="font-medium">
                      {c.first_name} {c.last_name}
                    </span>
                    <span className="text-zinc-500 ml-2">{c.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CC/BCC Toggle */}
          {!showCcBcc && (
            <button
              onClick={() => setShowCcBcc(true)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              + CC / BCC
            </button>
          )}
          {showCcBcc && (
            <>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">CC</label>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="cc@example.com"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">BCC</label>
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="bcc@example.com"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                />
              </div>
            </>
          )}

          {/* Subject */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Compose your email..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none resize-none transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
          <button
            onClick={handleSaveDraft}
            className="px-4 py-2 text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg hover:border-zinc-500 hover:text-zinc-200 transition-colors"
          >
            Save Draft
          </button>
          <button
            onClick={handleSend}
            disabled={!to.trim() || sending}
            className="px-6 py-2 text-sm bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 disabled:opacity-50 transition-colors font-medium"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
