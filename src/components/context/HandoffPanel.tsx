import { useState } from 'react';
import { useHandoff } from '../../hooks/useHandoff';
import { useActiveAgent } from '../../stores/agents';
import { HandoffCard } from './HandoffCard';
import { HandoffRequestForm } from './HandoffRequestForm';
import { HandoffTimeline } from './HandoffTimeline';

export function HandoffPanel() {
  const activeAgent = useActiveAgent();
  const {
    acceptHandoff,
    completeHandoff,
    declineHandoff,
    getActiveHandoffs,
    getHandoffHistory,
  } = useHandoff();
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const agentId = activeAgent?.id || '';
  const activeHandoffs = getActiveHandoffs(agentId);
  const allHistory = getHandoffHistory(agentId);

  const handleComplete = async (id: string) => {
    const outcome = window.prompt('Handoff outcome:');
    if (outcome) await completeHandoff(id, outcome);
  };

  const handleDecline = async (id: string) => {
    const reason = window.prompt('Reason for declining:');
    if (reason) await declineHandoff(id, reason);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-zinc-200 uppercase tracking-wider">
          Handoffs
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              showHistory
                ? 'bg-zinc-700 text-zinc-300'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            History
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
          >
            + New
          </button>
        </div>
      </div>

      {/* New request form */}
      {showForm && (
        <HandoffRequestForm
          requestingAgentId={agentId}
          onCreated={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Active handoffs */}
      {showHistory ? (
        <HandoffTimeline handoffs={allHistory} />
      ) : activeHandoffs.length > 0 ? (
        <div className="space-y-2">
          {activeHandoffs.map((h) => (
            <HandoffCard
              key={h.id}
              handoff={h}
              onAccept={acceptHandoff}
              onComplete={handleComplete}
              onDecline={handleDecline}
            />
          ))}
        </div>
      ) : (
        <div className="text-center text-zinc-500 text-xs py-4">
          No active handoffs
        </div>
      )}
    </div>
  );
}
