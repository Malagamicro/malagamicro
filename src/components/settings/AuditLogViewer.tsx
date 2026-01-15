import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Loader2, Activity, User, FileText, Mail, Bell, MessageSquare, Send, Download, FileSpreadsheet, File } from 'lucide-react';
import { exportAuditLogsToCSV, exportAuditLogsToPDF } from '@/lib/exportAuditLogs';
import { useToast } from '@/hooks/use-toast';

const actionLabels: Record<string, string> = {
  login: 'Inicio de sesión',
  logout: 'Cierre de sesión',
  password_reset_request: 'Solicitud de restablecimiento',
  password_updated: 'Contraseña actualizada',
  lead_created: 'Lead creado',
  lead_updated: 'Lead actualizado',
  lead_deleted: 'Lead eliminado',
  lead_status_changed: 'Estado cambiado',
  leads_imported: 'Leads importados',
  lead_geocoded: 'Lead geocodificado',
  reminder_created: 'Recordatorio creado',
  reminder_completed: 'Recordatorio completado',
  reminder_deleted: 'Recordatorio eliminado',
  email_sent: 'Email enviado',
  campaign_created: 'Campaña creada',
  campaign_sent: 'Campaña enviada',
  whatsapp_sent: 'WhatsApp enviado',
};

const entityIcons: Record<string, React.ElementType> = {
  user: User,
  lead: FileText,
  reminder: Bell,
  email: Mail,
  campaign: Send,
  whatsapp: MessageSquare,
};

const actionColors: Record<string, string> = {
  login: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  logout: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  lead_created: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  lead_updated: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  lead_deleted: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  lead_status_changed: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  leads_imported: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  email_sent: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  reminder_created: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

export function AuditLogViewer() {
  const { data: logs, isLoading, error } = useAuditLogs(100);
  const { toast } = useToast();

  const handleExportCSV = () => {
    if (!logs || logs.length === 0) {
      toast({
        title: 'Sin datos',
        description: 'No hay registros para exportar.',
        variant: 'destructive',
      });
      return;
    }
    exportAuditLogsToCSV(logs);
    toast({
      title: 'Exportación completada',
      description: 'El archivo CSV se ha descargado.',
    });
  };

  const handleExportPDF = () => {
    if (!logs || logs.length === 0) {
      toast({
        title: 'Sin datos',
        description: 'No hay registros para exportar.',
        variant: 'destructive',
      });
      return;
    }
    exportAuditLogsToPDF(logs);
    toast({
      title: 'Exportación completada',
      description: 'El archivo PDF se ha descargado.',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Error al cargar el registro de actividad
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Registro de Actividad
            </CardTitle>
            <CardDescription>
              Historial de acciones realizadas en tu cuenta para auditoría y seguridad
            </CardDescription>
          </div>
          {logs && logs.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Exportar como CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>
                  <File className="w-4 h-4 mr-2" />
                  Exportar como PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {logs && logs.length > 0 ? (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {logs.map((log) => {
                const Icon = entityIcons[log.entity_type] || Activity;
                const colorClass = actionColors[log.action] || 'bg-muted text-muted-foreground';
                
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className={colorClass}>
                          {actionLabels[log.action] || log.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "d MMM yyyy, HH:mm", { locale: es })}
                        </span>
                      </div>
                      {log.details && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {formatDetails(log.action, log.details)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No hay actividad registrada todavía</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDetails(action: string, details: Record<string, unknown>): string {
  switch (action) {
    case 'lead_created':
    case 'lead_deleted':
      return `Empresa: ${details.company_name || 'N/A'}`;
    case 'lead_status_changed':
      return `De "${details.from}" a "${details.to}"`;
    case 'leads_imported':
      return `${details.count} leads importados`;
    case 'email_sent':
      return `Asunto: ${details.subject || 'N/A'}`;
    case 'lead_updated':
      return 'Datos del lead modificados';
    default:
      return JSON.stringify(details).slice(0, 100);
  }
}
