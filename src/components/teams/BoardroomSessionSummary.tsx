// ─── Boardroom Session Summary Display ───────────────────────────────────────
// Shows the auto-generated summary after a session ends

import type { SessionSummary } from '../../types/boardroom';

interface BoardroomSessionSummaryProps {
  summary: SessionSummary;
}

export function BoardroomSessionSummary({ summary }: BoardroomSessionSummaryProps) {
  return (
    <div className="bg-gradient-to-br from-zinc-800/80 to-zinc-900 border border-amber-500/20 rounded-lg p-6 space-y-6 max-w-2xl w-full">
      <div className="flex items-center gap-2">
        <span className="text-2xl">📋</span>
        <h3 className="text-lg font-semibold text-zinc-100">
          Session Summary
        </h3>
      </div>

      {/* Key Decisions */}
      {summary.decisions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">✅</span>
            <h4 className="font-medium text-zinc-100">
              Key Decisions
            </h4>
          </div>
          <ul className="space-y-2 ml-7">
            {summary.decisions.map((decision, idx) => (
              <li
                key={idx}
                className="text-sm text-zinc-300 leading-relaxed"
              >
                {decision}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Items */}
      {summary.action_items.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📌</span>
            <h4 className="font-medium text-zinc-100">
              Action Items
            </h4>
          </div>
          <ul className="space-y-2 ml-7">
            {summary.action_items.map((item, idx) => (
              <li
                key={idx}
                className="text-sm text-zinc-300 leading-relaxed"
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500"
                  />
                  <div>
                    <div>{item.task}</div>
                    {item.owner && (
                      <div className="text-xs text-zinc-500 mt-0.5">
                        Owner: {item.owner}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Unresolved Items */}
      {summary.unresolved.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">❓</span>
            <h4 className="font-medium text-zinc-100">
              Unresolved Items
            </h4>
          </div>
          <ul className="space-y-2 ml-7">
            {summary.unresolved.map((item, idx) => (
              <li
                key={idx}
                className="text-sm text-zinc-300 leading-relaxed"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Generated timestamp */}
      <div className="text-xs text-zinc-500 pt-4 border-t border-zinc-700">
        Generated: {new Date(summary.generated_at).toLocaleString()}
      </div>
    </div>
  );
}
