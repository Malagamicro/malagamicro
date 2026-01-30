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
        "rounded-xl p-4 md:p-6 transition-all duration-300 hover:shadow-lg animate-slide-up",
        variant === 'default' && "bg-card shadow-card border border-border",
        variant === 'primary' && "gradient-primary text-primary-foreground",
        variant === 'accent' && "gradient-accent text-accent-foreground"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn(
            "text-xs md:text-sm font-medium truncate",
            variant === 'default' ? "text-muted-foreground" : "opacity-80"
          )}>
            {title}
          </p>
          <p className="text-2xl md:text-3xl font-bold mt-0.5 md:mt-1">{value}</p>
          {subtitle && (
            <p className={cn(
              "text-[10px] md:text-xs mt-0.5 md:mt-1 truncate",
              variant === 'default' ? "text-muted-foreground" : "opacity-70"
            )}>
              {subtitle}
            </p>
          )}
          {trend && (
            <p className={cn(
              "text-[10px] md:text-xs font-medium mt-1 md:mt-2 flex items-center gap-1",
              trend.isPositive ? "text-green-500" : "text-red-500",
              variant !== 'default' && "text-inherit opacity-80"
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              <span className="opacity-60 hidden sm:inline">vs semana anterior</span>
            </p>
          )}
        </div>
        <div className={cn(
          "p-2 md:p-3 rounded-lg shrink-0",
          variant === 'default' && "bg-primary/10",
          variant !== 'default' && "bg-white/20"
        )}>
          <Icon className={cn(
            "w-5 h-5 md:w-6 md:h-6",
            variant === 'default' && "text-primary"
          )} />
        </div>
      </div>
    </div>
  );
}
