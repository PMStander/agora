-- ============================================================================
-- Seed the agents table with the full OpenClaw roster
-- Uses ON CONFLICT to be idempotent (safe to re-run)
-- ============================================================================

INSERT INTO agents (id, name, role, emoji, persona, team, provider, model, skills, domains, availability)
VALUES
  -- ── Orchestrator ──────────────────────────────────────────────────────────
  ('main', 'Marcus Aurelius', 'Main Orchestrator', '🏛️',
   'Stoic Emperor', 'orchestrator', 'anthropic', 'claude-opus-4-6',
   ARRAY['apple-notes','apple-reminders','coding-agent','github','gog','healthcheck','himalaya','nano-pdf','peekaboo','session-logs','skill-creator','things-mac','tmux','video-frames','wacli','weather','agent-orchestrator','agent-onboarding','mission-control','mission-authoring-playbook','team-management','company-bootstrap','supabase','imsg','apple-calendar'],
   ARRAY['orchestration','planning','delegation','strategy'], 'available'),

  -- ── Team Personal ─────────────────────────────────────────────────────────
  ('hippocrates', 'Hippocrates of Kos', 'Fitness & Health', '💪',
   'Father of Medicine', 'personal', 'anthropic', 'claude-sonnet-4-5',
   ARRAY['apple-notes','apple-reminders','gog','goplaces','things-mac','weather','web_fetch','web_search'],
   ARRAY['health','fitness','wellness','nutrition'], 'available'),

  ('confucius', 'Kong Qiu (Confucius)', 'Family & Relationships', '🏡',
   'Sage', 'personal', 'zai', 'glm-4.7',
   ARRAY['apple-notes','apple-reminders','gog','goplaces','things-mac','web_search','whatsapp'],
   ARRAY['family','relationships','wisdom','culture'], 'available'),

  ('seneca', 'Lucius Annaeus Seneca', 'Personal Finance', '💰',
   'Wealthy Stoic', 'personal', 'google', 'gemini-2.5-flash',
   ARRAY['apple-notes','apple-reminders','gog','things-mac','web_fetch','web_search'],
   ARRAY['personal-finance','investing','budgeting','stoicism'], 'available'),

  ('archimedes', 'Archimedes of Syracuse', 'Tech Enthusiast', '⚙️',
   'Inventor', 'personal', 'zai', 'glm-4.7',
   ARRAY['apple-notes','apple-reminders','exec','github','nodes','peekaboo','things-mac','web_fetch','web_search'],
   ARRAY['technology','gadgets','automation','tinkering'], 'available'),

  -- ── Partners in Biz ───────────────────────────────────────────────────────
  ('leonidas', 'Leonidas I of Sparta', 'CEO', '⚔️',
   'Spartan King', 'business', 'openai-codex', 'gpt-5.2-codex',
   ARRAY['apple-notes','discord','exec','gog','things-mac','web_fetch','web_search','team-management','mission-control','mission-authoring-playbook','supabase'],
   ARRAY['leadership','strategy','operations','business'], 'available'),

  ('odysseus', 'Odysseus of Ithaca', 'CFO', '🧭',
   'Cunning Strategist', 'business', 'openai-codex', 'gpt-5.2-codex',
   ARRAY['apple-notes','apple-reminders','exec','gog','things-mac','web_fetch','web_search'],
   ARRAY['finance','accounting','forecasting','risk'], 'available'),

  ('spartacus', 'Spartacus of Thrace', 'HR', '✊',
   'Champion of People', 'business', 'openai-codex', 'gpt-5.2-codex',
   ARRAY['apple-notes','apple-reminders','discord','gog','things-mac','web_fetch','web_search'],
   ARRAY['hr','people-ops','culture','hiring'], 'available'),

  ('achilles', 'Achilles, son of Peleus', 'CTO', '🔥',
   'Greatest Warrior', 'business', 'openai-codex', 'gpt-5.2-codex',
   ARRAY['apple-reminders','coding-agent','discord','exec','github','gog','peekaboo','things-mac','web_fetch','web_search','team-management','mission-control','mission-authoring-playbook','supabase'],
   ARRAY['engineering','architecture','code-quality','technical-leadership'], 'available'),

  ('alexander', 'Alexander III of Macedon', 'Marketing Head', '🦁',
   'The Conqueror', 'business', 'openai-codex', 'gpt-5.2-codex',
   ARRAY['apple-notes','apple-reminders','discord','gog','nano-banana-pro','openai-image-gen','sag','things-mac','web_fetch','web_search','team-management','mission-authoring-playbook'],
   ARRAY['marketing','growth','branding','campaigns'], 'available'),

  -- ── Dev Team (under Achilles) ─────────────────────────────────────────────
  ('heracles', 'Heracles', 'Senior Fullstack Dev', '💪',
   'The Strongest', 'business', 'anthropic', 'claude-sonnet-4-5',
   ARRAY['web_fetch','web_search','exec','github','coding-agent'],
   ARRAY['fullstack','react','node','typescript'], 'available'),

  ('daedalus', 'Daedalus', 'Backend Engineer', '🏗️',
   'Master Craftsman', 'business', 'anthropic', 'claude-sonnet-4-5',
   ARRAY['web_fetch','web_search','exec','github','coding-agent','supabase'],
   ARRAY['backend','database','schema','sql','api'], 'available'),

  ('icarus', 'Icarus', 'Frontend Engineer', '🪽',
   'Bold Flyer', 'business', 'anthropic', 'claude-sonnet-4-5',
   ARRAY['web_fetch','web_search','exec','github','coding-agent'],
   ARRAY['frontend','react','css','ui','ux'], 'available'),

  ('ajax', 'Ajax the Great', 'DevOps & Infrastructure', '🛡️',
   'The Shield Wall', 'business', 'anthropic', 'claude-sonnet-4-5',
   ARRAY['web_fetch','web_search','exec','github'],
   ARRAY['devops','infrastructure','ci-cd','monitoring','security'], 'available'),

  -- ── Marketing Team (under Alexander) ──────────────────────────────────────
  ('cleopatra', 'Cleopatra VII', 'Content Strategist', '👑',
   'Queen of Influence', 'business', 'anthropic', 'claude-sonnet-4-5',
   ARRAY['web_fetch','web_search','gog'],
   ARRAY['content-strategy','communication','influence','storytelling'], 'available'),

  ('homer', 'Homer the Bard', 'Copywriter & Brand Voice', '📜',
   'The Storyteller', 'business', 'anthropic', 'claude-sonnet-4-5',
   ARRAY['web_fetch','web_search','gog'],
   ARRAY['copywriting','brand-voice','narrative','writing'], 'available'),

  ('hermes', 'Hermes the Messenger', 'Social & Distribution', '🪶',
   'Swift Messenger', 'business', 'anthropic', 'claude-sonnet-4-5',
   ARRAY['web_fetch','web_search','gog','discord'],
   ARRAY['social-media','distribution','community','outreach'], 'available'),

  -- ── Sales Team (under Artemis) ────────────────────────────────────────────
  ('artemis', 'Artemis, Goddess of the Hunt', 'Sales Manager', '🏹',
   'The Huntress', 'business', 'anthropic', 'claude-sonnet-4-5',
   ARRAY['apple-notes','apple-reminders','gog','things-mac','web_fetch','web_search','supabase','team-management','mission-control','mission-authoring-playbook'],
   ARRAY['sales','pipeline','deals','crm','revenue'], 'available'),

  ('ares', 'Ares, God of War', 'Senior Sales Rep', '🗡️',
   'God of War', 'business', 'anthropic', 'claude-sonnet-4-5',
   ARRAY['apple-notes','gog','things-mac','web_fetch','web_search','supabase'],
   ARRAY['outbound','closing','cold-calling','negotiation'], 'available'),

  ('perseus', 'Perseus, Slayer of Medusa', 'Consultative Sales Rep', '🪞',
   'The Slayer', 'business', 'anthropic', 'claude-sonnet-4-5',
   ARRAY['apple-notes','gog','things-mac','web_fetch','web_search','supabase'],
   ARRAY['consultative-sales','discovery','trust-building','solutions'], 'available'),

  ('theseus', 'Theseus, Navigator of the Labyrinth', 'Enterprise Sales Rep', '🧶',
   'Labyrinth Navigator', 'business', 'anthropic', 'claude-sonnet-4-5',
   ARRAY['apple-notes','gog','things-mac','web_fetch','web_search','supabase'],
   ARRAY['enterprise-sales','complex-deals','procurement','stakeholder-mapping'], 'available'),

  -- ── The Forge (Engineering) ───────────────────────────────────────────────
  ('athena', 'Athena Parthenos', 'Security Architect', '🛡️',
   'Guardian of Wisdom', 'engineering', 'anthropic', 'claude-sonnet-4-5',
   ARRAY['web_fetch','web_search'],
   ARRAY['security','infosec','architecture','threat-modeling'], 'available'),

  ('hephaestus', 'Hephaestus, God of the Forge', 'Lead Developer', '🔨',
   'Master of the Forge', 'engineering', 'anthropic', 'claude-sonnet-4-5',
   ARRAY['web_fetch','web_search','supabase','exec','github','coding-agent'],
   ARRAY['development','craftsmanship','tooling','code-review'], 'available'),

  ('prometheus', 'Prometheus the Firebringer', 'Innovation Lead', '💡',
   'Bringer of Fire', 'engineering', 'anthropic', 'claude-sonnet-4-5',
   ARRAY['web_fetch','web_search'],
   ARRAY['innovation','ideas','prototyping','research'], 'available')

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  emoji = EXCLUDED.emoji,
  persona = EXCLUDED.persona,
  team = EXCLUDED.team,
  provider = EXCLUDED.provider,
  model = EXCLUDED.model,
  skills = EXCLUDED.skills,
  domains = EXCLUDED.domains;
