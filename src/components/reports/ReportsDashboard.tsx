import { useLeads, useDashboardStats } from '@/hooks/useLeads';
import { ConversionFunnel } from './ConversionFunnel';
import { LeadsBySource } from './LeadsBySource';
import { LeadsTrend } from './LeadsTrend';
import { ActivityStats } from './ActivityStats';
import { StatCard } from '@/components/dashboard/StatCard';
import { TrendingUp, Users, Target, BarChart3, Loader2 } from 'lucide-react';

export function ReportsDashboard() {
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

  // Calculate additional metrics
  const avgScore = leads.length > 0 
    ? Math.round(leads.reduce((sum, l) => sum + (l.score || 0), 0) / leads.length) 
    : 0;

  const leadsWithEmail = leads.filter(l => l.email).length;
  const emailRate = leads.length > 0 ? Math.round((leadsWithEmail / leads.length) * 100) : 0;

  const leadsWithLocation = leads.filter(l => l.latitude && l.longitude).length;
  const geoRate = leads.length > 0 ? Math.round((leadsWithLocation / leads.length) * 100) : 0;

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Reportes</h1>
        <p className="text-muted-foreground mt-1">
          Análisis de rendimiento y métricas de conversión
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Tasa de conversión"
          value={`${dashboardStats.conversionRate}%`}
          subtitle="Leads → Clientes"
          icon={TrendingUp}
          variant="primary"
        />
        <StatCard
          title="Score promedio"
          value={avgScore}
          subtitle="Puntuación media"
          icon={Target}
        />
        <StatCard
          title="Datos de contacto"
          value={`${emailRate}%`}
          subtitle="Leads con email"
          icon={Users}
          variant="accent"
        />
        <StatCard
          title="Geolocalización"
          value={`${geoRate}%`}
          subtitle="Leads con ubicación"
          icon={BarChart3}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversionFunnel stats={dashboardStats} />
        <LeadsBySource leads={leads} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadsTrend leads={leads} />
        <ActivityStats />
      </div>
    </div>
  );
}
