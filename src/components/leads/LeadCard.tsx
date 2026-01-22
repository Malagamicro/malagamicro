import { Lead } from '@/types/lead';
import { LeadStatusBadge } from './LeadStatusBadge';
import { LeadScoreBadge } from './LeadScoreBadge';
import { Building2, MapPin, Phone, Mail, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card rounded-xl p-5 border border-border shadow-card",
        "hover:shadow-lg hover:border-primary/30 transition-all duration-200",
        "cursor-pointer animate-slide-up"
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground leading-tight">
              {lead.companyName}
            </h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" />
              {lead.city}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LeadScoreBadge score={lead.score ?? 0} />
          <LeadStatusBadge status={lead.status} />
        </div>
      </div>

      {lead.contactName && (
        <p className="text-sm text-foreground mb-2">{lead.contactName}</p>
      )}

      <div className="space-y-1.5 text-sm text-muted-foreground">
        {lead.email && (
          <p className="flex items-center gap-2 truncate">
            <Mail className="w-4 h-4 flex-shrink-0" />
            {lead.email}
          </p>
        )}
        {/* Phone icon hidden per TAREA 1.2 */}
        {/* {lead.phone && (
          <p className="flex items-center gap-2">
            <Phone className="w-4 h-4 flex-shrink-0" />
            {lead.phone}
          </p>
        )} */}
        {lead.equipmentCount && (
          <p className="flex items-center gap-2">
            <Monitor className="w-4 h-4 flex-shrink-0" />
            {lead.equipmentCount} equipos
          </p>
        )}
      </div>

      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {lead.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-md"
            >
              {tag}
            </span>
          ))}
          {lead.tags.length > 3 && (
            <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-md">
              +{lead.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
