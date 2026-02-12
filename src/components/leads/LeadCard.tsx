import { Lead } from '@/types/lead';
import { LeadStatusBadge } from './LeadStatusBadge';
import { LeadScoreBadge } from './LeadScoreBadge';
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin, Phone, Mail, Monitor, ExternalLink, Smartphone, PhoneCall, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPhoneTypeDisplay } from '@/lib/phoneEnrichment';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
}

export function LeadCard({ lead, onClick }: LeadCardProps) {
  // Build Google Maps URL for address
  const getMapsUrl = () => {
    const query = lead.address || lead.city;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  };

  // Get phone type display info
  const phoneDisplay = getPhoneTypeDisplay(lead.phoneType, lead.whatsappVerified);

  // Determine which phone to show (mobile if available, otherwise original)
  const displayPhone = lead.mobilePhone 
    ? `+34 ${lead.mobilePhone.slice(0, 3)} ${lead.mobilePhone.slice(3, 6)} ${lead.mobilePhone.slice(6)}`
    : lead.phone;

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card rounded-xl p-3 sm:p-5 border border-border shadow-card",
        "hover:shadow-lg hover:border-primary/30 transition-all duration-200",
        "cursor-pointer animate-slide-up overflow-hidden"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground leading-tight text-sm sm:text-base truncate">
              {lead.companyName}
            </h3>
            <a
              href={getMapsUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 mt-0.5 hover:text-primary hover:underline transition-colors"
            >
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">
                {lead.address || lead.city || 'Sin dirección'}
              </span>
            </a>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {(lead.whatsappSentCount ?? 0) > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-1 text-xs bg-green-500/10 text-green-600 border-green-500/30">
                    <MessageCircle className="h-3 w-3" />
                    {lead.whatsappSentCount}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{lead.whatsappSentCount} WhatsApp{(lead.whatsappSentCount ?? 0) > 1 ? 's' : ''} enviado{(lead.whatsappSentCount ?? 0) > 1 ? 's' : ''}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
        {(lead.phone || lead.mobilePhone) && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className={cn("flex items-center gap-2", phoneDisplay.color)}>
                  {lead.whatsappVerified === true ? (
                    <Smartphone className="w-4 h-4 flex-shrink-0" />
                  ) : lead.phoneType === 'landline' ? (
                    <PhoneCall className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <Phone className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span>{displayPhone}</span>
                  <span className="text-xs">{phoneDisplay.icon}</span>
                </p>
              </TooltipTrigger>
              <TooltipContent>
                <p>{phoneDisplay.label}</p>
                {lead.mobilePhone && lead.phone && lead.mobilePhone !== lead.phone?.replace(/\D/g, '') && (
                  <p className="text-xs text-muted-foreground">Original: {lead.phone}</p>
                )}
                {lead.whatsappVerified === true && (
                  <p className="text-xs text-green-600">WhatsApp disponible</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
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
