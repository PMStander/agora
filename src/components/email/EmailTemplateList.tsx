import { useState } from 'react';
import { useEmailStore } from '../../stores/email';
import { useEmail } from '../../hooks/useEmail';
import { EMAIL_CATEGORY_CONFIG } from '../../types/email';
import type { EmailCategory } from '../../types/email';

export function EmailTemplateList() {
  const templates = useEmailStore((s) => s.templates);
  const { deleteTemplate } = useEmail();
  const [filter, setFilter] = useState<EmailCategory | 'all'>('all');

  const filtered = filter === 'all'
    ? templates
    : templates.filter((t) => t.category === filter);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Filter Bar */}
      <div className="px-4 py-2 border-b border-zinc-800 flex gap-1 overflow-x-auto">
        {(['all', 'sales', 'marketing', 'support', 'transactional', 'other'] as const).map(
          (cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                filter === cat
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {cat === 'all' ? 'All' : EMAIL_CATEGORY_CONFIG[cat].label}
            </button>
          )
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <p className="text-sm text-zinc-500">No templates found</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800">
          {filtered.map((template) => (
            <div
              key={template.id}
              className="px-4 py-3 hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-zinc-200">
                  {template.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] bg-zinc-800 text-zinc-400 rounded-full">
                    {EMAIL_CATEGORY_CONFIG[template.category].label}
                  </span>
                  {!template.is_active && (
                    <span className="px-2 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
              </div>
              {template.subject && (
                <p className="text-xs text-zinc-400 truncate mb-1">
                  Subject: {template.subject}
                </p>
              )}
              {template.variables && template.variables.length > 0 && (
                <div className="flex gap-1 flex-wrap mt-1">
                  {template.variables.map((v) => (
                    <span
                      key={v.name}
                      className="px-1.5 py-0.5 text-[10px] bg-indigo-500/20 text-indigo-400 rounded"
                    >
                      {`{{${v.name}}}`}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => deleteTemplate(template.id)}
                  className="text-[10px] text-red-500 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
