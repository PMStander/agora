import { useState, useEffect } from 'react';
import { useEmail } from '../../hooks/useEmail';
import { useEmailStore } from '../../stores/email';
import type { EmailCategory } from '../../types/email';

interface EmailTemplateEditorProps {
  isOpen: boolean;
  onClose: () => void;
  templateId?: string; // If provided, edit mode
}

const VARIABLE_PRESETS = [
  '{{first_name}}',
  '{{last_name}}',
  '{{full_name}}',
  '{{email}}',
  '{{company}}',
  '{{job_title}}',
];

export function EmailTemplateEditor({ isOpen, onClose, templateId }: EmailTemplateEditorProps) {
  const { createTemplate, updateTemplateDetails } = useEmail();
  const templates = useEmailStore((s) => s.templates);
  const existing = templateId ? templates.find((t) => t.id === templateId) : null;

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [category, setCategory] = useState<EmailCategory>('other');
  const [variables, setVariables] = useState<Array<{ name: string; default_value: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setSubject(existing.subject || '');
      setBodyHtml(existing.body_html || '');
      setCategory(existing.category);
      setVariables(
        (existing.variables || []).map((v) => ({
          name: v.name,
          default_value: v.default_value || '',
        }))
      );
    } else {
      setName('');
      setSubject('');
      setBodyHtml('');
      setCategory('other');
      setVariables([]);
    }
  }, [existing, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);

    if (existing) {
      await updateTemplateDetails(existing.id, {
        name,
        subject,
        body_html: bodyHtml,
        body_text: bodyHtml.replace(/<[^>]*>/g, ''),
        category,
        variables: variables.filter((v) => v.name.trim()),
      });
    } else {
      await createTemplate({
        name,
        subject,
        body_html: bodyHtml,
        body_text: bodyHtml.replace(/<[^>]*>/g, ''),
        category,
        variables: variables.filter((v) => v.name.trim()),
      });
    }

    setSaving(false);
    onClose();
  };

  const insertVariable = (varName: string) => {
    setBodyHtml((prev) => prev + varName);
  };

  const addVariable = () => {
    setVariables([...variables, { name: '', default_value: '' }]);
  };

  const removeVariable = (idx: number) => {
    setVariables(variables.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-200">
            {existing ? 'Edit Template' : 'New Template'}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Template name..."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EmailCategory)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500/50 focus:outline-none transition-colors"
              >
                <option value="sales">Sales</option>
                <option value="marketing">Marketing</option>
                <option value="support">Support</option>
                <option value="transactional">Transactional</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

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

          {/* Variable Shortcuts */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Insert Variable</label>
            <div className="flex gap-1 flex-wrap">
              {VARIABLE_PRESETS.map((v) => (
                <button
                  key={v}
                  onClick={() => insertVariable(v)}
                  className="px-2 py-1 text-[10px] bg-indigo-500/20 text-indigo-400 rounded hover:bg-indigo-500/30 transition-colors"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Body</label>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={10}
              placeholder="Template body... Use {{variable}} for dynamic content."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none resize-none transition-colors font-mono"
            />
          </div>

          {/* Custom Variables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-zinc-500">Custom Variables</label>
              <button
                onClick={addVariable}
                className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
              >
                + Add Variable
              </button>
            </div>
            {variables.map((v, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={v.name}
                  onChange={(e) => {
                    const updated = [...variables];
                    updated[idx] = { ...v, name: e.target.value };
                    setVariables(updated);
                  }}
                  placeholder="Variable name"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                />
                <input
                  type="text"
                  value={v.default_value}
                  onChange={(e) => {
                    const updated = [...variables];
                    updated[idx] = { ...v, default_value: e.target.value };
                    setVariables(updated);
                  }}
                  placeholder="Default value"
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-amber-500/50 focus:outline-none transition-colors"
                />
                <button
                  onClick={() => removeVariable(idx)}
                  className="text-zinc-500 hover:text-red-400 transition-colors px-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg hover:border-zinc-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 text-xs bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : existing ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
