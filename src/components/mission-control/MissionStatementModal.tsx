import { useMemo, useRef, useState } from 'react';
import { runAgentPrompt } from '../../lib/agentRun';
import { useMissionControl } from '../../hooks/useMissionControl';
import { useMissionControlStore } from '../../stores/missionControl';
import type { MediaAttachment, MissionPriority } from '../../types/supabase';

type StatementStatus =
  | 'idle'
  | 'drafting'
  | 'awaiting_approval'
  | 'decomposing'
  | 'done'
  | 'failed';

interface MissionStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MissionBlueprint {
  title: string;
  instructions: string;
  agent_id: string;
  priority?: MissionPriority;
  review_enabled?: boolean;
  review_agent_id?: string | null;
  max_revisions?: number;
  due_at?: string | null;
  due_offset_minutes?: number | null;
  domains?: string[];
  include_statement_media?: boolean;
}

const MAIN_AGENT_ID = 'main';

function parseJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text.match(/\{[\s\S]*\}/)?.[0]].filter(
    (value): value is string => Boolean(value)
  );
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      return parsed;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function parseBlueprints(raw: string): MissionBlueprint[] {
  const parsed = parseJsonObject(raw);
  if (!parsed) return [];
  const missions = Array.isArray(parsed.missions) ? parsed.missions : [];
  return missions
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      title: String(entry.title || '').trim(),
      instructions: String(entry.instructions || '').trim(),
      agent_id: String(entry.agent_id || '').trim(),
      priority: typeof entry.priority === 'string' ? entry.priority as MissionPriority : 'medium',
      review_enabled: entry.review_enabled === true,
      review_agent_id: typeof entry.review_agent_id === 'string' ? entry.review_agent_id : null,
      max_revisions: typeof entry.max_revisions === 'number' ? entry.max_revisions : 1,
      due_at: typeof entry.due_at === 'string' ? entry.due_at : null,
      due_offset_minutes: typeof entry.due_offset_minutes === 'number' ? entry.due_offset_minutes : 0,
      domains: Array.isArray(entry.domains) ? entry.domains.map((value) => String(value)) : [],
      include_statement_media: entry.include_statement_media !== false,
    }))
    .filter((entry) => entry.title.length > 0 && entry.instructions.length > 0 && entry.agent_id.length > 0);
}

