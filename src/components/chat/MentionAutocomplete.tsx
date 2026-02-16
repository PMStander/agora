// ─── Mention Autocomplete ────────────────────────────────────────────────────
// Floating dropdown triggered by @ in a textarea.
// Shows project team agents, other agents, and system entities.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAgentStore } from '../../stores/agents';
import { useCrmStore } from '../../stores/crm';
import { useProductsStore } from '../../stores/products';
import { useProjectsStore } from '../../stores/projects';
import { ENTITY_TYPE_EMOJI, type EntityReferenceType } from '../../types/boardroom';
import type { MessageMention } from '../../types/boardroom';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MentionOption {
  mention: MessageMention;
  label: string;
  sublabel?: string;
  emoji?: string;
  section: 'team' | 'agents' | 'entities';
}

interface MentionAutocompleteProps {
  inputValue: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  participantAgentIds: string[];
  onSelect: (mention: MessageMention) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MentionAutocomplete({
  inputValue,
  inputRef,
  participantAgentIds,
  onSelect,
}: MentionAutocompleteProps) {
  const teams = useAgentStore((s) => s.teams);
  const agentProfiles = useAgentStore((s) => s.agentProfiles);
  const companies = useCrmStore((s) => s.companies);
  const contacts = useCrmStore((s) => s.contacts);
  const deals = useCrmStore((s) => s.deals);
  const products = useProductsStore((s) => s.products);
  const projects = useProjectsStore((s) => s.projects);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [options, setOptions] = useState<MentionOption[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const allAgents = teams.flatMap((t) => t.agents);

  // Detect @ trigger: scan backwards from cursor for unmatched @
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBefore = inputValue.slice(0, cursorPos);
    const atIdx = textBefore.lastIndexOf('@');

    if (atIdx === -1 || (atIdx > 0 && textBefore[atIdx - 1] !== ' ' && textBefore[atIdx - 1] !== '\n' && atIdx !== 0)) {
      setIsOpen(false);
      return;
    }

    // Check there's no space between @ and cursor (allows multi-word search with partial spaces)
    const afterAt = textBefore.slice(atIdx + 1);

    // If there's a completed mention (display text matches), close
    // Simple heuristic: if text after @ contains two spaces, likely done typing
    if (afterAt.includes('  ')) {
      setIsOpen(false);
      return;
    }

    setQuery(afterAt.toLowerCase());
    setIsOpen(true);
  }, [inputValue, inputRef]);

