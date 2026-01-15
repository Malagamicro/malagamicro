import { DashboardStats } from '@/types/lead';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';

interface ConversionFunnelProps {
  stats: DashboardStats;
}

export function ConversionFunnel({ stats }: ConversionFunnelProps) {
  const data = [
    { name: 'Nuevos', value: stats.newLeads, color: 'hsl(217, 91%, 60%)' },
    { name: 'Contactados', value: stats.contactedLeads, color: 'hsl(45, 93%, 47%)' },
    { name: 'Interesados', value: stats.interestedLeads, color: 'hsl(280, 65%, 60%)' },
    { name: 'Clientes', value: stats.clients, color: 'hsl(142, 71%, 45%)' },
  ];

  const conversionRates = [
    { 
      label: 'Nuevo → Contactado', 
      rate: stats.newLeads > 0 ? ((stats.contactedLeads / stats.newLeads) * 100).toFixed(1) : 0 
    },
    { 
      label: 'Contactado → Interesado', 
      rate: stats.contactedLeads > 0 ? ((stats.interestedLeads / stats.contactedLeads) * 100).toFixed(1) : 0 
    },
    { 
      label: 'Interesado → Cliente', 
      rate: stats.interestedLeads > 0 ? ((stats.clients / stats.interestedLeads) * 100).toFixed(1) : 0 
    },
  ];

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Embudo de Conversión
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
            <XAxis type="number" hide />
            <YAxis 
              type="category" 
              dataKey="name" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              formatter={(value: number) => [`${value} leads`, 'Cantidad']}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Conversion rates */}
      <div className="mt-4 pt-4 border-t border-border space-y-2">
        {conversionRates.map((item) => (
          <div key={item.label} className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-semibold text-foreground">{item.rate}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
