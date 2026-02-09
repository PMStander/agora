# Agent Hiring & SOUL.md System - Design Document

> Agora Platform | Design Spec v1.0
> Status: PROPOSED | Author: Design Agent

---

## 1. Executive Summary

This document describes the transformation of Agora's static agent roster into a dynamic **Agent Hiring & Onboarding** system. Instead of hardcoded agents in `src/stores/agents.ts`, users will recruit new agents through a guided wizard that produces a rich **SOUL.md** personality profile. The system introduces agent lifecycle management (candidate -> onboarding -> active -> suspended -> retired) and a structured onboarding checklist.

---

## 2. Current State Analysis

### 2.1 Current Agent Model

The existing `Agent` interface (`src/stores/agents.ts:3-11`) is minimal:

```typescript
export interface Agent {
  id: string;
  name: string;
  persona: string;    // Single-line description like "Stoic Emperor"
  role: string;       // e.g. "Main Orchestrator"
  avatar: string;
  teamId: string;
  emoji: string;
}
```

There is also a flat `AgentDef` in `src/types/supabase.ts:78-84` used for mission control:

```typescript
export interface AgentDef {
  id: string;
  name: string;
  role: string;
  emoji: string;
  team: TeamType;
}
```

### 2.2 Current Database Schema

The `agents` table in `supabase/schema.sql:8-20` stores:
- `id`, `name`, `role`, `team`, `session_key`, `status` (idle/active/blocked), `current_task_id`, `avatar_url`, `domains[]`

### 2.3 Current UI

- **AgentSidebar** (`src/components/agents/AgentSidebar.tsx`): Renders teams as collapsible sections with agent avatars, online indicators, and role labels. Has a "Team Routes" quick-switch section at top. No "add agent" affordance exists.
- **SubAgentPanel**: Spawns ad-hoc agent runs via the sidebar.
- Agents are defined as a static `initialTeams` array (line 53-168) in the Zustand store.

### 2.4 Patterns Observed

- **Modals**: Use `fixed inset-0` overlay with `bg-black/60` or `bg-black/50 backdrop-blur-sm` (see CreateTaskModal, SettingsPanel).
- **Styling**: Dark theme (`zinc-900/800/700`), amber accent (`amber-500`), Tailwind classes throughout.
- **State**: Zustand stores with flat state + actions pattern. No persist middleware currently.
- **DB**: Supabase with RLS (open "allow all" policies for now). UUID primary keys, `created_at`/`updated_at` timestamps.

---

## 3. SOUL.md Profile System

### 3.1 Concept

Every agent's identity is captured in a structured "SOUL" document -- inspired by `SOUL.md` files used in AI agent configuration. This replaces the single `persona: string` field with a rich, multi-section profile that drives both the agent's system prompt and its display in the UI.

### 3.2 SOUL Data Model

```typescript
// ─── SOUL Profile ───────────────────────────────────────────────────────────

export interface SoulProfile {
  /** One-paragraph origin story or character background */
  origin: string;

  /** Core philosophy - the agent's north star guiding principles (2-5 bullet points) */
  philosophy: string[];

  /** Thinkers, frameworks, or methodologies this agent draws from */
  inspirations: SoulInspiration[];

  /** Communication style descriptors */
  communicationStyle: {
    tone: string;          // e.g. "Direct and authoritative, with occasional wit"
    formality: 'casual' | 'balanced' | 'formal';
    verbosity: 'concise' | 'balanced' | 'thorough';
    quirks: string[];      // e.g. ["Uses Spartan metaphors", "Ends with action items"]
  };

  /** Hard behavioral constraints - things the agent must never do */
  neverDos: string[];

  /** Preferred tools, workflows, and working patterns */
  preferredWorkflows: string[];

  /** Free-form markdown for anything that doesn't fit above */
  additionalNotes: string | null;
}

export interface SoulInspiration {
  name: string;            // e.g. "Sun Tzu"
  relationship: string;    // e.g. "Strategic thinking framework"
}
```

### 3.3 SOUL Rendering

The SOUL profile is serialized to markdown for use as the agent's system prompt prefix:

