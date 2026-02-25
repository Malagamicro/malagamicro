import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Database, Users, Activity, HardDrive, RefreshCw, Search,
  Globe, Monitor, Smartphone, Clock, MapPin, ChevronLeft, ChevronRight,
  TrendingUp, BarChart3,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function PerformanceDashboard() {
  const { user } = useAuth();
  const [loginPage, setLoginPage] = useState(1);
  const [interactionPage, setInteractionPage] = useState(1);
  const [interactionSearch, setInteractionSearch] = useState('');
  const pageSize = 25;

  // DB Stats
  const { data: dbStats, isLoading: dbLoading, refetch: refetchDb } = useQuery({
    queryKey: ['db-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('db-stats');
      if (error) throw error;
      return data as {
        tableCounts: Record<string, number>;
        storageCounts: Record<string, number>;
        totalRecords: number;
        totalTables: number;
        totalBuckets: number;
      };
    },
    enabled: !!user,
    staleTime: 60000,
  });

  // Login logs
  const { data: loginLogs, isLoading: loginLoading } = useQuery({
    queryKey: ['login-logs', loginPage],
    queryFn: async () => {
      const from = (loginPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: logs, error, count } = await supabase
        .from('user_login_logs')
        .select('*, profiles:user_id(full_name, avatar_url)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { logs: logs || [], total: count || 0 };
    },
    enabled: !!user,
  });

  // Interaction logs
  const { data: interactionLogs, isLoading: interactionLoading } = useQuery({
    queryKey: ['interaction-logs', interactionPage, interactionSearch],
    queryFn: async () => {
      const from = (interactionPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('user_interaction_logs')
        .select('*, profiles:user_id(full_name)', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (interactionSearch) {
        query = query.or(`action.ilike.%${interactionSearch}%,page.ilike.%${interactionSearch}%,element.ilike.%${interactionSearch}%`);
      }

      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      return { logs: data || [], total: count || 0 };
    },
    enabled: !!user,
  });

  // Online users count
  const { data: onlineCount } = useQuery({
    queryKey: ['online-users-count'],
    queryFn: async () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('user_presence')
        .select('*', { count: 'exact', head: true })
        .eq('is_online', true)
        .gte('last_seen_at', fiveMinAgo);
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const formatNum = (n: number) => n.toLocaleString('es-ES');

  const getActionIcon = (action: string) => {
    if (action === 'navigation') return '🧭';
    if (action === 'click') return '👆';
    if (action === 'login') return '🔑';
    return '📝';
  };

  const getActionColor = (action: string) => {
    if (action === 'navigation') return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
    if (action === 'click') return 'bg-green-500/10 text-green-600 dark:text-green-400';
    return 'bg-muted text-muted-foreground';
  };

  // Sort tables by count descending
  const sortedTables = dbStats
    ? Object.entries(dbStats.tableCounts).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Database className="h-4 w-4" />
            <span className="text-xs font-medium">Registros totales</span>
          </div>
          <p className="text-2xl font-bold">{dbStats ? formatNum(dbStats.totalRecords) : '—'}</p>
          <p className="text-[10px] text-muted-foreground">{dbStats?.totalTables || 0} tablas activas</p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <HardDrive className="h-4 w-4" />
            <span className="text-xs font-medium">Storage Buckets</span>
          </div>
          <p className="text-2xl font-bold">{dbStats?.totalBuckets || 0}</p>
          <p className="text-[10px] text-muted-foreground">
            {dbStats ? formatNum(Object.values(dbStats.storageCounts).reduce((a, b) => a + b, 0)) : 0} archivos
          </p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Usuarios online</span>
          </div>
          <p className="text-2xl font-bold">{onlineCount ?? '—'}</p>
          <p className="text-[10px] text-muted-foreground">Últimos 5 minutos</p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span className="text-xs font-medium">Logins registrados</span>
          </div>
          <p className="text-2xl font-bold">{loginLogs ? formatNum(loginLogs.total) : '—'}</p>
          <p className="text-[10px] text-muted-foreground">Total histórico</p>
        </Card>
      </div>

      <Tabs defaultValue="database" className="space-y-3">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="database" className="gap-1.5"><Database className="h-3.5 w-3.5" /> Base de datos</TabsTrigger>
          <TabsTrigger value="logins" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Accesos</TabsTrigger>
          <TabsTrigger value="interactions" className="gap-1.5"><Activity className="h-3.5 w-3.5" /> Interacciones</TabsTrigger>
        </TabsList>

        {/* Database Tab */}
        <TabsContent value="database" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Uso por tabla</h3>
            <Button variant="ghost" size="sm" onClick={() => refetchDb()} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Actualizar
            </Button>
          </div>
          {dbLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {sortedTables.map(([table, count]) => {
                const maxCount = sortedTables[0]?.[1] || 1;
                const pct = Math.max(5, (count / maxCount) * 100);
                return (
                  <Card key={table} className="p-3 relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-primary/5"
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative">
                      <p className="text-xs font-medium truncate">{table}</p>
                      <p className="text-lg font-bold">{formatNum(count)}</p>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Storage */}
          {dbStats && (
            <>
              <h3 className="text-sm font-semibold pt-2">Storage Buckets</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(dbStats.storageCounts).map(([bucket, count]) => (
                  <Card key={bucket} className="p-3">
                    <p className="text-xs font-medium truncate">{bucket}</p>
                    <p className="text-lg font-bold">{formatNum(count)}</p>
                    <p className="text-[10px] text-muted-foreground">archivos</p>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Login Logs Tab */}
        <TabsContent value="logins" className="space-y-3">
          <h3 className="text-sm font-semibold">Historial de accesos</h3>
          <ScrollArea className="h-[calc(100vh-22rem)]">
            <div className="space-y-1.5">
              {loginLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
                ))
              ) : loginLogs?.logs.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No hay accesos registrados aún</p>
              ) : (
                loginLogs?.logs.map((log: any) => (
                  <Card key={log.id} className="p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {log.device_type === 'mobile' ? (
                        <Smartphone className="h-4 w-4 text-primary" />
                      ) : (
                        <Monitor className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {(log as any).profiles?.full_name || 'Usuario'}
                        </p>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {log.ip_address || '—'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {log.city && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" />
                            {log.city}{log.country ? `, ${log.country}` : ''}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: es })}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
          {loginLogs && loginLogs.total > pageSize && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Página {loginPage} de {Math.ceil(loginLogs.total / pageSize)}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={loginPage <= 1} onClick={() => setLoginPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" disabled={loginPage >= Math.ceil(loginLogs.total / pageSize)} onClick={() => setLoginPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Interactions Tab */}
        <TabsContent value="interactions" className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold flex-1">Log de interacciones</h3>
            <div className="relative w-48">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={interactionSearch}
                onChange={e => { setInteractionSearch(e.target.value); setInteractionPage(1); }}
                className="pl-7 h-8 text-xs"
              />
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-22rem)]">
            <div className="space-y-1">
              {interactionLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 rounded bg-muted animate-pulse" />
                ))
              ) : interactionLogs?.logs.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No hay interacciones registradas</p>
              ) : (
                interactionLogs?.logs.map((log: any) => (
                  <div key={log.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 text-xs">
                    <span>{getActionIcon(log.action)}</span>
                    <Badge variant="secondary" className={`text-[10px] px-1.5 ${getActionColor(log.action)}`}>
                      {log.action}
                    </Badge>
                    <span className="text-muted-foreground truncate flex-1">
                      {log.element || log.page || '—'}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-[10px]">
                      {(log as any).profiles?.full_name?.split(' ')[0] || '—'}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-[10px]">
                      {format(new Date(log.created_at), 'HH:mm:ss', { locale: es })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          {interactionLogs && interactionLogs.total > pageSize && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                {formatNum(interactionLogs.total)} interacciones · Página {interactionPage} de {Math.ceil(interactionLogs.total / pageSize)}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={interactionPage <= 1} onClick={() => setInteractionPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" disabled={interactionPage >= Math.ceil(interactionLogs.total / pageSize)} onClick={() => setInteractionPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
