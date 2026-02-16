# Boardroom Smart Routing & Turn Awareness

## Overview

The Boardroom orchestrator has been upgraded from simple round-robin turn-taking to intelligent speaker selection with turn awareness, session phases, and automatic summaries.

## Key Features

### 1. Smart Routing (Default)

Instead of fixed round-robin order, the orchestrator intelligently selects the next speaker based on:

- **Relevance**: Agents who were mentioned or whose domain was discussed get priority
- **Participation Balance**: Turn counts are tracked to prevent one agent from dominating
- **Topic Flow**: Domain-relevant agents are prioritized (e.g., marketing topics → marketing agents)
- **Phase Requirements**: Opening phase ensures everyone speaks at least once

**Routing Modes:**
- `smart` (default): Intelligent speaker selection
- `round-robin`: Classic sequential rotation (still available)

### 2. Session Phases

Sessions automatically transition through three phases based on turn progress:

#### Opening Phase (first 20% of turns)
- Each participant gets at least one turn to present their perspective
- Strong preference for agents who haven't spoken yet
- Agent prompts include: "Opening Phase - Present your perspective"

#### Discussion Phase (middle 60% of turns)
- Smart routing based on conversation flow
- Participation balancing kicks in
- Agents respond to what others have said
- Agent prompts include: "Discussion Phase - Engage with what others have said"

#### Wrap-Up Phase (final 20% of turns)
- Focus shifts to synthesis and action items
- Agents are instructed to summarize decisions and propose actions
- Agent prompts include: "Wrap-Up Phase - Synthesize key decisions and action items"

### 3. Turn Tracking & Awareness

Each agent's participation is tracked:
- **Turn count**: How many times they've spoken
- **Last mentioned turn**: When they were last referenced by others

This data is saved to session metadata and used for smart routing decisions.

### 4. Auto-Summary Generation

When a session ends, the orchestrator automatically:
1. Generates a structured summary (decisions, action items, unresolved topics)
2. Saves the summary to session metadata
3. Optionally sends it via WhatsApp

**Summary Structure:**
```json
{
  "decisions": ["decision 1", "decision 2"],
  "action_items": [
    {"task": "description", "owner": "agent_name"},
    {"task": "description", "owner": null}
  ],
  "unresolved": ["topic that needs follow-up"]
}
```

### 5. Session Extension

Sessions can be extended mid-conversation by calling `extendSession(sessionId, additionalTurns)`.

**Use cases:**
- Wrap-up phase starts but important topics remain
- Manual extension via UI button
- Future: Auto-suggest extension when detecting unresolved discussions

The extension count is tracked in session metadata.

### 6. Auto-Start Scheduled Sessions

Sessions with `scheduled_at` set can automatically start when the time arrives.

**Configuration:**
- `metadata.auto_start`: `true` (default for scheduled sessions) | `false`
- Polling interval: 30 seconds
- Auto-start transitions session from `scheduled` → `active` and begins orchestration

**UI Indicator:**
- Sessions with auto-start show "⏰ HH:MM" badge

### 7. WhatsApp Notifications

Sessions can send WhatsApp notifications on start and end.

**Configuration:**
- `metadata.notify_whatsapp`: `true` (default for scheduled sessions) | `false`

**On Session Start:**
```
🏛️ Boardroom starting: {title} — {N} agents, {type} session, {max_turns} turns.
Agenda: {agenda items}
```

**On Session End:**
```
🏛️ Boardroom ended: {title}
Decisions: {decisions}
Action Items: {tasks with owners}
Unresolved: {unresolved topics}
```

## Usage

### Creating a Session with Smart Routing

Smart routing is enabled by default when creating sessions:

```typescript
const session = await createSession({
  title: "Q1 Strategy Review",
  topic: "Discuss Q1 goals and resource allocation",
  session_type: "strategy",
  participant_agent_ids: ["marcus-aurelius", "alexander", "cleopatra"],
  max_turns: 20,
  scheduled_at: null, // or ISO timestamp for scheduled
  metadata: {
    routing_mode: "smart", // or "round-robin"
    auto_start: true,
    notify_whatsapp: true,
    agenda: ["Review Q1 metrics", "Define Q2 priorities"],
  },
});
```

### Extending a Session

```typescript
// Add 5 more turns to an ongoing session
await extendSession(sessionId, 5);
```

### Switching to Round-Robin

To use classic round-robin instead of smart routing:

```typescript
metadata: {
  routing_mode: "round-robin"
}
```

## Implementation Details

### Smart Routing Score Calculation

Each agent receives a score for the next turn:

```
Base Score: 100

Adjustments:
- Turn count penalty: -20 per turn spoken
- Recent mention bonus: +40 if mentioned in last 3 turns
- Opening phase bonus: +100 if haven't spoken yet
- Discussion phase balance: +15 if below average participation
```

The agent with the highest score speaks next.

### Turn Tracking Structure

```typescript
interface TurnTracking {
  agent_id: string;
  turn_count: number;
  last_mentioned_turn?: number;
}
```

Stored in `session.metadata.turn_tracking` and updated after each turn.

### Phase Determination

```typescript
function determineSessionPhase(currentTurn: number, maxTurns: number): SessionPhase {
  const progress = currentTurn / maxTurns;
  if (progress <= 0.2) return 'opening';
  if (progress >= 0.8) return 'wrap-up';
  return 'discussion';
}
```

## Testing

Test with the brainstorm session:
- Session ID: `a2ded48e-daf9-4445-b770-f0d2d0aa2325`
- 7 participants, 30 turns
- Should see varied speaker order with participation balancing

## Future Enhancements

- **LLM-powered summary generation**: Currently uses a simple structure; could use an LLM call
- **Auto-extend suggestions**: Detect unresolved discussions and suggest extending
- **Conflict detection & resolution**: Track disagreements and ensure both sides respond
- **Domain-based routing**: Route based on agent specializations (requires agent domain metadata)
- **Session analytics**: Track participation patterns, topic flows, decision quality

## Migration

Existing sessions continue to work:
- Default to smart routing if no `routing_mode` is set
- Turn tracking initializes on first use
- No breaking changes to existing sessions

Round-robin is still available by setting `metadata.routing_mode = "round-robin"`.