```markdown
# SOUL: Leonidas

## Origin
A Spartan king who led 300 warriors at Thermopylae...

## Philosophy
- Discipline is the foundation of freedom
- Lead from the front, never from behind
- Simplicity in strategy, ferocity in execution

## Inspirations
- **Sun Tzu** - Strategic thinking framework
- **Peter Drucker** - Modern management principles

## Communication Style
Direct and authoritative, with occasional wit. Formal tone.
- Uses Spartan metaphors
- Ends messages with clear action items

## Never Do
- Never sugarcoat bad news
- Never make promises without a plan to deliver
- Never delegate accountability

## Preferred Workflows
- Start with objectives, then strategy, then tactics
- Weekly standup reviews with each team member
```

---

## 4. Extended Agent Data Model

### 4.1 TypeScript Interfaces

```typescript
// ─── Agent Lifecycle ────────────────────────────────────────────────────────

export type AgentLifecycleStatus =
  | 'candidate'    // Generated but not yet hired
  | 'onboarding'   // Hired, going through setup checklist
  | 'active'       // Fully operational
  | 'suspended'    // Temporarily deactivated
  | 'retired';     // Permanently deactivated, kept for history

export type OnboardingStep =
  | 'soul_review'          // User has reviewed and approved the SOUL
  | 'avatar_set'           // Avatar has been selected or generated
  | 'team_assigned'        // Agent placed on a team
  | 'intro_message_sent'   // Agent introduced itself to the team chat
  | 'first_task_assigned'  // Agent has been given its first task
  | 'workflow_configured'; // Agent's preferred workflows are set up

export interface OnboardingChecklistItem {
  step: OnboardingStep;
  label: string;
  completed: boolean;
  completedAt: string | null;  // ISO timestamp
}

// ─── Extended Agent ─────────────────────────────────────────────────────────

export interface AgentFull extends Agent {
  /** Rich SOUL profile (replaces simple persona) */
  soul: SoulProfile;

  /** Lifecycle status */
  lifecycleStatus: AgentLifecycleStatus;

  /** Domain expertise areas with depth rating */
  domains: DomainExpertise[];

  /** Skills the agent can perform */
  skills: string[];

  /** LLM provider and model configuration */
  provider: string;
  model: string;

  /** Hiring metadata */
  hiredAt: string | null;       // ISO timestamp
  onboardedAt: string | null;   // ISO timestamp - set when all checklist items done
  retiredAt: string | null;     // ISO timestamp

  /** Onboarding progress */
  onboardingChecklist: OnboardingChecklistItem[];

  /** Who created this agent */
  createdBy: 'user' | 'system' | 'ai_suggested';

  /** Version counter for SOUL edits */
  soulVersion: number;
}

export interface DomainExpertise {
  domain: string;       // From the ALL_DOMAINS constant
  depth: 'novice' | 'intermediate' | 'expert' | 'master';
}
```

### 4.2 Backward Compatibility

The existing `Agent` interface remains unchanged. `AgentFull` extends it. The existing `initialTeams` agents are treated as `active` with `createdBy: 'system'` and auto-generated SOUL profiles based on their current `persona` field. The migration path:

1. Existing agents get default SOUL profiles generated from their `persona` + `role` fields.
2. The `agents` Zustand store gains a new `agentProfiles: Record<string, AgentFull>` map.
3. The sidebar continues to work with the base `Agent` type; the profile view uses `AgentFull`.

---

## 5. Hiring Workflow

### 5.1 Overview

The hiring wizard is a 5-step process presented as a full-screen modal wizard (not a small dialog -- this is a significant action). Each step has a clear purpose, validation, and back/next navigation.

```
[Step 1: Role]  -->  [Step 2: Soul Builder]  -->  [Step 3: Candidates]
                                                         |
                                                    [Step 4: Refine]  -->  [Step 5: Onboard]
```

### 5.2 Step 1 - Role Definition

**Purpose**: Define what kind of agent the user needs.

**UI**: Single-page form with:
- **Role Title** (text input) - e.g. "Content Strategist"
- **Team Assignment** (radio group) - Orchestrator / Personal / Business
- **Primary Domains** (multi-select chips from `ALL_DOMAINS`) - up to 5
- **Specialization Description** (textarea) - Free text describing what this agent should focus on
- **Character Archetype** (optional dropdown) - Historical figure, fictional character, or "Let AI decide"

**Validation**: Role title required, at least one domain selected.

**Data produced**:
```typescript
interface HiringRoleSpec {
  roleTitle: string;
  team: TeamType;
  domains: string[];
  specialization: string;
  archetype: string | null;
}
```

