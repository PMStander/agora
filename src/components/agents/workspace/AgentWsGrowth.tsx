import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import type { AgentReflection, EvolutionReport } from '../../../types/growth';
import { SENTIMENT_CONFIG, TRIGGER_CONFIG, REPORT_STATUS_CONFIG } from '../../../types/growth';
import type { AgentFull } from '../../../types/supabase';

// ─── Per-Agent Growth Tab ───────────────────────────────────────────────────

export default function AgentWsGrowth({ agent }: { agent: AgentFull }) {
  const [reflections, setReflections] = useState<AgentReflection[]>([]);
  const [reports, setReports] = useState<EvolutionReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    Promise.all([
      supabase
        .from('agent_reflections')
        .select('*')
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('evolution_reports')
        .select('*')
        .or(`agent_id.eq.${agent.id},report_type.eq.team`)
        .order('created_at', { ascending: false })
        .limit(10),
    ]).then(([reflRes, reportRes]) => {
      if (reflRes.data) setReflections(reflRes.data as AgentReflection[]);
      if (reportRes.data) setReports(reportRes.data as EvolutionReport[]);
      setLoading(false);
    });
  }, [agent.id]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-zinc-500">Loading growth data...</div>;
  }

  // ── Compute stats ──
  const tagFreq: Record<string, number> = {};
  for (const r of reflections) {
    for (const t of r.tags) {
      tagFreq[t] = (tagFreq[t] || 0) + 1;
    }
  }
  const topTags = Object.entries(tagFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxTagCount = topTags.length > 0 ? topTags[0][1] : 1;

  const sentimentMap: Record<string, number> = { positive: 1, neutral: 0.5, negative: 0, mixed: 0.5 };
  const avgConfidence =
    reflections.length > 0
      ? reflections.reduce((s, r) => s + r.confidence_score, 0) / reflections.length
      : 0;
  const avgSentiment =
    reflections.length > 0
      ? reflections.reduce((s, r) => s + (sentimentMap[r.sentiment] ?? 0.5), 0) / reflections.length
      : 0.5;

  const now24h = Date.now() - 24 * 60 * 60 * 1000;
  const recent24h = reflections.filter((r) => new Date(r.created_at).getTime() > now24h).length;

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Reflections" value={reflections.length} />
        <StatCard label="Last 24h" value={recent24h} />
        <StatCard label="Avg Confidence" value={`${Math.round(avgConfidence * 100)}%`} />
        <StatCard label="Avg Sentiment" value={`${Math.round(avgSentiment * 100)}%`} />
      </div>

      {/* Tag Frequency */}
      {topTags.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Top Reflection Tags</h3>
          <div className="space-y-2">
            {topTags.map(([tag, count]) => (
              <div key={tag} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-28 truncate">{tag}</span>
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500/60 rounded-full transition-all"
                    style={{ width: `${(count / maxTagCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reflection Timeline */}
      <div>
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Reflections</h3>
        {reflections.length === 0 ? (
          <div className="text-center py-12 text-zinc-600">
            <p className="text-sm">No reflections yet</p>
            <p className="text-xs mt-1">Reflections will appear as this agent reflects on its work</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reflections.map((r) => (
              <ReflectionItem key={r.id} reflection={r} />
            ))}
          </div>
        )}
      </div>

      {/* Evolution Reports */}
      {reports.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-300 mb-3">Evolution Reports</h3>
          <div className="space-y-3">
            {reports.map((r) => (
              <ReportItem key={r.id} report={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-center">
      <p className="text-lg font-semibold text-zinc-100">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function ReflectionItem({ reflection }: { reflection: AgentReflection }) {
  const [expanded, setExpanded] = useState(false);
  const sentCfg = SENTIMENT_CONFIG[reflection.sentiment];
  const trigCfg = TRIGGER_CONFIG[reflection.trigger];
  const ts = new Date(reflection.created_at);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-medium ${sentCfg.color}`}>{sentCfg.label}</span>
          <span className="text-xs text-zinc-600">|</span>
          <span className="text-xs text-zinc-500">{trigCfg.label}</span>
          {reflection.tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 text-xs bg-zinc-800 text-zinc-400 rounded">
              {tag}
            </span>
          ))}
        </div>
        <span className="text-xs text-zinc-600 whitespace-nowrap">
          {ts.toLocaleDateString()} {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

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

      {expanded && reflection.areas_for_improvement.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-zinc-400 mb-1">Areas for Improvement</p>
          <ul className="space-y-1">
            {reflection.areas_for_improvement.map((a, i) => (
              <li key={i} className="text-xs text-zinc-500 pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1.5 before:h-1.5 before:bg-amber-500/40 before:rounded-full">
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReportItem({ report }: { report: EvolutionReport }) {
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
            {report.report_type === 'team' ? 'Team Report' : 'Individual'}
          </span>
        </div>
        {report.status === 'completed' && (
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-amber-500 hover:text-amber-400">
            {expanded ? 'Hide' : 'Details'}
          </button>
        )}
      </div>

      {report.raw_analysis && (
        <p className="text-sm text-zinc-300 mt-2">{report.raw_analysis.slice(0, 200)}...</p>
      )}

      {expanded && report.status === 'completed' && (
        <div className="mt-3 pt-3 border-t border-zinc-800 space-y-3">
          {report.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1">Recommendations</p>
              {report.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 mb-1">
                  <span className={`text-xs px-1 py-0.5 rounded ${
                    rec.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                    rec.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-zinc-800 text-zinc-400'
                  }`}>{rec.priority}</span>
                  <span className="text-xs text-zinc-300">{rec.action}</span>
                </div>
              ))}
            </div>
          )}

          {report.signals.length > 0 && (
            <div>
              <p className="text-xs font-medium text-zinc-400 mb-1">Signals Detected</p>
              {report.signals.map((sig, i) => (
                <div key={i} className="text-xs text-zinc-500 mb-1">
                  <span className={
                    sig.severity === 'high' ? 'text-red-400' :
                    sig.severity === 'medium' ? 'text-amber-400' : 'text-zinc-400'
                  }>[{sig.severity}]</span> {sig.description}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
