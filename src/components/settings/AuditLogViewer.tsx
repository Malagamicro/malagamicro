import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuditLogs, DateRange, AuditLogEntry } from '@/hooks/useAuditLogs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Loader2, Activity, User, FileText, Mail, Bell, MessageSquare, Send, Download, FileSpreadsheet, File, CalendarIcon, X, Filter, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { exportAuditLogsToCSV, exportAuditLogsToPDF } from '@/lib/exportAuditLogs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

const actionGroups: Record<string, string[]> = {
  'Autenticación': ['login', 'logout', 'password_reset_request', 'password_updated'],
  'Leads': ['lead_created', 'lead_updated', 'lead_deleted', 'lead_status_changed', 'leads_imported', 'lead_geocoded'],
  'Recordatorios': ['reminder_created', 'reminder_completed', 'reminder_deleted'],
  'Comunicación': ['email_sent', 'campaign_created', 'campaign_sent', 'whatsapp_sent'],
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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function AuditLogViewer() {
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  const { data: paginatedData, isLoading, error } = useAuditLogs(
    currentPage,
    pageSize,
    dateRange,
    selectedActions.length > 0 ? selectedActions : undefined
  );
  
  const logs = paginatedData?.data;
  const totalCount = paginatedData?.totalCount || 0;
  const pageCount = paginatedData?.pageCount || 0;
  
  const { toast } = useToast();

  // Search through log details
  const searchInDetails = (details: Record<string, unknown> | null, query: string): boolean => {
    if (!details) return false;
    const searchLower = query.toLowerCase();
    
    const searchValue = (value: unknown): boolean => {
      if (typeof value === 'string') {
        return value.toLowerCase().includes(searchLower);
      }
      if (typeof value === 'number') {
        return value.toString().includes(searchLower);
      }
      if (Array.isArray(value)) {
        return value.some(v => searchValue(v));
      }
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(v => searchValue(v));
      }
      return false;
    };
    
    return Object.values(details).some(v => searchValue(v));
  };

  const filteredLogs = useMemo(() => {
    if (!logs || !searchQuery.trim()) return logs;
    
    const query = searchQuery.toLowerCase();
    return logs.filter(log => {
      // Search in action label
      const actionLabel = actionLabels[log.action] || log.action;
      if (actionLabel.toLowerCase().includes(query)) return true;
      
      // Search in entity type
      if (log.entity_type.toLowerCase().includes(query)) return true;
      
      // Search in details
      if (searchInDetails(log.details, query)) return true;
      
      return false;
    });
  }, [logs, searchQuery]);

  const toggleAction = (action: string) => {
    setSelectedActions(prev => 
      prev.includes(action) 
        ? prev.filter(a => a !== action)
        : [...prev, action]
    );
    setCurrentPage(1); // Reset to first page on filter change
  };

  const toggleGroup = (group: string) => {
    const groupActions = actionGroups[group];
    const allSelected = groupActions.every(a => selectedActions.includes(a));
    
    if (allSelected) {
      setSelectedActions(prev => prev.filter(a => !groupActions.includes(a)));
    } else {
      setSelectedActions(prev => [...new Set([...prev, ...groupActions])]);
    }
    setCurrentPage(1); // Reset to first page on filter change
  };

  const clearActionFilter = () => {
    setSelectedActions([]);
    setCurrentPage(1);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const handlePageSizeChange = (value: string) => {
    setPageSize(Number(value));
    setCurrentPage(1);
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, pageCount)));
  };

  const handleExportCSV = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      toast({
        title: 'Sin datos',
        description: 'No hay registros para exportar.',
        variant: 'destructive',
      });
      return;
    }
    exportAuditLogsToCSV(filteredLogs);
    toast({
      title: 'Exportación completada',
      description: 'El archivo CSV se ha descargado.',
    });
  };

  const handleExportPDF = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      toast({
        title: 'Sin datos',
        description: 'No hay registros para exportar.',
        variant: 'destructive',
      });
      return;
    }
    exportAuditLogsToPDF(filteredLogs);
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

  const clearDateFilter = () => {
    setDateRange({ from: undefined, to: undefined });
  };

  const hasDateFilter = dateRange.from || dateRange.to;
  const hasActionFilter = selectedActions.length > 0;
  const hasSearchFilter = searchQuery.trim().length > 0;
  const hasAnyFilter = hasDateFilter || hasActionFilter || hasSearchFilter;

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Registro de Actividad
            </CardTitle>
            <CardDescription>
              Historial de acciones realizadas en tu cuenta para auditoría y seguridad
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en registros..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 w-48"
              />
              {hasSearchFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>

            {/* Action Type Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(hasActionFilter && "text-primary")}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  {hasActionFilter ? `${selectedActions.length} filtros` : "Tipo de acción"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
                {Object.entries(actionGroups).map(([group, actions]) => (
                  <div key={group}>
                    <DropdownMenuLabel className="flex items-center justify-between">
                      <span>{group}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.preventDefault();
                          toggleGroup(group);
                        }}
                      >
                        {actions.every(a => selectedActions.includes(a)) ? 'Quitar' : 'Todos'}
                      </Button>
                    </DropdownMenuLabel>
                    {actions.map(action => (
                      <DropdownMenuCheckboxItem
                        key={action}
                        checked={selectedActions.includes(action)}
                        onCheckedChange={() => toggleAction(action)}
                      >
                        {actionLabels[action] || action}
                      </DropdownMenuCheckboxItem>
                    ))}
                    <DropdownMenuSeparator />
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Date Range Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "justify-start text-left font-normal",
                    hasDateFilter && "text-primary"
                  )}
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "d MMM", { locale: es })} - {format(dateRange.to, "d MMM yyyy", { locale: es })}
                      </>
                    ) : (
                      format(dateRange.from, "d MMM yyyy", { locale: es })
                    )
                  ) : (
                    "Filtrar por fecha"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => setDateRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                  locale={es}
                />
              </PopoverContent>
            </Popover>

            {/* Clear Filters */}
            {hasAnyFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearDateFilter();
                  clearActionFilter();
                  clearSearch();
                }}
                className="h-9 px-2"
                title="Limpiar filtros"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
            {filteredLogs && filteredLogs.length > 0 && (
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
        </div>
      </CardHeader>
      <CardContent>
        {filteredLogs && filteredLogs.length > 0 ? (
          <>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {filteredLogs.map((log) => {
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
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Mostrar</span>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map(size => (
                      <SelectItem key={size} value={size.toString()}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>de {totalCount} registros</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Página {currentPage} de {pageCount || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= pageCount}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : logs && logs.length > 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No se encontraron resultados para "{searchQuery}"</p>
          </div>
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
