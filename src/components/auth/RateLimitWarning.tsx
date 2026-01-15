import { AlertCircle, Lock, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RateLimitWarningProps {
  isLocked: boolean;
  attemptsRemaining: number;
  formattedTime: string;
  maxAttempts: number;
}

export function RateLimitWarning({
  isLocked,
  attemptsRemaining,
  formattedTime,
  maxAttempts,
}: RateLimitWarningProps) {
  if (isLocked) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2 text-destructive">
          <Lock className="w-4 h-4" />
          <span className="font-medium text-sm">Cuenta bloqueada temporalmente</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Demasiados intentos fallidos. Intenta de nuevo en{' '}
          <span className="font-mono font-medium text-destructive">{formattedTime}</span>
        </p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>El bloqueo se levantará automáticamente</span>
        </div>
      </div>
    );
  }

  if (attemptsRemaining < maxAttempts && attemptsRemaining > 0) {
    return (
      <div className={cn(
        "flex items-center gap-2 text-xs p-2 rounded-md",
        attemptsRemaining <= 2 
          ? "bg-destructive/10 text-destructive" 
          : "bg-yellow-500/10 text-yellow-600"
      )}>
        <AlertCircle className="w-3 h-3 flex-shrink-0" />
        <span>
          {attemptsRemaining === 1 
            ? '¡Último intento! Después se bloqueará por 15 minutos.'
            : `${attemptsRemaining} intentos restantes`}
        </span>
      </div>
    );
  }

  return null;
}
