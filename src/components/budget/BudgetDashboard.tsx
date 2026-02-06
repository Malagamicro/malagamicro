import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, Clock, Inbox, CheckCircle, AlertCircle, 
  Send, BarChart2, PieChart as PieChartIcon
} from 'lucide-react';
import { useBudgetRequests } from '@/hooks/useBudgetRequests';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 
                '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  highlight?: boolean;
  trend?: number;
}

const StatCard = ({ title, value, icon: Icon, description, highlight, trend }: StatCardProps) => (
  <Card className={highlight ? 'border-primary' : ''}>
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="flex items-center gap-2">
            <p className={`text-2xl font-bold ${highlight ? 'text-primary' : ''}`}>
              {value}
            </p>
            {trend !== undefined && (
              <span className={`text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Icon className={`h-8 w-8 ${highlight ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>
    </CardContent>
  </Card>
);

const BudgetDashboard = () => {
  const { requests, budgetsReceived } = useBudgetRequests();

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const lastMonthStart = startOfMonth(subDays(monthStart, 1));
    const lastMonthEnd = endOfMonth(subDays(monthStart, 1));

    // This month requests
    const thisMonthRequests = requests.filter(r => {
      const date = new Date(r.created_at);
      return isWithinInterval(date, { start: monthStart, end: monthEnd });
    });

    // Last month requests
    const lastMonthRequests = requests.filter(r => {
      const date = new Date(r.created_at);
      return isWithinInterval(date, { start: lastMonthStart, end: lastMonthEnd });
    });

    // This month budgets received
    const thisMonthBudgets = budgetsReceived.filter(b => {
      const date = new Date(b.fecha_recepcion);
      return isWithinInterval(date, { start: monthStart, end: monthEnd });
    });

    // Status counts
    const pendingApproval = requests.filter(r => 
      r.status === 'pending' || r.status === 'pending_approval'
    ).length;
    
    const pendingSelection = budgetsReceived.filter(b => 
      !b.selected && !b.invoice_id
    ).length;

    const sentToStel = budgetsReceived.filter(b => b.invoice_id).length;

    // Response rate
    const totalSent = requests.length;
    const totalReceived = budgetsReceived.length;
    const responseRate = totalSent > 0 ? Math.round((totalReceived / totalSent) * 100) : 0;

    // Trend calculation
    const requestsTrend = lastMonthRequests.length > 0 
      ? Math.round(((thisMonthRequests.length - lastMonthRequests.length) / lastMonthRequests.length) * 100)
      : 0;

    return {
      thisMonthRequests: thisMonthRequests.length,
      thisMonthBudgets: thisMonthBudgets.length,
      pendingApproval,
      pendingSelection,
      sentToStel,
      responseRate,
      requestsTrend
    };
  }, [requests, budgetsReceived]);

  // Weekly data for line chart
  const weeklyData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dayStr = format(date, 'EEE', { locale: es });
      
      const dayRequests = requests.filter(r => 
        format(new Date(r.created_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      ).length;
      
      const dayBudgets = budgetsReceived.filter(b => 
        format(new Date(b.fecha_recepcion), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      ).length;

      data.push({
        day: dayStr,
        solicitudes: dayRequests,
        respuestas: dayBudgets
      });
    }
    return data;
  }, [requests, budgetsReceived]);

  // Status distribution for pie chart
  const statusData = useMemo(() => {
    const statusCounts: Record<string, number> = {
      'Pendiente': 0,
      'En Aprobación': 0,
      'Aprobado': 0,
      'Rechazado': 0,
      'Completado': 0
    };

    requests.forEach(r => {
      switch (r.status) {
        case 'pending': statusCounts['Pendiente']++; break;
        case 'pending_approval': statusCounts['En Aprobación']++; break;
        case 'approved': statusCounts['Aprobado']++; break;
        case 'rejected': statusCounts['Rechazado']++; break;
        case 'completed': statusCounts['Completado']++; break;
      }
    });

    return Object.entries(statusCounts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [requests]);

  // Top providers by budgets
  const providerData = useMemo(() => {
    const providerCounts: Record<string, number> = {};
    
    budgetsReceived.forEach(b => {
      providerCounts[b.proveedor] = (providerCounts[b.proveedor] || 0) + 1;
    });

    return Object.entries(providerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, presupuestos: value }));
  }, [budgetsReceived]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Solicitudes mes"
          value={stats.thisMonthRequests}
          icon={Send}
          description="Total enviadas"
          trend={stats.requestsTrend}
        />
        <StatCard
          title="Presupuestos"
          value={stats.thisMonthBudgets}
          icon={Inbox}
          description="Recibidos este mes"
        />
        <StatCard
          title="Pendientes"
          value={stats.pendingApproval}
          icon={Clock}
          description="Esperando aprobación"
          highlight={stats.pendingApproval > 0}
        />
        <StatCard
          title="Sin seleccionar"
          value={stats.pendingSelection}
          icon={AlertCircle}
          description="Por elegir"
          highlight={stats.pendingSelection > 0}
        />
        <StatCard
          title="Enviados STEL"
          value={stats.sentToStel}
          icon={CheckCircle}
          description="A facturación"
        />
        <StatCard
          title="Tasa respuesta"
          value={`${stats.responseRate}%`}
          icon={TrendingUp}
          description="De proveedores"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart2 className="h-4 w-4" />
              Actividad Semanal
            </CardTitle>
            <CardDescription>Solicitudes vs Respuestas</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    borderColor: 'hsl(var(--border))' 
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="solicitudes" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="respuestas" 
                  stroke="hsl(var(--secondary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--secondary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChartIcon className="h-4 w-4" />
              Estados de Solicitudes
            </CardTitle>
            <CardDescription>Distribución actual</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No hay datos para mostrar
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Providers */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart2 className="h-4 w-4" />
              Top Proveedores
            </CardTitle>
            <CardDescription>Por número de presupuestos recibidos</CardDescription>
          </CardHeader>
          <CardContent>
            {providerData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={providerData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))' 
                    }}
                  />
                  <Bar dataKey="presupuestos" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                No hay datos de proveedores aún
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BudgetDashboard;
