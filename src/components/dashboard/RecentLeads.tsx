import { Lead } from '@/types/lead';
import { LeadStatusBadge } from '../leads/LeadStatusBadge';
import { Building2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RecentLeadsProps {
  leads: Lead[];
  onViewLead: (id: string) => void;
}

export function RecentLeads({ leads, onViewLead }: RecentLeadsProps) {
  const recentLeads = [...leads]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          Leads Recientes
        </h3>
        <Button variant="ghost" size="sm" className="text-primary">
          Ver todos
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      
      <div className="space-y-3">
        {recentLeads.map((lead) => (
          <button
            key={lead.id}
            onClick={() => onViewLead(lead.id)}
            className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {lead.companyName}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {lead.city} • {lead.contactName || 'Sin contacto'}
              </p>
            </div>
            <LeadStatusBadge status={lead.status} />
          </button>
        ))}
      </div>
    </div>
  );
}
