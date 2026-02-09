-- ============================================================================
-- REPORTING VIEWS
-- ============================================================================

-- v_pipeline_forecast: Per-pipeline stage breakdown
CREATE OR REPLACE VIEW v_pipeline_forecast AS
SELECT
  dp.id   AS pipeline_id,
  dp.name AS pipeline_name,
  ps.id   AS stage_id,
  ps.name AS stage_name,
  ps.display_order,
  ps.probability,
  COUNT(d.id)                                          AS deal_count,
  COALESCE(SUM(d.amount), 0)                           AS total_value,
  COALESCE(SUM(d.amount * ps.probability / 100), 0)    AS weighted_value
FROM deal_pipelines dp
JOIN pipeline_stages ps ON ps.pipeline_id = dp.id
LEFT JOIN deals d
  ON d.stage_id = ps.id
  AND d.status = 'open'
GROUP BY dp.id, dp.name, ps.id, ps.name, ps.display_order, ps.probability
ORDER BY dp.name, ps.display_order;

-- v_revenue_by_month: Monthly revenue from won deals
CREATE OR REPLACE VIEW v_revenue_by_month AS
SELECT
  date_trunc('month', d.close_date)::date AS month,
  d.currency,
  COUNT(d.id)               AS deal_count,
  COALESCE(SUM(d.amount), 0) AS revenue
FROM deals d
WHERE d.status = 'won'
  AND d.close_date IS NOT NULL
GROUP BY date_trunc('month', d.close_date), d.currency
ORDER BY month DESC;

-- v_deal_conversion: Per-pipeline win/loss/open counts and win_rate
CREATE OR REPLACE VIEW v_deal_conversion AS
SELECT
  dp.id   AS pipeline_id,
  dp.name AS pipeline_name,
  COUNT(d.id) FILTER (WHERE d.status = 'won')  AS won,
  COUNT(d.id) FILTER (WHERE d.status = 'lost') AS lost,
  COUNT(d.id) FILTER (WHERE d.status = 'open') AS open,
  COUNT(d.id)                                   AS total,
  CASE
    WHEN COUNT(d.id) FILTER (WHERE d.status IN ('won', 'lost')) > 0
    THEN ROUND(
      COUNT(d.id) FILTER (WHERE d.status = 'won')::numeric
      / COUNT(d.id) FILTER (WHERE d.status IN ('won', 'lost'))
      * 100, 1
    )
    ELSE 0
  END AS win_rate
FROM deal_pipelines dp
LEFT JOIN deals d ON d.pipeline_id = dp.id
GROUP BY dp.id, dp.name;

-- v_lifecycle_funnel: Contact counts by lifecycle_status + active_30d
CREATE OR REPLACE VIEW v_lifecycle_funnel AS
SELECT
  lifecycle_status,
  COUNT(*)                                                          AS total_count,
  COUNT(*) FILTER (WHERE last_contacted_at > NOW() - INTERVAL '30 days') AS active_30d
FROM contacts
GROUP BY lifecycle_status
ORDER BY
  CASE lifecycle_status
    WHEN 'subscriber'          THEN 1
    WHEN 'lead'                THEN 2
    WHEN 'marketing_qualified' THEN 3
    WHEN 'sales_qualified'     THEN 4
    WHEN 'opportunity'         THEN 5
    WHEN 'customer'            THEN 6
    WHEN 'evangelist'          THEN 7
    WHEN 'churned'             THEN 8
    ELSE 9
  END;

-- v_agent_performance: Per-agent deals_won, total_revenue, missions_completed
CREATE OR REPLACE VIEW v_agent_performance AS
SELECT
  al.agent_id,
  COALESCE(dw.deals_won, 0)          AS deals_won,
  COALESCE(dw.total_revenue, 0)      AS total_revenue,
  COALESCE(mc.missions_completed, 0) AS missions_completed
FROM agent_levels al
LEFT JOIN (
  SELECT
    d.owner_agent_id AS agent_id,
    COUNT(*)         AS deals_won,
    SUM(d.amount)    AS total_revenue
  FROM deals d
  WHERE d.status = 'won'
  GROUP BY d.owner_agent_id
) dw ON dw.agent_id = al.agent_id
LEFT JOIN (
  SELECT
    m.agent_id,
    COUNT(*) AS missions_completed
  FROM missions m
  WHERE m.mission_status = 'done'
  GROUP BY m.agent_id
) mc ON mc.agent_id = al.agent_id
ORDER BY COALESCE(dw.deals_won, 0) DESC;
