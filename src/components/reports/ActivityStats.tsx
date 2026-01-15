import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { Loader2 } from 'lucide-react';

const activityLabels: Record<string, string> = {
  email: 'Emails',
  llamada: 'Llamadas',
  whatsapp: 'WhatsApp',
  reunion: 'Reuniones',
  visita: 'Visitas',
  nota: 'Notas',
  estado: 'Cambios estado',
  creado: 'Creaciones',
};

const activityColors: Record<string, string> = {
  email: 'hsl(217, 91%, 60%)',
  llamada: 'hsl(142, 71%, 45%)',
  whatsapp: 'hsl(145, 70%, 42%)',
  reunion: 'hsl(280, 65%, 60%)',
  visita: 'hsl(45, 93%, 47%)',
  nota: 'hsl(200, 60%, 50%)',
  estado: 'hsl(340, 65%, 55%)',
  creado: 'hsl(180, 60%, 45%)',
};

export function ActivityStats() {
  const { user } = useAuth();

  const { data: activities, isLoading } = useQuery({
    queryKey: ['activity-stats'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('lead_activities')
        .select('type')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-card border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Actividades (30 días)
        </h3>
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Count activities by type
  const activityCounts = (activities || []).reduce((acc, activity) => {
    acc[activity.type] = (acc[activity.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(activityCounts)
    .map(([type, count]) => ({
      name: activityLabels[type] || type,
      value: count,
      color: activityColors[type] || 'hsl(var(--muted))',
    }))
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-card border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Actividades (30 días)
        </h3>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          Sin actividades registradas
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Actividades (30 días)
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 10, right: 10 }}>
            <XAxis 
              dataKey="name" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
              width={30}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              formatter={(value: number) => [`${value} actividades`, 'Cantidad']}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={30}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
