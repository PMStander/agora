-- Mission Control Schema for Agora
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  team TEXT NOT NULL CHECK (team IN ('personal', 'business')),
  session_key TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'active', 'blocked')),
  current_task_id UUID,
  avatar_url TEXT,
  domains TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'inbox' CHECK (status IN ('inbox', 'assigned', 'in_progress', 'review', 'done', 'blocked')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  team TEXT CHECK (team IN ('personal', 'business')),
  domains TEXT[] DEFAULT '{}',
  created_by TEXT,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key to agents after tasks table exists
ALTER TABLE agents 
  ADD CONSTRAINT fk_agents_current_task 
  FOREIGN KEY (current_task_id) 
  REFERENCES tasks(id) 
  ON DELETE SET NULL;

-- Task assignees (many-to-many)
CREATE TABLE IF NOT EXISTS task_assignees (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (task_id, agent_id)
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  from_user BOOLEAN DEFAULT FALSE,
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  attachments UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT,
  type TEXT DEFAULT 'deliverable' CHECK (type IN ('deliverable', 'research', 'protocol', 'note')),
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'mention' CHECK (type IN ('mention', 'assignment', 'status_change')),
  delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now - restrict later if needed)
CREATE POLICY "Allow all on agents" ON agents FOR ALL USING (true);
CREATE POLICY "Allow all on tasks" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow all on task_assignees" ON task_assignees FOR ALL USING (true);
CREATE POLICY "Allow all on comments" ON comments FOR ALL USING (true);
CREATE POLICY "Allow all on activities" ON activities FOR ALL USING (true);
CREATE POLICY "Allow all on documents" ON documents FOR ALL USING (true);
CREATE POLICY "Allow all on notifications" ON notifications FOR ALL USING (true);

-- Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE activities;

-- Indexes for performance
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_team ON tasks(team);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_comments_task_id ON comments(task_id);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX idx_notifications_agent_delivered ON notifications(agent_id, delivered);

-- Seed agents data
INSERT INTO agents (name, role, team, session_key, domains) VALUES
-- Personal Team (Philosophers)
('Marcus Aurelius', 'Main Orchestrator', 'personal', 'agent:marcus:main', ARRAY['orchestration', 'life-coaching', 'decision-making']),
('Hippocrates', 'Health & Fitness', 'personal', 'agent:hippocrates:main', ARRAY['health', 'fitness', 'wellness']),
('Confucius', 'Family & Relationships', 'personal', 'agent:confucius:main', ARRAY['family', 'relationships', 'wisdom']),
('Seneca', 'Personal Finance', 'personal', 'agent:seneca:main', ARRAY['personal-finance', 'investing', 'budgeting']),
('Archimedes', 'Tech Enthusiast', 'personal', 'agent:archimedes:main', ARRAY['tech', 'gadgets', 'home-automation']),
-- Business Team (Warriors)
('Leonidas', 'CEO', 'business', 'agent:leonidas:main', ARRAY['strategy', 'leadership', 'business-decisions']),
('Odysseus', 'CFO', 'business', 'agent:odysseus:main', ARRAY['business-finance', 'accounting', 'forecasting']),
('Spartacus', 'HR', 'business', 'agent:spartacus:main', ARRAY['hiring', 'hr', 'team-management']),
('Achilles', 'CTO', 'business', 'agent:achilles:main', ARRAY['code', 'architecture', 'devops', 'engineering']),
('Alexander', 'Marketing Head', 'business', 'agent:alexander:main', ARRAY['marketing', 'seo', 'content', 'social-media'])
ON CONFLICT (session_key) DO NOTHING;
