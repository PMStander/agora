# Boardroom Resolution Package - Testing Guide

## Quick Test Scenarios

### Scenario 1: Propose Mode (Strategy Session)

**Setup:**
```typescript
// Create a strategy session (resolution_mode: 'propose')
const session = await createSession({
  title: "Q1 2026 Strategy Planning",
  topic: "Define Q1 priorities and resource allocation",
  session_type: "strategy",
  participant_agent_ids: ["marcus-aurelius", "alexander", "cleopatra"],
  max_turns: 15,
  scheduled_at: null,
  metadata: {
    routing_mode: "smart",
    resolution_mode: "propose", // Will be set automatically
  },
});
```

**Test Steps:**
1. Start the session (manual or auto-start)
2. Let it run through all turns (or stop manually)
3. Session ends and generates summary
4. Resolution package is generated
5. Check `session.metadata.resolution_package` exists
6. Open ResolutionPackagePanel
7. Verify items are in "pending" status
8. Approve some items individually
9. Reject some items
10. Click "Approve All" for remaining items
11. Click "Execute" button
12. Verify missions created in missions table
13. Check missions have `metadata.source_session_id`
14. Verify follow-up sessions created (if any)

**Expected Results:**
- ✅ Resolution package generated with items
- ✅ Items start in "pending" status
- ✅ Can approve/reject individually
- ✅ "Approve All" works
- ✅ Execution creates missions with source metadata
- ✅ Session card shows `📦 actions` badge
- ✅ Created items show created_id

### Scenario 2: Auto Mode (Standup)

**Setup:**
```typescript
// Create a standup session (resolution_mode: 'auto')
const session = await createSession({
  title: "Monday Standup",
  topic: "Quick sync on weekend progress",
  session_type: "standup",
  participant_agent_ids: ["marcus-aurelius", "alexander", "athena"],
  max_turns: 12,
  scheduled_at: null,
});
```

**Test Steps:**
1. Start the session
2. Let it complete all turns
3. Session ends
4. Resolution package is generated AND auto-executed
5. Check database for created missions
6. Open ResolutionPackagePanel
7. Verify items are in "created" status
8. Verify created_id is populated

**Expected Results:**
- ✅ Resolution package generated
- ✅ Items auto-executed (no approval needed)
- ✅ Items have status: "created"
- ✅ Missions appear in missions table immediately
- ✅ Session card shows `⚡ auto` badge during session
- ✅ Session card shows `📦 actions` badge after completion

### Scenario 3: None Mode (Chat)

**Setup:**
```typescript
// Create a chat session (resolution_mode: 'none')
const session = await createSession({
  title: "Project Team Chat",
  topic: "",
  session_type: "chat",
  participant_agent_ids: ["marcus-aurelius", "alexander"],
  max_turns: 999,
  scheduled_at: null,
});
```

**Test Steps:**
1. Start the session
2. Have some conversation
3. End the session
4. Check `session.metadata.resolution_package`

**Expected Results:**
- ✅ No resolution package generated
- ✅ Session ends normally
- ✅ No badges related to resolution
- ✅ No error in console

### Scenario 4: Follow-up Session Creation

**Setup:**
Use a brainstorm session that discusses topics needing follow-up.

**Test Steps:**
1. Create and run a brainstorm session
2. In conversation, explicitly mention: "We need to follow up on this next week"
3. Let session complete
4. Check resolution package for follow_up items
5. Approve the follow-up item
6. Execute the package
7. Verify new boardroom session created
8. Check new session metadata.context includes summary from source
9. Check new session agenda includes unresolved items

**Expected Results:**
- ✅ Follow-up session created in boardroom_sessions table
- ✅ New session has participant_agent_ids from resolution item
- ✅ New session metadata.context references source session
- ✅ New session agenda contains unresolved items
- ✅ New session scheduled_at set (if specified in resolution item)

### Scenario 5: Mission Creation with Context

**Setup:**
Strategy session that results in missions.

**Test Steps:**
1. Complete a strategy session
2. Resolution package extracts missions
3. Approve and execute
4. Query missions table for created missions
5. Check each mission's metadata field

