# Boardroom Human-in-the-Loop Participation

## Overview

Users can now join Boardroom sessions as active participants alongside agents, contributing to conversations in real-time. This creates a collaborative environment where human judgment and agent intelligence work together.

## Key Features

### 1. User as Participant

- Users can be added to `participant_agent_ids` as `'user'`
- User appears in participant list with avatar (👤) and name
- User messages are saved to `boardroom_messages` with `sender_type: 'user'`
- User messages are styled distinctly (blue background highlight, "You" badge)

### 2. Input Modes

#### Round-Robin Mode
When user's turn arrives:
- Orchestration **pauses** automatically
- Input field highlights with amber ring
- Context message: "⚡ Your turn — the team is waiting for your input"
- User types and submits message
- Orchestration continues to next participant
- **Timeout:** If no input after 5 minutes (configurable), skip turn and continue

#### Smart Routing Mode
- Smart router can route to user when their input is needed
- Routes to user at decision points or when mentioned
- User can **raise hand** (✋ button) to request next turn
- When user raises hand, they get priority in smart routing
- Context message: "✋ Hand raised — you'll speak next in smart routing"

### 3. Anytime Input (Interjections)

**User can type and send messages at ANY time, regardless of whose turn it is.**

Key behaviors:
- Input field **always visible and active** during session
- User messages appear immediately in conversation
- In round-robin: Next agent sees the interjection and can respond
- In smart routing: Router factors in user input when selecting next speaker
- User messages don't count against turn limit (bonus turns)
- Messages inserted into conversation history with appropriate turn numbering

### 4. Pause/Resume

Users have full control over orchestration flow:

**Pause Button (⏸️):**
- Pauses orchestration at any time
- User can type multiple messages
- Review conversation while paused
- Agents stop generating responses

**Resume Button (▶️):**
- Continues orchestration from where it paused
- Next agent in queue speaks
- Session proceeds normally

**While Paused:**
- Input field shows: "⏸️ Session paused — type and resume when ready"
- User can send multiple messages
- Messages saved to conversation history
- No agents respond until resume

### 5. Visual Indicators

#### User Messages
```
┌─────────────────────────────────────┐
│ 👤 Peet                    [You]    │
│ Turn 5                               │
│                                      │
│ I think we should prioritize the     │
│ security work before launching.      │
└─────────────────────────────────────┘
```
- Blue background highlight (bg-blue-500/5)
- "You" badge in blue
- User avatar (👤)

#### Waiting for User (Their Turn)
```
┌─────────────────────────────────────┐
│ ⚡ Your turn — the team is waiting  │
│    for your input                    │
├─────────────────────────────────────┤
│ [Highlighted input with amber ring]  │
└─────────────────────────────────────┘
```

#### Raised Hand
```
┌─────────────────────────────────────┐
│ ✋ Hand raised — you'll speak next  │
│    in smart routing                  │
├─────────────────────────────────────┤
│ [Input visible, raise hand active]   │
└─────────────────────────────────────┘
```

#### Typing Indicator
```
Peet is typing...
```
Shows below input when user is typing (maintains consistency with agent indicators)

### 6. UI Components

#### Input Bar (Always Visible)
Located at bottom of conversation view:

**Elements:**
- User avatar (👤)
- Multi-line textarea (auto-resize, max 4 rows)
- Raise Hand button (✋) — disabled when already user's turn
- Pause/Resume button (⏸️/▶️)
- Send button (amber, disabled when empty or session stopped)

**Keyboard Shortcuts:**
- `Enter` — Send message
- `Shift+Enter` — New line
- Input auto-resizes based on content

**States:**
- Normal: "Join the conversation..."
- User's turn: "It's your turn..."
- Session stopped: Input disabled, "Session not active"

### 7. Turn Tracking

User participation integrates with turn tracking:

```typescript
interface TurnTracking {
  agent_id: string; // Can be 'user'
  turn_count: number;
  last_mentioned_turn?: number;
}
```

- User turns are tracked like agent turns
- User interjections update `last_mentioned_turn`
- Smart routing considers user participation balance
- User doesn't dominate (same balancing rules as agents)

