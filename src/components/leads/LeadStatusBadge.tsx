import { LeadStatus } from '@/types/lead';
import { cn } from '@/lib/utils';

interface LeadStatusBadgeProps {
  status: LeadStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<LeadStatus, { label: string; className: string }> = {
  nuevo: {
    label: 'Nuevo',
    className: 'bg-status-new/15 text-status-new border-status-new/30',
  },
  contactado: {
    label: 'Contactado',
    className: 'bg-status-contacted/15 text-status-contacted border-status-contacted/30',
  },
  interesado: {
    label: 'Interesado',
    className: 'bg-status-interested/15 text-status-interested border-status-interested/30',
  },
  cliente: {
    label: 'Cliente',
    className: 'bg-status-client/15 text-status-client border-status-client/30',
  },
};

export function LeadStatusBadge({ status, size = 'sm' }: LeadStatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full border",
        config.className,
        size === 'sm' && "px-2 py-0.5 text-xs",
        size === 'md' && "px-3 py-1 text-sm"
      )}
    >
      {config.label}
    </span>
  );
}
