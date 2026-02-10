import { useState, useEffect, useMemo } from 'react';
import { useActiveAgent } from '../../stores/agents';
import { useA2UI } from '../../hooks/useA2UI';
import { useAutoSurface } from '../../hooks/useAutoSurface';
import { A2UIRenderer, type A2UIActionEvent } from '../a2ui/A2UIRenderer';
import { cn } from '../../lib/utils';
import { useOpenClaw } from '../../hooks/useOpenClaw';
import {
  useGatewayConfig,
  THINKING_LEVELS,
  SKILL_CATALOG,
  buildPrimary,
  type ThinkingLevel,
} from '../../hooks/useGatewayConfig';
import { HandoffPanel } from '../context/HandoffPanel';
import { UpcomingEvents } from '../calendar/UpcomingEvents';
import { ChatPanel } from '../chat/ChatPanel';
import { useMissionControlStore } from '../../stores/missionControl';
import { useCrmStore } from '../../stores/crm';
import { useInvoicingStore } from '../../stores/invoicing';
import { useNotificationsStore } from '../../stores/notifications';
import { useMemoryIntelligence } from '../../hooks/useMemoryIntelligence';

interface ContextPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

type PanelMode = 'agent-info' | 'tools' | 'a2ui' | 'chat';

// ── Model Section ──────────────────────────────────────────────────────

