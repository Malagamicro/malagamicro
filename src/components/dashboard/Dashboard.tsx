import { StatCard } from './StatCard';
import { LeadsByStatusChart } from './LeadsByStatusChart';
import { RecentLeads } from './RecentLeads';
import { mockStats, mockLeads } from '@/data/mockLeads';
import { Users, UserPlus, MessageSquare, TrendingUp, Target, Calendar } from 'lucide-react';

interface DashboardProps {
  onViewLead: (id: string) => void;
}

export function Dashboard({ onViewLead }: DashboardProps) {
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
          value={mockStats.totalLeads}
          subtitle="En tu base de datos"
          icon={Users}
          variant="primary"
        />
        <StatCard
          title="Nuevos esta semana"
          value={mockStats.thisWeekLeads}
          icon={UserPlus}
          trend={{ value: 15, isPositive: true }}
        />
        <StatCard
          title="Tasa de conversión"
          value={`${mockStats.conversionRate}%`}
          subtitle="Leads → Clientes"
          icon={TrendingUp}
          variant="accent"
        />
        <StatCard
          title="Clientes activos"
          value={mockStats.clients}
          icon={Target}
        />
      </div>

      {/* Charts & Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadsByStatusChart stats={mockStats} />
        <RecentLeads leads={mockLeads} onViewLead={onViewLead} />
      </div>
    </div>
  );
}