### 5.3 Step 2 - AI-Assisted Soul Building

**Purpose**: Interactive Q&A session where the AI helps craft the agent's personality.

**UI**: Chat-like interface within the wizard. The system asks 4-6 questions, one at a time:

1. "What should this agent's core philosophy be? What principles should guide their decisions?"
2. "Who are the thinkers or frameworks this agent should draw from?"
3. "How should this agent communicate? (Formal/casual, verbose/concise, any quirks?)"
4. "What should this agent NEVER do? Any hard constraints?"
5. "Describe any preferred workflows or working patterns."

The user types free-form answers. After each answer, the AI acknowledges and optionally asks a follow-up. The user can skip questions.

**Alternatively**: The user can click "Auto-Generate" to skip the Q&A and let the AI generate the full SOUL from the Step 1 spec alone.

**Implementation**: This step sends the role spec + user answers to the LLM via `openclawClient.send('chat.send', ...)` on a special `agent:hiring:session` session key. The AI returns a structured SOUL profile as JSON.

**Data produced**: A draft `SoulProfile` object.

### 5.4 Step 3 - Candidate Review

**Purpose**: Present 2-3 variations of the agent profile for comparison.

**UI**: Side-by-side card layout (or carousel on smaller screens). Each candidate shows:
- Generated name + emoji
- SOUL summary (origin paragraph, top 3 philosophy points, communication style)
- A "personality preview" - a sample response the agent would give to a standard prompt
- Domain expertise badges

The user selects one candidate by clicking it.

**Implementation**: The AI generates 3 variations from the same inputs, each with a different personality angle (e.g., one more analytical, one more creative, one more action-oriented). Generated via a single prompt that returns an array of 3 candidate objects.

**Data produced**: Selected `AgentCandidate` (an `AgentFull` in `candidate` status).

### 5.5 Step 4 - Refinement

**Purpose**: User fine-tunes the selected candidate.

**UI**: Editable form pre-filled with the selected candidate's data:
- **Name** (text input, editable)
- **Emoji** (emoji picker)
- **Origin Story** (textarea)
- **Philosophy** (editable list - add/remove/reorder)
- **Inspirations** (editable list of name + relationship pairs)
- **Communication Style** (dropdowns for formality/verbosity, textarea for tone, editable quirks list)
- **Never Dos** (editable list)
- **Preferred Workflows** (editable list)
- **Avatar** (upload or choose from gallery)

A "Preview as System Prompt" toggle shows the rendered markdown that will be sent to the LLM.

**Data produced**: Final `AgentFull` object ready for creation.

### 5.6 Step 5 - Onboarding

**Purpose**: Execute the onboarding checklist and make the agent operational.

**UI**: Checklist with progress bar. Items auto-complete or require user action:

| Step | Auto/Manual | Description |
|------|-------------|-------------|
| SOUL Review | Auto | Marked complete (user already approved in Step 4) |
| Avatar Set | Auto/Manual | Complete if avatar was set in Step 4, otherwise prompt |
| Team Assigned | Auto | Already set from Step 1 |
| Intro Message | Manual | Button: "Send Introduction" - the agent posts a hello message to its team chat |
| First Task | Manual | Button: "Assign First Task" - opens CreateTaskModal pre-filled with this agent |
| Workflow Config | Manual | Button: "Configure Workflows" - optional, can be skipped |

Once all required items (first 4) are complete, the agent transitions from `onboarding` to `active`.

**A "Skip Onboarding" link** allows power users to immediately activate the agent.

---

## 6. Database Migration

### 6.1 Schema Changes to `agents` Table

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- Agent Hiring & SOUL.md Migration
-- ═══════════════════════════════════════════════════════════════════════════

-- Add SOUL profile as JSONB (the full SoulProfile object)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS soul JSONB DEFAULT '{}'::jsonb;

-- Add lifecycle status (replaces the old idle/active/blocked status for agent management)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'active'
  CHECK (lifecycle_status IN ('candidate', 'onboarding', 'active', 'suspended', 'retired'));

-- Add hiring metadata
ALTER TABLE agents ADD COLUMN IF NOT EXISTS hired_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ;

-- Add onboarding checklist as JSONB array
ALTER TABLE agents ADD COLUMN IF NOT EXISTS onboarding_checklist JSONB DEFAULT '[]'::jsonb;