**Expected SQL:**
```sql
SELECT 
  id,
  title,
  description,
  agent_id,
  priority,
  metadata->>'source_session_id' as source_session,
  metadata->>'source_type' as source_type,
  metadata->>'relevant_excerpt' as excerpt,
  created_by
FROM missions
WHERE created_by = 'boardroom'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected Results:**
- ✅ Missions exist
- ✅ `metadata.source_session_id` = original session ID
- ✅ `metadata.source_type` = 'boardroom'
- ✅ `metadata.relevant_excerpt` contains quote from conversation
- ✅ `created_by` = 'boardroom'
- ✅ `agent_id` matches assignment from resolution item
- ✅ `priority` matches resolution item priority

## Integration Tests

### Test 1: Full Lifecycle with Smart Routing

1. Create strategy session with smart routing enabled
2. Run session with 20 turns
3. Verify smart routing selects speakers intelligently
4. Session enters wrap-up phase (last 20% of turns)
5. Agents receive wrap-up guidance in prompts
6. Session completes
7. Summary generated
8. Resolution package generated
9. Items appear in UI for approval
10. Approve all items
11. Execute package
12. Verify system objects created
13. Check WhatsApp notification sent (if enabled)

### Test 2: Edge Cases

**Empty Resolution Package:**
- Session with no actionable items
- Resolution package has empty arrays for all types
- UI shows "No items to display"
- Session ends normally

**LLM Failure:**
- Mock LLM timeout or error
- Resolution package generation fails gracefully
- Session still ends and saves summary
- User can manually retry resolution generation (future)

**Partial Execution:**
- Some items succeed, some fail
- Failed items show error message
- Successful items show created_id
- User can retry failed items (future)

**Duplicate Prevention:**
- Two missions with similar titles
- CRM actions for existing companies
- System should detect and warn (future enhancement)

## Performance Tests

### Resolution Package Generation Time

**Metrics:**
- Time to generate summary: < 5 seconds
- Time to generate resolution package: < 10 seconds
- Time to execute 10 items: < 5 seconds
- Total session closure time: < 20 seconds

**Test:**
```javascript
console.time('Summary Generation');
// ... summary generation
console.timeEnd('Summary Generation');

console.time('Resolution Package Generation');
// ... resolution package generation
console.timeEnd('Resolution Package Generation');

