import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, ShieldAlert, ShieldCheck, Unlock, Clock, Globe } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export interface SecurityBlock {
  id: string;
  user_id: string;
  user_email: string;
  ip_address: string | null;
  reason: string;
  is_active: boolean;
  expires_at: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  alert_details: any;
}

interface SecurityTabProps {
  blocks: SecurityBlock[];
  blocksLoading: boolean;
  onUnblock: (blockId: string) => Promise<void>;
}

export function SecurityTab({ blocks, blocksLoading, onUnblock }: SecurityTabProps) {
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const activeBlocks = blocks.filter(b => b.is_active && new Date(b.expires_at) > new Date());
  const resolvedBlocks = blocks.filter(b => !b.is_active || new Date(b.expires_at) <= new Date());

  const handleUnblock = async (blockId: string) => {
    setUnblocking(blockId);
    try {
      await onUnblock(blockId);
    } finally {
      setUnblocking(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Blocks */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Bloqueos Activos
            {activeBlocks.length > 0 && (
              <Badge variant="destructive">{activeBlocks.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>Usuarios bloqueados por actividad sospechosa</CardDescription>
        </CardHeader>
        <CardContent>
          {blocksLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : activeBlocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mb-3 text-emerald-500" />
              <p className="text-lg font-medium">Sin bloqueos activos</p>
              <p className="text-sm">Todos los usuarios tienen acceso normal</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeBlocks.map((block) => (
                <div key={block.id} className="border border-destructive/20 rounded-lg p-4 bg-destructive/5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-destructive" />
                        <span className="font-semibold">{block.user_email}</span>
                        <Badge variant="destructive" className="text-xs">Bloqueado</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{block.reason}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        {block.ip_address && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            IP: {block.ip_address}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(block.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expira: {formatDistanceToNow(new Date(block.expires_at), { addSuffix: true, locale: es })}
                        </span>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="shrink-0 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950">
                          {unblocking === block.id ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Unlock className="h-4 w-4 mr-1" />
                          )}
                          Desbloquear
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Desbloquear usuario?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Se restaurará el acceso de <strong>{block.user_email}</strong>. Asegúrate de que la actividad sospechosa ha sido revisada.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleUnblock(block.id)}>
                            Desbloquear
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolved Blocks History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Historial de Bloqueos
          </CardTitle>
          <CardDescription>Bloqueos anteriores resueltos o expirados</CardDescription>
        </CardHeader>
        <CardContent>
          {resolvedBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin historial de bloqueos</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedBlocks.slice(0, 20).map((block) => (
                  <TableRow key={block.id}>
                    <TableCell className="font-medium">{block.user_email}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{block.reason}</TableCell>
                    <TableCell className="text-sm font-mono">{block.ip_address || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(block.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </TableCell>
                    <TableCell>
                      {block.resolved_at ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                          Desbloqueado
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Expirado</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