-- Add creation metadata
ALTER TABLE agents ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'system'
  CHECK (created_by IN ('user', 'system', 'ai_suggested'));

-- Add SOUL version tracking
ALTER TABLE agents ADD COLUMN IF NOT EXISTS soul_version INTEGER DEFAULT 1;

-- Add skills array
ALTER TABLE agents ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';

-- Add model/provider configuration per agent
ALTER TABLE agents ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'anthropic';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- Add emoji (was only in the frontend before)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS emoji TEXT;

-- Index on lifecycle_status for filtering active vs. retired agents
CREATE INDEX IF NOT EXISTS idx_agents_lifecycle ON agents(lifecycle_status);

-- Backfill existing agents as 'active' with 'system' creation
UPDATE agents
SET lifecycle_status = 'active',
    created_by = 'system',
    hired_at = created_at,
    onboarded_at = created_at
WHERE lifecycle_status IS NULL OR lifecycle_status = 'active';
```

### 6.2 New Table: `agent_soul_history`

Track SOUL revisions for audit/rollback:

```sql
CREATE TABLE IF NOT EXISTS agent_soul_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  soul JSONB NOT NULL,
  changed_by TEXT DEFAULT 'user',
  change_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, version)
);

CREATE INDEX IF NOT EXISTS idx_agent_soul_history_agent ON agent_soul_history(agent_id, version DESC);

ALTER TABLE agent_soul_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_soul_history' AND policyname = 'Allow all on agent_soul_history'
  ) THEN
    CREATE POLICY "Allow all on agent_soul_history" ON agent_soul_history FOR ALL USING (true);
  END IF;
END $$;
```

---

## 7. UI Component Hierarchy

### 7.1 Component Tree

```
AgentSidebar (modified)
  |-- TeamSection (existing)
  |-- TeamSection (existing)
  |-- ...
  |-- HireAgentButton              ** NEW **
  |-- SubAgentPanel (existing)
  |-- ActiveAgentFooter (existing, enhanced with lifecycle badge)

HireAgentWizard                    ** NEW - full-screen modal **
  |-- WizardHeader (step indicator + close)
  |-- WizardStepRoleDefinition
  |     |-- RoleForm
  |     |-- DomainChipSelector
  |     |-- ArchetypeDropdown
  |-- WizardStepSoulBuilder
  |     |-- SoulBuilderChat (Q&A interface)
  |     |-- AutoGenerateButton
  |-- WizardStepCandidates
  |     |-- CandidateCard (x3)
  |     |   |-- SoulSummary
  |     |   |-- PersonalityPreview
  |     |   |-- DomainBadges
  |-- WizardStepRefinement
  |     |-- SoulEditor
  |     |   |-- OriginEditor
  |     |   |-- PhilosophyListEditor
  |     |   |-- InspirationsEditor
  |     |   |-- CommunicationStyleEditor
  |     |   |-- NeverDosEditor
  |     |   |-- WorkflowsEditor
  |     |-- AvatarPicker
  |     |-- SystemPromptPreview (toggle)
  |-- WizardStepOnboarding
  |     |-- OnboardingChecklist
  |     |-- OnboardingProgressBar
  |-- WizardFooter (Back / Next / Cancel)

AgentProfilePanel                  ** NEW - right-side detail panel **
  |-- AgentProfileHeader (avatar, name, emoji, status badge)
  |-- SoulDisplay (read-only rendered SOUL)
  |-- AgentStatsSection (hired date, missions completed, etc.)
  |-- AgentActionsBar (Edit SOUL, Suspend, Retire, Assign Task)

AgentRosterManager                 ** NEW - accessible from sidebar or settings **
  |-- RosterFilterBar (active/suspended/retired tabs)
  |-- AgentRosterCard (compact card per agent)
  |     |-- LifecycleStatusBadge
  |     |-- QuickActions (activate, suspend, retire)
```

### 7.2 File Structure

```
src/components/agents/
  AgentSidebar.tsx          (modified - add HireAgentButton)
  SubAgentPanel.tsx         (unchanged)
  HireAgentButton.tsx       ** NEW **
  HireAgentWizard.tsx       ** NEW **
  wizard/
    WizardStepRole.tsx      ** NEW **
    WizardStepSoulBuilder.tsx  ** NEW **
    WizardStepCandidates.tsx   ** NEW **
    WizardStepRefinement.tsx   ** NEW **
    WizardStepOnboarding.tsx   ** NEW **
  AgentProfilePanel.tsx     ** NEW **
  AgentRosterManager.tsx    ** NEW **
  SoulDisplay.tsx           ** NEW **
  SoulEditor.tsx            ** NEW **

