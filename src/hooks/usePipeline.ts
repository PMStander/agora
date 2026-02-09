import { useMemo, useCallback } from 'react';
import { useCrmStore, useActivePipeline } from '../stores/crm';
import { useCRM } from './useCRM';
import type { Deal, PipelineStage } from '../types/crm';

export function usePipeline() {
  const pipeline = useActivePipeline();
  const deals = useCrmStore((s) => s.deals);
  const filters = useCrmStore((s) => s.filters);
  const { moveDeal } = useCRM();

  const stages = pipeline?.stages || [];
  const pipelineId = pipeline?.id || null;

  // Filter deals for this pipeline
  const pipelineDeals = useMemo(
    () =>
      deals.filter((d) => {
        if (d.pipeline_id !== pipelineId) return false;
        if (filters.ownerAgent && d.owner_agent_id !== filters.ownerAgent)
          return false;
        return true;
      }),
    [deals, pipelineId, filters.ownerAgent]
  );

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const stage of stages) {
      map.set(
        stage.id,
        pipelineDeals.filter(
          (d) => d.stage_id === stage.id && d.status === 'open'
        )
      );
    }
    return map;
  }, [pipelineDeals, stages]);

  // Total pipeline value (open deals only)
  const totalValue = useMemo(
    () =>
      pipelineDeals
        .filter((d) => d.status === 'open')
        .reduce((sum, d) => sum + (d.amount || 0), 0),
    [pipelineDeals]
  );

  // Weighted pipeline value (amount * stage probability)
  const weightedValue = useMemo(
    () =>
      pipelineDeals
        .filter((d) => d.status === 'open')
        .reduce((sum, d) => {
          const stage = stages.find((s) => s.id === d.stage_id);
          return sum + (d.amount || 0) * ((stage?.probability || 0) / 100);
        }, 0),
    [pipelineDeals, stages]
  );

  // Deal counts by status
  const counts = useMemo(
    () => ({
      open: pipelineDeals.filter((d) => d.status === 'open').length,
      won: pipelineDeals.filter((d) => d.status === 'won').length,
      lost: pipelineDeals.filter((d) => d.status === 'lost').length,
    }),
    [pipelineDeals]
  );

  // Drag-and-drop handler
  const handleDragEnd = useCallback(
    (dealId: string, newStageId: string) => {
      moveDeal(dealId, newStageId);
    },
    [moveDeal]
  );

  // Stage info helper
  const getStageInfo = useCallback(
    (stageId: string): PipelineStage | undefined => {
      return stages.find((s) => s.id === stageId);
    },
    [stages]
  );

  return {
    pipeline,
    stages,
    dealsByStage,
    totalValue,
    weightedValue,
    counts,
    handleDragEnd,
    getStageInfo,
  };
}
