import { useState } from 'react';
import { useAgentStore } from '../../stores/agents';
import { useAgentHiring } from '../../hooks/useAgentHiring';
import { SoulDisplay } from './SoulDisplay';
import { SoulEditor } from './SoulEditor';
import { cn } from '../../lib/utils';
import type { AgentLifecycleStatus } from '../../types/supabase';

const LIFECYCLE_BADGE: Record<AgentLifecycleStatus, { bg: string; text: string }> = {
  candidate: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  onboarding: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  active: { bg: 'bg-green-500/20', text: 'text-green-400' },
  suspended: { bg: 'bg-zinc-500/20', text: 'text-zinc-400' },
  retired: { bg: 'bg-red-500/20', text: 'text-red-400' },
};

export function AgentProfilePanel() {
  const selectedId = useAgentStore((s) => s.selectedProfileAgentId);
  const profile = useAgentStore((s) => (selectedId ? s.agentProfiles[selectedId] : null));
  const setSelectedProfileAgentId = useAgentStore((s) => s.setSelectedProfileAgentId);
  const { updateSoul, changeLifecycleStatus } = useAgentHiring();
  const [editing, setEditing] = useState(false);
  const [showConfirmAction, setShowConfirmAction] = useState<'suspend' | 'retire' | null>(null);

  if (!profile) return null;

  const badge = LIFECYCLE_BADGE[profile.lifecycleStatus];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setSelectedProfileAgentId(null)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Close
          </button>
          <span
            className={cn(
              'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full',
              badge.bg,
              badge.text
            )}
          >
            {profile.lifecycleStatus}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={profile.avatar}
              alt={profile.name}
              className="w-14 h-14 rounded-full object-cover border-2 border-zinc-700"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <span className="hidden w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-2xl">
              {profile.emoji}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">
              {profile.emoji} {profile.name}
            </h3>
            <p className="text-sm text-zinc-400">
              {profile.role} | {profile.team} team
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-500">
          {profile.hiredAt && (
            <div>
              Active since: {new Date(profile.hiredAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </div>
          )}
          <div>SOUL v{profile.soulVersion}</div>
          <div>Provider: {profile.provider}</div>
          <div>Model: {profile.model.split('-').slice(0, 2).join('-')}</div>
        </div>

        {/* Actions */}
        {!editing && profile.lifecycleStatus !== 'retired' && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-xs bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500/20 transition-colors"
            >
              Edit Soul
            </button>
            {profile.lifecycleStatus === 'active' && (
              <>
                <button
                  onClick={() => setShowConfirmAction('suspend')}
                  className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  Suspend
                </button>
                <button
                  onClick={() => setShowConfirmAction('retire')}
                  className="px-3 py-1.5 text-xs bg-zinc-800 text-red-400/70 rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  Retire
                </button>
              </>
            )}
            {profile.lifecycleStatus === 'suspended' && (
              <button
                onClick={() => changeLifecycleStatus(profile.id, 'active')}
                className="px-3 py-1.5 text-xs bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 transition-colors"
              >
                Reactivate
              </button>
            )}
          </div>
        )}

        {/* Confirm dialog */}
        {showConfirmAction && (
          <div className="mt-3 p-3 bg-zinc-800 border border-zinc-700 rounded-lg">
            <p className="text-sm text-zinc-300 mb-2">
              {showConfirmAction === 'suspend'
                ? "Suspend this agent? They won't receive new tasks."
                : 'Retire this agent permanently? Their history will be preserved.'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  changeLifecycleStatus(
                    profile.id,
                    showConfirmAction === 'suspend' ? 'suspended' : 'retired'
                  );
                  setShowConfirmAction(null);
                }}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  showConfirmAction === 'retire'
                    ? 'bg-red-500 text-white hover:bg-red-400'
                    : 'bg-amber-500 text-black hover:bg-amber-400'
                )}
              >
                Confirm
              </button>
              <button
                onClick={() => setShowConfirmAction(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Body - SOUL Display or Editor */}
      <div className="flex-1 overflow-y-auto">
        {editing ? (
          <div className="p-4">
            <SoulEditor
              soul={profile.soul}
              agent={profile}
              onSave={(soul) => {
                updateSoul(profile.id, soul);
                setEditing(false);
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <SoulDisplay soul={profile.soul} />
        )}
      </div>
    </div>
  );
}
