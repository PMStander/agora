import { supabase, isSupabaseConfigured } from './supabase';
import { generateProofReport, appendProofToOutput } from './proofGenerator';
import { useMissionControlStore } from '../stores/missionControl';
import type { Mission } from '../types/supabase';

/**
 * Add proof reports to completed missions that are missing them.
 * This is a one-time utility for fixing existing completed missions.
 */
export async function addRetroactiveProof(missionId: string): Promise<boolean> {
  const store = useMissionControlStore.getState();
  const mission = store.missions.find((m) => m.id === missionId);

  if (!mission) {
    console.error(`[RetroactiveProof] Mission ${missionId} not found`);
    return false;
  }

  if (mission.status !== 'done' && mission.status !== 'failed') {
    console.error(`[RetroactiveProof] Mission ${missionId} is not completed (status: ${mission.status})`);
    return false;
  }

  const outputText = mission.output_text || '';

  // Check if proof already exists
  if (outputText.includes('```json') && outputText.includes('"result"')) {
    console.log(`[RetroactiveProof] Mission ${missionId} already has proof`);
    return true;
  }

  // Find the task that corresponds to this mission
  const task = store.tasks.find((t) => t.id === missionId);
  if (!task) {
    console.error(`[RetroactiveProof] Task ${missionId} not found`);
    return false;
  }

  try {
    console.log(`[RetroactiveProof] Generating proof for mission: ${mission.title}`);

    const proofReport = await generateProofReport(task, outputText);
    const finalOutput = appendProofToOutput(outputText, proofReport);

    const now = new Date().toISOString();
    const updates: Partial<Mission> = {
      output_text: finalOutput,
      updated_at: now,
    };

    // Update in local store
    store.updateMission(missionId, updates);

    // Update in Supabase if configured
    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('missions')
        .update(updates)
        .eq('id', missionId);

      if (error) {
        console.error(`[RetroactiveProof] Failed to update mission in Supabase:`, error);
        return false;
      }
    }

    console.log(`[RetroactiveProof] Successfully added proof to mission: ${mission.title}`);
    return true;
  } catch (error) {
    console.error(`[RetroactiveProof] Failed to generate proof:`, error);
    return false;
  }
}

/**
 * Add proof to all completed missions that are missing it.
 */
export async function addRetroactiveProofToAll(): Promise<{ success: number; failed: number }> {
  const store = useMissionControlStore.getState();
  const completedMissions = store.missions.filter(
    (m) => (m.status === 'done' || m.status === 'failed')
  );

  let success = 0;
  let failed = 0;

  console.log(`[RetroactiveProof] Found ${completedMissions.length} completed missions`);

  for (const mission of completedMissions) {
    const result = await addRetroactiveProof(mission.id);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  console.log(`[RetroactiveProof] Complete. Success: ${success}, Failed: ${failed}`);
  return { success, failed };
}
