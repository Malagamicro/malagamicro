import { useEffect, useState } from 'react';
import { X, Bell, AlertTriangle, CheckCircle, Info, Bot, Webhook, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CustomNotification } from '@/hooks/useCustomNotifications';

const TYPE_CONFIG: Record<string, { icon: typeof Bell; bg: string; border: string; iconColor: string }> = {
  info: { icon: Info, bg: 'bg-blue-500/10', border: 'border-blue-500/30', iconColor: 'text-blue-500' },
  success: { icon: CheckCircle, bg: 'bg-green-500/10', border: 'border-green-500/30', iconColor: 'text-green-500' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-500/10', border: 'border-amber-500/30', iconColor: 'text-amber-500' },
  error: { icon: AlertTriangle, bg: 'bg-red-500/10', border: 'border-red-500/30', iconColor: 'text-red-500' },
  ai: { icon: Bot, bg: 'bg-violet-500/10', border: 'border-violet-500/30', iconColor: 'text-violet-500' },
  n8n: { icon: Webhook, bg: 'bg-orange-500/10', border: 'border-orange-500/30', iconColor: 'text-orange-500' },
};

interface Props {
  notification: CustomNotification;
  onDismiss: (id: string) => void;
}

export function NotificationPopup({ notification, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.info;
  const Icon = config.icon;

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => setVisible(true));
    // Auto-dismiss after 8 seconds
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(notification.id), 300);
    }, 8000);
    return () => clearTimeout(timer);
  }, [notification.id, onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => onDismiss(notification.id), 300);
  };

  return (
    <div
      className={cn(
        'w-[360px] max-w-[calc(100vw-2rem)] p-4 rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300',
        'bg-card/95',
        config.border,
        visible ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
      )}
    >
      <div className="flex gap-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', config.bg)}>
          <Icon className={cn('w-5 h-5', config.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{notification.title}</p>
              <p className="text-xs text-muted-foreground capitalize">{notification.source}</p>
            </div>
            <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 line-clamp-3">{notification.message}</p>
          {notification.action_url && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs gap-1"
              onClick={() => {
                window.open(notification.action_url!, '_blank');
                handleDismiss();
              }}
            >
              <ExternalLink className="w-3 h-3" />
              {notification.action_label || 'Ver más'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotificationPopupStack({ popups, onDismiss }: {
  popups: CustomNotification[];
  onDismiss: (id: string) => void;
}) {
  // Show max 3 popups at once
  const visiblePopups = popups.slice(-3);
  
  if (visiblePopups.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3">
      {visiblePopups.map(popup => (
        <NotificationPopup key={popup.id} notification={popup} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
