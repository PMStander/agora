// ─── Shared Context Feedback Writer ───────────────────────────────────────────
// Writes approve/reject decisions to the shared-context/feedback/ directory
// so that all OpenClaw agents can learn from human decisions.
//
// This bridges the Agora UI → agent workspace feedback loop.
// Agents read from shared-context/feedback/pending/ on session startup.

import { writeTextFile, mkdir, rename } from '@tauri-apps/plugin-fs';
import { homeDir, join } from '@tauri-apps/api/path';
import type { ResolutionPackageItem } from '../types/boardroom';

const SHARED_CONTEXT_BASE = '.openclaw/workspace/shared-context';

async function getSharedContextPath(...segments: string[]): Promise<string> {
  const home = await homeDir();
  return join(home, SHARED_CONTEXT_BASE, ...segments);
}

function getItemTitle(item: ResolutionPackageItem): string {
  const data = item.data as any;
  return data?.title || data?.name || data?.description || `${item.type} item`;
}

function getItemDescription(item: ResolutionPackageItem): string {
  const data = item.data as any;
  return data?.description || data?.source_excerpt || 'No description';
}

function getAssignedAgent(item: ResolutionPackageItem): string {
  const data = item.data as any;
  return data?.agent_id || data?.assigned_to || 'unassigned';
}

/**
 * Write a feedback file to shared-context/feedback/pending/
 * Called after a resolution item is approved or rejected in the Agora UI.
 */
export async function writeFeedbackToSharedContext(
  sessionId: string,
  sessionTitle: string,
  item: ResolutionPackageItem,
  decision: 'approved' | 'rejected',
  userNotes?: string
): Promise<void> {
  try {
    const pendingDir = await getSharedContextPath('feedback', 'pending');

    // Ensure directory exists
    try {
      await mkdir(pendingDir, { recursive: true });
    } catch {
      // Directory likely already exists
    }

    const timestamp = new Date().toISOString();
    const agent = getAssignedAgent(item);
    const title = getItemTitle(item);
    const description = getItemDescription(item);

    const content = `# Feedback: ${title}

- **Decision:** ${decision}
- **Item Type:** ${item.type}
- **Source:** boardroom session
- **Session:** ${sessionTitle} (${sessionId})
- **Agent:** ${agent}
- **Decided At:** ${timestamp}
${userNotes ? `- **User Notes:** ${userNotes}` : ''}

---

## Original Proposal
${description}
`;

    const filename = `${item.id}.md`;
    const filePath = await getSharedContextPath('feedback', 'pending', filename);

    await writeTextFile(filePath, content);

    console.log(
      `[SharedContextFeedback] Wrote ${decision} feedback for "${title}" → feedback/pending/${filename}`
    );
  } catch (err) {
    // Non-critical — don't break the approve/reject flow if file write fails
    console.warn('[SharedContextFeedback] Failed to write feedback file:', err);
  }
}

/**
 * Move a feedback file from pending/ to resolved/
 * Called by agents after they process feedback.
 */
export async function resolveFeedbackItem(itemId: string): Promise<void> {
  try {
    const pendingPath = await getSharedContextPath('feedback', 'pending', `${itemId}.md`);
    const resolvedDir = await getSharedContextPath('feedback', 'resolved');

    try {
      await mkdir(resolvedDir, { recursive: true });
    } catch {
      // Directory likely already exists
    }

    const resolvedPath = await getSharedContextPath('feedback', 'resolved', `${itemId}.md`);
    await rename(pendingPath, resolvedPath);

    console.log(`[SharedContextFeedback] Moved ${itemId}.md to feedback/resolved/`);
  } catch (err) {
    console.warn('[SharedContextFeedback] Failed to resolve feedback item:', err);
  }
}

/**
 * Write a decision file to shared-context/decisions/active/
 * Called after a boardroom session closes and produces a resolution package.
 */
export async function writeDecisionToSharedContext(
  sessionId: string,
  sessionTitle: string,
  items: ResolutionPackageItem[],
  decidedBy: string[]
): Promise<void> {
  try {
    const activeDir = await getSharedContextPath('decisions', 'active');

    try {
      await mkdir(activeDir, { recursive: true });
    } catch {
      // Directory likely already exists
    }

    const date = new Date().toISOString().split('T')[0];
    const slug = sessionTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    const approvedItems = items.filter(i => i.status === 'approved' || i.status === 'created');
    const rejectedItems = items.filter(i => i.status === 'rejected');

    const affectedAgents = new Set<string>();
    items.forEach(item => {
      const agent = getAssignedAgent(item);
      if (agent !== 'unassigned') affectedAgents.add(agent);
    });

    const content = `# Decision: ${sessionTitle}

- **Date:** ${date}
- **Session:** ${sessionTitle} (${sessionId})
- **Decided By:** ${decidedBy.join(', ')}
- **Status:** active

## Summary
Boardroom session produced ${items.length} resolution items: ${approvedItems.length} approved, ${rejectedItems.length} rejected.

## Impact
- **Affected Agents:** ${[...affectedAgents].join(', ') || 'none'}
- **Affected Domains:** ${[...new Set(items.map(i => i.type))].join(', ')}

## Approved Items
${approvedItems.map(i => `- [${i.type}] ${getItemTitle(i)} — @${getAssignedAgent(i)}`).join('\n') || '- None'}

## Rejected Items
${rejectedItems.map(i => `- [${i.type}] ${getItemTitle(i)} — reason: user rejected`).join('\n') || '- None'}
`;

    const filename = `${date}_${slug}.md`;
    const filePath = await getSharedContextPath('decisions', 'active', filename);

    await writeTextFile(filePath, content);

    console.log(`[SharedContextFeedback] Wrote decision → decisions/active/${filename}`);
  } catch (err) {
    console.warn('[SharedContextFeedback] Failed to write decision file:', err);
  }
}
