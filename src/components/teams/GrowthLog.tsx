import { useState, useMemo, useCallback } from 'react';
import { useAgentGrowth } from '../../hooks/useAgentGrowth';
import { useAgentStore } from '../../stores/agents';
import type { AgentReflection, EvolutionReport } from '../../types/growth';
import { SENTIMENT_CONFIG, TRIGGER_CONFIG, REPORT_STATUS_CONFIG } from '../../types/growth';

// ─── Team-Wide Growth Log ───────────────────────────────────────────────────

export function GrowthLog() {
  const { reflections, reports, loadingReflections, loadingReports, getGrowthStats, triggerEvolutionReport } =
    useAgentGrowth();
  const teams = useAgentStore((s) => s.teams);
  const allAgents = useMemo(() => teams.flatMap((t) => t.agents), [teams]);

  const [subView, setSubView] = useState<'reflections' | 'reports'>('reflections');
  const [filterAgentId, setFilterAgentId] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [generatingReport, setGeneratingReport] = useState(false);

  const stats = getGrowthStats();

  // ── Computed ──
  const filteredReflections = useMemo(() => {
    let list = reflections;
    if (filterAgentId !== 'all') list = list.filter((r) => r.agent_id === filterAgentId);
    if (filterTag !== 'all') list = list.filter((r) => r.tags.includes(filterTag));
    return list;
  }, [reflections, filterAgentId, filterTag]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const r of reflections) {
      for (const t of r.tags) tags.add(t);
    }
    return Array.from(tags).sort();
  }, [reflections]);

  const agentName = useCallback(
    (id: string) => {
      const a = allAgents.find((a) => a.id === id);
      return a ? `${a.emoji} ${a.name}` : id;
    },
    [allAgents]
  );

  const agentEmoji = useCallback(
    (id: string) => allAgents.find((a) => a.id === id)?.emoji || '?',
    [allAgents]
  );

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    await triggerEvolutionReport({
      agent_id: filterAgentId !== 'all' ? filterAgentId : null,
      report_type: filterAgentId !== 'all' ? 'individual' : 'team',
      period_start: weekAgo.toISOString(),
      period_end: now.toISOString(),
    });
    setGeneratingReport(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header + Stats */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-800 space-y-3">
        <div className="grid grid-cols-4 gap-3">
          <GrowthStatCard label="Total Reflections" value={stats.totalReflections} />
          <GrowthStatCard label="Last 24h" value={stats.recentReflections24h} />
          <GrowthStatCard label="Reports" value={stats.totalReports} />
          <GrowthStatCard label="Avg Sentiment" value={`${Math.round(stats.averageSentiment * 100)}%`} />
        </div>

        {/* Sub-view tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSubView('reflections')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              subView === 'reflections'
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            Reflections
          </button>
          <button
            onClick={() => setSubView('reports')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              subView === 'reports'
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            Reports
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {subView === 'reflections' ? (
          <ReflectionsView
            reflections={filteredReflections}
            loading={loadingReflections}
            allAgents={allAgents}
            allTags={allTags}
            filterAgentId={filterAgentId}
            filterTag={filterTag}
            onFilterAgent={setFilterAgentId}
            onFilterTag={setFilterTag}
            agentName={agentName}
            agentEmoji={agentEmoji}
          />
        ) : (
          <ReportsView
            reports={reports}
            loading={loadingReports}
            generating={generatingReport}
            onGenerate={handleGenerateReport}
            agentName={agentName}
          />
        )}
      </div>
    </div>
  );
}

// ─── Reflections View ───────────────────────────────────────────────────────

function ReflectionsView({
  reflections,
  loading,
  allAgents,
  allTags,
  filterAgentId,
  filterTag,
  onFilterAgent,
  onFilterTag,
  agentName,
  agentEmoji,
}: {
  reflections: AgentReflection[];
  loading: boolean;
  allAgents: { id: string; name: string; emoji: string }[];
  allTags: string[];
  filterAgentId: string;
  filterTag: string;
  onFilterAgent: (id: string) => void;
  onFilterTag: (tag: string) => void;
  agentName: (id: string) => string;
  agentEmoji: (id: string) => string;
}) {
  if (loading) {
    return <div className="flex items-center justify-center h-64 text-zinc-500">Loading reflections...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <select
          value={filterAgentId}
          onChange={(e) => onFilterAgent(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500/50"
        >
          <option value="all">All Agents</option>
          {allAgents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.emoji} {a.name}
            </option>
          ))}
        </select>
        <select
          value={filterTag}
          onChange={(e) => onFilterTag(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-amber-500/50"
        >
          <option value="all">All Tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="text-xs text-zinc-600 ml-auto">{reflections.length} reflections</span>
      </div>

      {reflections.length === 0 ? (
        <EmptyState
          title="No reflections yet"
          description="Reflections will appear as agents reflect on their work through the self-reflection skill"
        />
      ) : (
        reflections.map((r) => (
          <TeamReflectionCard key={r.id} reflection={r} agentName={agentName} agentEmoji={agentEmoji} />
        ))
      )}
    </div>
  );
}

function TeamReflectionCard({
  reflection,
  agentName,
  agentEmoji,
}: {
  reflection: AgentReflection;
  agentName: (id: string) => string;
  agentEmoji: (id: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const sentCfg = SENTIMENT_CONFIG[reflection.sentiment];
  const trigCfg = TRIGGER_CONFIG[reflection.trigger];
  const ts = new Date(reflection.created_at);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{agentEmoji(reflection.agent_id)}</span>
          <span className="text-sm font-medium text-zinc-200">{agentName(reflection.agent_id)}</span>
          <span className={`text-xs ${sentCfg.color}`}>{sentCfg.label}</span>
          <span className="text-xs text-zinc-600">{trigCfg.label}</span>
        </div>
        <span className="text-xs text-zinc-600 whitespace-nowrap">
          {ts.toLocaleDateString()} {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {reflection.tags.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {reflection.tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 text-xs bg-zinc-800 text-zinc-400 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
        {expanded ? reflection.content : reflection.content.slice(0, 200)}
        {reflection.content.length > 200 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-amber-500 hover:text-amber-400 ml-1"
          >
            {expanded ? ' less' : '... more'}
          </button>
        )}
      </p>

      {expanded && reflection.lessons_learned.length > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-800">
          <p className="text-xs font-medium text-zinc-400 mb-1">Lessons Learned</p>
          <ul className="space-y-1">
            {reflection.lessons_learned.map((l, i) => (
              <li key={i} className="text-xs text-zinc-500 pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-emerald-500/40 before:rounded-full">
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Reports View ───────────────────────────────────────────────────────────

function ReportsView({
  reports,
  loading,
  generating,
  onGenerate,
  agentName,
}: {
  reports: EvolutionReport[];
  loading: boolean;
  generating: boolean;
  onGenerate: () => void;
  agentName: (id: string) => string;
}) {
  if (loading) {
    return <div className="flex items-center justify-center h-64 text-zinc-500">Loading reports...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Generate button */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-600">{reports.length} reports</span>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {generating ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          title="No reports yet"
          description="Click 'Generate Report' to create a State of the Agents analysis"
        />
      ) : (
        reports.map((r) => (
          <TeamReportCard key={r.id} report={r} agentName={agentName} />
        ))
      )}
    </div>
  );
}