## Configuration

### Enable User Participation

**In CreateSessionModal:**
```typescript
// Checkbox: "Include yourself in this session"
// When checked, adds 'user' to participant_agent_ids
```

**In Session Metadata:**
```typescript
{
  user_participation: {
    enabled: true,
    user_turn_timeout_ms: 300000, // 5 minutes default
    user_raised_hand: false,
    waiting_for_user: false,
  }
}
```

### Metadata Fields

```typescript
interface UserParticipation {
  enabled: boolean;
  user_turn_timeout_ms?: number; // Default 300000 (5 min)
  user_raised_hand?: boolean;
  waiting_for_user?: boolean;
  decision_points?: Array<{
    turn: number;
    question: string;
    resolved: boolean;
  }>;
}
```

## Usage Examples

### Example 1: Strategy Session with User

```typescript
const session = await createSession({
  title: "Q1 Planning with Team",
  topic: "Define Q1 priorities",
  session_type: "strategy",
  participant_agent_ids: ["user", "marcus-aurelius", "alexander", "cleopatra"],
  max_turns: 20,
  metadata: {
    routing_mode: "smart",
    user_participation: {
      enabled: true,
      user_turn_timeout_ms: 300000,
    },
  },
});
```

**Flow:**
1. Session starts, agents begin discussing
2. Alexander mentions: "We need to decide on the budget allocation"
3. Smart router detects decision point → routes to user
4. Input highlights: "⚡ Your turn — the team is waiting for your input"
5. User types: "Let's allocate 40% to marketing, 60% to product"
6. Orchestration continues, agents respond to decision

### Example 2: User Interjection

```typescript
// Round-robin session in progress
// Current speaker: Agent 3

// User types at any time: "Wait, we should consider security implications"
// Message inserted into conversation
// Next agent (Agent 4) sees user's interjection and addresses it
```

### Example 3: User Raises Hand

```typescript
// Smart routing session in progress
// Current discussion: technical architecture

// User clicks raise hand button (✋)
// Smart router: "User raised hand, they speak next"
// After current agent finishes, user gets the floor
```

## Implementation Details

### Orchestrator Changes

**User Turn Detection:**
```typescript
if (shouldWaitForUser(session, agentId)) {
  store.setWaitingForUser(true);
  
  // Poll for user message
  const userInputPromise = new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const userMessage = messages.find(
        msg => msg.turn_number === turnNumber && msg.sender_type === 'user'
      );
      
      if (userMessage) {
        clearInterval(checkInterval);
        resolve(userMessage.content);
      }
    }, 500);
  });
  
  await userInputPromise;
  store.setWaitingForUser(false);
}
```

**Pause State Handling:**
```typescript
// In orchestration loop
while (store.isPaused && !cancelRef.current) {
  await new Promise(r => setTimeout(r, 500));
}
```

**Raised Hand Priority:**
```typescript
if (store.userRaisedHand && metadata.routing_mode === 'smart') {
  const userId = session.participant_agent_ids.find(isUserParticipant);
  if (userId) {
    agentId = userId;
    store.setUserRaisedHand(false);
  }
}
```

### Store State

```typescript
interface BoardroomState {
  isPaused: boolean;
  waitingForUser: boolean;
  userRaisedHand: boolean;
  
  setPaused: (val: boolean) => void;
  setWaitingForUser: (val: boolean) => void;
  setUserRaisedHand: (val: boolean) => void;
}
```

### Helper Functions

**boardroomUserParticipation.ts:**
- `isUserParticipant(id)` — Check if ID represents user
- `hasUserParticipation(session)` — Check if session allows user
- `shouldWaitForUser(session, agentId)` — Should orchestrator pause
- `getUserTurnTimeout(session)` — Get timeout for user input
- `getUserDisplayInfo()` — Get user name/emoji/avatar

## Decision Points (Future Enhancement)

The system can detect when user input is needed:

