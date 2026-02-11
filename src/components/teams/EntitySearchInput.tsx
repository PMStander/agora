import { useState, useRef, useEffect, useCallback } from 'react';
import { useCrmStore } from '../../stores/crm';
import { useProductsStore } from '../../stores/products';
import { useProjectsStore } from '../../stores/projects';
import { ENTITY_TYPE_EMOJI, type EntityReference, type EntityReferenceType } from '../../types/boardroom';

interface EntitySearchInputProps {
  value: EntityReference[];
  onChange: (refs: EntityReference[]) => void;
}

export function EntitySearchInput({ value, onChange }: EntitySearchInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntityReference[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const companies = useCrmStore((s) => s.companies);
  const contacts = useCrmStore((s) => s.contacts);
  const products = useProductsStore((s) => s.products);
  const projects = useProjectsStore((s) => s.projects);

  const selectedIds = new Set(value.map((r) => `${r.type}:${r.id}`));

  const search = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setIsOpen(false);
        return;
      }
      const lower = q.toLowerCase();
      const matches: EntityReference[] = [];

      const push = (type: EntityReferenceType, id: string, label: string) => {
        if (!selectedIds.has(`${type}:${id}`)) {
          matches.push({ type, id, label, emoji: ENTITY_TYPE_EMOJI[type] });
        }
      };

      for (const c of companies) {
        if (c.name.toLowerCase().includes(lower)) push('company', c.id, c.name);
        if (matches.length >= 10) break;
      }
      for (const c of contacts) {
        const name = `${c.first_name} ${c.last_name}`.trim();
        if (name.toLowerCase().includes(lower)) push('contact', c.id, name);
        if (matches.length >= 10) break;
      }
      for (const p of products) {
        if (p.name.toLowerCase().includes(lower)) push('product', p.id, p.name);
        if (matches.length >= 10) break;
      }
      for (const p of projects) {
        if (p.name.toLowerCase().includes(lower)) push('project', p.id, p.name);
        if (matches.length >= 10) break;
      }

      setResults(matches.slice(0, 10));
      setHighlightIdx(0);
      setIsOpen(matches.length > 0);
    },
    [companies, contacts, products, projects, selectedIds]
  );

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 200);
  };

  const selectEntity = (ref: EntityReference) => {
    onChange([...value, ref]);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const removeEntity = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectEntity(results[highlightIdx]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Click-outside close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (results.length > 0) setIsOpen(true); }}
        placeholder="Search companies, contacts, products, projects..."
        className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
      />

      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((ref, i) => (
            <span
              key={`${ref.type}:${ref.id}`}
              className="flex items-center gap-1 px-2 py-0.5 text-xs bg-zinc-800 border border-zinc-700 rounded-md text-zinc-300"
            >
              <span>{ref.emoji}</span>
              <span className="text-zinc-500 text-[10px] uppercase">{ref.type}</span>
              {ref.label}
              <button
                onClick={() => removeEntity(i)}
                className="ml-1 text-zinc-500 hover:text-zinc-300"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg">
          {results.map((ref, i) => (
            <button
              key={`${ref.type}:${ref.id}`}
              onClick={() => selectEntity(ref)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                i === highlightIdx
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <span>{ref.emoji}</span>
              <span className="text-zinc-500 text-[10px] uppercase w-12">{ref.type}</span>
              <span className="truncate">{ref.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
