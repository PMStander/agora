import { useState, useEffect } from 'react';
import { useActiveAgent } from '../../stores/agents';
import { useA2UI } from '../../hooks/useA2UI';
import { A2UIRenderer } from '../a2ui/A2UIRenderer';
import { A2UIDemo } from '../a2ui/A2UIDemo';
import { cn } from '../../lib/utils';
import {
  useGatewayConfig,
  THINKING_LEVELS,
  SKILL_CATALOG,
  buildPrimary,
  type ThinkingLevel,
} from '../../hooks/useGatewayConfig';

interface ContextPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

type PanelMode = 'agent-info' | 'tools' | 'a2ui';

// ── Model Section ──────────────────────────────────────────────────────

function ModelSection() {
  const {
    loading, patching, primary, providerId, modelId, thinkingLevel,
    catalog, setModel, setThinking,
  } = useGatewayConfig();

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

  // When provider changes, pick first model of that provider
  const handleProviderChange = (newProvider: string) => {
    setSelProvider(newProvider);
    const prov = catalog.find(p => p.id === newProvider);
    if (prov?.models.length) {
      setSelModel(prov.models[0].id);
    }
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      const newPrimary = buildPrimary(selProvider, selModel);
      // Apply model and thinking in one go
      if (newPrimary !== primary) {
        await setModel(newPrimary);
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
        <div className="text-xs text-muted-foreground uppercase tracking-wider">Model</div>
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
                <option key={p.id} value={p.id}>
                  {p.icon} {p.label}{p.note ? ` (${p.note})` : ''}
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
              {selectedProvider?.models.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
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
  const { allSkills, skillEntries, skillsFromGateway, loading } = useGatewayConfig();
  const [expanded, setExpanded] = useState(false);

  // Use gateway skills if available (richer data), fall back to config-derived list
  const displaySkills = skillsFromGateway.length > 0
    ? skillsFromGateway.filter(s => s.eligible !== false)
    : allSkills.map(id => ({ key: id, name: SKILL_CATALOG[id]?.label }));

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

  if (displaySkills.length === 0) {
    return (
      <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
        No skills configured
      </div>
    );
  }

  const visibleSkills = expanded ? displaySkills : displaySkills.slice(0, 12);
  const hasMore = displaySkills.length > 12;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">
          Skills
          <span className="ml-1.5 text-zinc-500">({displaySkills.length})</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {visibleSkills.map(skill => {
          const skillId = typeof skill === 'string' ? skill : skill.key;
          const skillName = typeof skill === 'string' ? skill : (skill.name || skill.key);
          const meta = SKILL_CATALOG[skillId];
          const isConfigured = skillEntries.includes(skillId);
          return (
            <span
              key={skillId}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
                isConfigured
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              )}
              title={meta?.label ?? skillName}
            >
              <span>{meta?.icon ?? '🔧'}</span>
              <span className="truncate max-w-[80px]">{meta?.label ?? skillName}</span>
            </span>
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

// ── Main Panel ─────────────────────────────────────────────────────────

export function ContextPanel({ isOpen, onToggle }: ContextPanelProps) {
  const activeAgent = useActiveAgent();
  const { isConnected: a2uiConnected, isEnabled: a2uiEnabled, activeSurface, surfaces, enable: enableA2UI } = useA2UI();
  const [mode, setMode] = useState<PanelMode>('agent-info');

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
        <h2 className="font-semibold">Context</h2>
        <div className="flex items-center gap-2">
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
      <div className="flex-1 overflow-y-auto p-4">
        {mode === 'agent-info' && activeAgent && (
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
          </div>
        )}

        {mode === 'tools' && (
          <div className="space-y-4">
            <div className="text-center text-muted-foreground py-4">
              <div className="text-4xl mb-2">🔧</div>
              <p className="text-sm">Agent tools & widgets</p>
            </div>

            {/* Quick tools grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: '📊', label: 'Charts', desc: 'Data visualization' },
                { icon: '📝', label: 'Forms', desc: 'Data input' },
                { icon: '📋', label: 'Tasks', desc: 'Kanban board' },
                { icon: '📁', label: 'Files', desc: 'Documents' },
                { icon: '🔗', label: 'Links', desc: 'Resources' },
                { icon: '⏱️', label: 'Timer', desc: 'Pomodoro' },
              ].map((tool) => (
                <button
                  key={tool.label}
                  className="p-3 rounded-lg bg-muted/50 text-left hover:bg-muted transition-colors group"
                >
                  <div className="text-xl mb-1">{tool.icon}</div>
                  <div className="text-sm font-medium">{tool.label}</div>
                  <div className="text-xs text-muted-foreground">{tool.desc}</div>
                </button>
              ))}
            </div>

            {/* A2UI Demo */}
            <div className="border-t border-border pt-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                A2UI Preview
              </div>
              <A2UIDemo />
            </div>
          </div>
        )}

        {mode === 'a2ui' && (
          <div className="space-y-4">
            {/* A2UI Connection Status */}
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm">
                <span className={cn(
                  'w-2 h-2 rounded-full',
                  a2uiConnected ? 'bg-green-500' : a2uiEnabled ? 'bg-yellow-500 animate-pulse' : 'bg-muted-foreground'
                )} />
                <span>
                  {a2uiConnected ? 'Connected to Canvas' : a2uiEnabled ? 'Connecting...' : 'Canvas Disabled'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Port 18793 • {surfaces.size} surface(s)
              </p>
            </div>

            {/* Render active surface */}
            {activeSurface ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  Surface: {activeSurface.id}
                </div>
                <A2UIRenderer surface={activeSurface} />
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

            {/* Surface list if multiple */}
            {surfaces.size > 1 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  All Surfaces
                </div>
                {Array.from(surfaces.keys()).map(id => (
                  <button
                    key={id}
                    onClick={() => {/* setActiveSurfaceId(id) */}}
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
        )}
      </div>
    </aside>
  );
}