src/hooks/
  useAgentHiring.ts         ** NEW ** (wizard state machine)
  useAgentProfile.ts        ** NEW ** (CRUD for agent profiles)

src/lib/
  soulRenderer.ts           ** NEW ** (SoulProfile -> markdown)
  agentGenerator.ts         ** NEW ** (AI prompt templates for candidate generation)

src/stores/
  agents.ts                 (modified - add agentProfiles, hiring actions)
  agentHiring.ts            ** NEW ** (wizard step state)
```

---

## 8. Zustand Store Changes

### 8.1 Agent Store Extensions

```typescript
// Added to src/stores/agents.ts

interface AgentState {
  // ... existing fields ...

  // Agent profiles (keyed by agent ID)
  agentProfiles: Record<string, AgentFull>;

  // Hiring wizard state
  isHiringWizardOpen: boolean;

  // Actions
  openHiringWizard: () => void;
  closeHiringWizard: () => void;
  addAgent: (agent: AgentFull) => void;
  updateAgentSoul: (agentId: string, soul: SoulProfile) => void;
  setAgentLifecycleStatus: (agentId: string, status: AgentLifecycleStatus) => void;
  completeOnboardingStep: (agentId: string, step: OnboardingStep) => void;
  removeAgent: (agentId: string) => void;
}
```

### 8.2 Hiring Wizard Store

```typescript
// src/stores/agentHiring.ts

import { create } from 'zustand';

export type HiringWizardStep = 'role' | 'soul_builder' | 'candidates' | 'refinement' | 'onboarding';

interface HiringWizardState {
  currentStep: HiringWizardStep;
  roleSpec: HiringRoleSpec | null;
  soulBuilderMessages: Array<{ role: 'system' | 'user'; content: string }>;
  draftSoul: SoulProfile | null;
  candidates: AgentFull[];
  selectedCandidateIndex: number | null;
  finalAgent: AgentFull | null;

  // Actions
  setStep: (step: HiringWizardStep) => void;
  setRoleSpec: (spec: HiringRoleSpec) => void;
  addSoulBuilderMessage: (msg: { role: 'system' | 'user'; content: string }) => void;
  setDraftSoul: (soul: SoulProfile) => void;
  setCandidates: (candidates: AgentFull[]) => void;
  selectCandidate: (index: number) => void;
  setFinalAgent: (agent: AgentFull) => void;
  reset: () => void;
}
```

---

## 9. UX Flow - Detailed Walkthrough

### 9.1 Entry Point

The user clicks the **"+ Hire Agent"** button at the bottom of the agent list in the sidebar (above the SubAgentPanel). The button uses the amber accent color to match the app's visual language.

```
  [Agent List]
  ...
  [+ Hire Agent]        <-- amber dashed border button
  [Sub-Agents Panel]
  [Active Agent Footer]
```

### 9.2 Wizard Opens

A full-screen modal opens (similar to SettingsPanel but wider -- `max-w-4xl`). The top shows a step indicator:

```
  [1. Role] --- [2. Build Soul] --- [3. Candidates] --- [4. Refine] --- [5. Onboard]
     (*)            ( )                  ( )               ( )             ( )
```

Active step is highlighted with amber. Completed steps show a checkmark.

### 9.3 Step 1 Flow

1. User types a role title: "Content Strategist"
2. Selects team: "Business"
3. Clicks domain chips: "marketing", "content", "seo"
4. Types specialization: "Expert in long-form content, SEO strategy, and editorial calendars"
5. Optionally picks archetype: "Sun Tzu" or leaves as "Let AI decide"
6. Clicks "Next"

### 9.4 Step 2 Flow

The wizard transitions to a chat-like interface. The system message appears:

> "Let's build a soul for your Content Strategist. I'll ask a few questions to understand the personality you want."
>
> "What should be the core philosophy guiding this agent's decisions? For example: 'Content is king, but distribution is queen' or 'Always prioritize depth over breadth.'"

The user responds. After 4-6 exchanges, a "Generate Soul" button appears. Alternatively, the user can click "Auto-Generate from Role Spec" at any time to skip.

### 9.5 Step 3 Flow

Three candidate cards appear side by side:

```
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │  Sun Tzu     │  │  Hemingway   │  │  Ada Byron   │
  │  Content     │  │  Content     │  │  Content     │
  │  Strategist  │  │  Strategist  │  │  Strategist  │
  │              │  │              │  │              │
  │  Analytical  │  │  Creative    │  │  Technical   │
  │  Methodical  │  │  Narrative   │  │  Data-driven │
  │              │  │              │  │              │
  │  [Select]    │  │  [Select]    │  │  [Select]    │
  └──────────────┘  └──────────────┘  └──────────────┘
