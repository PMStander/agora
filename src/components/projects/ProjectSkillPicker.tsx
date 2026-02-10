import { useState, useRef, useEffect } from 'react';
import { TECHNOLOGY_SUGGESTIONS, type ProjectSkillType } from '../../types/projectAgents';
import { SKILL_CATALOG } from '../../hooks/useGatewayConfig';

interface ProjectSkillPickerProps {
  existingSkills: { technology: string[]; gateway: string[] };
  onAdd: (skillKey: string, skillType: ProjectSkillType) => void;
  onClose: () => void;
}

type Tab = 'technology' | 'gateway';

const GATEWAY_CATEGORIES = ['Dev', 'API', 'AI', 'Productivity', 'CRM', 'Comms', 'Info'];

export function ProjectSkillPicker({
  existingSkills,
  onAdd,
  onClose,
}: ProjectSkillPickerProps) {
  const [tab, setTab] = useState<Tab>('technology');
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [tab]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const q = search.toLowerCase().trim();

  // Technology suggestions filtered
  const techSuggestions = TECHNOLOGY_SUGGESTIONS.filter(
    (s) => !existingSkills.technology.includes(s) && (!q || s.includes(q))
  );

  // Gateway skills grouped by category
  const gatewayEntries = Object.entries(SKILL_CATALOG)
    .filter(([key, meta]) => {
      if (existingSkills.gateway.includes(key)) return false;
      if (!GATEWAY_CATEGORIES.includes(meta.category)) return false;
      if (q && !key.includes(q) && !meta.label.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => a[1].category.localeCompare(b[1].category));

  const handleAddTech = (key: string) => {
    onAdd(key, 'technology');
  };

  const handleAddCustomTech = () => {
    if (q && !existingSkills.technology.includes(q)) {
      onAdd(q, 'technology');
      setSearch('');
    }
  };

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-1 w-72 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-10 overflow-hidden"
    >
      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => { setTab('technology'); setSearch(''); }}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            tab === 'technology'
              ? 'text-amber-400 border-b-2 border-amber-400'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Technology
        </button>
        <button
          onClick={() => { setTab('gateway'); setSearch(''); }}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            tab === 'gateway'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Gateway Tools
        </button>
      </div>

      {/* Search input */}
      <div className="p-2">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && tab === 'technology') handleAddCustomTech();
            if (e.key === 'Escape') onClose();
          }}
          placeholder={tab === 'technology' ? 'Search or type custom...' : 'Search tools...'}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
        />
      </div>

      {/* Items list */}
      <div className="max-h-48 overflow-y-auto px-2 pb-2">
        {tab === 'technology' ? (
          <>
            {/* Custom entry hint */}
            {q && !TECHNOLOGY_SUGGESTIONS.includes(q as any) && !existingSkills.technology.includes(q) && (
              <button
                onClick={handleAddCustomTech}
                className="w-full text-left px-2.5 py-1.5 text-xs text-amber-400 hover:bg-zinc-800 rounded flex items-center gap-1.5"
              >
                + Add &quot;{q}&quot;
              </button>
            )}
            {techSuggestions.length === 0 && !q && (
              <p className="text-xs text-zinc-600 text-center py-2">All suggestions already added</p>
            )}
            <div className="flex flex-wrap gap-1">
              {techSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleAddTech(s)}
                  className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-400 rounded border border-zinc-700 hover:border-amber-500/50 hover:text-amber-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {gatewayEntries.length === 0 && (
              <p className="text-xs text-zinc-600 text-center py-2">No matching tools</p>
            )}
            {gatewayEntries.map(([key, meta]) => (
              <button
                key={key}
                onClick={() => onAdd(key, 'gateway')}
                className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-zinc-800 rounded transition-colors"
              >
                <span>{meta.icon}</span>
                <span className="text-zinc-200">{meta.label}</span>
                <span className="text-[10px] text-zinc-600 ml-auto">{meta.category}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
