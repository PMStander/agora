// ─── Boardroom Resolution Package Generation ─────────────────────────────────

import type { 
  BoardroomSession, 
  BoardroomMessage, 
  BoardroomSessionType,
  ResolutionMode,
  ResolutionPackage,
  ResolutionPackageItem,
  SessionSummary,
} from '../types/boardroom';

/**
 * Get default resolution mode for session type
 */
export function getDefaultResolutionMode(sessionType: BoardroomSessionType): ResolutionMode {
  // SAFETY: All session types default to 'propose' to prevent autonomous recursion.
  // 'auto' was previously used for standup/task_review/war_room but this enables
  // infinite loops: session → auto-approved follow-up → auto-approved follow-up → ...
  // Only 'chat' and 'watercooler' skip resolution entirely.
  switch (sessionType) {
    case 'chat':
    case 'watercooler':
      return 'none';
    default:
      return 'propose';
  }
}

/**
 * Generate prompt for extracting resolution package from session
 */
export function generateResolutionPackagePrompt(
  session: BoardroomSession,
  messages: BoardroomMessage[],
  summary: SessionSummary,
  agentProfiles: Record<string, any>,
  availableCompanies?: Array<{ id: string; name: string }>,
  availableContacts?: Array<{ id: string; name: string; company?: string }>,
): string {
  const participantList = session.participant_agent_ids
    .map(id => {
      const p = agentProfiles[id];
      return p ? `- ${id}: ${p.name} (${p.role}) — ${p.persona}` : `- ${id}`;
    })
    .join('\n');

  const conversationText = messages.map(msg => {
    const agent = agentProfiles[msg.agent_id];
    const name = agent ? `${agent.name}` : msg.agent_id;
    return `[Turn ${msg.turn_number}] ${name}: ${msg.content}`;
  }).join('\n\n');

  const companiesContext = availableCompanies?.length
    ? `\n\nExisting Companies (avoid duplicates):\n${availableCompanies.map(c => `- ${c.name} (${c.id})`).join('\n')}`
    : '';

  const contactsContext = availableContacts?.length
    ? `\n\nExisting Contacts (avoid duplicates):\n${availableContacts.map(c => `- ${c.name}${c.company ? ` at ${c.company}` : ''} (${c.id})`).join('\n')}`
    : '';

  return `You are extracting actionable items from a boardroom session to create a Resolution Package.

Session Details:
- Title: ${session.title}
- Type: ${session.session_type}
- Topic: ${session.topic || 'Not specified'}
- Participants:
${participantList}

Session Summary:
Decisions: ${summary.decisions.join('; ') || 'None'}
Action Items: ${summary.action_items.map(a => `${a.task}${a.owner ? ` (${a.owner})` : ''}`).join('; ') || 'None'}
Unresolved: ${summary.unresolved.join('; ') || 'None'}

Full Conversation:
${conversationText}
${companiesContext}
${contactsContext}

Extract structured actionable items from this session. For each action mentioned or implied, create an appropriate item.

IMPORTANT RULES:
1. Only extract actions that were explicitly discussed or clearly implied
2. Assign tasks to the most appropriate agent based on their role and expertise
3. Include a source_excerpt (1-2 sentences from the conversation showing where this action came from)
4. For follow-up meetings, include unresolved items as agenda points
5. Avoid creating duplicate CRM entries if they already exist
6. Use agent IDs from the participant list (e.g., "marcus-aurelius", not "Marcus Aurelius")

Output ONLY valid JSON in this exact structure:
\`\`\`json
{
  "missions": [
    {
      "title": "Brief task title",
      "description": "Detailed description with context from the discussion",
      "agent_id": "agent-id-from-list",
      "priority": "low|medium|high|urgent",
      "dependencies": ["other mission titles if applicable"],
      "scheduled_at": "ISO timestamp if timing was discussed, else null",
      "source_excerpt": "Quote from conversation showing where this came from"
    }
  ],
  "projects": [
    {
      "name": "Project name if multiple related missions should be grouped",
      "description": "Project description",
      "mission_ids": ["indices into missions array, e.g., 0, 1, 2"],
      "source_excerpt": "Quote from conversation"
    }
  ],
  "documents": [
    {
      "title": "Document title",
      "description": "What should be in this document",
      "agent_id": "agent-id-who-should-write-it",
      "type": "brief|spec|proposal|report",
      "source_excerpt": "Quote from conversation"
    }
  ],
  "crm_actions": [
    {
      "type": "company|contact|deal",
      "action": "create|update",
      "name": "Entity name",
      "details": {"relevant": "fields"},
      "source_excerpt": "Quote from conversation"
    }
  ],
  "follow_up_meetings": [
    {
      "title": "Follow-up session title",
      "topic": "What needs further discussion",
      "participant_agent_ids": ["agent-ids-who-should-attend"],
      "agenda": ["agenda item 1", "agenda item 2"],
      "scheduled_at": "ISO timestamp or null",
      "unresolved_items": ["items from summary.unresolved that this meeting addresses"],
      "source_excerpt": "Quote from conversation"
    }
  ],
  "events": [
    {
      "title": "Event title",
      "description": "Event description",
      "start_time": "ISO timestamp",
      "duration_minutes": 60,
      "attendees": ["attendee names or agent names"],
      "source_excerpt": "Quote from conversation"
    }
  ],
  "quotes": [
    {
      "customer": "Customer name",
      "description": "What they need",
      "items": [{"description": "Line item", "amount": 1000}],
      "source_excerpt": "Quote from conversation"
    }
  ]
}
\`\`\`

If no items of a particular type were discussed, use an empty array []. Focus on concrete, actionable items.`;
}

/**
 * Parse resolution package JSON from LLM response
 */