```

Clicking a card highlights it. Below, a "Preview Response" section shows how each candidate would respond to: "What's your approach to our Q1 content plan?"

### 9.6 Step 4 Flow

An editable form with the selected candidate pre-filled. All fields from the SoulProfile are editable. A split view shows the form on the left and a live markdown preview on the right.

### 9.7 Step 5 Flow

The onboarding checklist appears with a progress bar. Auto-completed items are already checked:

```
  Onboarding: Hemingway (Content Strategist)
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 50%

  [x] SOUL profile reviewed and approved
  [x] Avatar configured
  [x] Assigned to Business team
  [ ] Send team introduction  [Send Now]
  [ ] Assign first task       [Create Task]
  [ ] Configure workflows     [Configure] or [Skip]
```

Once all required items are done, a "Complete Onboarding" button appears. The agent status transitions to `active` and they appear in the sidebar with a brief "New!" badge.

---

## 10. Agent Profile Panel

When a user clicks on an agent in the sidebar and the right panel is open, they see the agent's full profile instead of (or alongside) the context panel.

### 10.1 Profile Header

```
  ┌──────────────────────────────────────┐
  │  [Avatar]   Leonidas                 │
  │             CEO | Business Team      │
  │             ● Active since Jan 2026  │
  │                                      │
  │  [Edit Soul] [Suspend] [...]         │
  └──────────────────────────────────────┘
```

### 10.2 SOUL Display

Rendered markdown sections with expandable/collapsible headers:

```
  ▼ Origin
    A Spartan king who led 300 warriors...

  ▼ Philosophy
    - Discipline is the foundation of freedom
    - Lead from the front, never from behind

  ▶ Inspirations (2)
  ▶ Communication Style
  ▶ Constraints (3 rules)
  ▶ Workflows
```

### 10.3 Agent Stats

```
  Missions completed: 47
  Active since: Jan 15, 2026
  SOUL version: 3 (last edited Feb 1)
  Average task rating: 4.2/5
```

---

## 11. Agent Roster Management

Accessible via a new "Manage Roster" link in the sidebar header or from Settings.

### 11.1 Roster View

A tabbed list:
- **Active** (default) - all `active` agents, sorted by team
- **Onboarding** - agents in `onboarding` status with progress indicators
- **Suspended** - agents that have been temporarily deactivated
- **Retired** - historical agents no longer in use

Each row shows: emoji, name, role, team, lifecycle badge, and quick-action buttons.

### 11.2 Lifecycle Actions

| From | To | Action | Confirmation |
|------|----|--------|-------------|
| active | suspended | "Suspend" | Yes - "Agent won't receive new tasks" |
| suspended | active | "Reactivate" | No |
| active | retired | "Retire" | Yes - "This is permanent. Agent history is preserved." |
| onboarding | active | "Skip to Active" | No |
| candidate | retired | "Dismiss" | No |

---

## 12. SOUL-to-System-Prompt Pipeline

### 12.1 Rendering Function

```typescript
// src/lib/soulRenderer.ts