  // Build options based on query
  useEffect(() => {
    if (!isOpen) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const results: MentionOption[] = [];
      const q = query.toLowerCase();

      // Special @all and @team options
      if ('all'.startsWith(q) || 'everyone'.startsWith(q)) {
        results.push({
          mention: { type: 'agent', id: '__all__', display: '@all' },
          label: 'All Agents',
          sublabel: 'Everyone responds',
          emoji: '📢',
          section: 'team',
        });
      }

      // Team agents (in project)
      for (const agentId of participantAgentIds) {
        const profile = agentProfiles[agentId];
        if (!profile) continue;
        if (q && !profile.name.toLowerCase().includes(q) && !agentId.toLowerCase().includes(q)) continue;
        results.push({
          mention: { type: 'agent', id: agentId, display: `@${profile.name}` },
          label: profile.name,
          sublabel: profile.role,
          emoji: profile.emoji,
          section: 'team',
        });
      }

      // Other agents (not in project)
      for (const agent of allAgents) {
        if (participantAgentIds.includes(agent.id)) continue;
        if (q && !agent.name.toLowerCase().includes(q) && !agent.id.toLowerCase().includes(q)) continue;
        const profile = agentProfiles[agent.id];
        results.push({
          mention: { type: 'agent', id: agent.id, display: `@${agent.name}` },
          label: agent.name,
          sublabel: agent.role,
          emoji: profile?.emoji || agent.emoji,
          section: 'agents',
        });
      }

      // Entities — only search if query has 2+ chars (avoid huge result sets)
      if (q.length >= 2) {
        const pushEntity = (type: EntityReferenceType, id: string, label: string) => {
          results.push({
            mention: { type: 'entity', id, display: `@${label}`, entity_type: type },
            label,
            sublabel: type,
            emoji: ENTITY_TYPE_EMOJI[type],
            section: 'entities',
          });
        };

        for (const c of companies.slice(0, 100)) {
          if (c.name.toLowerCase().includes(q)) pushEntity('company', c.id, c.name);
          if (results.filter((r) => r.section === 'entities').length >= 5) break;
        }
        for (const c of contacts.slice(0, 100)) {
          const name = `${c.first_name} ${c.last_name}`.trim();
          if (name.toLowerCase().includes(q)) pushEntity('contact', c.id, name);
          if (results.filter((r) => r.section === 'entities').length >= 8) break;
        }
        for (const d of deals.slice(0, 100)) {
          if (d.title.toLowerCase().includes(q)) pushEntity('deal', d.id, d.title);
          if (results.filter((r) => r.section === 'entities').length >= 10) break;
        }
        for (const p of products.slice(0, 100)) {
          if (p.name.toLowerCase().includes(q)) pushEntity('product', p.id, p.name);
          if (results.filter((r) => r.section === 'entities').length >= 12) break;
        }
        for (const p of projects.slice(0, 50)) {
          if (p.name.toLowerCase().includes(q)) pushEntity('project', p.id, p.name);
          if (results.filter((r) => r.section === 'entities').length >= 14) break;
        }
      }

      setOptions(results.slice(0, 15));
      setHighlightIdx(0);
    }, 100);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isOpen, participantAgentIds, agentProfiles, allAgents, companies, contacts, deals, products, projects]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || options.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, options.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Tab' || (e.key === 'Enter' && isOpen)) {
        e.preventDefault();
        e.stopPropagation();
        const selected = options[highlightIdx];
        if (selected) {
          onSelect(selected.mention);
          setIsOpen(false);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    },
    [isOpen, options, highlightIdx, onSelect]
  );

  // Attach keyboard listener to textarea only when autocomplete is open
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea || !isOpen) return;

    textarea.addEventListener('keydown', handleKeyDown as any, true);
    return () => textarea.removeEventListener('keydown', handleKeyDown as any, true);
  }, [inputRef, isOpen, handleKeyDown]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!isOpen || options.length === 0) return null;

  // Group options by section
  const sections = [
    { key: 'team', label: 'Team Agents', items: options.filter((o) => o.section === 'team') },
    { key: 'agents', label: 'Other Agents', items: options.filter((o) => o.section === 'agents') },
    { key: 'entities', label: 'Entities', items: options.filter((o) => o.section === 'entities') },
  ].filter((s) => s.items.length > 0);

  let globalIdx = 0;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-20 max-h-64 overflow-y-auto"
    >
      {sections.map((section) => (
        <div key={section.key}>
          <div className="px-3 py-1 text-[10px] text-zinc-500 uppercase tracking-wider bg-zinc-900/80 sticky top-0">
            {section.label}
          </div>
          {section.items.map((option) => {
            const currentIdx = globalIdx++;
            return (
              <button
                key={`${option.mention.type}:${option.mention.id}`}
                onClick={() => {
                  onSelect(option.mention);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                  currentIdx === highlightIdx
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <span className="text-sm shrink-0">{option.emoji}</span>
                <span className="truncate font-medium">{option.label}</span>
                {option.sublabel && (
                  <span className="text-[10px] text-zinc-500 ml-auto shrink-0">
                    {option.sublabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
      <div className="px-3 py-1 text-[10px] text-zinc-600 border-t border-zinc-800">
        ↑↓ navigate · Tab to select · Esc to dismiss
      </div>
    </div>
  );
}
