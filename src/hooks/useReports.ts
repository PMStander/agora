import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type {
  PipelineForecastRow,
  RevenueByMonthRow,
  DealConversionRow,
  LifecycleFunnelRow,
  AgentPerformanceRow,
} from '../types/reports';

export function useReports() {
  const initializedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [pipelineForecast, setPipelineForecast] = useState<PipelineForecastRow[]>([]);
  const [revenueByMonth, setRevenueByMonth] = useState<RevenueByMonthRow[]>([]);
  const [dealConversion, setDealConversion] = useState<DealConversionRow[]>([]);
  const [lifecycleFunnel, setLifecycleFunnel] = useState<LifecycleFunnelRow[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformanceRow[]>([]);

  const fetchAll = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);

    const [forecast, revenue, conversion, funnel, agents] = await Promise.all([
      supabase.from('v_pipeline_forecast').select('*'),
      supabase.from('v_revenue_by_month').select('*'),
      supabase.from('v_deal_conversion').select('*'),
      supabase.from('v_lifecycle_funnel').select('*'),
      supabase.from('v_agent_performance').select('*'),
    ]);

    if (!forecast.error && forecast.data) setPipelineForecast(forecast.data as PipelineForecastRow[]);
    if (!revenue.error && revenue.data) setRevenueByMonth(revenue.data as RevenueByMonthRow[]);
    if (!conversion.error && conversion.data) setDealConversion(conversion.data as DealConversionRow[]);
    if (!funnel.error && funnel.data) setLifecycleFunnel(funnel.data as LifecycleFunnelRow[]);
    if (!agents.error && agents.data) setAgentPerformance(agents.data as AgentPerformanceRow[]);

    setLoading(false);
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    fetchAll();
  }, [fetchAll]);

  return useMemo(
    () => ({
      loading,
      pipelineForecast,
      revenueByMonth,
      dealConversion,
      lifecycleFunnel,
      agentPerformance,
      refreshReports: fetchAll,
    }),
    [loading, pipelineForecast, revenueByMonth, dealConversion, lifecycleFunnel, agentPerformance, fetchAll]
  );
}