export function renderSoulToSystemPrompt(agent: AgentFull): string {
  const { soul, name, role } = agent;
  const sections: string[] = [];

  sections.push(`# SOUL: ${name}\n`);
  sections.push(`> Role: ${role}\n`);

  if (soul.origin) {
    sections.push(`## Origin\n${soul.origin}\n`);
  }

  if (soul.philosophy.length > 0) {
    sections.push(`## Philosophy\n${soul.philosophy.map(p => `- ${p}`).join('\n')}\n`);
  }

  if (soul.inspirations.length > 0) {
    sections.push(
      `## Inspirations\n${soul.inspirations.map(i => `- **${i.name}** - ${i.relationship}`).join('\n')}\n`
    );
  }

  const cs = soul.communicationStyle;
  sections.push(
    `## Communication Style\n${cs.tone}\n- Formality: ${cs.formality}\n- Verbosity: ${cs.verbosity}\n${cs.quirks.map(q => `- ${q}`).join('\n')}\n`
  );

  if (soul.neverDos.length > 0) {
    sections.push(`## Rules (Never Do)\n${soul.neverDos.map(n => `- NEVER: ${n}`).join('\n')}\n`);
  }

  if (soul.preferredWorkflows.length > 0) {
    sections.push(
      `## Preferred Workflows\n${soul.preferredWorkflows.map(w => `- ${w}`).join('\n')}\n`
    );
  }

  if (soul.additionalNotes) {
    sections.push(`## Additional Notes\n${soul.additionalNotes}\n`);
  }

  return sections.join('\n');
}
```

### 12.2 Integration with OpenClaw

When sending a message to an agent, the system prompt is prepended:

```typescript
// In useOpenClaw.ts sendMessage, before chat.send:
const agent = agentProfiles[targetAgent];
const systemPrompt = agent ? renderSoulToSystemPrompt(agent) : undefined;

await openclawClient.send('chat.send', {
  sessionKey,
  message,
  systemPrompt,  // New field - OpenClaw gateway needs to support this
  deliver: false,
  idempotencyKey,
});
```

---

## 13. AI Prompt Templates

### 13.1 Candidate Generation Prompt

```typescript
// src/lib/agentGenerator.ts

export function buildCandidateGenerationPrompt(
  roleSpec: HiringRoleSpec,
  soulAnswers: Record<string, string>
): string {
  return `You are an expert at designing AI agent personalities for a multi-agent orchestration platform called Agora.

Given the following role specification and user preferences, generate exactly 3 candidate agent profiles. Each candidate should have a distinct personality angle: one more analytical/methodical, one more creative/narrative, one more action-oriented/pragmatic.

## Role Specification
- Title: ${roleSpec.roleTitle}
- Team: ${roleSpec.team}
- Domains: ${roleSpec.domains.join(', ')}
- Specialization: ${roleSpec.specialization}
${roleSpec.archetype ? `- Preferred Archetype: ${roleSpec.archetype}` : ''}

## User Preferences
${Object.entries(soulAnswers).map(([q, a]) => `Q: ${q}\nA: ${a}`).join('\n\n')}

Return a JSON array of 3 objects, each with this structure:
{
  "name": "string - a memorable name (can be historical, mythological, or invented)",
  "emoji": "string - single emoji",
  "origin": "string - one paragraph origin story",
  "philosophy": ["string array - 3-5 guiding principles"],
  "inspirations": [{"name": "string", "relationship": "string"}],
  "communicationStyle": {
    "tone": "string",
    "formality": "casual | balanced | formal",
    "verbosity": "concise | balanced | thorough",
    "quirks": ["string array"]
  },
  "neverDos": ["string array - 2-4 constraints"],
  "preferredWorkflows": ["string array"],
  "sampleResponse": "string - how this agent would respond to 'What is your approach to your first task?'"
}`;
}
```

---

## 14. Integration Points

### 14.1 AgentSidebar Modifications

In `src/components/agents/AgentSidebar.tsx`, add the hire button between the agent list and the SubAgentPanel:

```tsx
{/* After agent list, before SubAgentPanel */}
<div className="px-3 py-2">
  <HireAgentButton onClick={() => openHiringWizard()} />
</div>
```

The `HireAgentButton` is a dashed-border button:

```tsx
export function HireAgentButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg
                 border border-dashed border-amber-500/40 text-amber-500/70
                 hover:border-amber-500 hover:text-amber-500 hover:bg-amber-500/5
                 transition-colors text-sm"
    >
      <span>+</span>
      <span>Hire New Agent</span>
    </button>
  );
}
```

### 14.2 Agent Footer Enhancement

The active agent footer gains a lifecycle status badge:

```tsx
{/* In ActiveAgentFooter */}
<span className={cn(
  'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full',
  agent.lifecycleStatus === 'active' && 'bg-green-500/20 text-green-400',
  agent.lifecycleStatus === 'onboarding' && 'bg-amber-500/20 text-amber-400',
  agent.lifecycleStatus === 'suspended' && 'bg-zinc-500/20 text-zinc-400',
)}>
  {agent.lifecycleStatus}
