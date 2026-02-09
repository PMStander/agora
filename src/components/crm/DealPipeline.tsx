import { useCallback, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { usePipeline } from '../../hooks/usePipeline';
import { useCrmStore } from '../../stores/crm';
import { DealCard } from './DealCard';
import type { Deal, PipelineStage } from '../../types/crm';

const stageColors = [
  'border-blue-500',
  'border-cyan-500',
  'border-indigo-500',
  'border-amber-500',
  'border-orange-500',
  'border-emerald-500',
  'border-red-500',
  'border-purple-500',
];

const stageHeaderColors = [
  'text-blue-400',
  'text-cyan-400',
  'text-indigo-400',
  'text-amber-400',
  'text-orange-400',
  'text-emerald-400',
  'text-red-400',
  'text-purple-400',
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

interface StageColumnProps {
  stage: PipelineStage;
  deals: Deal[];
  colorIndex: number;
}

function StageColumn({ stage, deals, colorIndex }: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const borderColor = stageColors[colorIndex % stageColors.length];
  const headerColor = stageHeaderColors[colorIndex % stageHeaderColors.length];
  const stageTotal = deals.reduce((sum, d) => sum + (d.amount || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col min-w-[280px] max-w-[280px] h-full
        bg-zinc-900/50 rounded-lg border-t-2
        ${borderColor}
        ${isOver ? 'bg-zinc-800/50' : ''}
        transition-colors
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex flex-col">
          <h3 className={`text-sm font-semibold ${headerColor}`}>
            {stage.name}
          </h3>
          {stageTotal > 0 && (
            <span className="text-xs text-zinc-500">{formatCurrency(stageTotal)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">{stage.probability}%</span>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
            {deals.length}
          </span>
        </div>
      </div>

      {/* Deals */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
        {deals.length === 0 && (
          <div className="text-center text-zinc-600 text-sm py-8">
            No deals
          </div>
        )}
      </div>
    </div>
  );
}

export function DealPipeline() {
  const { pipeline, stages, dealsByStage, totalValue, weightedValue, handleDragEnd } =
    usePipeline();
  const deals = useCrmStore((s) => s.deals);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      const deal = deals.find((d) => d.id === event.active.id);
      if (deal) setActiveDeal(deal);
    },
    [deals]
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDeal(null);
      const { active, over } = event;
      if (!over) return;

      const dealId = active.id as string;
      const newStageId = over.id as string;

      // Only move if the stage actually exists and is different
      const deal = deals.find((d) => d.id === dealId);
      if (!deal || deal.stage_id === newStageId) return;
      if (!stages.some((s) => s.id === newStageId)) return;

      handleDragEnd(dealId, newStageId);
    },
    [deals, stages, handleDragEnd]
  );

  if (!pipeline) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600">
        <div className="text-center">
          <p className="text-sm">No pipeline configured</p>
          <p className="text-xs mt-1">Create a deal pipeline to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-zinc-100">{pipeline.name}</h2>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-400">
              Total: <span className="text-zinc-200 font-medium">{formatCurrency(totalValue)}</span>
            </span>
            <span className="text-zinc-400">
              Weighted: <span className="text-amber-400 font-medium">{formatCurrency(weightedValue)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-4 h-full overflow-x-auto pb-4 px-4 pt-4">
            {stages.map((stage, index) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage.get(stage.id) || []}
                colorIndex={index}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDeal && <DealCard deal={activeDeal} isDragOverlay />}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