function toDueAt(blueprint: MissionBlueprint): string {
  if (blueprint.due_at) {
    const parsed = Date.parse(blueprint.due_at);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  const offset = blueprint.due_offset_minutes ?? 0;
  return new Date(Date.now() + offset * 60_000).toISOString();
}

function buildAgentConsultPrompt(userRequest: string): string {
  return [
    'You are contributing specialist insight for a mission statement draft.',
    'Provide short, practical recommendations only.',
    '',
    `User request:\n${userRequest}`,
    '',
    'Output format:',
    '- Key objectives (3-5 bullets)',
    '- Risks & constraints (3-5 bullets)',
    '- Recommended execution checkpoints (3-6 bullets)',
  ].join('\n');
}

function buildMainDraftPrompt(userRequest: string, collaboratorNotes: string): string {
  return [
    'Create a detailed mission statement draft for execution.',
    'Use explicit, measurable criteria and concrete scope boundaries.',
    '',
    `User request:\n${userRequest}`,
    '',
    'Specialist collaborator notes:',
    collaboratorNotes || '(none)',
    '',
    'Return markdown with these exact sections:',
    '1. Mission Name',
    '2. Objective',
    '3. Success Criteria',
    '4. Scope In',
    '5. Scope Out',
    '6. Constraints and Risks',
    '7. Required Inputs and Media',
    '8. Agent Allocation Strategy (agent id + rationale)',
    '9. Decomposition Strategy (ordered checkpoints)',
  ].join('\n');
}

function buildRevisionPrompt(currentDraft: string, feedback: string): string {
  return [
    'Revise the mission statement draft using user feedback.',
    'Keep the same section structure and improve precision.',
    '',
    `Current draft:\n${currentDraft}`,
    '',
    `User feedback:\n${feedback}`,
    '',
    'Return the full revised draft in markdown.',
  ].join('\n');
}

function buildDecompositionPrompt(
  statementDraft: string,
  allowedAgentIds: string[],
  reviewerHint: string
): string {
  return [
    'Decompose the approved mission statement into executable missions.',
    'Create 3 to 10 missions with clear ownership and deadlines.',
    '',
    `Approved mission statement:\n${statementDraft}`,
    '',
    `Allowed agent IDs: ${allowedAgentIds.join(', ')}`,
    `Preferred reviewer for quality gates: ${reviewerHint}`,
    '',
    'Respond ONLY as JSON in this exact shape:',
    '{"missions":[{"title":"...", "instructions":"...", "agent_id":"...", "priority":"low|medium|high|urgent", "review_enabled":true|false, "review_agent_id":"...", "max_revisions":1, "due_offset_minutes":15, "domains":["..."], "include_statement_media":true}]}',
    '',
    'Rules:',
    '- Use only allowed agent ids.',
    '- Keep instructions actionable and self-contained.',
    '- Set review_enabled=true on high-risk missions.',
    '- due_offset_minutes should represent staggered launch order from now.',
  ].join('\n');
}

export function MissionStatementModal({ isOpen, onClose }: MissionStatementModalProps) {
  const { createMission, agents } = useMissionControl();
  const addActivity = useMissionControlStore((s) => s.addActivity);
  const requestSchedulerTick = useMissionControlStore((s) => s.requestSchedulerTick);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [requestText, setRequestText] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [statementMedia, setStatementMedia] = useState<MediaAttachment[]>([]);
  const [status, setStatus] = useState<StatementStatus>('idle');
  const [draftText, setDraftText] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createdMissionTitles, setCreatedMissionTitles] = useState<string[]>([]);
  const [lastBlueprints, setLastBlueprints] = useState<MissionBlueprint[]>([]);

  const collaboratorAgents = useMemo(
    () => agents.filter((agent: { id: string }) => agent.id !== MAIN_AGENT_ID),
    [agents]
  );

  if (!isOpen) return null;

  const resetState = () => {
    setRequestText('');
    setSelectedAgents([]);
    setStatementMedia([]);
    setStatus('idle');
    setDraftText('');
    setFeedbackText('');
    setError(null);
    setCreatedMissionTitles([]);
    setLastBlueprints([]);
  };

  const closeModal = () => {
    resetState();
    onClose();
  };

  const toggleAgent = (agentId: string) => {
    setSelectedAgents((current) =>
      current.includes(agentId)
        ? current.filter((id) => id !== agentId)
        : [...current, agentId]
    );
  };

  const handleAttachMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newMedia = Array.from(files).map((file) => ({
      url: URL.createObjectURL(file),
      type: file.type,
      name: file.name,
    }));
    setStatementMedia((current) => [...current, ...newMedia]);
  };

  const removeMedia = (index: number) => {
    setStatementMedia((current) => current.filter((_, i) => i !== index));
  };

  const generateDraft = async () => {
    if (!requestText.trim()) return;
    setStatus('drafting');
    setError(null);
    setDraftText('');
    setCreatedMissionTitles([]);
    setLastBlueprints([]);
    addActivity({
      id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'statement_drafting',
      message: 'Mission statement drafting started',
      agent: { id: MAIN_AGENT_ID, name: 'Marcus Aurelius', emoji: '🏛️' },
      created_at: new Date().toISOString(),
    });

    try {
      const collaboratorResults = await Promise.allSettled(
        selectedAgents.map(async (agentId) => {
          const response = await runAgentPrompt(
            agentId,
            buildAgentConsultPrompt(requestText),
            { sessionNamespace: 'mission-statement-consult' }
          );
          return { agentId, text: response.text };
        })
      );

      const collaboratorNotes = collaboratorResults
        .map((result) => {
          if (result.status === 'rejected') return '';
          return `Agent ${result.value.agentId}:\n${result.value.text}`;
        })
        .filter(Boolean)
        .join('\n\n');

      const draft = await runAgentPrompt(
        MAIN_AGENT_ID,
        buildMainDraftPrompt(requestText, collaboratorNotes),
        {
          sessionNamespace: 'mission-statement',
          onDelta: setDraftText,
        }
      );
      setDraftText(draft.text);
      setStatus('awaiting_approval');
      addActivity({
        id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'statement_ready',
        message: 'Mission statement draft ready for approval',
        agent: { id: MAIN_AGENT_ID, name: 'Marcus Aurelius', emoji: '🏛️' },
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      setStatus('failed');
      setError(String(err));
    }
  };

  const reviseDraft = async () => {
    if (!draftText.trim() || !feedbackText.trim()) return;
    setStatus('drafting');
    setError(null);
    try {
      const revised = await runAgentPrompt(
        MAIN_AGENT_ID,
        buildRevisionPrompt(draftText, feedbackText),
        {
          sessionNamespace: 'mission-statement',
          onDelta: setDraftText,
        }
      );
      setDraftText(revised.text);
      setStatus('awaiting_approval');
      addActivity({
        id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'statement_revised',
        message: 'Mission statement draft revised',
        agent: { id: MAIN_AGENT_ID, name: 'Marcus Aurelius', emoji: '🏛️' },
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      setStatus('failed');
      setError(String(err));
    }
  };

  const approveAndCreateMissions = async () => {
    if (!draftText.trim()) return;
    setStatus('decomposing');
    setError(null);
    setCreatedMissionTitles([]);
    try {
      const decomposition = await runAgentPrompt(
        MAIN_AGENT_ID,
        buildDecompositionPrompt(
          draftText,
          agents.map((agent: { id: string }) => agent.id),
          selectedAgents[0] || 'leonidas'
        ),
        { sessionNamespace: 'mission-statement' }
      );

      const blueprints = parseBlueprints(decomposition.text);
      setLastBlueprints(blueprints);
      if (blueprints.length === 0) {
        throw new Error('Decomposition returned no valid missions.');
      }

      const createdTitles: string[] = [];
      for (const blueprint of blueprints) {
        const mission = await createMission({
          title: blueprint.title,
          description: blueprint.instructions,
          input_text: blueprint.instructions,
          input_media: blueprint.include_statement_media === false ? [] : statementMedia,
          agent_id: blueprint.agent_id,
          priority: blueprint.priority || 'medium',
          status: 'assigned',
          mission_status: 'assigned',
          scheduled_at: toDueAt(blueprint),
          review_enabled: blueprint.review_enabled || false,
          review_agent_id: blueprint.review_enabled
            ? (blueprint.review_agent_id || selectedAgents[0] || MAIN_AGENT_ID)
            : null,
          max_revisions: blueprint.review_enabled
            ? Math.max(1, blueprint.max_revisions || 1)
            : 1,
          domains: blueprint.domains || [],
          mission_statement: draftText,
          mission_phase: 'tasks',
          mission_phase_status: 'approved',
        });
        if (mission) createdTitles.push(blueprint.title);
      }

      requestSchedulerTick();
      setCreatedMissionTitles(createdTitles);
      setStatus('done');
      addActivity({
        id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'statement_decomposed',
        message: `Mission statement approved and decomposed into ${createdTitles.length} missions`,
        agent: { id: MAIN_AGENT_ID, name: 'Marcus Aurelius', emoji: '🏛️' },
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      setStatus('failed');
      setError(String(err));
    }
  };

  const isBusy = status === 'drafting' || status === 'decomposing';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && !isBusy && closeModal()}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Mission Statement Lab</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Draft with multiple agents, approve, then auto-decompose into missions.
            </p>
          </div>
          <button
            onClick={closeModal}
            disabled={isBusy}
            className="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">What outcome do you want?</label>
            <textarea
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
              rows={4}
              placeholder="Describe the outcome, constraints, timeline, and non-negotiables."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 resize-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">Collaborating Agents (parallel input)</label>
            <div className="flex flex-wrap gap-2">
              {collaboratorAgents.map((agent: { id: string; name: string; emoji: string }) => {
                const selected = selectedAgents.includes(agent.id);
                return (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => toggleAgent(agent.id)}
                    className={`
                      px-2.5 py-1.5 text-xs rounded-full border transition-colors flex items-center gap-1
                      ${selected
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}
                    `}
                  >
                    <span>{agent.emoji}</span>
                    {agent.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Optional Statement Media</label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleAttachMedia}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 border-dashed rounded-lg text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
            >
              📎 Attach media/context
            </button>
            {statementMedia.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {statementMedia.map((media, index) => (
                  <div
                    key={`${media.name}-${index}`}
                    className="flex items-center gap-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300"
                  >
                    <span className="truncate max-w-[150px]">{media.name}</span>
                    <button
                      type="button"
                      onClick={() => removeMedia(index)}
                      className="text-zinc-500 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="text-xs text-zinc-500 uppercase tracking-wide">Status</div>
            <div className="text-sm text-zinc-200 mt-1">
              {status === 'idle' && 'Ready'}
              {status === 'drafting' && 'Drafting mission statement...'}
              {status === 'awaiting_approval' && 'Draft ready for your review'}
              {status === 'decomposing' && 'Decomposing into executable missions...'}
              {status === 'done' && `Done. Created ${createdMissionTitles.length} missions.`}
              {status === 'failed' && 'Failed'}
            </div>
            {error && (
              <div className="text-xs text-red-300 mt-2 bg-red-500/10 border border-red-500/30 rounded p-2">
                {error}
              </div>
            )}
          </div>

          {draftText && (
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Mission Statement Draft</label>
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={14}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 resize-y text-sm font-mono"
              />
            </div>
          )}

          {status === 'awaiting_approval' && (
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Feedback for Revision</label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={3}
                placeholder="Describe what to change before approval."
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 resize-none text-sm"
              />
            </div>
          )}

          {lastBlueprints.length > 0 && (
            <div className="rounded-lg border border-zinc-800 p-3 space-y-1">
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Latest Decomposition Preview</div>
              {lastBlueprints.map((item, index) => (
                <div key={`${item.title}-${index}`} className="text-xs text-zinc-300">
                  {index + 1}. {item.title} → {item.agent_id}
                </div>
              ))}
            </div>
          )}

          {createdMissionTitles.length > 0 && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <div className="text-xs text-emerald-300 uppercase tracking-wide mb-1">Created Missions</div>
              {createdMissionTitles.map((title) => (
                <div key={title} className="text-sm text-emerald-100">
                  • {title}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center px-6 py-4 border-t border-zinc-800">
          <button
            type="button"
            onClick={closeModal}
            disabled={isBusy}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {status === 'awaiting_approval' && (
              <button
                type="button"
                onClick={reviseDraft}
                disabled={!feedbackText.trim() || isBusy}
                className="px-4 py-2 text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:border-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Revise Draft
              </button>
            )}
            {status === 'awaiting_approval' && (
              <button
                type="button"
                onClick={approveAndCreateMissions}
                disabled={isBusy}
                className="px-4 py-2 text-sm bg-emerald-500 text-black font-medium rounded-lg hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve and Create Missions
              </button>
            )}
            {(status === 'idle' || status === 'failed' || (status === 'done' && !isBusy)) && (
              <button
                type="button"
                onClick={generateDraft}
                disabled={!requestText.trim() || isBusy}
                className="px-4 py-2 text-sm bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate Mission Statement
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
