# Boardroom User Participation - Testing Guide

## Quick Start Test

### Create a Session with User Participation

1. Open Agora → Teams tab → Boardroom
2. Click "New Session"
3. **Check the box**: "Include yourself in this session"
4. Select a few agents (e.g., Marcus Aurelius, Alexander)
5. Set session type: "strategy" (smart routing) or "standup" (round-robin)
6. Set max turns: 10-15
7. Click "Start Session"

### Test Round-Robin Mode

**Setup:** Session type: "standup", participants: user + 3 agents

**Expected Flow:**
1. Agent 1 speaks (Turn 1)
2. Agent 2 speaks (Turn 2)
3. **User's turn** (Turn 3):
   - Orchestration pauses
   - Input field highlights with amber ring
   - Context: "⚡ Your turn — the team is waiting for your input"
   - Type: "I reviewed the progress and approve moving forward"
   - Click Send or press Enter
   - Message appears in conversation with blue highlight
   - Orchestration continues
4. Agent 3 speaks (Turn 4), sees user's message in context
5. User's turn again (Turn 7 if 4 participants)

**Verify:**
- ✅ Orchestration pauses on user's turn
- ✅ Input highlighted when waiting
- ✅ User message saved to database
- ✅ User message styled with blue background
- ✅ "You" badge appears on user messages
- ✅ Agents respond to user input
- ✅ Orchestration resumes after user submits

### Test Smart Routing Mode

**Setup:** Session type: "strategy", participants: user + 4 agents

**Test Raise Hand:**
1. Start session, let agents discuss (3-4 turns)
2. Click raise hand button (✋)
3. Verify button turns blue
4. Verify context: "✋ Hand raised — you'll speak next in smart routing"
5. Wait for current agent to finish
6. **User should be selected next**
7. Input highlights, user types message
8. Raised hand cleared after user speaks

**Verify:**
- ✅ Raise hand button toggles state
- ✅ User gets next turn after raising hand
- ✅ Raised hand clears after speaking
- ✅ Smart routing continues normally

### Test Anytime Input (Interjections)

**Setup:** Any active session with user

**Steps:**
1. Session in progress, agent speaking
2. **While agent is speaking**, type in input field
3. Message: "Wait, let's consider the security implications"
4. Click Send
5. Message appears immediately in conversation
6. Current agent finishes their turn
7. Next agent's response should acknowledge user's interjection

**Verify:**
- ✅ Input field always enabled during session
- ✅ User can send message anytime
- ✅ Message inserted into conversation immediately
- ✅ Agents see interjection in their context
- ✅ Smart routing adapts to user input

### Test Pause/Resume

**Setup:** Any active session with user

**Steps:**
1. Session in progress
2. Click pause button (⏸️)
3. Verify agents stop responding
4. Type message: "This is the first paused message"
5. Send
6. Type message: "This is the second paused message"
7. Send
8. Verify both appear in conversation
9. Click resume button (▶️)
10. Orchestration continues from where it paused

**Verify:**
- ✅ Pause button stops orchestration
- ✅ User can send multiple messages while paused
- ✅ Messages saved to history
- ✅ Resume button continues orchestration
- ✅ Next agent sees all paused messages

### Test User Timeout (Round-Robin)

**Setup:** Session with user, round-robin mode

**Steps:**
1. Let session reach user's turn
2. Wait for 5+ minutes without typing
3. Orchestration should skip user's turn
4. Next agent speaks

**Note:** Default timeout is 5 minutes. For faster testing, this would need to be configured shorter in session metadata.

**Verify:**
- ✅ Timeout triggers after configured time
- ✅ Orchestration doesn't hang
- ✅ Session continues with next agent

### Test User Message Styling

**Verify Visual Differences:**

Agent message:
- Gray/white background
- Agent emoji avatar
- Agent name
- No special badge

User message:
- ✅ Blue background highlight (bg-blue-500/5)
- ✅ User emoji (👤)
- ✅ User name ("Peet")
- ✅ Blue "You" badge
- ✅ Turn number displayed

### Test Input States

**Normal State:**
- Session active, not user's turn
- Placeholder: "Join the conversation..."
- All buttons enabled
- No highlighting

**User's Turn:**
- ✅ Amber ring around input area
- ✅ Placeholder: "It's your turn..."
- ✅ Context: "⚡ Your turn — the team is waiting"
- ✅ Send button enabled

**Paused:**
- ✅ Context: "⏸️ Session paused — type and resume when ready"
- ✅ Pause button shows resume icon (▶️)
- ✅ Input enabled

**Session Stopped:**
- ✅ Input disabled
- ✅ Placeholder: "Session not active"
- ✅ All buttons disabled

### Test Keyboard Shortcuts

**In Input Field:**
- `Enter` → ✅ Sends message
- `Shift+Enter` → ✅ Creates new line
- Auto-resize → ✅ Textarea grows with content (max 4 rows)

### Integration Tests

**Test with Smart Routing:**
1. Create session with smart routing + user
2. Session starts, agents discuss
3. Agent mentions: "We need to decide on the budget"
4. Smart router should route to user (if implemented)
5. User provides decision
6. Agents respond to decision

