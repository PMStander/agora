import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useDocumentCenterStore } from '../stores/documentCenter';
import { useAgentStore } from '../stores/agents';
import type { CrmDocument } from '../types/documents';
import type { ContextDocument } from '../types/context';
import type { Mission } from '../types/supabase';
import type { BoardroomSession } from '../types/boardroom';
import type {
  DocumentCenterItem,
  DocumentCategory,
  DocumentCenterStatus,
  DocumentContributor,
  LinkedEntity,
} from '../types/documentCenter';

// ─── Mappers ────────────────────────────────────────────────────────────────

function crmDocCategory(docType: string): DocumentCategory {
  if (['contract', 'nda', 'sow', 'proposal'].includes(docType)) return 'contracts';
  return 'files';
}

function crmDocStatus(status: string): DocumentCenterStatus {
  if (status === 'active') return 'active';
  if (status === 'archived') return 'archived';
  if (status === 'expired') return 'archived';
  return 'active';
}

function mapCrmDocument(doc: CrmDocument): DocumentCenterItem {
  const linked: LinkedEntity[] = [];
  if (doc.contact_id) linked.push({ type: 'contact', id: doc.contact_id, label: 'Contact' });
  if (doc.company_id) linked.push({ type: 'company', id: doc.company_id, label: 'Company' });
  if (doc.deal_id) linked.push({ type: 'deal', id: doc.deal_id, label: 'Deal' });
  if (doc.project_id) linked.push({ type: 'project', id: doc.project_id, label: 'Project' });
  if (doc.quote_id) linked.push({ type: 'quote', id: doc.quote_id, label: 'Quote' });
  if (doc.invoice_id) linked.push({ type: 'invoice', id: doc.invoice_id, label: 'Invoice' });

  const contributors: DocumentContributor[] = [];
  if (doc.owner_agent_id) {
    contributors.push({ agentId: doc.owner_agent_id, role: 'owner', lastContributedAt: doc.updated_at });
  }

  return {
    id: doc.id,
    source: 'crm_document',
    sourceId: doc.id,
    title: doc.title,
    contentPreview: doc.description?.slice(0, 200) ?? doc.file_name,
    contentType: 'file',
    category: crmDocCategory(doc.doc_type),
    status: crmDocStatus(doc.status),
    version: doc.version,
    fileSize: doc.file_size,
    mimeType: doc.mime_type,
    storagePath: doc.storage_path,
    contributors,
    linkedEntities: linked,
    requiresApproval: false,
    approvalData: null,
    tags: doc.tags ?? [],
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

interface ContextDocWithProject extends ContextDocument {
  project_contexts?: { project_id: string; title: string } | null;
}

function contextDocCategory(docType: string): DocumentCategory {
  if (docType === 'decision_log') return 'decisions';
  return 'prds';
}

function mapContextDocument(doc: ContextDocWithProject): DocumentCenterItem {
  const linked: LinkedEntity[] = [];
  if (doc.project_contexts?.project_id) {
    linked.push({
      type: 'project',
      id: doc.project_contexts.project_id,
      label: doc.project_contexts.title || 'Project',
    });
  }

  const contributors: DocumentContributor[] = [];
  if (doc.last_updated_by_agent_id) {
    contributors.push({
      agentId: doc.last_updated_by_agent_id,
      role: 'editor',
      lastContributedAt: doc.updated_at,
    });
  }

  return {
    id: doc.id,
    source: 'context_document',
    sourceId: doc.id,
    title: doc.title,
    contentPreview: doc.content?.slice(0, 200) ?? '',
    contentType: 'markdown',
    category: contextDocCategory(doc.doc_type),
    status: 'active',
    version: doc.version,
    fileSize: null,
    mimeType: null,
    storagePath: null,
    contributors,
    linkedEntities: linked,
    requiresApproval: false,
    approvalData: null,
    tags: [],
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

function missionDocStatus(mission: Mission, phase: 'statement' | 'plan'): DocumentCenterStatus {
  // If the mission is currently on this phase and awaiting approval
  if (mission.mission_phase === phase && mission.mission_phase_status === 'awaiting_approval') {
    return 'awaiting_approval';
  }
  // If approved or past this phase
  if (mission.mission_phase_status === 'approved') return 'approved';
  if (phase === 'statement' && (mission.mission_phase === 'plan' || mission.mission_phase === 'tasks')) {
    return 'approved';
  }
  if (phase === 'plan' && mission.mission_phase === 'tasks') return 'approved';
  return 'draft';
}

function mapMissionStatement(mission: Mission): DocumentCenterItem {
  const status = missionDocStatus(mission, 'statement');
  const contributors: DocumentContributor[] = [];
  if (mission.agent_id) {
    contributors.push({ agentId: mission.agent_id, role: 'owner', lastContributedAt: mission.updated_at });
  }
  if (mission.review_agent_id) {
    contributors.push({ agentId: mission.review_agent_id, role: 'reviewer', lastContributedAt: null });
  }

  return {
    id: `${mission.id}:statement`,
    source: 'mission_statement',
    sourceId: mission.id,
    title: `${mission.title} — Statement`,
    contentPreview: mission.mission_statement?.slice(0, 200) ?? '',
    contentType: 'markdown',
    category: 'mission_docs',
    status,
    version: null,
    fileSize: null,
    mimeType: null,
    storagePath: null,
    contributors,
    linkedEntities: [{ type: 'mission', id: mission.id, label: mission.title }],
    requiresApproval: status === 'awaiting_approval',
    approvalData: {
      phase: 'statement',
      phaseStatus: mission.mission_phase_status,
      reviewAgentId: mission.review_agent_id,
      reviewNotes: mission.review_notes,
    },
    tags: mission.domains ?? [],
    createdAt: mission.created_at,
    updatedAt: mission.updated_at,
  };
}

function mapMissionPlan(mission: Mission): DocumentCenterItem {
  const status = missionDocStatus(mission, 'plan');
  const contributors: DocumentContributor[] = [];
  if (mission.agent_id) {
    contributors.push({ agentId: mission.agent_id, role: 'owner', lastContributedAt: mission.updated_at });
  }
  if (mission.review_agent_id) {
    contributors.push({ agentId: mission.review_agent_id, role: 'reviewer', lastContributedAt: null });
  }

  return {
    id: `${mission.id}:plan`,
    source: 'mission_plan',
    sourceId: mission.id,
    title: `${mission.title} — Plan`,
    contentPreview: mission.mission_plan?.slice(0, 200) ?? '',
    contentType: 'markdown',
    category: 'mission_docs',
    status,
    version: null,
    fileSize: null,
    mimeType: null,
    storagePath: null,
    contributors,
    linkedEntities: [{ type: 'mission', id: mission.id, label: mission.title }],
    requiresApproval: status === 'awaiting_approval',
    approvalData: {
      phase: 'plan',
      phaseStatus: mission.mission_phase_status,
      reviewAgentId: mission.review_agent_id,
      reviewNotes: mission.review_notes,
    },
    tags: mission.domains ?? [],
    createdAt: mission.created_at,
    updatedAt: mission.updated_at,
  };
}

function mapBoardroomSession(session: BoardroomSession): DocumentCenterItem {
  const contributors: DocumentContributor[] = session.participant_agent_ids.map((agentId) => ({
    agentId,
    role: 'participant' as const,
    lastContributedAt: session.ended_at,
  }));
  if (session.created_by && session.created_by !== 'user') {
    const existing = contributors.find((c) => c.agentId === session.created_by);
    if (existing) existing.role = 'owner';
    else contributors.unshift({ agentId: session.created_by, role: 'owner', lastContributedAt: session.created_at });
  }

  return {
    id: session.id,
    source: 'boardroom_minutes',
    sourceId: session.id,
    title: `${session.title} — Minutes`,
    contentPreview: session.topic?.slice(0, 200) ?? '',
    contentType: 'synthesized',
    category: 'meeting_minutes',
    status: 'closed',
    version: null,
    fileSize: null,
    mimeType: null,
    storagePath: null,
    contributors,
    linkedEntities: [{ type: 'boardroom_session', id: session.id, label: session.title }],
    requiresApproval: false,
    approvalData: null,
    tags: [session.session_type],
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  };
}

// ─── Sort ───────────────────────────────────────────────────────────────────

function sortDocuments(docs: DocumentCenterItem[], sort: string): DocumentCenterItem[] {
  const sorted = [...docs];
  switch (sort) {
    case 'oldest':
      return sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case 'recently_updated':
      return sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case 'title_asc':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'title_desc':
      return sorted.sort((a, b) => b.title.localeCompare(a.title));
    case 'newest':
    default:
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useDocumentCenter() {
  const [allDocuments, setAllDocuments] = useState<DocumentCenterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const filters = useDocumentCenterStore((s) => s.filters);
  const allAgents = useAgentStore((s) => s.teams).flatMap((t) => t.agents);

  // ── Fetch all sources in parallel ─────────────────────────────────────

  useEffect(() => {
    if (!isSupabaseConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    const fetchAll = async () => {
      setLoading(true);

      try {
        const [crmRes, ctxRes, missionRes, boardroomRes] = await Promise.all([
          supabase.from('crm_documents').select('*').order('created_at', { ascending: false }).limit(300),
          supabase.from('context_documents').select('*, project_contexts(project_id, title)').order('updated_at', { ascending: false }).limit(300),
          supabase.from('missions').select('*').or('mission_statement.not.is.null,mission_plan.not.is.null').order('created_at', { ascending: false }).limit(300),
          supabase.from('boardroom_sessions').select('*').eq('status', 'closed').order('created_at', { ascending: false }).limit(100),
        ]);

        const docs: DocumentCenterItem[] = [];

        // CRM Documents
        if (crmRes.data) {
          for (const row of crmRes.data) docs.push(mapCrmDocument(row as CrmDocument));
        }

        // Context Documents
        if (ctxRes.data) {
          for (const row of ctxRes.data) docs.push(mapContextDocument(row as ContextDocWithProject));
        }

        // Mission Statements & Plans
        if (missionRes.data) {
          for (const row of missionRes.data) {
            const mission = row as Mission;
            if (mission.mission_statement) docs.push(mapMissionStatement(mission));
            if (mission.mission_plan) docs.push(mapMissionPlan(mission));
          }
        }

        // Boardroom Minutes
        if (boardroomRes.data) {
          for (const row of boardroomRes.data) docs.push(mapBoardroomSession(row as BoardroomSession));
        }

        setAllDocuments(docs);
      } catch (err) {
        console.error('[DocumentCenter] fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  // ── Realtime subscriptions ────────────────────────────────────────────

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = supabase
      .channel('document-center-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_documents' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const doc = mapCrmDocument(payload.new as CrmDocument);
          setAllDocuments((prev) => {
            const idx = prev.findIndex((d) => d.id === doc.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = doc; return next; }
            return [doc, ...prev];
          });
        } else if (payload.eventType === 'DELETE' && payload.old?.id) {
          setAllDocuments((prev) => prev.filter((d) => d.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'context_documents' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const doc = mapContextDocument(payload.new as ContextDocWithProject);
          setAllDocuments((prev) => {
            const idx = prev.findIndex((d) => d.id === doc.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = doc; return next; }
            return [doc, ...prev];
          });
        } else if (payload.eventType === 'DELETE' && payload.old?.id) {
          setAllDocuments((prev) => prev.filter((d) => d.id !== payload.old.id));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const mission = payload.new as Mission;
          setAllDocuments((prev) => {
            let next = prev.filter((d) => d.sourceId !== mission.id || (d.source !== 'mission_statement' && d.source !== 'mission_plan'));
            if (mission.mission_statement) next = [mapMissionStatement(mission), ...next];
            if (mission.mission_plan) next = [mapMissionPlan(mission), ...next];
            return next;
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'boardroom_sessions' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const session = payload.new as BoardroomSession;
          if (session.status === 'closed') {
            const doc = mapBoardroomSession(session);
            setAllDocuments((prev) => {
              const idx = prev.findIndex((d) => d.id === doc.id);
              if (idx >= 0) { const next = [...prev]; next[idx] = doc; return next; }
              return [doc, ...prev];
            });
          }
        }
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, []);

  // ── Client-side filtering ─────────────────────────────────────────────

  const filteredDocuments = useMemo(() => {
    let docs = allDocuments;

    if (filters.category !== 'all') {
      docs = docs.filter((d) => d.category === filters.category);
    }
    if (filters.status !== 'all') {
      docs = docs.filter((d) => d.status === filters.status);
    }
    if (filters.agentId) {
      const aid = filters.agentId;
      docs = docs.filter((d) => d.contributors.some((c) => c.agentId === aid));
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.contentPreview.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return sortDocuments(docs, filters.sort);
  }, [allDocuments, filters]);

  // ── Actions ───────────────────────────────────────────────────────────

  const approveDocument = useCallback(async (item: DocumentCenterItem) => {
    if (item.source !== 'mission_statement' && item.source !== 'mission_plan') return;
    const missionId = item.sourceId;

    const updates: Record<string, string> = { mission_phase_status: 'approved' };
    // Advance phase if appropriate
    if (item.approvalData?.phase === 'statement') {
      updates.mission_phase = 'plan';
      updates.mission_phase_status = 'draft'; // plan starts as draft
    }

    const { error } = await supabase.from('missions').update(updates).eq('id', missionId);
    if (error) {
      console.error('[DocumentCenter] approve error:', error);
    }
  }, []);

  const rejectDocument = useCallback(async (item: DocumentCenterItem, notes: string) => {
    if (item.source !== 'mission_statement' && item.source !== 'mission_plan') return;

    const { error } = await supabase
      .from('missions')
      .update({ mission_phase_status: 'draft', review_notes: notes })
      .eq('id', item.sourceId);

    if (error) {
      console.error('[DocumentCenter] reject error:', error);
    }
  }, []);

  const fetchFullContent = useCallback(async (item: DocumentCenterItem): Promise<string> => {
    switch (item.source) {
      case 'crm_document': {
        if (!item.storagePath) return 'No file available';
        const { data } = await supabase.storage.from('crm-documents').createSignedUrl(item.storagePath, 60);
        return data?.signedUrl ?? 'Could not generate download URL';
      }
      case 'context_document': {
        const { data } = await supabase.from('context_documents').select('content').eq('id', item.sourceId).single();
        return data?.content ?? '';
      }
      case 'mission_statement': {
        const { data } = await supabase.from('missions').select('mission_statement').eq('id', item.sourceId).single();
        return data?.mission_statement ?? '';
      }
      case 'mission_plan': {
        const { data } = await supabase.from('missions').select('mission_plan').eq('id', item.sourceId).single();
        return data?.mission_plan ?? '';
      }
      case 'boardroom_minutes': {
        const { data: messages } = await supabase
          .from('boardroom_messages')
          .select('agent_id, content, turn_number, created_at')
          .eq('session_id', item.sourceId)
          .order('turn_number', { ascending: true });

        if (!messages?.length) return 'No messages recorded.';

        return messages.map((m: { agent_id: string; content: string; turn_number: number }) => {
          const agent = allAgents.find((a) => a.id === m.agent_id);
          const name = agent ? `${agent.emoji} ${agent.name}` : m.agent_id;
          return `**${name}** (Turn ${m.turn_number}):\n${m.content}`;
        }).join('\n\n---\n\n');
      }
      default:
        return '';
    }
  }, [allAgents]);

  // ── Return ────────────────────────────────────────────────────────────

  return {
    documents: filteredDocuments,
    allDocuments,
    loading,
    approveDocument,
    rejectDocument,
    fetchFullContent,
    counts: {
      total: allDocuments.length,
      awaitingApproval: allDocuments.filter((d) => d.status === 'awaiting_approval').length,
    },
  };
}
