import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'accent';
}

export function StatCard({ 
  title, 
  value, 
  subtitle,
  icon: Icon, 
  trend,
  variant = 'default' 
}: StatCardProps) {
  return (
    <div 
      className={cn(
        "rounded-xl p-6 transition-all duration-300 hover:shadow-lg animate-slide-up",
        variant === 'default' && "bg-card shadow-card border border-border",
        variant === 'primary' && "gradient-primary text-primary-foreground",
        variant === 'accent' && "gradient-accent text-accent-foreground"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={cn(
            "text-sm font-medium",
            variant === 'default' ? "text-muted-foreground" : "opacity-80"
          )}>
            {title}
          </p>
          <p className="text-3xl font-bold mt-1">{value}</p>
          {subtitle && (
            <p className={cn(
              "text-xs mt-1",
              variant === 'default' ? "text-muted-foreground" : "opacity-70"
            )}>
              {subtitle}
            </p>
          )}
          {trend && (
            <p className={cn(
              "text-xs font-medium mt-2 flex items-center gap-1",
              trend.isPositive ? "text-green-500" : "text-red-500",
              variant !== 'default' && "text-inherit opacity-80"
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              <span className="opacity-60">vs semana anterior</span>
            </p>
          )}
        </div>
        <div className={cn(
          "p-3 rounded-lg",
          variant === 'default' && "bg-primary/10",
          variant !== 'default' && "bg-white/20"
        )}>
          <Icon className={cn(
            "w-6 h-6",
            variant === 'default' && "text-primary"
          )} />
        </div>
      </div>
    </div>
  );
}
