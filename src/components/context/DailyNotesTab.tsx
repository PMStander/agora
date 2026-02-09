import { useState, useEffect } from 'react';
import { useAgentMemory } from '../../hooks/useAgentMemory';
import type { DailyNote, DailyNoteEntry } from '../../types/context';

interface DailyNotesTabProps {
  agentId: string;
}

const entryTypeIcons: Record<string, string> = {
  task_started: '>>',
  task_completed: '[ok]',
  insight: '[!]',
  error: '[x]',
  handoff: '[->]',
  decision: '[*]',
  observation: '[~]',
};

function DailyNoteEntryItem({ entry }: { entry: DailyNoteEntry }) {
  return (
    <div className="flex gap-2 py-1.5 border-b border-zinc-800 last:border-0">
      <span className="text-xs font-mono text-zinc-500 shrink-0 w-10">
        {entryTypeIcons[entry.type] || '[?]'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-300">{entry.content}</p>
        <div className="flex gap-2 mt-0.5">
          <span className="text-xs text-zinc-600">
            {new Date(entry.timestamp).toLocaleTimeString()}
          </span>
          <span className="text-xs text-zinc-600">{entry.type}</span>
          {entry.related_task_id && (
            <span className="text-xs text-zinc-600">
              task:{entry.related_task_id.slice(0, 8)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function DailyNotesTab({ agentId }: DailyNotesTabProps) {
  const { getDailyNotes, dailyNotes } = useAgentMemory();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDailyNotes(agentId).then(() => setLoading(false));
  }, [agentId, getDailyNotes]);

  const notes: DailyNote[] = dailyNotes[agentId] || [];

  if (loading) {
    return (
      <div className="text-center text-zinc-500 text-xs py-8 animate-pulse">
        Loading daily notes...
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-2xl mb-2">📓</div>
        <p className="text-xs text-zinc-400">No daily notes yet</p>
        <p className="text-xs text-zinc-600 mt-1">
          Notes are auto-generated during task execution
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <div key={note.id} className="rounded-lg border border-zinc-700 bg-zinc-800/50">
          <div className="px-3 py-2 border-b border-zinc-700 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">{note.date}</span>
            <span className="text-xs text-zinc-500">
              {note.entries.length} entries
            </span>
          </div>
          <div className="px-3 py-1">
            {note.entries.map((entry, idx) => (
              <DailyNoteEntryItem key={`${note.id}-${idx}`} entry={entry} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