**Test with Resolution Package:**
1. Complete session with user participation
2. Verify session summary includes user messages
3. Verify resolution package extraction considers user input
4. User decisions should appear in action items

**Test with Auto-Summary:**
1. Session ends with user having participated
2. Check session summary
3. Verify user contributions reflected in decisions/discussion

## Database Verification

### Check User Messages

```sql
SELECT 
  id,
  session_id,
  agent_id,
  sender_type,
  content,
  turn_number,
  created_at
FROM boardroom_messages
WHERE sender_type = 'user'
ORDER BY created_at DESC
LIMIT 10;
```

**Verify:**
- ✅ `agent_id` = 'user'
- ✅ `sender_type` = 'user'
- ✅ `turn_number` sequential
- ✅ `content` matches what user typed

### Check Session Metadata

```sql
SELECT 
  id,
  title,
  participant_agent_ids,
  metadata->>'user_participation' as user_participation
FROM boardroom_sessions
WHERE 'user' = ANY(participant_agent_ids)
ORDER BY created_at DESC
LIMIT 5;
```

**Verify:**
- ✅ 'user' in `participant_agent_ids`
- ✅ `metadata.user_participation.enabled` = true
- ✅ `metadata.user_participation.user_turn_timeout_ms` set

## Common Issues & Debugging

### Issue: Input Field Not Appearing

**Check:**
- Session status should be 'active' or 'open'
- User must be in `participant_agent_ids`
- Component `<BoardroomUserInput>` should be rendered

**Debug:**
```typescript
console.log('Session status:', session.status);
console.log('Participants:', session.participant_agent_ids);
console.log('Has user:', session.participant_agent_ids.includes('user'));
```

### Issue: Orchestration Not Pausing on User Turn

**Check:**
- `shouldWaitForUser()` returns true for user agent ID
- Store state `waitingForUser` set to true
- Polling interval checking for user message

**Debug:**
```typescript
console.log('Current agent:', currentAgentId);
console.log('Is user?', isUserParticipant(currentAgentId));
console.log('Waiting for user?', store.waitingForUser);
```

### Issue: User Messages Not Saving

**Check:**
- `addMessageToSession` called with correct params
- Supabase connection active
- Database permissions allow insert
- Turn number is valid

**Debug:**
```typescript
console.log('Saving message:', {
  session_id,
  agent_id: 'user',
  content,
  turn_number,
  sender_type: 'user',
});
```

### Issue: Agents Not Seeing User Messages

**Check:**
- User message added to `conversationHistory`
- `buildAgentPrompt` includes full history
- Message appears in database

**Debug:**
```typescript
console.log('Conversation history:', conversationHistory.length);
console.log('Last message:', conversationHistory[conversationHistory.length - 1]);
```

## Performance Tests

### Test: Rapid User Input

1. Start session
2. Send 10 messages rapidly (within 30 seconds)
3. Verify all messages saved
4. Verify conversation remains coherent
5. Verify no messages lost

### Test: Long Session with User

1. Create session with 30 turns, user included
2. Let session run to completion with user participating every 5-6 turns
3. Verify no memory leaks
4. Verify orchestration remains stable
5. Verify all messages display correctly

## Edge Cases

### Test: User Submits Empty Message

**Expected:** Send button disabled when input empty

### Test: User Submits During Agent Streaming

**Expected:** Message saves, agent continues streaming, next agent sees user input

### Test: Multiple Users (Future)

**Current:** Not supported (only single user as 'user')
**Future:** Will need user IDs (user:alice, user:bob)

### Test: Session Stops While Waiting for User

**Expected:**
- User can still type
- Submit does nothing
- No error message
- Input shows "Session not active"

## Acceptance Criteria

✅ **Must Have:**
- [ ] User can be added as participant
- [ ] Input field always visible when session active
- [ ] Orchestration pauses on user's turn (round-robin)
- [ ] User can send messages anytime (interjections)
- [ ] User messages styled distinctly
- [ ] Pause/Resume works correctly
- [ ] Raise hand works in smart routing
- [ ] User messages saved to database
- [ ] Agents see user messages in context
- [ ] TypeScript compiles without errors

✅ **Should Have:**
- [ ] User timeout handling (5 min default)
- [ ] Visual indicators (your turn, raised hand, paused)
- [ ] Keyboard shortcuts (Enter to send, Shift+Enter for new line)
- [ ] Auto-resize textarea
- [ ] Context messages explaining state

✅ **Nice to Have:**
- [ ] Typing indicator ("Peet is typing...")
- [ ] Decision point detection
- [ ] User participation in session summary
- [ ] Documentation complete

## Sign-Off Checklist

Before marking complete:

- [ ] Created test session with user participation
- [ ] Verified round-robin mode pauses for user
- [ ] Verified smart routing with raise hand
- [ ] Tested anytime interjections
- [ ] Tested pause/resume
- [ ] Verified user message styling
- [ ] Checked database for user messages
- [ ] Verified TypeScript compilation
- [ ] Documentation written
- [ ] No console errors
- [ ] No UI glitches
- [ ] Session completes successfully

## Next Steps

After basic testing passes:

1. Test with real multi-turn sessions
2. Gather user feedback on UX
3. Optimize timeout handling
4. Implement decision point detection
5. Add @mention system
6. Consider multi-user support
