import { StatCard } from './StatCard';
import { LeadsByStatusChart } from './LeadsByStatusChart';
import { RecentLeads } from './RecentLeads';
import { UpcomingReminders } from './UpcomingReminders';
import { useLeads, useDashboardStats } from '@/hooks/useLeads';
import { Users, UserPlus, TrendingUp, Target, Loader2 } from 'lucide-react';

interface DashboardProps {
  onViewLead: (id: string) => void;
}

export function Dashboard({ onViewLead }: DashboardProps) {
  const { leads, isLoading: leadsLoading } = useLeads();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();

  const isLoading = leadsLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const dashboardStats = stats || {
    totalLeads: 0,
    newLeads: 0,
    contactedLeads: 0,
    interestedLeads: 0,
    clients: 0,
    thisWeekLeads: 0,
    conversionRate: 0,
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Resumen de actividad y prospección
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Leads"
          value={dashboardStats.totalLeads}
          subtitle="En tu base de datos"
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Nuevos esta semana"
          value={dashboardStats.thisWeekLeads}
          icon={UserPlus}
          trend={{ value: 15, isPositive: true }}
        />
        <StatCard
          title="Tasa de conversión"
          value={`${dashboardStats.conversionRate}%`}
          subtitle="Leads → Clientes"
          icon={TrendingUp}
          variant="accent"
        />
        <StatCard
          title="Clientes activos"
          value={dashboardStats.clients}
          icon={Target}
        />
      </div>

      {/* Charts & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <LeadsByStatusChart stats={dashboardStats} />
        <RecentLeads leads={leads} onViewLead={onViewLead} />
        <UpcomingReminders onLeadClick={onViewLead} />
      </div>
    </div>
  );
}
