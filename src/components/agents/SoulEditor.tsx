import { useState } from 'react';
import type { SoulProfile } from '../../types/supabase';
import { renderSoulToSystemPrompt } from '../../lib/soulRenderer';
import type { AgentFull } from '../../types/supabase';

interface SoulEditorProps {
  soul: SoulProfile;
  agent: AgentFull;
  onSave: (soul: SoulProfile) => void;
  onCancel: () => void;
}

function EditableList({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-zinc-400 mb-1">{label}</label>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 mb-1.5">
          <input
            type="text"
            value={item}
            onChange={(e) => {
              const updated = [...items];
              updated[i] = e.target.value;
              onChange(updated);
            }}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
            placeholder={placeholder}
          />
          <button
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="px-2 text-zinc-500 hover:text-red-400 transition-colors text-sm"
          >
            x
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, ''])}
        className="text-xs text-amber-500/70 hover:text-amber-500 transition-colors mt-1"
      >
        + Add item
      </button>
    </div>
  );
}

export function SoulEditor({ soul, agent, onSave, onCancel }: SoulEditorProps) {
  const [draft, setDraft] = useState<SoulProfile>({ ...soul });
  const [showPreview, setShowPreview] = useState(false);

  const update = <K extends keyof SoulProfile>(key: K, value: SoulProfile[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const previewAgent: AgentFull = { ...agent, soul: draft };

  return (
    <div className="space-y-5">
      {/* Origin */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Origin Story</label>
        <textarea
          value={draft.origin}
          onChange={(e) => update('origin', e.target.value)}
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 resize-none transition-colors"
        />
      </div>

      {/* Philosophy */}
      <EditableList
        label="Philosophy"
        items={draft.philosophy}
        onChange={(items) => update('philosophy', items)}
        placeholder="A guiding principle..."
      />

      {/* Inspirations */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Inspirations</label>
        {draft.inspirations.map((insp, i) => (
          <div key={i} className="flex gap-2 mb-1.5">
            <input
              type="text"
              value={insp.name}
              onChange={(e) => {
                const updated = [...draft.inspirations];
                updated[i] = { ...updated[i], name: e.target.value };
                update('inspirations', updated);
              }}
              placeholder="Name"
              className="w-1/3 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
            />
            <input
              type="text"
              value={insp.relationship}
              onChange={(e) => {
                const updated = [...draft.inspirations];
                updated[i] = { ...updated[i], relationship: e.target.value };
                update('inspirations', updated);
              }}
              placeholder="Relationship / influence"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
            />
            <button
              onClick={() => update('inspirations', draft.inspirations.filter((_, idx) => idx !== i))}
              className="px-2 text-zinc-500 hover:text-red-400 transition-colors text-sm"
            >
              x
            </button>
          </div>
        ))}
        <button
          onClick={() => update('inspirations', [...draft.inspirations, { name: '', relationship: '' }])}
          className="text-xs text-amber-500/70 hover:text-amber-500 transition-colors mt-1"
        >
          + Add inspiration
        </button>
      </div>

      {/* Communication Style */}
      <div>
        <label className="block text-sm text-zinc-400 mb-2">Communication Style</label>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Tone</label>
            <input
              type="text"
              value={draft.communicationStyle.tone}
              onChange={(e) =>
                update('communicationStyle', { ...draft.communicationStyle, tone: e.target.value })
              }
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1">Formality</label>
              <select
                value={draft.communicationStyle.formality}
                onChange={(e) =>
                  update('communicationStyle', {
                    ...draft.communicationStyle,
                    formality: e.target.value as 'casual' | 'balanced' | 'formal',
                  })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
              >
                <option value="casual">Casual</option>
                <option value="balanced">Balanced</option>
                <option value="formal">Formal</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1">Verbosity</label>
              <select
                value={draft.communicationStyle.verbosity}
                onChange={(e) =>
                  update('communicationStyle', {
                    ...draft.communicationStyle,
                    verbosity: e.target.value as 'concise' | 'balanced' | 'thorough',
                  })
                }
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
              >
                <option value="concise">Concise</option>
                <option value="balanced">Balanced</option>
                <option value="thorough">Thorough</option>
              </select>
            </div>
          </div>
          <EditableList
            label="Quirks"
            items={draft.communicationStyle.quirks}
            onChange={(items) =>
              update('communicationStyle', { ...draft.communicationStyle, quirks: items })
            }
            placeholder="A communication quirk..."
          />
        </div>
      </div>

      {/* Never Dos */}
      <EditableList
        label="Never Do (Hard Constraints)"
        items={draft.neverDos}
        onChange={(items) => update('neverDos', items)}
        placeholder="Something this agent must never do..."
      />

      {/* Preferred Workflows */}
      <EditableList
        label="Preferred Workflows"
        items={draft.preferredWorkflows}
        onChange={(items) => update('preferredWorkflows', items)}
        placeholder="A preferred workflow..."
      />

      {/* Additional Notes */}
      <div>
        <label className="block text-sm text-zinc-400 mb-1">Additional Notes</label>
        <textarea
          value={draft.additionalNotes ?? ''}
          onChange={(e) => update('additionalNotes', e.target.value || null)}
          rows={2}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 resize-none transition-colors"
          placeholder="Any extra notes..."
        />
      </div>

      {/* Preview Toggle */}
      <div className="border-t border-zinc-700 pt-4">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="text-sm text-amber-500/70 hover:text-amber-500 transition-colors"
        >
          {showPreview ? 'Hide' : 'Preview as'} System Prompt
        </button>
        {showPreview && (
          <pre className="mt-3 p-4 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-400 overflow-auto max-h-64 whitespace-pre-wrap font-mono">
            {renderSoulToSystemPrompt(previewAgent)}
          </pre>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(draft)}
          className="px-5 py-2 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors"
        >
          Save SOUL
        </button>
      </div>
    </div>
  );
}
