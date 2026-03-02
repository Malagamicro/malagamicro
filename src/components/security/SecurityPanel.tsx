import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldAlert, ShieldCheck, Unlock, Clock, Globe, RefreshCw, Users, Brain, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

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

interface IPAnalysis {
  summary: string;
  risk_level: string;
  familiar_ips: Array<{ ip: string; reason: string; user: string }>;
  suspicious_ips: Array<{ ip: string; reason: string; user: string; recommendation: string }>;
  dangerous_ips: Array<{ ip: string; reason: string; user: string; recommendation: string }>;
  user_analysis: Array<{ user: string; status: string; notes: string }>;
  recommendations: string[];
}

export function SecurityPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<SecurityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<IPAnalysis | null>(null);

  const fetchBlocks = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/admin-users?action=list-blocks`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to fetch blocks');
      const data = await res.json();
      setBlocks(data?.blocks || []);
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

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/admin-users?action=unblock`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ blockId }),
      });

      if (!res.ok) throw new Error('Failed to unblock');
      toast.success('Usuario desbloqueado');
      fetchBlocks();
    } catch {
      toast.error('Error al desbloquear');
    } finally {
      setUnlocking(null);
    }
  };

  const handleAnalyzeIPs = async () => {
    setAnalyzing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/analyze-ip`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al analizar IPs');
      }

      const data = await res.json();
      setAnalysis(data.analysis);
      toast.success('Análisis de IPs completado');
    } catch (err: any) {
      toast.error(err.message || 'Error al analizar IPs');
    } finally {
      setAnalyzing(false);
    }
  };

  const activeBlocks = blocks.filter(b => b.is_active && new Date(b.expires_at) > new Date());
  const resolvedBlocks = blocks.filter(b => !b.is_active || new Date(b.expires_at) <= new Date());

  const riskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const riskBg = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-500/10';
      case 'medium': return 'bg-yellow-500/10';
      case 'high': return 'bg-red-500/10';
      default: return 'bg-muted';
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'safe': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'monitored': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'at_risk': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Globe className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="transition-all duration-200 hover:shadow-md">
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
        <Card className="transition-all duration-200 hover:shadow-md">
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
        <Card className="transition-all duration-200 hover:shadow-md">
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

      {/* AI Analysis Button */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Análisis inteligente de IPs</h3>
              <p className="text-xs text-muted-foreground">IA analiza patrones de login, geolocalización y comportamiento</p>
            </div>
          </div>
          <Button
            onClick={handleAnalyzeIPs}
            disabled={analyzing}
            className="gap-2 shrink-0"
          >
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {analyzing ? 'Analizando...' : 'Analizar IPs con IA'}
          </Button>
        </CardContent>
      </Card>

      {/* AI Analysis Results */}
      {analysis && (
        <Card className="animate-fade-in">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                Resultado del análisis IA
              </CardTitle>
              <Badge className={`${riskBg(analysis.risk_level)} ${riskColor(analysis.risk_level)} border-0`}>
                Riesgo: {analysis.risk_level === 'low' ? 'Bajo' : analysis.risk_level === 'medium' ? 'Medio' : 'Alto'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p>{analysis.summary}</p>
            </div>

            {/* Dangerous IPs */}
            {analysis.dangerous_ips?.length > 0 && (
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-500" /> IPs peligrosas ({analysis.dangerous_ips.length})
                </h4>
                <div className="space-y-2">
                  {analysis.dangerous_ips.map((ip, i) => (
                    <div key={i} className="p-2 rounded-lg bg-red-500/5 border border-red-500/20 text-sm">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono bg-red-500/10 px-1.5 py-0.5 rounded">{ip.ip}</code>
                        <span className="text-xs text-muted-foreground">· {ip.user}</span>
                      </div>
                      <p className="text-xs mt-1">{ip.reason}</p>
                      <p className="text-xs text-red-500 mt-1 font-medium">→ {ip.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suspicious IPs */}
            {analysis.suspicious_ips?.length > 0 && (
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" /> IPs sospechosas ({analysis.suspicious_ips.length})
                </h4>
                <div className="space-y-2">
                  {analysis.suspicious_ips.map((ip, i) => (
                    <div key={i} className="p-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-sm">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono bg-yellow-500/10 px-1.5 py-0.5 rounded">{ip.ip}</code>
                        <span className="text-xs text-muted-foreground">· {ip.user}</span>
                      </div>
                      <p className="text-xs mt-1">{ip.reason}</p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1 font-medium">→ {ip.recommendation}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Familiar IPs */}
            {analysis.familiar_ips?.length > 0 && (
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> IPs familiares ({analysis.familiar_ips.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {analysis.familiar_ips.map((ip, i) => (
                    <div key={i} className="p-2 rounded-lg bg-green-500/5 border border-green-500/20 text-sm">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono bg-green-500/10 px-1.5 py-0.5 rounded">{ip.ip}</code>
                        <span className="text-xs text-muted-foreground">· {ip.user}</span>
                      </div>
                      <p className="text-xs mt-1 text-muted-foreground">{ip.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User Analysis */}
            {analysis.user_analysis?.length > 0 && (
              <div>
                <h4 className="text-sm font-bold mb-2">Análisis por usuario</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Observaciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.user_analysis.map((ua, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-medium">{ua.user}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {statusIcon(ua.status)}
                            <span className="text-xs capitalize">{ua.status === 'safe' ? 'Seguro' : ua.status === 'monitored' ? 'Monitorizado' : 'En riesgo'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[300px]">{ua.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Recommendations */}
            {analysis.recommendations?.length > 0 && (
              <div>
                <h4 className="text-sm font-bold mb-2">Recomendaciones</h4>
                <ul className="space-y-1">
                  {analysis.recommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