function TeamReportCard({
  report,
  agentName,
}: {
  report: EvolutionReport;
  agentName: (id: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = REPORT_STATUS_CONFIG[report.status];
  const start = new Date(report.period_start).toLocaleDateString();
  const end = new Date(report.period_end).toLocaleDateString();

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
          <span className="text-xs text-zinc-600">|</span>
          <span className="text-xs text-zinc-500">{start} - {end}</span>
          <span className="text-xs text-zinc-600">|</span>
          <span className="text-xs text-zinc-500">
            {report.report_type === 'team' ? 'Team' : agentName(report.agent_id || '')}
          </span>
        </div>
        {report.status === 'completed' && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-amber-500 hover:text-amber-400"
          >
            {expanded ? 'Hide' : 'Details'}
          </button>
        )}
      </div>

      {report.raw_analysis && (
        <p className="text-sm text-zinc-300 mt-2">
          {expanded ? report.raw_analysis : report.raw_analysis.slice(0, 200) + '...'}
        </p>
      )}

      {expanded && report.status === 'completed' && (
        <div className="mt-3 pt-3 border-t border-zinc-800 space-y-3">
          {/* Health score */}
          {report.health_summary.overall_score > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1">Health Score</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500/60 rounded-full"
                    style={{ width: `${report.health_summary.overall_score}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400">{report.health_summary.overall_score}%</span>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1">Recommendations</p>
              {report.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 mb-1.5">
                  <span
                    className={`text-xs px-1 py-0.5 rounded ${
                      rec.priority === 'high'
                        ? 'bg-red-500/20 text-red-400'
                        : rec.priority === 'medium'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {rec.priority}
                  </span>
                  <div>
                    <p className="text-xs text-zinc-300">{rec.action}</p>
                    <p className="text-xs text-zinc-600">{rec.rationale}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Signals */}
          {report.signals.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1">Signals</p>
              {report.signals.map((sig, i) => (
                <p key={i} className="text-xs text-zinc-500 mb-1">
                  <span
                    className={
                      sig.severity === 'high'
                        ? 'text-red-400'
                        : sig.severity === 'medium'
                        ? 'text-amber-400'
                        : 'text-zinc-400'
                    }
                  >
                    [{sig.severity}]
                  </span>{' '}
                  {sig.description}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared ─────────────────────────────────────────────────────────────────

function GrowthStatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center">
      <p className="text-lg font-semibold text-zinc-100">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center py-16 text-zinc-600">
      <p className="text-sm">{title}</p>
      <p className="text-xs mt-1">{description}</p>
    </div>
  );
}
