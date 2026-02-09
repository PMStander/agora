import { useReports } from '../../hooks/useReports';
import { PipelineForecast } from './PipelineForecast';
import { RevenueChart } from './RevenueChart';
import { DealConversionChart } from './DealConversionChart';
import { LifecycleFunnel } from './LifecycleFunnel';
import { AgentLeaderboard } from './AgentLeaderboard';

export function ReportsTab() {
  const {
    loading,
    pipelineForecast,
    revenueByMonth,
    dealConversion,
    lifecycleFunnel,
    agentPerformance,
    refreshReports,
  } = useReports();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <h2 className="text-sm font-semibold text-zinc-300">Reports &amp; Analytics</h2>
        <button
          onClick={refreshReports}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Report cards */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
            Loading report data...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <PipelineForecast data={pipelineForecast} />
              <RevenueChart data={revenueByMonth} />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <DealConversionChart data={dealConversion} />
              <LifecycleFunnel data={lifecycleFunnel} />
            </div>
            <AgentLeaderboard data={agentPerformance} />
          </>
        )}
      </div>
    </div>
  );
}
