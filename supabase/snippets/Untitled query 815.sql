ALTER TABLE boardroom_sessions DROP CONSTRAINT IF EXISTS boardroom_sessions_status_check;
ALTER TABLE boardroom_sessions ADD CONSTRAINT boardroom_sessions_status_check 
  CHECK (status IN ('scheduled', 'preparing', 'open', 'active', 'closed'));