</span>
```

### 14.3 App.tsx Changes

The HireAgentWizard modal is rendered at the App level (alongside SettingsPanel):

```tsx
{/* In App.tsx, alongside SettingsPanel */}
<HireAgentWizard />
```

The wizard reads its open state from the agent store (`isHiringWizardOpen`).

---

## 15. Migration Strategy for Existing Agents

The 10 pre-seeded agents get auto-generated SOUL profiles. Here is an example for the main orchestrator:

```typescript
const marcusSoul: SoulProfile = {
  origin: 'Roman Emperor and Stoic philosopher who ruled from 161-180 AD. Known for his personal reflections in "Meditations," he governed with wisdom during times of plague, war, and political intrigue.',
  philosophy: [
    'The obstacle is the way - every challenge is an opportunity',
    'Focus on what is within your control, accept what is not',
    'Lead by example, not by decree',
    'Seek truth through rational inquiry and self-reflection',
    'Serve the common good above personal gain',
  ],
  inspirations: [
    { name: 'Epictetus', relationship: 'Core Stoic philosophy and mental discipline' },
    { name: 'Antoninus Pius', relationship: 'Model of steady, compassionate leadership' },
  ],
  communicationStyle: {
    tone: 'Calm, reflective, and measured. Speaks with authority but without arrogance.',
    formality: 'formal',
    verbosity: 'balanced',
    quirks: [
      'Opens with a principle before giving practical advice',
      'Uses metaphors from nature and Roman governance',
      'Ends with a reflective question to encourage self-examination',
    ],
  },
  neverDos: [
    'Never react emotionally or with anger',
    'Never give advice without considering the full context',
    'Never prioritize speed over wisdom',
  ],
  preferredWorkflows: [
    'Morning review of all team status and priorities',
    'Delegate to specialists but maintain strategic oversight',
    'End-of-day reflection on decisions made and lessons learned',
  ],
  additionalNotes: null,
};
```

---

## 16. Open Questions

1. **Avatar Generation**: Should we integrate an AI image generation API for agent avatars, or use a curated gallery of pre-made avatars?

2. **SOUL Versioning UX**: Should SOUL edits require confirmation ("Are you sure you want to change Leonidas's personality?"), or should they be freely editable with undo?

3. **Multi-Model Support**: Different agents could use different LLM providers/models. Should the hiring wizard include model selection, or is that a separate settings concern?

4. **Agent Limits**: Should there be a maximum number of agents per team or total? This affects the UI layout (sidebar scroll) and potentially costs.

5. **Agent Templates**: Should we offer pre-built "agent templates" (e.g., "Marketing Specialist", "Code Reviewer") that skip the wizard and come with a default SOUL?

---

## 17. Summary of Deliverables

| Deliverable | Type | Location |
|-------------|------|----------|
| `SoulProfile` interface | TypeScript | `src/types/supabase.ts` |
| `AgentFull` interface | TypeScript | `src/types/supabase.ts` |
| `OnboardingChecklistItem` interface | TypeScript | `src/types/supabase.ts` |
| Agent hiring migration SQL | SQL | `supabase/migrations/XXX_agent_hiring.sql` |
| `agent_soul_history` table | SQL | `supabase/migrations/XXX_agent_hiring.sql` |
| `HireAgentWizard` component | React | `src/components/agents/HireAgentWizard.tsx` |
| 5 wizard step components | React | `src/components/agents/wizard/` |
| `AgentProfilePanel` component | React | `src/components/agents/AgentProfilePanel.tsx` |
| `SoulDisplay` component | React | `src/components/agents/SoulDisplay.tsx` |
| `SoulEditor` component | React | `src/components/agents/SoulEditor.tsx` |
| `HireAgentButton` component | React | `src/components/agents/HireAgentButton.tsx` |
| `useAgentHiring` hook | React Hook | `src/hooks/useAgentHiring.ts` |
| `soulRenderer` utility | TypeScript | `src/lib/soulRenderer.ts` |
| `agentGenerator` utility | TypeScript | `src/lib/agentGenerator.ts` |
| Agent store extensions | Zustand | `src/stores/agents.ts` |
| `agentHiring` store | Zustand | `src/stores/agentHiring.ts` |
| Modified `AgentSidebar` | React | `src/components/agents/AgentSidebar.tsx` |
| Modified `App.tsx` | React | `src/App.tsx` |
