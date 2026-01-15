import { Lead } from '@/types/lead';
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { format, subDays, startOfDay, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

interface LeadsTrendProps {
  leads: Lead[];
}

export function LeadsTrend({ leads }: LeadsTrendProps) {
  const chartData = useMemo(() => {
    const today = startOfDay(new Date());
    const thirtyDaysAgo = subDays(today, 29);
    
    // Generate all days in range
    const days = eachDayOfInterval({ start: thirtyDaysAgo, end: today });
    
    // Count leads per day
    const leadsByDay = leads.reduce((acc, lead) => {
      const dayKey = format(startOfDay(lead.createdAt), 'yyyy-MM-dd');
      acc[dayKey] = (acc[dayKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Build chart data with cumulative count
    let cumulative = leads.filter(l => l.createdAt < thirtyDaysAgo).length;
    
    return days.map(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const newLeads = leadsByDay[dayKey] || 0;
      cumulative += newLeads;
      
      return {
        date: format(day, 'd MMM', { locale: es }),
        nuevos: newLeads,
        total: cumulative,
      };
    });
  }, [leads]);

  return (
    <div className="bg-card rounded-xl p-6 shadow-card border border-border">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        Tendencia de Leads (30 días)
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis 
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              formatter={(value: number, name: string) => [
                value, 
                name === 'nuevos' ? 'Nuevos' : 'Total acumulado'
              ]}
            />
            <Line 
              type="monotone" 
              dataKey="nuevos" 
              stroke="hsl(217, 91%, 60%)" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="total" 
              stroke="hsl(142, 71%, 45%)" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex gap-6 justify-center text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(217, 91%, 60%)' }} />
          <span className="text-muted-foreground">Nuevos por día</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(142, 71%, 45%)' }} />
          <span className="text-muted-foreground">Total acumulado</span>
        </div>
      </div>
    </div>
  );
}
