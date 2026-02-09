import { PAYMENT_LINK_STATUS_CONFIG } from '../../types/payments';
import type { PaymentLinkStatus } from '../../types/payments';

interface PaymentStatusBadgeProps {
  status: PaymentLinkStatus;
}

const colorMap: Record<string, string> = {
  zinc: 'bg-zinc-500/20 text-zinc-400',
  blue: 'bg-blue-500/20 text-blue-400',
  green: 'bg-green-500/20 text-green-400',
  red: 'bg-red-500/20 text-red-400',
  amber: 'bg-amber-500/20 text-amber-400',
};

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const config = PAYMENT_LINK_STATUS_CONFIG[status];
  const classes = colorMap[config.color] || colorMap.zinc;

  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] rounded-full ${classes}`}>
      {config.label}
    </span>
  );
}
