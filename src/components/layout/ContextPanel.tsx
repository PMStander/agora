import { useState, useEffect } from 'react';
import { useActiveAgent } from '../../stores/agents';
import { useA2UI } from '../../hooks/useA2UI';
import { A2UIRenderer } from '../a2ui/A2UIRenderer';
import { A2UIDemo } from '../a2ui/A2UIDemo';
import { cn } from '../../lib/utils';

interface ContextPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

type PanelMode = 'agent-info' | 'tools' | 'a2ui';

export function ContextPanel({ isOpen, onToggle }: ContextPanelProps) {
  const activeAgent = useActiveAgent();
  const { isConnected: a2uiConnected, activeSurface, surfaces } = useA2UI();
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
            onClick={() => setMode('a2ui')}
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
                  a2uiConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
                )} />
                <span>{a2uiConnected ? 'Connected to Canvas' : 'Connecting...'}</span>
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
