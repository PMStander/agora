import { useCrmStore, useDealsByCompany, useDealsByContact } from '../../../../stores/crm';
import { ProfileEmptyState } from '../ProfileEmptyState';
import { TabHeader } from './TabHeader';
import { DEAL_STATUS_CONFIG } from '../../../../types/crm';

function formatCurrency(amount: number | null, currency = 'USD'): string {
  if (amount == null) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const STATUS_COLORS: Record<string, string> = {
  blue: 'bg-blue-500/20 text-blue-400',
  green: 'bg-green-500/20 text-green-400',
  red: 'bg-red-500/20 text-red-400',
  zinc: 'bg-zinc-500/20 text-zinc-400',
};

interface DealsTabProps {
  entityType: string;
  entityId: string;
  onAddDeal?: () => void;
}

export default function DealsTab({ entityType, entityId, onAddDeal }: DealsTabProps) {
  const navigateToProfile = useCrmStore(s => s.navigateToProfile);
  const pipelines = useCrmStore(s => s.pipelines);

  const contactDeals = useDealsByContact(entityType === 'contact' ? entityId : null);
  const companyDeals = useDealsByCompany(entityType === 'company' ? entityId : null);

  const deals = entityType === 'contact' ? contactDeals : companyDeals;

  if (!deals.length) return <ProfileEmptyState message="No deals yet" actionLabel="Create Deal" onAction={onAddDeal} />;

  const getStageName = (pipelineId: string, stageId: string) => {
    const pipeline = pipelines.find(p => p.id === pipelineId);
    const stage = pipeline?.stages?.find(s => s.id === stageId);
    return stage?.name ?? 'Unknown';
  };

  return (
    <div>
      <TabHeader count={deals.length} noun="deal" actionLabel="Create Deal" onAction={onAddDeal} />
      <div className="space-y-2">
        {deals.map(deal => {
          const statusCfg = DEAL_STATUS_CONFIG[deal.status];
          const colorClass = STATUS_COLORS[statusCfg?.color] ?? STATUS_COLORS.zinc;
          return (
            <div
              key={deal.id}
              onClick={() => navigateToProfile('deal', deal.id, deal.title)}
              className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-zinc-200 truncate">{deal.title}</span>
                <span className={`px-1.5 py-0.5 text-xs rounded ${colorClass}`}>
                  {statusCfg?.label ?? deal.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{formatCurrency(deal.amount, deal.currency)}</span>
                <span>{getStageName(deal.pipeline_id, deal.stage_id)}</span>
                {deal.close_date && <span>Close: {new Date(deal.close_date).toLocaleDateString()}</span>}
                <span className="ml-auto">{relativeTime(deal.created_at)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
