-- ============================================================================
-- Agent Growth: Self-Reflection + Evolution Reports
-- ============================================================================

-- ── Agent Reflections ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('post_task', 'post_session', 'daily', 'manual')),
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  content TEXT NOT NULL,
  lessons_learned TEXT[] DEFAULT '{}',
  areas_for_improvement TEXT[] DEFAULT '{}',
  confidence_score NUMERIC(3,2) DEFAULT 0.50
    CHECK (confidence_score BETWEEN 0 AND 1),
  source_mission_id UUID,
  source_session_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_reflections_agent ON agent_reflections(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_reflections_trigger ON agent_reflections(trigger);
CREATE INDEX IF NOT EXISTS idx_agent_reflections_tags ON agent_reflections USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_agent_reflections_created ON agent_reflections(created_at DESC);

ALTER TABLE agent_reflections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'agent_reflections' AND policyname = 'Allow all on agent_reflections')
  THEN CREATE POLICY "Allow all on agent_reflections" ON agent_reflections FOR ALL USING (true);
  END IF;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE agent_reflections;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Evolution Reports ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS evolution_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT,
  report_type TEXT NOT NULL CHECK (report_type IN ('individual', 'team')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  health_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_analysis TEXT,
  triggered_by TEXT NOT NULL DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'scheduled')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_evolution_reports_agent ON evolution_reports(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evolution_reports_type ON evolution_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_evolution_reports_status ON evolution_reports(status);
CREATE INDEX IF NOT EXISTS idx_evolution_reports_created ON evolution_reports(created_at DESC);

ALTER TABLE evolution_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'evolution_reports' AND policyname = 'Allow all on evolution_reports')
  THEN CREATE POLICY "Allow all on evolution_reports" ON evolution_reports FOR ALL USING (true);
  END IF;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE evolution_reports;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