```typescript
// Agent says: "Should we go with option A or option B?"
// Smart routing detects question directed at group
// Routes to user for decision
// Marks as decision point in metadata

metadata.user_participation.decision_points.push({
  turn: currentTurn,
  question: "Should we go with option A or option B?",
  resolved: false,
});
```

**Visual Indicator:**
```
┌─────────────────────────────────────┐
│ ⚡ Decision needed — the team is    │
│    waiting for your input            │
└─────────────────────────────────────┘
```

## Edge Cases & Handling

### User Timeout (Round-Robin)
- Wait 5 minutes (default)
- If no input, skip user's turn
- Continue to next agent
- Log: "User turn skipped (timeout)"

### User Timeout (Smart Routing)
- Wait 5 minutes when routed to user
- If no input, select different speaker
- Log: "User didn't respond, routing to next speaker"

### Session Stopped While Waiting
- User submit cancels gracefully
- Message not saved if session stopped
- Input field disables
- No error shown to user

### Rapid User Messages
- All messages saved
- Turn numbers may be sequential
- Agents see all user messages in context
- Smart routing adapts to conversation flow

### User Joins Mid-Session
- Not currently supported (participant list is static)
- Future enhancement: dynamic participant adding

## Best Practices

### When to Include User

**Include user for:**
- ✅ Strategy sessions requiring decisions
- ✅ Brainstorms where human creativity adds value
- ✅ Planning sessions with resource allocation
- ✅ Debates where user provides final say
- ✅ War rooms requiring rapid human judgment

**Skip user for:**
- ❌ Automated standups (pure agent sync)
- ❌ Task reviews (agents reviewing work)
- ❌ Report generation (agents compiling data)
- ❌ Routine check-ins

### User Interaction Patterns

**Active Participation:**
- User contributes regularly
- Raises hand when needed
- Responds promptly on their turn
- Uses pause to review before important decisions

**Passive Oversight:**
- User watches conversation
- Interjects only when correction needed
- Lets agents discuss autonomously
- Steps in at decision points

**Guided Facilitation:**
- User starts with opening question
- Agents discuss
- User raises hand to redirect if off-topic
- User provides synthesis at end

## Testing

### Test Scenario 1: Round-Robin with User

1. Create session with user + 3 agents, round-robin, 12 turns
2. Start session
3. Agents speak turns 1-3
4. User's turn (turn 4) — orchestration pauses
5. User types message, submits
6. Orchestration resumes
7. Verify user message in history
8. Verify agents see user message in their prompts

### Test Scenario 2: Smart Routing with Raise Hand

1. Create session with user + 4 agents, smart routing, 20 turns
2. Start session, let agents discuss
3. User clicks raise hand (✋)
4. Verify next speaker is user
5. User submits message
6. Verify raised hand cleared
7. Smart routing continues normally

### Test Scenario 3: User Interjection

1. Session in progress, agent speaking
2. User types message, submits (anytime)
3. Message appears immediately in conversation
4. Next agent's prompt includes user interjection
5. Agent responds to user's point

### Test Scenario 4: Pause/Resume

1. Session in progress
2. User clicks pause (⏸️)
3. Verify agents stop responding
4. User types 2 messages while paused
5. User clicks resume (▶️)
6. Verify orchestration continues
7. Verify both user messages in history

## Future Enhancements

### Phase 2
- [ ] Typing indicator for other users (multiplayer)
- [ ] @mention system (tag specific agents)
- [ ] Inline polls/voting
- [ ] File upload from user
- [ ] Voice input option

### Phase 3
- [ ] Dynamic participant adding (join mid-session)
- [ ] User roles (moderator vs participant)
- [ ] Private messaging to specific agents
- [ ] Session recording from user perspective

### Phase 4
- [ ] Multi-user sessions (multiple humans)
- [ ] User "lanes" (separate input streams)
- [ ] Rich text formatting
- [ ] Reaction system (👍, 🤔, etc.)

## Conclusion

Human-in-the-loop participation transforms Boardroom from an agent-only discussion forum into a true collaborative workspace. Users bring judgment, creativity, and decision-making authority while agents provide research, analysis, and diverse perspectives. Together, they achieve better outcomes than either could alone.
