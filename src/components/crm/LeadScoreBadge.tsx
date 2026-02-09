import { LEAD_SCORE_CONFIG, type LeadScoreLabel } from '../../types/crm';

interface LeadScoreBadgeProps {
  score: number;
  label: LeadScoreLabel;
}

export function LeadScoreBadge({ score, label }: LeadScoreBadgeProps) {
  const config = LEAD_SCORE_CONFIG[label] ?? LEAD_SCORE_CONFIG.cold;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${config.bgClass} ${config.textClass}`}
      title={`Lead score: ${score} (${config.label})`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          label === 'hot'
            ? 'bg-red-400'
            : label === 'warm'
              ? 'bg-orange-400'
              : 'bg-blue-400'
        }`}
      />
      {score}
    </span>
  );
}
