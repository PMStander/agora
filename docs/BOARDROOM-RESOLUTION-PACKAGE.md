# Boardroom Resolution Package (Post-Session Action Engine)

## Overview

The Resolution Package is a post-session action engine that automatically extracts actionable items from Boardroom sessions and creates real system objects (missions, follow-up sessions, documents, etc.). This creates full traceability from discussion → decision → action → result.

## Core Features

### 1. Automatic Action Extraction

When a session ends, the system:
1. Generates a session summary (decisions, action items, unresolved topics)
2. Makes an LLM call to extract structured actions from the conversation
3. Creates a **Resolution Package** containing typed actionable items
4. Either proposes them for approval or auto-executes them (based on resolution mode)

### 2. Resolution Modes

Every session has a `resolution_mode` that controls how actions are handled:

#### **Propose Mode** (default for strategy, brainstorm, debate, custom)
- Resolution Package items are presented in UI for review
- User can approve, edit, or reject each item
- "Approve All" button for quick confirmation
- Only approved items are created in the system
- Ideal for sessions requiring human judgment

#### **Auto Mode** (default for standup, task_review, war_room)
- Resolution Package items are created immediately
- Still visible in UI as "Auto-created" with ability to undo
- Ideal for routine sessions with clear action patterns

#### **None Mode** (default for chat, watercooler)
- No resolution package generated
- Session ends without automatic action extraction

### 3. Resolution Package Item Types

#### **Missions** 🎯
Tasks to be created in the missions table.
```typescript
{
  title: string;
  description: string;
  agent_id: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dependencies?: string[];
  scheduled_at?: string;
  source_excerpt: string;
}
```

**Created as:** Entry in `missions` table with metadata linking back to source session

#### **Projects** 📁
Groups of related missions.
```typescript
{
  name: string;
  description: string;
  mission_ids: string[];
  source_excerpt: string;
}
```

**Created as:** Project wrapper with linked missions (future enhancement)

#### **Documents** 📄
Briefs, specs, proposals to be written.
```typescript
{
  title: string;
  description: string;
  agent_id: string;
  type: 'brief' | 'spec' | 'proposal' | 'report';
  source_excerpt: string;
}
```

**Created as:** Mission assigned to the agent to write the document

#### **CRM Actions** 👥
Companies, contacts, or deals to create/update.
```typescript
{
  type: 'company' | 'contact' | 'deal';
  action: 'create' | 'update';
  name: string;
  details: Record<string, any>;
  source_excerpt: string;
}
```

**Created as:** Entries in CRM tables (future enhancement)

#### **Follow-up Meetings** 📅
New boardroom sessions to schedule.
```typescript
{
  title: string;
  topic: string;
  participant_agent_ids: string[];
  agenda: string[];
  scheduled_at?: string;
  unresolved_items: string[];
  source_excerpt: string;
}
```

**Created as:** New boardroom session with context from current session

#### **Calendar Events** 📆
Events to create.
```typescript
{
  title: string;
  description: string;
  start_time: string;
  duration_minutes: number;
  attendees: string[];
  source_excerpt: string;
}
```

**Created as:** Calendar entry (future enhancement)

#### **Quotes/Proposals** 💰
Commercial documents.
```typescript
{
  customer: string;
  description: string;
  items: Array<{ description: string; amount?: number }>;
  source_excerpt: string;
}
```

**Created as:** Quote/proposal in invoicing system (future enhancement)

### 4. Context Chain (Traceability)

Every created object includes source metadata:

```typescript
metadata: {
  source_session_id: string;
  source_type: 'boardroom';
  relevant_excerpt: string;
}
```

This enables full traceability:
- From mission → view source session → see discussion context
- From session summary → view all created missions/sessions
- Audit trail of decisions and their origins

### 5. Follow-up Meeting Intelligence

When creating follow-up sessions:
- **Unresolved items** from current session become agenda points
- **Session summary** is included in new session's `metadata.context`
- **Participants** suggested based on who discussed unresolved topics
- **Scheduled time** proposed based on urgency (next day for urgent, next week for routine)
- **Session type** inherited from parent session

### 6. Smart Extraction Prompt

The LLM extraction prompt includes:
- Full conversation history
- Session summary (decisions, action items, unresolved)
- Available agents and their roles (for correct assignment)
- Session type (to calibrate extraction patterns)
- Existing CRM data (to avoid duplicates)
- Structured JSON schema for output

Example output:
```json
{
  "missions": [...],
  "projects": [...],
  "documents": [...],
  "crm_actions": [...],
  "follow_up_meetings": [...],
  "events": [...],
  "quotes": [...]
}
```

