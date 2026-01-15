import { cn } from '@/lib/utils';
import { TrendingUp } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LeadScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function LeadScoreBadge({ score, size = 'sm', showLabel = false }: LeadScoreBadgeProps) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return { bg: 'bg-green-500/10', text: 'text-green-600', ring: 'ring-green-500/20' };
    if (score >= 50) return { bg: 'bg-amber-500/10', text: 'text-amber-600', ring: 'ring-amber-500/20' };
    if (score >= 30) return { bg: 'bg-orange-500/10', text: 'text-orange-600', ring: 'ring-orange-500/20' };
    return { bg: 'bg-muted', text: 'text-muted-foreground', ring: 'ring-border' };
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Caliente';
    if (score >= 50) return 'Tibio';
    if (score >= 30) return 'Frío';
    return 'Muy frío';
  };

  const colors = getScoreColor(score);
  const label = getScoreLabel(score);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2', showLabel && 'flex-col')}>
            <div
              className={cn(
                'rounded-full flex items-center justify-center font-bold ring-2',
                colors.bg,
                colors.text,
                colors.ring,
                sizeClasses[size]
              )}
            >
              {score}
            </div>
            {showLabel && (
              <span className={cn('text-xs font-medium', colors.text)}>{label}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p className="font-semibold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Score: {score}/100 - {label}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Basado en estado, contacto, actividad y recencia
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
