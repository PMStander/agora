-- ============================================================================
-- FIX AGENT_LEVELS TABLE FOR SUPABASE REALTIME
-- Migration: 20260209000007_fix_agent_levels_realtime.sql
--
-- Problem: Supabase realtime requires tables to have proper REPLICA IDENTITY
-- set for change data capture. The agent_levels table uses agent_id as the
-- primary key instead of id, which causes realtime subscriptions to fail.
--
-- Solution: Set REPLICA IDENTITY to FULL to enable full row replication.
-- ============================================================================

-- Set replica identity to FULL for agent_levels table
-- This allows realtime to track all column changes for UPDATE/DELETE operations
ALTER TABLE agent_levels REPLICA IDENTITY FULL;

-- Add guardrail_violations to realtime publication (was missing)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE guardrail_violations;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Verify the changes
SELECT
  pt.schemaname,
  pt.tablename,
  CASE c.relreplident
    WHEN 'd' THEN 'default'
    WHEN 'n' THEN 'nothing'
    WHEN 'i' THEN 'index'
    WHEN 'f' THEN 'full'
  END as replica_identity
FROM pg_publication_tables pt
JOIN pg_class c ON c.relname = pt.tablename
WHERE pt.tablename IN ('agent_levels', 'guardrail_violations', 'agent_level_transitions');
