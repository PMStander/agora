import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAgentStore } from '../stores/agents';
import type { AgentFull, AgentLifecycleStatus, SoulProfile } from '../types/supabase';

/**
 * Hook wrapping the hiring wizard store with Supabase CRUD operations.
 */
export function useAgentHiring() {
  const { addAgent, updateAgentSoul, setAgentLifecycleStatus } = useAgentStore();

  const createAgent = useCallback(async (agent: AgentFull) => {
    // Insert into Supabase agents table
    const { error } = await supabase.from('agents').insert({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      team: agent.team,
      avatar_url: agent.avatar,
      emoji: agent.emoji,
      soul: agent.soul as unknown as Record<string, unknown>,
      lifecycle_status: agent.lifecycleStatus,
      skills: agent.skills,
      provider: agent.provider,
      model: agent.model,
      hired_at: agent.hiredAt,
      onboarded_at: agent.onboardedAt,
      onboarding_checklist: agent.onboardingChecklist as unknown as Record<string, unknown>[],
      created_by: agent.createdBy,
      soul_version: agent.soulVersion,
      domains: agent.domains.map((d) => d.domain),
    });

    if (error) {
      console.error('Failed to create agent in DB:', error);
    }

    // Insert initial soul history entry
    await supabase.from('agent_soul_history').insert({
      agent_id: agent.id,
      version: 1,
      soul: agent.soul as unknown as Record<string, unknown>,
      changed_by: 'user',
      change_reason: 'Initial SOUL created during hiring',
    });

    // Add to local store
    addAgent(agent);
  }, [addAgent]);

  const updateSoul = useCallback(async (agentId: string, soul: SoulProfile) => {
    const profiles = useAgentStore.getState().agentProfiles;
    const existing = profiles[agentId];
    if (!existing) return;

    const newVersion = existing.soulVersion + 1;

    const { error } = await supabase
      .from('agents')
      .update({
        soul: soul as unknown as Record<string, unknown>,
        soul_version: newVersion,
      })
      .eq('id', agentId);

    if (error) {
      console.error('Failed to update soul in DB:', error);
    }

    await supabase.from('agent_soul_history').insert({
      agent_id: agentId,
      version: newVersion,
      soul: soul as unknown as Record<string, unknown>,
      changed_by: 'user',
      change_reason: 'SOUL updated via editor',
    });

    updateAgentSoul(agentId, soul);
  }, [updateAgentSoul]);

  const changeLifecycleStatus = useCallback(async (agentId: string, status: AgentLifecycleStatus) => {
    const updates: Record<string, unknown> = { lifecycle_status: status };
    if (status === 'retired') updates.retired_at = new Date().toISOString();
    if (status === 'active') updates.onboarded_at = new Date().toISOString();

    const { error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', agentId);

    if (error) {
      console.error('Failed to update lifecycle status in DB:', error);
    }

    setAgentLifecycleStatus(agentId, status);
  }, [setAgentLifecycleStatus]);

  const getAgentProfile = useCallback(async (agentId: string): Promise<AgentFull | null> => {
    const profiles = useAgentStore.getState().agentProfiles;
    return profiles[agentId] ?? null;
  }, []);

  const listAgentsByStatus = useCallback((status: AgentLifecycleStatus): AgentFull[] => {
    const profiles = useAgentStore.getState().agentProfiles;
    return Object.values(profiles).filter((a) => a.lifecycleStatus === status);
  }, []);

  return {
    createAgent,
    updateSoul,
    changeLifecycleStatus,
    getAgentProfile,
    listAgentsByStatus,
  };
}