export function parseResolutionPackage(
  response: string,
  sessionId: string,
  mode: ResolutionMode
): ResolutionPackage {
  // Extract JSON from response
  const jsonMatch = response.match(/```json\s*([\s\S]*?)```/);
  const jsonText = jsonMatch ? jsonMatch[1] : response;

  try {
    const parsed = JSON.parse(jsonText);
    const items: ResolutionPackageItem[] = [];

    // Process missions
    if (Array.isArray(parsed.missions)) {
      parsed.missions.forEach((mission: any, index: number) => {
        items.push({
          id: `mission-${index}`,
          type: 'mission',
          status: mode === 'auto' ? 'approved' : 'pending',
          data: {
            title: mission.title || 'Untitled Mission',
            description: mission.description || '',
            agent_id: mission.agent_id || '',
            priority: mission.priority || 'medium',
            dependencies: mission.dependencies || [],
            scheduled_at: mission.scheduled_at || undefined,
            source_excerpt: mission.source_excerpt || '',
          },
        });
      });
    }

    // Process projects
    if (Array.isArray(parsed.projects)) {
      parsed.projects.forEach((project: any, index: number) => {
        items.push({
          id: `project-${index}`,
          type: 'project',
          status: mode === 'auto' ? 'approved' : 'pending',
          data: {
            name: project.name || 'Untitled Project',
            description: project.description || '',
            mission_ids: project.mission_ids || [],
            source_excerpt: project.source_excerpt || '',
          },
        });
      });
    }

    // Process documents
    if (Array.isArray(parsed.documents)) {
      parsed.documents.forEach((doc: any, index: number) => {
        items.push({
          id: `document-${index}`,
          type: 'document',
          status: mode === 'auto' ? 'approved' : 'pending',
          data: {
            title: doc.title || 'Untitled Document',
            description: doc.description || '',
            agent_id: doc.agent_id || '',
            type: doc.type || 'brief',
            source_excerpt: doc.source_excerpt || '',
          },
        });
      });
    }

    // Process CRM actions
    // CRM actions are always 'pending' regardless of resolution mode to prevent
    // data integrity issues from LLM hallucinations.
    if (Array.isArray(parsed.crm_actions)) {
      parsed.crm_actions.forEach((action: any, index: number) => {
        items.push({
          id: `crm-${index}`,
          type: 'crm',
          // CRM actions ALWAYS require human approval — never auto-execute
          status: 'pending',
          data: {
            type: action.type || 'contact',
            action: action.action || 'create',
            name: action.name || '',
            details: action.details || {},
            source_excerpt: action.source_excerpt || '',
          },
        });
      });
    }

    // Process follow-up meetings
    if (Array.isArray(parsed.follow_up_meetings)) {
      parsed.follow_up_meetings.forEach((meeting: any, index: number) => {
        items.push({
          id: `follow-up-${index}`,
          type: 'follow_up',
          status: mode === 'auto' ? 'approved' : 'pending',
          data: {
            title: meeting.title || 'Follow-up Meeting',
            topic: meeting.topic || '',
            participant_agent_ids: meeting.participant_agent_ids || [],
            agenda: meeting.agenda || [],
            scheduled_at: meeting.scheduled_at || undefined,
            unresolved_items: meeting.unresolved_items || [],
            source_excerpt: meeting.source_excerpt || '',
          },
        });
      });
    }

    // Process events
    if (Array.isArray(parsed.events)) {
      parsed.events.forEach((event: any, index: number) => {
        items.push({
          id: `event-${index}`,
          type: 'event',
          status: mode === 'auto' ? 'approved' : 'pending',
          data: {
            title: event.title || 'Untitled Event',
            description: event.description || '',
            start_time: event.start_time || new Date().toISOString(),
            duration_minutes: event.duration_minutes || 60,
            attendees: event.attendees || [],
            source_excerpt: event.source_excerpt || '',
          },
        });
      });
    }

    // Process quotes
    if (Array.isArray(parsed.quotes)) {
      parsed.quotes.forEach((quote: any, index: number) => {
        items.push({
          id: `quote-${index}`,
          type: 'quote',
          status: mode === 'auto' ? 'approved' : 'pending',
          data: {
            customer: quote.customer || '',
            description: quote.description || '',
            items: quote.items || [],
            source_excerpt: quote.source_excerpt || '',
          },
        });
      });
    }

    return {
      session_id: sessionId,
      generated_at: new Date().toISOString(),
      items,
      mode,
    };
  } catch (err) {
    console.error('[ResolutionPackage] Failed to parse resolution package:', err);
    // Return empty package on parse error
    return {
      session_id: sessionId,
      generated_at: new Date().toISOString(),
      items: [],
      mode,
    };
  }
}

/**
 * Get icon for resolution item type
 */
export function getResolutionItemIcon(type: ResolutionPackageItem['type']): string {
  switch (type) {
    case 'mission':
      return '🎯';
    case 'project':
      return '📁';
    case 'document':
      return '📄';
    case 'crm':
      return '👥';
    case 'follow_up':
      return '📅';
    case 'event':
      return '📆';
    case 'quote':
      return '💰';
    default:
      return '📋';
  }
}

/**
 * Get label for resolution item type
 */
export function getResolutionItemTypeLabel(type: ResolutionPackageItem['type']): string {
  switch (type) {
    case 'mission':
      return 'Mission';
    case 'project':
      return 'Project';
    case 'document':
      return 'Document';
    case 'crm':
      return 'CRM Action';
    case 'follow_up':
      return 'Follow-up Meeting';
    case 'event':
      return 'Calendar Event';
    case 'quote':
      return 'Quote/Proposal';
    default:
      return 'Item';
  }
}
