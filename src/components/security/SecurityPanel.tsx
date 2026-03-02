import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldAlert, ShieldCheck, Unlock, Clock, Globe, RefreshCw, Users } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface SecurityBlock {
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

export function SecurityPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<SecurityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState<string | null>(null);

  const fetchBlocks = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await supabase.functions.invoke('admin-users', {
        body: { action: 'list-blocks' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw res.error;
      setBlocks(res.data?.blocks || []);
    } catch (err: any) {
      toast.error('Error al cargar bloqueos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBlocks(); }, []);

  const handleUnblock = async (blockId: string) => {
    setUnlocking(blockId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await supabase.functions.invoke('admin-users', {
        body: { action: 'unblock', blockId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw res.error;
      toast.success('Usuario desbloqueado');
      fetchBlocks();
    } catch {
      toast.error('Error al desbloquear');
    } finally {
      setUnlocking(null);
    }
  };

  const activeBlocks = blocks.filter(b => b.is_active && new Date(b.expires_at) > new Date());
  const resolvedBlocks = blocks.filter(b => !b.is_active || new Date(b.expires_at) <= new Date());

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeBlocks.length}</p>
              <p className="text-xs text-muted-foreground">Bloqueos activos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{resolvedBlocks.length}</p>
              <p className="text-xs text-muted-foreground">Resueltos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Globe className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{blocks.length}</p>
              <p className="text-xs text-muted-foreground">Total histórico</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Blocks */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-destructive" />
                Bloqueos activos
              </CardTitle>
              <CardDescription>Cuentas con acceso restringido por anomalías de seguridad</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchBlocks} className="gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Actualizar
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/admin/users')} className="gap-1.5">
                <Users className="w-3.5 h-3.5" /> Gestión usuarios
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeBlocks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-primary/40" />
              <p className="text-sm font-medium">Sin bloqueos activos</p>
              <p className="text-xs">Todos los accesos son seguros</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeBlocks.map(block => (
                  <TableRow key={block.id}>
                    <TableCell className="font-medium text-sm">{block.user_email}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{block.reason}</span>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{block.ip_address || '—'}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(block.expires_at), { locale: es, addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnblock(block.id)}
                        disabled={unlocking === block.id}
                        className="gap-1.5"
                      >
                        {unlocking === block.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                        Desbloquear
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {resolvedBlocks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Historial de bloqueos
            </CardTitle>
            <CardDescription>Bloqueos resueltos o expirados</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedBlocks.slice(0, 20).map(block => (
                  <TableRow key={block.id} className="opacity-70">
                    <TableCell className="font-medium text-sm">{block.user_email}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{block.reason}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(block.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={block.resolved_at ? 'default' : 'secondary'} className="text-[10px]">
                        {block.resolved_at ? 'Desbloqueado' : 'Expirado'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
