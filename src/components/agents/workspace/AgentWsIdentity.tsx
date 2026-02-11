import { useState } from 'react';
import type { AgentFull, SoulProfile } from '../../../types/supabase';
import { useAgentStore } from '../../../stores/agents';
import { useAgentWorkspace } from '../../../hooks/useAgentWorkspace';
import { SoulDisplay } from '../SoulDisplay';
import { SoulEditor } from '../SoulEditor';
import { GuardrailConfig } from '../GuardrailConfig';

interface Props {
  agent: AgentFull;
}

export default function AgentWsIdentity({ agent }: Props) {
  const [editingSoul, setEditingSoul] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [identityDraft, setIdentityDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const updateAgentSoul = useAgentStore((s) => s.updateAgentSoul);
  const { identityMd, loading, writeFile, workspacePath, refresh } = useAgentWorkspace(agent.id);

  const handleSaveSoul = (soul: SoulProfile) => {
    updateAgentSoul(agent.id, soul);
    setEditingSoul(false);
    // Also write SOUL.md to OpenClaw workspace
    if (workspacePath) {
      const md = renderSoulToMarkdown(soul, agent);
      writeFile(`${workspacePath}/SOUL.md`, md).catch(console.error);
    }
  };

  const handleEditIdentity = () => {
    setIdentityDraft(identityMd);
    setEditingIdentity(true);
  };

  const handleSaveIdentity = async () => {
    if (!workspacePath) return;
    setSaving(true);
    try {
      await writeFile(`${workspacePath}/IDENTITY.md`, identityDraft);
      await refresh();
      setEditingIdentity(false);
    } catch (err) {
      console.error('Failed to save IDENTITY.md:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* SOUL Profile */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-300">SOUL Profile</h3>
          {!editingSoul && (
            <button
              onClick={() => setEditingSoul(true)}
              className="px-3 py-1 text-xs bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
        {editingSoul ? (
          <SoulEditor
            soul={agent.soul}
            agent={agent}
            onSave={handleSaveSoul}
            onCancel={() => setEditingSoul(false)}
          />
        ) : (
          <SoulDisplay soul={agent.soul} />
        )}
      </section>

      {/* IDENTITY.md */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-300">IDENTITY.md</h3>
          {!editingIdentity && (
            <button
              onClick={handleEditIdentity}
              className="px-3 py-1 text-xs bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : editingIdentity ? (
          <div className="space-y-3">
            <textarea
              value={identityDraft}
              onChange={(e) => setIdentityDraft(e.target.value)}
              className="w-full h-64 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-200 font-mono resize-y focus:outline-none focus:ring-1 focus:ring-amber-500"
              placeholder="# Agent Identity..."
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveIdentity}
                disabled={saving}
                className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save to OpenClaw'}
              </button>
              <button
                onClick={() => setEditingIdentity(false)}
                className="px-3 py-1.5 text-xs bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : identityMd ? (
          <pre className="text-sm text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed">
            {identityMd}
          </pre>
        ) : (
          <p className="text-sm text-zinc-600 italic">No IDENTITY.md found for this agent.</p>
        )}
      </section>

      {/* Communication Style Summary */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Communication Style</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Tone</p>
            <p className="text-sm text-zinc-300">{agent.soul.communicationStyle.tone}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Formality</p>
            <p className="text-sm text-zinc-300 capitalize">{agent.soul.communicationStyle.formality}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Verbosity</p>
            <p className="text-sm text-zinc-300 capitalize">{agent.soul.communicationStyle.verbosity}</p>
          </div>
        </div>
        {agent.soul.communicationStyle.quirks.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Quirks</p>
            <ul className="space-y-1">
              {agent.soul.communicationStyle.quirks.map((q, i) => (
                <li key={i} className="text-sm text-zinc-400">&bull; {q}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Guardrails */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Guardrails</h3>
        <GuardrailConfig agentId={agent.id} />
      </section>

      {/* Model/Provider */}
      <section className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Model Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Provider</p>
            <p className="text-sm text-zinc-200">{agent.provider}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Model</p>
            <p className="text-sm text-zinc-200">{agent.model}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

// Simple SOUL → Markdown renderer
function renderSoulToMarkdown(soul: SoulProfile, agent: AgentFull): string {
  const lines: string[] = [];
  lines.push(`# ${agent.name} - SOUL Profile\n`);
  lines.push(`## Origin\n${soul.origin}\n`);

  if (soul.philosophy.length) {
    lines.push(`## Philosophy`);
    soul.philosophy.forEach((p) => lines.push(`- ${p}`));
    lines.push('');
  }

  if (soul.inspirations.length) {
    lines.push(`## Inspirations`);
    soul.inspirations.forEach((i) => lines.push(`- **${i.name}**: ${i.relationship}`));
    lines.push('');
  }

  lines.push(`## Communication Style`);
  lines.push(`- **Tone**: ${soul.communicationStyle.tone}`);
  lines.push(`- **Formality**: ${soul.communicationStyle.formality}`);
  lines.push(`- **Verbosity**: ${soul.communicationStyle.verbosity}`);
  if (soul.communicationStyle.quirks.length) {
    lines.push(`- **Quirks**:`);
    soul.communicationStyle.quirks.forEach((q) => lines.push(`  - ${q}`));
  }
  lines.push('');

  if (soul.neverDos.length) {
    lines.push(`## Hard Constraints`);
    soul.neverDos.forEach((n) => lines.push(`- ${n}`));
    lines.push('');
  }

  if (soul.preferredWorkflows.length) {
    lines.push(`## Preferred Workflows`);
    soul.preferredWorkflows.forEach((w) => lines.push(`- ${w}`));
    lines.push('');
  }

  if (soul.additionalNotes) {
    lines.push(`## Additional Notes\n${soul.additionalNotes}\n`);
  }

  return lines.join('\n');
}
