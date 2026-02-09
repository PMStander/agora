// ─── Report View Row Types ──────────────────────────────────────────────────

export interface PipelineForecastRow {
  pipeline_id: string;
  pipeline_name: string;
  stage_id: string;
  stage_name: string;
  display_order: number;
  probability: number;
  deal_count: number;
  total_value: number;
  weighted_value: number;
}

export interface RevenueByMonthRow {
  month: string;
  currency: string;
  deal_count: number;
  revenue: number;
}

export interface DealConversionRow {
  pipeline_id: string;
  pipeline_name: string;
  won: number;
  lost: number;
  open: number;
  total: number;
  win_rate: number;
}

export interface LifecycleFunnelRow {
  lifecycle_status: string;
  total_count: number;
  active_30d: number;
}

export interface AgentPerformanceRow {
  agent_id: string;
  deals_won: number;
  total_revenue: number;
  missions_completed: number;
}