## Usage

### Creating a Session with Resolution Package

Resolution mode is set automatically based on session type:

```typescript
const session = await createSession({
  title: "Q1 Planning Strategy",
  topic: "Define Q1 goals and resource allocation",
  session_type: "strategy", // → resolution_mode: 'propose'
  participant_agent_ids: ["marcus-aurelius", "alexander"],
  max_turns: 20,
  // ...
});
```

### Viewing Resolution Package

After a session ends (status: 'closed'):
1. Check `session.metadata.resolution_package`
2. Display `<ResolutionPackagePanel session={session} />`
3. User reviews and approves items
4. Execute to create system objects

### Manual Resolution Package Generation

```typescript
const { generateResolutionPackage, saveResolutionPackage } = useBoardroomResolution();

const resolutionPackage = await generateResolutionPackage(
  session,
  messages,
  summary,
  agentProfiles
);

await saveResolutionPackage(session.id, resolutionPackage);
```

### Approving Items

```typescript
// Approve individual item
await approveResolutionItem(sessionId, itemId);

// Reject individual item
await rejectResolutionItem(sessionId, itemId);

// Approve all pending items
await approveAllItems(sessionId);
```

### Executing Resolution Package

```typescript
// Create system objects from approved items
await executeResolutionPackage(sessionId);
```

## Resolution Package Lifecycle

```
Session Ends
  ↓
Generate Summary (decisions, actions, unresolved)
  ↓
Generate Resolution Package (LLM extraction)
  ↓
Save to session.metadata.resolution_package
  ↓
[If mode = 'auto'] → Execute immediately
[If mode = 'propose'] → Show UI for approval
[If mode = 'none'] → Stop here
  ↓
User Reviews Items (propose mode only)
  ↓
Approve/Reject/Edit Items
  ↓
Execute Approved Items
  ↓
Create System Objects (missions, sessions, etc.)
  ↓
Update Items with created_id and status: 'created'
```

## Default Resolution Modes by Session Type

| Session Type | Resolution Mode | Rationale |
|-------------|----------------|-----------|
| `standup` | `auto` | Routine updates with clear action patterns |
| `task_review` | `auto` | Structured reviews with predictable outcomes |
| `war_room` | `auto` | Crisis response requiring immediate action |
| `strategy` | `propose` | Strategic decisions benefit from human review |
| `brainstorm` | `propose` | Creative sessions need curation |
| `debate` | `propose` | Contentious topics need approval |
| `custom` | `propose` | Safe default |
| `chat` | `none` | Informal conversation, no structured output |
| `watercooler` | `none` | Casual chat, no actions expected |

## UI Components

### ResolutionPackagePanel

Main UI for viewing and managing resolution packages.

**Features:**
- Grouped by item type
- Status indicators (pending, approved, created, rejected)
- Approve/Reject buttons per item
- "Approve All" bulk action
- "Execute" button to create approved items
- Source excerpts expandable
- Error display
- Created object IDs shown after execution

**States:**
- Pending (amber) — waiting for approval
- Approved (green) — ready to execute
- Created (blue) — successfully created
- Rejected (red) — excluded from execution

### Session Card Badges

- `📦 actions` — Session has resolution package (closed sessions)
- `⚡ auto` — Auto-execution mode (active sessions)
- Shows user at a glance which sessions have actionable outputs

## Implementation Details

### Resolution Package Generation

**File:** `src/lib/boardroomResolution.ts`

Key functions:
- `getDefaultResolutionMode(sessionType)` — Determine mode from session type
- `generateResolutionPackagePrompt(...)` — Build LLM extraction prompt
- `parseResolutionPackage(response, sessionId, mode)` — Parse LLM JSON output

### Resolution Package Management

**File:** `src/hooks/useBoardroomResolution.ts`

Key functions:
- `generateResolutionPackage(...)` — Make LLM call and parse result
- `saveResolutionPackage(...)` — Persist to session metadata
- `approveResolutionItem(...)` — Mark item as approved
- `rejectResolutionItem(...)` — Mark item as rejected
- `approveAllItems(...)` — Bulk approve
- `executeResolutionPackage(...)` — Create system objects from approved items

Helper functions:
- `createMissionFromResolution(...)` — Create mission with source metadata
- `createDocumentMission(...)` — Create document-writing mission
- `createFollowUpSession(...)` — Create follow-up boardroom session with context

### Integration Points

**Orchestrator:** `src/hooks/useBoardroomOrchestrator.ts`
- After session summary generation
- Before session closure
- Generates and saves resolution package
- Auto-executes if mode = 'auto'

