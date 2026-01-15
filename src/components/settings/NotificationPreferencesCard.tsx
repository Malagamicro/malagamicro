import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { Bell, Loader2, Mail, FileText, Calendar, Shield } from 'lucide-react';

interface PreferenceItemProps {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

function PreferenceItem({ id, label, description, icon, checked, onCheckedChange, disabled }: PreferenceItemProps) {
  return (
    <div className="flex items-center justify-between py-4 border-b last:border-0">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">
          {icon}
        </div>
        <div className="space-y-0.5">
          <Label htmlFor={id} className="text-sm font-medium cursor-pointer">
            {label}
          </Label>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </div>
  );
}

export function NotificationPreferencesCard() {
  const { preferences, isLoading, updatePreferences, isUpdating } = useNotificationPreferences();

  const handleToggle = (key: string, value: boolean) => {
    updatePreferences({ [key]: value });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Preferencias de Notificación
        </CardTitle>
        <CardDescription>
          Controla qué emails deseas recibir
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PreferenceItem
          id="email_lead_updates"
          label="Actualizaciones de leads"
          description="Recibe notificaciones cuando haya cambios importantes en tus leads"
          icon={<Mail className="h-5 w-5" />}
          checked={preferences?.email_lead_updates ?? true}
          onCheckedChange={(checked) => handleToggle('email_lead_updates', checked)}
          disabled={isUpdating}
        />
        
        <PreferenceItem
          id="email_reminder_notifications"
          label="Recordatorios de seguimiento"
          description="Recibe emails cuando tengas recordatorios pendientes"
          icon={<Calendar className="h-5 w-5" />}
          checked={preferences?.email_reminder_notifications ?? true}
          onCheckedChange={(checked) => handleToggle('email_reminder_notifications', checked)}
          disabled={isUpdating}
        />
        
        <PreferenceItem
          id="email_campaign_reports"
          label="Informes de campañas"
          description="Recibe resúmenes del rendimiento de tus campañas de email"
          icon={<FileText className="h-5 w-5" />}
          checked={preferences?.email_campaign_reports ?? true}
          onCheckedChange={(checked) => handleToggle('email_campaign_reports', checked)}
          disabled={isUpdating}
        />
        
        <PreferenceItem
          id="email_weekly_summary"
          label="Resumen semanal"
          description="Recibe un resumen semanal de tu actividad y métricas clave"
          icon={<FileText className="h-5 w-5" />}
          checked={preferences?.email_weekly_summary ?? true}
          onCheckedChange={(checked) => handleToggle('email_weekly_summary', checked)}
          disabled={isUpdating}
        />
        
        <PreferenceItem
          id="email_security_alerts"
          label="Alertas de seguridad"
          description="Recibe notificaciones sobre actividad inusual en tu cuenta"
          icon={<Shield className="h-5 w-5" />}
          checked={preferences?.email_security_alerts ?? true}
          onCheckedChange={(checked) => handleToggle('email_security_alerts', checked)}
          disabled={isUpdating}
        />
      </CardContent>
    </Card>
  );
}
