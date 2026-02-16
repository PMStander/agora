-- Fix: Add 'preparing' to boardroom_sessions status CHECK constraint
-- The application code sets status='preparing' for sessions with prep work,
-- but the original migration only allowed: scheduled, open, active, closed.
-- This caused silent insert failures for any session created with preparation assignments.

-- Drop the old constraint and recreate with 'preparing' included
ALTER TABLE boardroom_sessions
  DROP CONSTRAINT IF EXISTS boardroom_sessions_status_check;

ALTER TABLE boardroom_sessions
  ADD CONSTRAINT boardroom_sessions_status_check
  CHECK (status IN ('scheduled', 'preparing', 'open', 'active', 'closed'));