function ModelSection() {
  const activeAgent = useActiveAgent();
  const {
    loading, patching, primary, providerId, modelId, thinkingLevel,
    catalog, setModel, setThinking, canValidateModels, isModelSupported, isProviderSupported,
    activeAgentConfig,
  } = useGatewayConfig({ agentId: activeAgent?.id });

  const [editing, setEditing] = useState(false);
  const [selProvider, setSelProvider] = useState(providerId);
  const [selModel, setSelModel] = useState(modelId);
  const [selThinking, setSelThinking] = useState<ThinkingLevel>(thinkingLevel);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sync selections when config loads or primary changes
  useEffect(() => {
    if (!editing) {
      setSelProvider(providerId);
      setSelModel(modelId);
      setSelThinking(thinkingLevel);
    }
  }, [providerId, modelId, thinkingLevel, editing]);

  const currentProvider = catalog.find(p => p.id === providerId);
  const selectedProvider = catalog.find(p => p.id === selProvider);
  const currentModelAvailable = isModelSupported(primary);

  // When provider changes, pick first model of that provider
  const handleProviderChange = (newProvider: string) => {
    setSelProvider(newProvider);
    const prov = catalog.find(p => p.id === newProvider);
    if (prov?.models.length) {
      const nextModel = prov.models.find((m) => {
        if (!canValidateModels) return true;
        return isModelSupported(buildPrimary(newProvider, m.id));
      })?.id ?? prov.models[0].id;
      setSelModel(nextModel);
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    console.log('[ModelSection] handleSave called with:', { selProvider, selModel, selThinking });
    try {
      const newPrimary = buildPrimary(selProvider, selModel);
      console.log('[ModelSection] Built primary:', newPrimary, 'current primary:', primary);
      if (canValidateModels && !isModelSupported(newPrimary)) {
        setSaveError(`Model not available in current OpenClaw runtime: ${newPrimary}`);
        return;
      }
      // Apply model and thinking in one go
      if (newPrimary !== primary) {
        console.log('[ModelSection] Calling setModel with:', newPrimary, 'for agent:', activeAgent?.id);
        await setModel(newPrimary, activeAgent?.id);
      }
      if (selThinking !== thinkingLevel) {
        await setThinking(selThinking);
      }
      setEditing(false);
    } catch (err) {
      setSaveError(String(err));
    }
  };

  if (loading) {
    return (
      <div className="p-3 rounded-lg bg-muted/50 animate-pulse">
        <div className="h-4 bg-muted rounded w-24 mb-2" />
        <div className="h-3 bg-muted rounded w-32" />
      </div>
    );
  }

  if (!primary) {
    return (
      <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
        No model configured
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          Model{activeAgent ? ` · ${activeAgent.id}` : ''}
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {!editing ? (
        /* ── Display mode ── */
        <div className="p-3 rounded-lg bg-muted/50 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{currentProvider?.icon ?? '⚡'}</span>
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">
                {currentProvider?.label ?? providerId}
              </div>
              <div className="text-xs text-muted-foreground truncate">{modelId}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Thinking:</span>
            <span className={cn(
              'px-1.5 py-0.5 rounded font-medium',
              thinkingLevel === 'off' ? 'bg-zinc-700 text-zinc-400' :
              thinkingLevel === 'xhigh' || thinkingLevel === 'high' ? 'bg-amber-500/20 text-amber-400' :
              'bg-zinc-700 text-zinc-300'
            )}>
              {thinkingLevel}
            </span>
            {currentProvider?.note && (
              <span className="text-muted-foreground ml-auto">{currentProvider.note}</span>
            )}
          </div>
          {!activeAgentConfig?.model && (
            <div className="text-xs text-zinc-400">
              Using global default model for this agent.
            </div>
          )}
          {canValidateModels && !currentModelAvailable && (
            <div className="text-xs text-red-400">
              Current model unavailable in this gateway runtime.
            </div>
          )}
        </div>
      ) : (
        /* ── Edit mode ── */
        <div className="p-3 rounded-lg bg-muted/50 border border-zinc-700 space-y-3">
          {/* Provider */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Provider</label>
            <select
              value={selProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full text-sm bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 focus:border-amber-500 focus:outline-none"
          >
            {catalog.map(p => (
              <option key={p.id} value={p.id} disabled={canValidateModels && !isProviderSupported(p.id)}>
                {p.iconText ?? '⚡'} {p.label}{p.note ? ` (${p.note})` : ''}{canValidateModels && !isProviderSupported(p.id) ? ' (Unavailable)' : ''}
              </option>
            ))}
          </select>
        </div>

          {/* Model */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Model</label>
            <select
              value={selModel}
              onChange={(e) => setSelModel(e.target.value)}
              className="w-full text-sm bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-zinc-200 focus:border-amber-500 focus:outline-none"
            >
              {selectedProvider?.models.map(m => {
                const candidatePrimary = buildPrimary(selProvider, m.id);
                const available = isModelSupported(candidatePrimary);
                const disabled = canValidateModels && !available;
                return (
                  <option key={m.id} value={m.id} disabled={disabled}>
                    {m.label}{disabled ? ' (Unavailable)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Thinking Level */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Thinking Level</label>
            <div className="flex flex-wrap gap-1">
              {THINKING_LEVELS.map(level => (
                <button
                  key={level}
                  onClick={() => setSelThinking(level)}
                  className={cn(
                    'px-2 py-1 text-xs rounded transition-colors',
                    selThinking === level
                      ? 'bg-amber-500/20 text-amber-400 font-medium'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="text-xs text-muted-foreground border-t border-zinc-700 pt-2">
            <span className="font-mono">{buildPrimary(selProvider, selModel)}</span>
            {canValidateModels && !isModelSupported(buildPrimary(selProvider, selModel)) && (
              <span className="ml-2 text-red-400">not available on this gateway</span>
            )}
          </div>

          {saveError && (
            <div className="text-xs text-red-400">{saveError}</div>
          )}

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={patching}
              className={cn(
                'flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors',
                patching
                  ? 'bg-amber-500/10 text-amber-400/50 cursor-wait'
                  : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
              )}
            >
              {patching ? 'Saving…' : 'Save & Restart'}
            </button>
            <button
              onClick={() => { setEditing(false); setSaveError(null); }}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Skills Section ─────────────────────────────────────────────────────

function SkillsSection() {
  const activeAgent = useActiveAgent();
  const {
    skillEntries, configuredSkills, agentScopedGatewaySkills, activeAgentConfig,
    allSkills, loading, patching, setSkills, skillsFromGateway,
  } = useGatewayConfig({ agentId: activeAgent?.id });
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [viewingSkillId, setViewingSkillId] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState(false);

  const hasExplicitAgentSkills = !!activeAgentConfig && Array.isArray(activeAgentConfig.skills);
  const effectiveConfiguredSkills = hasExplicitAgentSkills
    ? configuredSkills
    : (configuredSkills.length > 0 ? configuredSkills : agentScopedGatewaySkills);

  // Show explicit/inferred configured skills first.
  // Only fall back to global skill entries when no per-agent signal exists at all.
  const displaySkills = effectiveConfiguredSkills.length > 0
    ? effectiveConfiguredSkills.map(id => ({ key: id, name: SKILL_CATALOG[id]?.label }))
    : hasExplicitAgentSkills
    ? []
    : skillEntries.map(id => ({ key: id, name: SKILL_CATALOG[id]?.label }));
  const configuredSkillSet = new Set(effectiveConfiguredSkills);

  // Reset viewing skill when agent changes
  useEffect(() => {
    setViewingSkillId(null);
    setRemoveConfirm(false);
  }, [activeAgent?.id]);

  // Initialize selected skills when entering edit mode
  useEffect(() => {
    if (editing) {
      setSelectedSkills(new Set(effectiveConfiguredSkills));
      setSaveError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const handleToggleSkill = (skillId: string) => {
    setSelectedSkills(prev => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      const skillsArray = Array.from(selectedSkills);
      await setSkills(skillsArray, activeAgent?.id);
      setEditing(false);
    } catch (err) {
      setSaveError(String(err));
    }
  };

  const handleRemoveSkill = async (skillId: string) => {
    setSaveError(null);
    try {
      const updated = effectiveConfiguredSkills.filter(s => s !== skillId);
      await setSkills(updated, activeAgent?.id);
      setViewingSkillId(null);
      setRemoveConfirm(false);
    } catch (err) {
      setSaveError(String(err));
    }
  };

  if (loading && displaySkills.length === 0) {
    return (
      <div className="p-3 rounded-lg bg-muted/50 animate-pulse">
        <div className="h-4 bg-muted rounded w-20 mb-2" />
        <div className="flex flex-wrap gap-1">
          {[1,2,3,4,5].map(i => <div key={i} className="h-6 bg-muted rounded w-16" />)}
        </div>
      </div>
    );
  }

  // ── Skill Detail View ──
  if (viewingSkillId) {
    const meta = SKILL_CATALOG[viewingSkillId];
    const gatewayEntry = skillsFromGateway.find(
      s => s.key === viewingSkillId || s.skillKey === viewingSkillId || s.name === viewingSkillId
    );
    const label = meta?.label ?? viewingSkillId;
    const icon = meta?.icon ?? '🔧';
    const category = meta?.category ?? 'Unknown';
    const description = gatewayEntry?.description ?? null;
    const source = gatewayEntry?.source ?? null;
    const filePath = gatewayEntry?.filePath ?? null;
    const isEnabled = gatewayEntry?.enabled !== false;
    const isAssigned = configuredSkillSet.has(viewingSkillId);

    return (
      <div className="space-y-3">
        {/* Back + title row */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setViewingSkillId(null); setRemoveConfirm(false); setSaveError(null); }}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Skill Detail</div>
        </div>

        <div className="p-3 rounded-lg bg-muted/50 border border-zinc-700 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{label}</div>
              <div className="text-xs text-muted-foreground">{viewingSkillId}</div>
            </div>
            {isAssigned && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/10 text-green-400 border border-green-500/20">
                Active
              </span>
            )}
          </div>

          {/* Info rows */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Category</span>
              <span className="text-foreground">{category}</span>
            </div>
            {description && (
              <div>
                <span className="text-muted-foreground block mb-1">Description</span>
                <span className="text-foreground/80 block">{description}</span>
              </div>
            )}
            {source && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span className="text-foreground font-mono text-[11px]">{source}</span>
              </div>
            )}
            {filePath && (
              <div>
                <span className="text-muted-foreground block mb-1">Path</span>
                <span className="text-foreground/60 block font-mono text-[10px] break-all">{filePath}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className={isEnabled ? 'text-green-400' : 'text-zinc-500'}>{isEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-zinc-700 pt-3 space-y-2">
            {/* Edit all skills */}
            <button
              onClick={() => { setViewingSkillId(null); setEditing(true); }}
              className="w-full px-3 py-1.5 text-xs font-medium rounded transition-colors bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
            >
              Edit All Skills
            </button>

            {/* Remove from agent */}
            {isAssigned && !removeConfirm && (
              <button
                onClick={() => setRemoveConfirm(true)}
                className="w-full px-3 py-1.5 text-xs font-medium rounded transition-colors bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
              >
                Remove from {activeAgent?.name ?? 'Agent'}
              </button>
            )}

            {/* Confirm remove */}
            {isAssigned && removeConfirm && (
              <div className="space-y-2">
                <div className="text-xs text-red-400">
                  Remove <strong>{label}</strong> from this agent? This updates the gateway config.
                </div>
                {saveError && <div className="text-xs text-red-400">{saveError}</div>}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRemoveSkill(viewingSkillId)}
                    disabled={patching}
                    className={cn(
                      'flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors',
                      patching
                        ? 'bg-red-500/10 text-red-400/50 cursor-wait'
                        : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    )}
                  >
                    {patching ? 'Removing…' : 'Confirm Remove'}
                  </button>
                  <button
                    onClick={() => setRemoveConfirm(false)}
                    className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Edit mode ──
  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            Edit Skills{activeAgent ? ` · ${activeAgent.id}` : ''}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-muted/50 border border-zinc-700 space-y-3">
          <div className="text-xs text-muted-foreground mb-2">
            Click skills to toggle them on/off for this agent:
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
            {allSkills.map(skillId => {
              const meta = SKILL_CATALOG[skillId];
              const isSelected = selectedSkills.has(skillId);
              return (
                <button
                  key={skillId}
                  onClick={() => handleToggleSkill(skillId)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
                    isSelected
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
                      : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-400'
                  )}
                  title={meta?.label ?? skillId}
                >
                  <span>{meta?.icon ?? '🔧'}</span>
                  <span className="truncate max-w-[100px]">{meta?.label ?? skillId}</span>
                </button>
              );
            })}
          </div>

          <div className="text-xs text-muted-foreground border-t border-zinc-700 pt-2">
            Selected: {selectedSkills.size} skills
          </div>

          {saveError && (
            <div className="text-xs text-red-400">{saveError}</div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={patching}
              className={cn(
                'flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors',
                patching
                  ? 'bg-amber-500/10 text-amber-400/50 cursor-wait'
                  : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
              )}
            >
              {patching ? 'Saving…' : 'Save Skills'}
            </button>
            <button
              onClick={() => { setEditing(false); setSaveError(null); }}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Display mode ──
  if (displaySkills.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            Skills{activeAgent ? ` · ${activeAgent.id}` : ''}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            Edit
          </button>
        </div>
        <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          No agent-scoped skills configured yet
        </div>
      </div>
    );
  }

  const visibleSkills = expanded ? displaySkills : displaySkills.slice(0, 12);
  const hasMore = displaySkills.length > 12;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          Skills{activeAgent ? ` · ${activeAgent.id}` : ''}
          <span className="ml-1.5 text-zinc-500">({displaySkills.length})</span>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          Edit
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {visibleSkills.map(skill => {
          const skillId = typeof skill === 'string' ? skill : skill.key;
          const skillName = typeof skill === 'string' ? skill : (skill.name || skill.key);
          const meta = SKILL_CATALOG[skillId];
          const isConfigured = configuredSkillSet.has(skillId) || skillEntries.includes(skillId);
          return (
            <button
              key={skillId}
              onClick={() => setViewingSkillId(skillId)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors cursor-pointer',
                isConfigured
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
              )}
              title={`View ${meta?.label ?? skillName}`}
            >
              <span>{meta?.icon ?? '🔧'}</span>
              <span className="truncate max-w-[80px]">{meta?.label ?? skillName}</span>
            </button>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
        >
          {expanded ? 'Show less' : `Show all (${displaySkills.length})`}
        </button>
      )}
    </div>
  );
}

// ── Tools Panel ─────────────────────────────────────────────────────────

function ToolsPanel() {
  const missions = useMissionControlStore((s) => s.missions);
  const pendingApprovals = useMissionControlStore((s) => s.pendingApprovals);
  const setActiveTab = useMissionControlStore((s) => s.setActiveTab);
  const deals = useCrmStore((s) => s.deals);
  const contacts = useCrmStore((s) => s.contacts);
  const invoices = useInvoicingStore((s) => s.invoices);
  const quotes = useInvoicingStore((s) => s.quotes);
  const unreadCount = useNotificationsStore((s) => s.notifications.filter((n) => !n.is_read).length);
  const { priorities, addPriority, removePriority } = useMemoryIntelligence();
  const [newPriorityTitle, setNewPriorityTitle] = useState('');

  // Computed stats
  const missionStats = useMemo(() => {
    const running = missions.filter((m) => m.status === 'in_progress' || m.status === 'assigned').length;
    const pending = missions.filter((m) => m.status === 'scheduled' || m.status === 'pending_review').length;
    const completed = missions.filter((m) => m.status === 'done').length;
    const failed = missions.filter((m) => m.status === 'failed').length;
    return { running, pending, completed, failed, total: missions.length };
  }, [missions]);

  const dealStats = useMemo(() => {
    const open = deals.filter((d) => d.status === 'open');
    const won = deals.filter((d) => d.status === 'won');
    const totalValue = open.reduce((sum, d) => sum + (d.amount ?? 0), 0);
    const wonValue = won.reduce((sum, d) => sum + (d.amount ?? 0), 0);
    return { openCount: open.length, wonCount: won.length, totalValue, wonValue };
  }, [deals]);

  const invoiceStats = useMemo(() => {
    const overdue = invoices.filter((i) => i.status === 'overdue');
    const outstanding = invoices.filter((i) => ['sent', 'viewed', 'partially_paid'].includes(i.status));
    const overdueTotal = overdue.reduce((sum, i) => sum + i.total, 0);
    const outstandingTotal = outstanding.reduce((sum, i) => sum + i.total, 0);
    return { overdueCount: overdue.length, outstandingCount: outstanding.length, overdueTotal, outstandingTotal };
  }, [invoices]);

  const pendingQuotes = useMemo(() => {
    return quotes.filter((q) => ['draft', 'sent'].includes(q.status));
  }, [quotes]);

  const hotLeads = useMemo(() => {
    return [...contacts]
      .filter((c) => (c.lead_score ?? 0) > 0)
      .sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0))
      .slice(0, 3);
  }, [contacts]);

  const formatCurrency = (amount: number) => {
    if (amount >= 1_000_000) return `R ${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `R ${(amount / 1_000).toFixed(1)}K`;
    return `R ${amount.toFixed(0)}`;
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-4">

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setActiveTab('mission-control')}
            className="p-2.5 rounded-lg bg-muted/50 text-left hover:bg-muted transition-colors"
          >
            <div className="text-lg font-semibold text-blue-400">{missionStats.running}</div>
            <div className="text-[11px] text-muted-foreground">Active Missions</div>
            {missionStats.pending > 0 && (
              <div className="text-[10px] text-amber-400 mt-0.5">{missionStats.pending} pending</div>
            )}
          </button>

          <button
            onClick={() => setActiveTab('crm')}
            className="p-2.5 rounded-lg bg-muted/50 text-left hover:bg-muted transition-colors"
          >
            <div className="text-lg font-semibold text-emerald-400">{dealStats.openCount}</div>
            <div className="text-[11px] text-muted-foreground">Open Deals</div>
            {dealStats.totalValue > 0 && (
              <div className="text-[10px] text-zinc-400 mt-0.5">{formatCurrency(dealStats.totalValue)}</div>
            )}
          </button>

          <button
            onClick={() => setActiveTab('invoicing')}
            className="p-2.5 rounded-lg bg-muted/50 text-left hover:bg-muted transition-colors"
          >
            <div className={cn('text-lg font-semibold', invoiceStats.overdueCount > 0 ? 'text-red-400' : 'text-zinc-300')}>
              {invoiceStats.outstandingCount}
            </div>
            <div className="text-[11px] text-muted-foreground">Invoices Due</div>
            {invoiceStats.overdueCount > 0 && (
              <div className="text-[10px] text-red-400 mt-0.5">{invoiceStats.overdueCount} overdue</div>
            )}
          </button>

          <div className="p-2.5 rounded-lg bg-muted/50 text-left">
            <div className={cn('text-lg font-semibold', unreadCount > 0 ? 'text-amber-400' : 'text-zinc-300')}>
              {unreadCount}
            </div>
            <div className="text-[11px] text-muted-foreground">Unread Alerts</div>
            {pendingApprovals.length > 0 && (
              <div className="text-[10px] text-purple-400 mt-0.5">{pendingApprovals.length} approvals</div>
            )}
          </div>
        </div>

        {/* Shared Priorities */}
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Priorities</span>
            <span className="text-[10px] text-zinc-500 normal-case">shared across all agents</span>
          </div>
          {priorities.filter(p => p.status === 'active').length > 0 ? (
            <div className="space-y-1">
              {priorities.filter(p => p.status === 'active').map((p) => (
                <div key={p.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted/40 group">
                  <span className="text-amber-400 text-xs font-bold mt-0.5 shrink-0">
                    {p.priority_rank}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-zinc-200">{p.title}</div>
                    {p.description && (
                      <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{p.description}</div>
                    )}
                    <div className="text-[10px] text-zinc-600 mt-0.5">
                      {p.scope !== 'global' && <span className="text-purple-400">{p.scope}</span>}
                      {p.set_by !== 'user' && <span> &middot; set by {p.set_by}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => removePriority(p.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-emerald-400 transition-all shrink-0 text-xs"
                    title="Mark complete"
                  >
                    ✓
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-zinc-600 p-2 rounded-lg bg-muted/30 text-center">
              No active priorities — add one below
            </div>
          )}
          <form
            className="mt-2 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (newPriorityTitle.trim()) {
                addPriority(newPriorityTitle.trim());
                setNewPriorityTitle('');
              }
            }}
          >
            <input
              type="text"
              value={newPriorityTitle}
              onChange={(e) => setNewPriorityTitle(e.target.value)}
              placeholder="Add a priority..."
              className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-muted/50 border border-zinc-700/50 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
            />
            <button
              type="submit"
              disabled={!newPriorityTitle.trim()}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              +
            </button>
          </form>
        </div>

        {/* Pending Approvals */}
        {pendingApprovals.length > 0 && (
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3">
            <div className="text-xs text-purple-300 uppercase tracking-wider mb-2 font-medium">
              Pending Approvals
            </div>
            <div className="space-y-1.5">
              {pendingApprovals.slice(0, 3).map((a) => (
                <div key={a.taskId} className="flex items-start gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                  <span className="text-zinc-300 line-clamp-2">{a.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Overdue Invoices Alert */}
        {invoiceStats.overdueCount > 0 && (
          <button
            onClick={() => setActiveTab('invoicing')}
            className="w-full rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-left hover:bg-red-500/15 transition-colors"
          >
            <div className="text-xs text-red-300 uppercase tracking-wider mb-1 font-medium">
              Overdue
            </div>
            <div className="text-sm text-zinc-200">
              {invoiceStats.overdueCount} invoice{invoiceStats.overdueCount > 1 ? 's' : ''} — {formatCurrency(invoiceStats.overdueTotal)}
            </div>
          </button>
        )}

        {/* Hot Leads */}
        {hotLeads.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Hot Leads
            </div>
            <div className="space-y-1.5">
              {hotLeads.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveTab('crm')}
                  className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-semibold shrink-0">
                    {(c.first_name?.[0] ?? '').toUpperCase()}{(c.last_name?.[0] ?? '').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-zinc-200 truncate">{c.first_name} {c.last_name}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{c.job_title || c.email}</div>
                  </div>
                  <div className="shrink-0">
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-medium',
                      c.lead_score_label === 'hot' ? 'bg-red-500/20 text-red-300' :
                      c.lead_score_label === 'warm' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-zinc-700 text-zinc-400'
                    )}>
                      {c.lead_score ?? 0}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pending Quotes */}
        {pendingQuotes.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Pending Quotes ({pendingQuotes.length})
            </div>
            <div className="space-y-1.5">
              {pendingQuotes.slice(0, 3).map((q) => (
                <button
                  key={q.id}
                  onClick={() => setActiveTab('invoicing')}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-200 truncate">{q.title || q.quote_number}</div>
                    <div className="text-[10px] text-zinc-500">{q.status}</div>
                  </div>
                  <div className="text-sm font-medium text-amber-300 shrink-0">
                    {formatCurrency(q.total)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Events */}
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Upcoming Events
          </div>
          <UpcomingEvents limit={3} />
        </div>

        {/* Quick Navigation */}
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            Quick Nav
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { tab: 'mission-control' as const, icon: '🎯', label: 'Missions' },
              { tab: 'crm' as const, icon: '👥', label: 'CRM' },
              { tab: 'products' as const, icon: '📦', label: 'Products' },
              { tab: 'projects' as const, icon: '📐', label: 'Projects' },
              { tab: 'invoicing' as const, icon: '💰', label: 'Invoicing' },
              { tab: 'reports' as const, icon: '📊', label: 'Reports' },
              { tab: 'automation' as const, icon: '⚡', label: 'Workflows' },
              { tab: 'calendar' as const, icon: '📅', label: 'Calendar' },
              { tab: 'teams' as const, icon: '🏛️', label: 'Teams' },
            ]).map((nav) => (
              <button
                key={nav.tab}
                onClick={() => setActiveTab(nav.tab)}
                className="p-2 rounded-lg bg-muted/30 text-center hover:bg-muted/60 transition-colors"
              >
                <div className="text-base">{nav.icon}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">{nav.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Mission Completion Summary */}
        {missionStats.total > 0 && (
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Mission Progress
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-zinc-400">
                  {missionStats.completed}/{missionStats.total} completed
                </span>
                <span className="text-zinc-300 font-medium">
                  {missionStats.total > 0 ? Math.round((missionStats.completed / missionStats.total) * 100) : 0}%
                </span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${missionStats.total > 0 ? (missionStats.completed / missionStats.total) * 100 : 0}%` }}
                />
              </div>
              <div className="flex items-center gap-3 mt-2 text-[10px]">
                {missionStats.running > 0 && <span className="text-blue-400">{missionStats.running} running</span>}
                {missionStats.failed > 0 && <span className="text-red-400">{missionStats.failed} failed</span>}
                {dealStats.wonCount > 0 && <span className="text-emerald-400">{dealStats.wonCount} deals won</span>}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────

export function ContextPanel({ isOpen, onToggle }: ContextPanelProps) {
  const activeAgent = useActiveAgent();
  const { sendMessage, isConnected: gatewayConnected } = useOpenClaw();
  const activeTab = useMissionControlStore((s) => s.activeTab);
  const {
    isConnected: a2uiConnected,
    isEnabled: a2uiEnabled,
    connectionMode: a2uiConnectionMode,
    streamEndpoint: a2uiStreamEndpoint,
    activeSurface,
    surfaces,
    setActiveSurfaceId,
    pushMessages,
    enable: enableA2UI,
  } = useA2UI(true);

  // Auto-generate A2UI surfaces from agent response text (weather, calendar, missions, etc.)
  useAutoSurface({ enabled: true, pushMessages });

  const [mode, setMode] = useState<PanelMode>('agent-info');
  const [lastA2UIAction, setLastA2UIAction] = useState<string | null>(null);
  const [a2uiActionError, setA2UIActionError] = useState<string | null>(null);
  
  // Show chat tab when not on the main chat tab view
  const showChatTab = activeTab !== 'chat';

  const handleA2UIAction = async (event: A2UIActionEvent) => {
    const payload = event.payload ? JSON.stringify(event.payload) : '{}';
    setLastA2UIAction(`${event.action} @ ${event.surfaceId}`);
    setA2UIActionError(null);

    if (!activeAgent || !gatewayConnected) return;

    const actionInstruction = [
      'A2UI action event received.',
      `Surface: ${event.surfaceId}`,
      `Component: ${event.componentId}`,
      `Action: ${event.action}`,
      `Payload: ${payload}`,
      'Apply this action and continue the workflow.',
    ].join('\n');

    try {
      await sendMessage(actionInstruction, activeAgent.id);
    } catch (err) {
      setA2UIActionError(String(err));
    }
  };

  // Auto-switch to A2UI when a surface is available
  useEffect(() => {
    if (activeSurface && activeSurface.rootId) {
      setMode('a2ui');
    }
  }, [activeSurface]);

  // Change mode based on active agent's role
  useEffect(() => {
    if (!activeAgent || activeSurface?.rootId) return;
    
    if (activeAgent.role.includes('Finance') || activeAgent.role.includes('CFO')) {
      setMode('tools');
    } else if (activeAgent.role.includes('CTO') || activeAgent.role.includes('Tech')) {
      setMode('tools');
    } else {
      setMode('agent-info');
    }
  }, [activeAgent, activeSurface]);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 px-1 py-4 bg-card border border-r-0 border-border rounded-l-lg text-muted-foreground hover:text-foreground transition-colors"
      >
        ◀
      </button>
    );
  }

  return (
    <aside className="w-80 bg-card border-l border-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showChatTab && (
            <button
              onClick={() => setMode('chat')}
              className={cn(
                'px-2 py-1 text-xs rounded transition-colors',
                mode === 'chat' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Chat
            </button>
          )}
          <button
            onClick={() => setMode('agent-info')}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              mode === 'agent-info' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Info
          </button>
          <button
            onClick={() => setMode('tools')}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              mode === 'tools' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Tools
          </button>
          <button
            onClick={() => {
              setMode('a2ui');
              if (!a2uiEnabled) enableA2UI();
            }}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors relative',
              mode === 'a2ui' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            A2UI
            {activeSurface?.rootId && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
            )}
          </button>
          <button
            onClick={onToggle}
            className="ml-2 text-muted-foreground hover:text-foreground"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mode === 'chat' && showChatTab && (
          <ChatPanel />
        )}

        {mode === 'agent-info' && activeAgent && (
          <div className="h-full overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Agent Card */}
            <div className="text-center">
              <img
                src={activeAgent.avatar}
                alt={activeAgent.name}
                className="w-24 h-24 rounded-full mx-auto mb-3 border-4 border-primary/20 object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="text-4xl mb-2">{activeAgent.emoji}</div>
              <h3 className="font-bold text-lg">{activeAgent.name}</h3>
              <p className="text-sm text-muted-foreground">{activeAgent.persona}</p>
            </div>

            {/* Details */}
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Role</div>
                <div className="font-medium">{activeAgent.role}</div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Team</div>
                <div className="font-medium">
                  {activeAgent.teamId === 'personal' ? '📚 Team Personal (Philosophers)' : 
                   activeAgent.teamId === 'business' ? '⚔️ Partners in Biz (Warriors)' : 
                   '🏛️ Orchestrator'}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Specialty</div>
                <div className="text-muted-foreground text-xs">
                  {activeAgent.role.includes('Health') && 'Fitness tracking, workout plans, nutrition advice, health monitoring'}
                  {activeAgent.role.includes('Finance') && 'Budgeting, investments, financial planning, wealth building'}
                  {activeAgent.role.includes('Family') && 'Relationship advice, family dynamics, communication skills'}
                  {activeAgent.role.includes('Tech') && 'Technology trends, gadget recommendations, troubleshooting'}
                  {activeAgent.role.includes('CEO') && 'Strategic vision, leadership, business direction, company culture'}
                  {activeAgent.role.includes('CFO') && 'Financial strategy, resource allocation, metrics, profitability'}
                  {activeAgent.role.includes('CTO') && 'Technical architecture, development strategy, engineering excellence'}
                  {activeAgent.role.includes('HR') && 'Team culture, hiring, employee relations, organizational health'}
                  {activeAgent.role.includes('Marketing') && 'Brand strategy, growth hacking, market expansion, customer acquisition'}
                  {activeAgent.role.includes('Orchestrator') && 'Coordinating all agents, high-level planning, delegation, strategic oversight'}
                </div>
              </div>
            </div>

            {/* Model & Provider */}
            <div className="border-t border-border pt-4">
              <ModelSection />
            </div>

            {/* Skills */}
            <div className="border-t border-border pt-4">
              <SkillsSection />
            </div>

            {/* Handoffs */}
            <div className="border-t border-border pt-4">
              <HandoffPanel />
            </div>

            {/* Upcoming Events */}
            <div className="border-t border-border pt-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Upcoming Events
              </div>
              <UpcomingEvents limit={5} />
            </div>
          </div>
          </div>
        )}

        {mode === 'tools' && (
          <ToolsPanel />
        )}

        {mode === 'a2ui' && (
          <div className="h-full overflow-y-auto p-4">
          <div className="space-y-4">
            {/* A2UI Connection Status */}
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm">
                <span className={cn(
                  'w-2 h-2 rounded-full',
                  a2uiConnected ? 'bg-green-500' : a2uiEnabled ? 'bg-yellow-500 animate-pulse' : 'bg-muted-foreground'
                )} />
                <span>
                  {a2uiConnected
                    ? (a2uiConnectionMode === 'stream' ? 'Connected (Live Stream)' : 'Connected (Gateway Events)')
                    : a2uiEnabled
                    ? 'Connecting...'
                    : 'Canvas Disabled'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {a2uiConnectionMode === 'stream' && a2uiStreamEndpoint
                  ? `Stream: ${a2uiStreamEndpoint}`
                  : 'Stream: not available (using gateway events)'} • {surfaces.size} surface(s)
              </p>
            </div>

            {/* Render active surface */}
            {activeSurface ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Surface: {activeSurface.id}
                </div>
                <A2UIRenderer surface={activeSurface} onAction={handleA2UIAction} />
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">🎨</div>
                <p className="text-sm text-muted-foreground">No active surfaces</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Agent-generated UI will appear here
                </p>
              </div>
            )}

            {(lastA2UIAction || a2uiActionError) && (
              <div className="p-2 rounded border border-zinc-700 bg-zinc-900/60 text-xs space-y-1">
                {lastA2UIAction && (
                  <div className="text-zinc-300">Last action: {lastA2UIAction}</div>
                )}
                {a2uiActionError && (
                  <div className="text-red-300">Action dispatch failed: {a2uiActionError}</div>
                )}
              </div>
            )}

            {/* Surface list if multiple */}
            {surfaces.size > 1 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  All Surfaces
                </div>
                {Array.from(surfaces.keys()).map(id => (
                  <button
                    key={id}
                    onClick={() => setActiveSurfaceId(id)}
                    className={cn(
                      'w-full px-2 py-1 text-left text-sm rounded',
                      id === activeSurface?.id ? 'bg-primary/20 text-primary' : 'hover:bg-muted'
                    )}
                  >
                    {id}
                  </button>
                ))}
              </div>
            )}
          </div>
          </div>
        )}
      </div>
    </aside>
  );
}