**Session Creation:** `src/components/teams/CreateSessionModal.tsx`
- Sets `resolution_mode` based on session type
- User can override if needed (future enhancement)

**Session Display:** `src/components/teams/SessionCard.tsx`
- Shows resolution indicators
- Badges for mode and availability

## Future Enhancements

### Phase 2
- [ ] UI controls to edit items before approval
- [ ] Manual override of resolution mode in create modal
- [ ] Batch editing (change agent assignments, priorities)
- [ ] Resolution templates by session type

### Phase 3
- [ ] CRM action execution (create companies, contacts, deals)
- [ ] Calendar event creation
- [ ] Quote/proposal generation
- [ ] Project creation (grouping missions)

### Phase 4
- [ ] ML-powered action extraction (learn from past sessions)
- [ ] Duplicate detection (avoid creating redundant missions)
- [ ] Priority inference from discussion tone
- [ ] Dependency detection (mission A must complete before B)

### Phase 5
- [ ] Resolution analytics (which sessions produce most actions)
- [ ] Action completion tracking (close loop from session → done)
- [ ] Session effectiveness metrics
- [ ] Automatic follow-up scheduling based on completion rates

## Testing

### Test Session
Use session `a2ded48e-daf9-4445-b770-f0d2d0aa2325` (brainstorm, 7 participants, 30 turns) to verify:
- Summary generation
- Resolution package extraction
- Propose mode UI
- Item approval/rejection
- Mission creation with context chain

### Test Checklist

- [ ] Create session with `session_type: 'strategy'` (propose mode)
- [ ] Complete session, verify summary generated
- [ ] Verify resolution package appears in metadata
- [ ] Open ResolutionPackagePanel
- [ ] Approve individual items
- [ ] Reject some items
- [ ] Approve all remaining
- [ ] Execute package
- [ ] Verify missions created in database
- [ ] Check missions have `metadata.source_session_id`
- [ ] Create follow-up session, verify context carried forward

- [ ] Create session with `session_type: 'standup'` (auto mode)
- [ ] Complete session
- [ ] Verify items auto-executed
- [ ] Check created missions

- [ ] Create session with `session_type: 'chat'` (none mode)
- [ ] Complete session
- [ ] Verify no resolution package generated

## Migration

Existing sessions:
- No migration required
- Resolution package is optional field in metadata
- Default mode determined from session type
- All sessions continue to work unchanged

New sessions:
- `resolution_mode` set automatically in CreateSessionModal
- Can be overridden in session metadata if needed

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ Boardroom Session                                   │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Smart Routing Orchestrator                      │ │
│ │ - Turn-by-turn conversation                     │ │
│ │ - Phase awareness (opening/discussion/wrap-up)  │ │
│ │ - Participation balancing                       │ │
│ └─────────────────┬───────────────────────────────┘ │
│                   │                                  │
│                   ↓                                  │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Session Summary Generation                      │ │
│ │ - Decisions                                     │ │
│ │ - Action items                                  │ │
│ │ - Unresolved topics                             │ │
│ └─────────────────┬───────────────────────────────┘ │
│                   │                                  │
│                   ↓                                  │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Resolution Package Generation (LLM)             │ │
│ │ - Extract missions, follow-ups, documents       │ │
│ │ - Assign to appropriate agents                  │ │
│ │ - Include source excerpts for context           │ │
│ └─────────────────┬───────────────────────────────┘ │
│                   │                                  │
│                   ↓                                  │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Resolution Mode Handler                         │ │
│ │ - Auto: Execute immediately                     │ │
│ │ - Propose: Present for approval                 │ │
│ │ - None: Skip                                    │ │
│ └─────────────────┬───────────────────────────────┘ │
│                   │                                  │
└───────────────────┼──────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────┐
│ System Object Creation                              │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ Missions     │ │ Follow-ups   │ │ Documents    │ │
│ │ (tasks)      │ │ (sessions)   │ │ (missions)   │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ CRM Actions  │ │ Events       │ │ Quotes       │ │
│ │ (future)     │ │ (future)     │ │ (future)     │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Conclusion

The Resolution Package transforms Boardroom sessions from passive discussions into active command centers. Every strategic conversation, brainstorm, or war room automatically produces concrete, traceable actions that drive the business forward.

**Key Benefits:**
- **Zero action items lost** — Everything discussed is extracted and reviewed
- **Full traceability** — Every mission links back to its source discussion
- **Intelligent routing** — Tasks assigned to the right agents automatically
- **Context preservation** — Follow-up sessions carry forward unresolved items
- **Flexible control** — Auto-execute routine sessions, review strategic ones
- **Closed loop** — From discussion → decision → action → result
