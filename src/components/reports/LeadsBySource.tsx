import { Lead, LeadSource } from '@/types/lead';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface LeadsBySourceProps {
  leads: Lead[];
}

const sourceLabels: Record<LeadSource, string> = {
  google_maps: 'Google Maps',
  web_scraping: 'Web Scraping',
  referido: 'Referido',
  manual: 'Manual',
};

const sourceColors: Record<LeadSource, string> = {
  google_maps: 'hsl(217, 91%, 60%)',
  web_scraping: 'hsl(280, 65%, 60%)',
  referido: 'hsl(142, 71%, 45%)',
  manual: 'hsl(45, 93%, 47%)',
};

export function LeadsBySource({ leads }: LeadsBySourceProps) {
  const sourceData = leads.reduce((acc, lead) => {
    acc[lead.source] = (acc[lead.source] || 0) + 1;
    return acc;
  }, {} as Record<LeadSource, number>);

  const data = Object.entries(sourceData).map(([source, count]) => ({
    name: sourceLabels[source as LeadSource],
    value: count,
    color: sourceColors[source as LeadSource],
  }));

  if (data.length === 0) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-card border border-border">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Leads por Fuente
        </h3>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          Sin datos disponibles
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Leads por Fuente
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
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
              formatter={(value: number) => [`${value} leads`, 'Cantidad']}
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