console.time('Execution');
// ... execution
console.timeEnd('Execution');
```

### Database Impact

**Metrics:**
- Session with 5 resolution items → 5 INSERT queries
- Follow-up session → 1 INSERT + metadata update
- Should batch when possible
- No N+1 query issues

## UI Tests

### ResolutionPackagePanel

**Visual Tests:**
- [ ] Panel renders correctly
- [ ] Items grouped by type
- [ ] Status badges show correct colors
- [ ] Approve/Reject buttons functional
- [ ] Approve All button works
- [ ] Execute button disabled until items approved
- [ ] Loading state shows during execution
- [ ] Error messages display properly
- [ ] Source excerpts expand/collapse
- [ ] Created IDs display after execution

**Interaction Tests:**
- [ ] Click approve → item turns green
- [ ] Click reject → item turns red
- [ ] Click source toggle → excerpt shows/hides
- [ ] Click Approve All → all pending items turn green
- [ ] Click Execute → items transition to "created"
- [ ] Click close → panel closes

### SessionCard Badges

**Visual Tests:**
- [ ] `📦 actions` badge shows on closed sessions with resolution package
- [ ] `⚡ auto` badge shows on active sessions with auto mode
- [ ] `🧠 smart` badge shows on sessions with smart routing
- [ ] Badges don't overlap
- [ ] Colors are distinct and readable

## Regression Tests

**Ensure these still work:**
- [ ] Sessions without resolution package work normally
- [ ] Old sessions (created before feature) still open
- [ ] Manual session closure still works
- [ ] Session summary generation independent of resolution
- [ ] WhatsApp notifications still send
- [ ] Smart routing unaffected by resolution feature
- [ ] Session extension works
- [ ] Auto-start scheduler works

## Test Data Fixtures

### Sample Mission Item
```json
{
  "id": "mission-0",
  "type": "mission",
  "status": "pending",
  "data": {
    "title": "Create Q1 Marketing Plan",
    "description": "Develop comprehensive marketing strategy focusing on social media and content marketing",
    "agent_id": "alexander",
    "priority": "high",
    "dependencies": [],
    "scheduled_at": "2026-02-15T09:00:00Z",
    "source_excerpt": "Alexander suggested we need a robust marketing plan to hit our Q1 targets"
  }
}
```

### Sample Follow-up Item
```json
{
  "id": "follow-up-0",
  "type": "follow_up",
  "status": "pending",
  "data": {
    "title": "Follow-up: Budget Allocation Discussion",
    "topic": "Finalize Q1 budget distribution across teams",
    "participant_agent_ids": ["marcus-aurelius", "cleopatra", "athena"],
    "agenda": [
      "Review proposed budget splits",
      "Address security team concerns",
      "Finalize infrastructure costs"
    ],
    "scheduled_at": "2026-02-17T14:00:00Z",
    "unresolved_items": [
      "Security team budget allocation",
      "Infrastructure scaling costs"
    ],
    "source_excerpt": "We couldn't reach consensus on the security budget. Let's schedule a follow-up."
  }
}
```

## Automated Test Suite (Future)

```typescript
describe('Resolution Package', () => {
  describe('Generation', () => {
    it('should generate package for strategy session', async () => {
      const session = await createTestSession('strategy');
      const resolutionPackage = await generateResolutionPackage(...);
      expect(resolutionPackage).toBeDefined();
      expect(resolutionPackage.mode).toBe('propose');
    });

    it('should skip generation for chat session', async () => {
      const session = await createTestSession('chat');
      const resolutionPackage = await generateResolutionPackage(...);
      expect(resolutionPackage).toBeNull();
    });
  });

  describe('Execution', () => {
    it('should create missions from approved items', async () => {
      const pkg = createTestResolutionPackage();
      await approveAllItems(sessionId);
      await executeResolutionPackage(sessionId);
      
      const missions = await queryMissions({ created_by: 'boardroom' });
      expect(missions.length).toBeGreaterThan(0);
    });

    it('should include source metadata in created missions', async () => {
      // ... test implementation
    });
  });

  describe('UI', () => {
    it('should display resolution panel after session ends', () => {
      // ... React Testing Library test
    });
  });
});
```

## Manual QA Checklist

Before releasing to production:

- [ ] Create 3 different session types (strategy, standup, chat)
- [ ] Verify correct resolution modes set automatically
- [ ] Run each session to completion
- [ ] Check resolution packages generated correctly
- [ ] Test approve/reject functionality
- [ ] Test execution for each item type
- [ ] Verify database entries created
- [ ] Check metadata includes source references
- [ ] Test follow-up session carries context
- [ ] Verify WhatsApp notifications (if enabled)
- [ ] Check all UI badges display correctly
- [ ] Test edge cases (empty packages, errors)
- [ ] Verify backward compatibility with old sessions
- [ ] Check performance on long conversations (30+ turns)
- [ ] Test concurrent executions (multiple sessions ending)

## Known Limitations (MVP)

1. **LLM Response Handling**: Currently uses timeout instead of streaming (simplified for MVP)
2. **CRM Actions**: Not yet implemented (placeholder)
3. **Calendar Events**: Not yet implemented (placeholder)
4. **Quotes**: Not yet implemented (placeholder)
5. **Edit Before Approve**: Can only approve/reject, not edit (future enhancement)
6. **Duplicate Detection**: No automatic detection (future enhancement)
7. **Batch Operations**: Executes items sequentially (could be parallelized)

## Success Criteria

✅ **Core Functionality:**
- Resolution packages generate for applicable session types
- Propose mode presents items for approval
- Auto mode executes immediately
- None mode skips generation
- Created objects include source metadata

✅ **User Experience:**
- UI is intuitive and responsive
- Status indicators are clear
- Errors are handled gracefully
- Performance is acceptable (<20s session closure)

✅ **Data Integrity:**
- No data loss during generation
- No duplicate entries created
- Source references always present
- Transaction rollback on failure

✅ **Integration:**
- Works with smart routing
- Works with auto-start
- Works with WhatsApp notifications
- Doesn't break existing features
