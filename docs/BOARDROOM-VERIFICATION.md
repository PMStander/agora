# Boardroom Smart Routing - Verification Checklist

## Implementation Verification

### ✅ Core Features

- [x] **Smart Routing Logic** (`src/lib/boardroomSmartRouting.ts`)
  - Score-based speaker selection
  - Participation balancing
  - Mention detection
  - Phase-aware routing

- [x] **Turn Awareness** 
  - Turn tracking initialization
  - Turn count updates after each message
  - Mention detection and marking
  - Metadata persistence

- [x] **Session Phases**
  - Opening phase (0-20%)
  - Discussion phase (20-80%)
  - Wrap-up phase (80-100%)
  - Phase-specific guidance in prompts

- [x] **Routing Modes**
  - Smart routing (default)
  - Round-robin (fallback option)
  - Configuration via `metadata.routing_mode`

- [x] **Auto-Summary**
  - Summary generation prompt
  - Summary parsing and storage
  - Metadata updates on session end

- [x] **Auto-Start Scheduler** (`src/hooks/useBoardroomAutoStart.ts`)
  - 30-second polling interval
  - `scheduled_at` check
  - `auto_start` configuration
  - Automatic orchestration trigger

- [x] **WhatsApp Notifications**
  - Session start notification
  - Session end notification with summary
  - Agenda inclusion in start message
  - Configuration via `metadata.notify_whatsapp`

- [x] **Session Extension** (`extendSession` in `useBoardroom`)
  - Add additional turns mid-session
  - Extension count tracking

### ✅ Type Definitions

Updated `src/types/boardroom.ts`:
- `RoutingMode` type
- `SessionPhase` type
- `TurnTracking` interface
- `SessionSummary` interface
- Extended `BoardroomSessionMetadata` with:
  - `routing_mode`
  - `auto_start`
  - `notify_whatsapp`
  - `turn_tracking`
  - `session_summary`
  - `current_phase`
  - `extension_count`

### ✅ Hook Updates

- [x] **useBoardroomOrchestrator.ts**
  - Smart routing integration
  - Turn tracking updates
  - Mention detection
  - Phase-aware prompts
  - WhatsApp notifications (start/end)
  - Auto-summary generation

- [x] **useBoardroom.ts**
  - `endSession` accepts metadata parameter
  - `extendSession` function added
  - Exported in return statement

- [x] **useBoardroomAutoStart.ts** (new)
  - Polling every 30 seconds
  - Auto-start logic
  - Session status transitions

### ✅ UI Updates

- [x] **CreateSessionModal.tsx**
  - Sets `routing_mode: 'smart'` by default
  - Sets `auto_start: true` for scheduled sessions
  - Sets `notify_whatsapp: true` for scheduled sessions

- [x] **SessionCard.tsx**
  - Shows smart routing badge (🧠 smart)
  - Shows auto-start time badge (⏰ HH:MM)
  - Routing mode display
  - Auto-start indicator

- [x] **TeamsTab.tsx**
  - Integrated `useBoardroomAutoStart` hook

### ✅ Utilities

- [x] **boardroomUtils.ts**
  - Imports smart routing functions
  - Phase guidance integration in `buildAgentPrompt`
  - Turn awareness in prompts

- [x] **boardroomSmartRouting.ts** (new)
  - Phase determination
  - Phase guidance generation
  - Turn tracking initialization
  - Turn tracking updates
  - Mention detection
  - Smart speaker selection
  - Summary generation prompt
  - Summary parsing

## Testing Checklist

### Manual Testing

1. **Create a Smart Routing Session**
   - [ ] Create session with default settings
   - [ ] Verify `routing_mode: 'smart'` in metadata
   - [ ] Start session and observe speaker order
   - [ ] Verify it's NOT strict round-robin

2. **Test Session Phases**
   - [ ] Opening phase: All agents speak at least once
   - [ ] Discussion phase: Varied speaker order
   - [ ] Wrap-up phase: Prompts include synthesis guidance
   - [ ] Check prompt content includes phase info

3. **Test Turn Tracking**
   - [ ] Check session metadata has `turn_tracking` array
   - [ ] Verify turn counts increment correctly
   - [ ] Mention an agent by name, verify they speak next
   - [ ] Check `last_mentioned_turn` updates

4. **Test Auto-Start**
   - [ ] Create scheduled session (5 minutes in future)
   - [ ] Verify `auto_start: true` in metadata
   - [ ] Wait for scheduled time
   - [ ] Session should auto-transition to active and start
   - [ ] Check session card shows ⏰ badge

5. **Test WhatsApp Notifications**
   - [ ] Create scheduled session with `notify_whatsapp: true`
   - [ ] Start session (auto or manual)
   - [ ] Verify WhatsApp message received with agenda
   - [ ] End session
   - [ ] Verify WhatsApp summary message received

6. **Test Session Extension**
   - [ ] Call `extendSession(sessionId, 5)`
   - [ ] Verify `max_turns` increased by 5
   - [ ] Verify `extension_count` incremented in metadata
   - [ ] Session continues beyond original max_turns

7. **Test Round-Robin Fallback**
   - [ ] Create session with `routing_mode: 'round-robin'`
   - [ ] Start session
   - [ ] Verify strict sequential speaker order
   - [ ] No smart routing applied

8. **Test Auto-Summary**
   - [ ] Complete a session (reach max_turns)
   - [ ] Check session metadata has `session_summary`
   - [ ] Verify summary structure (decisions, action_items, unresolved)
   - [ ] Check WhatsApp notification includes summary

### Integration Testing

- [ ] TypeScript compilation: `npm run build` ✅
- [ ] No console errors on session creation
- [ ] No console errors during orchestration
- [ ] Realtime updates work correctly
- [ ] Session state persists to Supabase
- [ ] Session metadata updates correctly

### Test Session

Use the existing brainstorm session: `a2ded48e-daf9-4445-b770-f0d2d0aa2325`
- 7 participants
- 30 turns
- Should demonstrate smart routing with participation balancing

## Known Limitations

1. **Summary Generation**: Currently uses a simple structure instead of LLM generation (commented out in code for MVP)
2. **WhatsApp API**: Requires gateway message.send support (implementation assumes it's available)
3. **Extension UI**: No UI button yet for manual extension (API is ready)
4. **Conflict Detection**: Not implemented (future enhancement)

## Documentation

- [x] `docs/BOARDROOM-SMART-ROUTING.md` - Feature documentation
- [x] `docs/BOARDROOM-VERIFICATION.md` - This checklist
- [x] Code comments in smart routing functions
- [x] Type definitions documented

## Rollback Plan

If issues arise:
1. Set `routing_mode: 'round-robin'` in session metadata
2. Disable auto-start: set `auto_start: false`
3. Disable WhatsApp: set `notify_whatsapp: false`
4. All existing sessions continue to work (backward compatible)

No database migrations required - all features use existing metadata JSON field.
