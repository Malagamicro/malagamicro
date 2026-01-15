import { DashboardStats } from '@/types/lead';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface LeadsByStatusChartProps {
  stats: DashboardStats;
}

export function LeadsByStatusChart({ stats }: LeadsByStatusChartProps) {
  const data = [
    { name: 'Nuevos', value: stats.newLeads, color: 'hsl(210, 100%, 50%)' },
    { name: 'Contactados', value: stats.contactedLeads, color: 'hsl(45, 93%, 47%)' },
    { name: 'Interesados', value: stats.interestedLeads, color: 'hsl(142, 71%, 45%)' },
    { name: 'Clientes', value: stats.clients, color: 'hsl(224, 40%, 39%)' },
  ];

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border animate-slide-up">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Leads por Estado
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => (
                <span className="text-sm text-muted-foreground">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
