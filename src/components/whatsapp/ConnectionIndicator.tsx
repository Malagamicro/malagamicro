import { ConnectionStatus } from '@/hooks/useRealtimeConnection';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionIndicatorProps {
  status: ConnectionStatus;
  onReconnect?: () => void;
  showLabel?: boolean;
  className?: string;
}

export function ConnectionIndicator({ 
  status, 
  onReconnect, 
  showLabel = false,
  className 
}: ConnectionIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          color: 'text-emerald-500',
          bgColor: 'bg-emerald-500',
          label: 'Conectado',
          description: 'Conexión en tiempo real activa',
        };
      case 'connecting':
        return {
          icon: Loader2,
          color: 'text-amber-500',
          bgColor: 'bg-amber-500',
          label: 'Conectando',
          description: 'Estableciendo conexión...',
          animate: true,
        };
      case 'reconnecting':
        return {
          icon: RefreshCw,
          color: 'text-amber-500',
          bgColor: 'bg-amber-500',
          label: 'Reconectando',
          description: 'Intentando reconectar...',
          animate: true,
        };
      case 'disconnected':
        return {
          icon: WifiOff,
          color: 'text-destructive',
          bgColor: 'bg-destructive',
          label: 'Desconectado',
          description: 'Sin conexión. Los mensajes podrían no actualizarse.',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-1.5', className)}>
            {/* Animated dot */}
            <span className="relative flex h-2.5 w-2.5">
              {status === 'connected' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={cn(
                'relative inline-flex rounded-full h-2.5 w-2.5',
                config.bgColor
              )} />
            </span>
            
            {/* Icon */}
            <Icon className={cn(
              'h-4 w-4',
              config.color,
              config.animate && 'animate-spin'
            )} />
            
            {/* Optional label */}
            {showLabel && (
              <span className={cn('text-xs font-medium', config.color)}>
                {config.label}
              </span>
            )}
            
            {/* Reconnect button for disconnected state */}
            {status === 'disconnected' && onReconnect && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReconnect}
                className="h-6 px-2 text-xs"
              >
                Reconectar
              </Button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
