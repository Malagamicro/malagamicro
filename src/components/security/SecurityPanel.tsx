import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldAlert, ShieldCheck, Unlock, Clock, Globe, RefreshCw, Users, Brain, CheckCircle2, AlertTriangle, XCircle, Ban, Shield, Info, FileDown, FolderUp } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

interface BlockRecommendation {
  ip: string;
  user: string;
  reason: string;
  urgency: string;
  duration_hours: number;
}

interface IPAnalysis {
  summary: string;
  risk_level: string;
  familiar_ips: Array<{ ip: string; reason: string; user: string }>;
  suspicious_ips: Array<{ ip: string; reason: string; user: string; recommendation: string; should_block?: boolean }>;
  dangerous_ips: Array<{ ip: string; reason: string; user: string; recommendation: string; should_block?: boolean }>;
  user_analysis: Array<{ user: string; status: string; notes: string }>;
  recommendations: string[];
  block_recommendations?: BlockRecommendation[];
}

const SECURITY_RECOMMENDATIONS = [
  {
    priority: 'critical',
    title: 'Verificar logins desde ubicaciones inusuales',
    description: 'Contactar con los usuarios que presenten logins desde países o ciudades no habituales para verificar la autenticidad. Si no son legítimos, forzar el reseteo de contraseña y revisar la actividad de la cuenta.',
    icon: Globe,
  },
  {
    priority: 'high',
    title: 'Detección de anomalías geográficas',
    description: 'El sistema detecta cambios bruscos de ubicación (ej. login desde España y minutos después desde EE.UU.) y bloquea automáticamente o solicita verificación adicional (MFA).',
    icon: Shield,
  },
  {
    priority: 'high',
    title: 'Protección contra fuerza bruta activa',
    description: 'Rate limiting, bloqueos temporales de IP y alertas automáticas están configurados. Se bloquea tras >10 intentos/hora o >5 IPs distintas/hora. Verificar si los bloqueos son ataques reales o errores humanos.',
    icon: Ban,
  },
  {
    priority: 'medium',
    title: 'Monitorización de IPs sospechosas',
    description: 'Las IPs detectadas como peligrosas por la IA pueden ser bloqueadas manualmente desde este panel. Monitorear patrones persistentes de acceso no autorizado.',
    icon: AlertTriangle,
  },
  {
    priority: 'medium',
    title: 'Multi-Factor Authentication (MFA)',
    description: 'Considerar la implementación de MFA para todos los usuarios, especialmente para accesos desde IPs externas a la red corporativa o situaciones de viaje.',
    icon: ShieldCheck,
  },
];

export function SecurityPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<SecurityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [blockingIP, setBlockingIP] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<IPAnalysis | null>(null);
  const [savingToFiles, setSavingToFiles] = useState(false);

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

  const handleBlockIP = async (ip: string, reason: string, userEmail?: string, durationHours: number = 24) => {
    setBlockingIP(ip);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/admin-users?action=block-ip`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ip_address: ip, reason, user_email: userEmail, duration_hours: durationHours }),
      });

      if (!res.ok) throw new Error('Failed to block IP');
      toast.success(`IP ${ip} bloqueada por ${durationHours}h`);
      fetchBlocks();
    } catch {
      toast.error('Error al bloquear IP');
    } finally {
      setBlockingIP(null);
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

  // Generate PDF report
  const generatePDF = () => {
    if (!analysis) {
      toast.error('Primero ejecuta el análisis de IPs');
      return;
    }

    const doc = new jsPDF();
    const now = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });

    // Header
    doc.setFontSize(18);
    doc.setTextColor(33, 33, 33);
    doc.text('Informe de Seguridad - Análisis de IPs', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generado: ${now}`, 14, 28);
    doc.text(`Nivel de riesgo: ${analysis.risk_level === 'low' ? 'Bajo' : analysis.risk_level === 'medium' ? 'Medio' : 'Alto'}`, 14, 34);

    // Summary
    doc.setFontSize(12);
    doc.setTextColor(33, 33, 33);
    doc.text('Resumen Ejecutivo', 14, 44);
    doc.setFontSize(9);
    doc.setTextColor(66, 66, 66);
    const summaryLines = doc.splitTextToSize(analysis.summary, 180);
    doc.text(summaryLines, 14, 52);

    let yPos = 52 + summaryLines.length * 5 + 8;

    // Block Recommendations from AI
    if (analysis.block_recommendations?.length) {
      doc.setFontSize(12);
      doc.setTextColor(200, 0, 0);
      doc.text('🚨 Recomendaciones de Bloqueo de la IA', 14, yPos);
      yPos += 6;

      autoTable(doc, {
        startY: yPos,
        head: [['IP', 'Usuario', 'Urgencia', 'Duración', 'Motivo']],
        body: analysis.block_recommendations.map(r => [
          r.ip,
          r.user,
          r.urgency === 'immediate' ? 'Inmediato' : r.urgency === 'soon' ? 'Pronto' : 'Monitorear',
          `${r.duration_hours}h`,
          r.reason,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [200, 0, 0] },
      });
      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    // Dangerous IPs
    if (analysis.dangerous_ips?.length) {
      if (yPos > 250) { doc.addPage(); yPos = 20; }
      doc.setFontSize(12);
      doc.setTextColor(200, 0, 0);
      doc.text('IPs Peligrosas', 14, yPos);
      yPos += 6;

      autoTable(doc, {
        startY: yPos,
        head: [['IP', 'Usuario', 'Motivo', 'Recomendación']],
        body: analysis.dangerous_ips.map(ip => [ip.ip, ip.user, ip.reason, ip.recommendation]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 38, 38] },
      });
      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    // Suspicious IPs
    if (analysis.suspicious_ips?.length) {
      if (yPos > 250) { doc.addPage(); yPos = 20; }
      doc.setFontSize(12);
      doc.setTextColor(180, 130, 0);
      doc.text('IPs Sospechosas', 14, yPos);
      yPos += 6;

      autoTable(doc, {
        startY: yPos,
        head: [['IP', 'Usuario', 'Motivo', 'Recomendación']],
        body: analysis.suspicious_ips.map(ip => [ip.ip, ip.user, ip.reason, ip.recommendation]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [234, 179, 8] },
      });
      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    // Familiar IPs
    if (analysis.familiar_ips?.length) {
      if (yPos > 250) { doc.addPage(); yPos = 20; }
      doc.setFontSize(12);
      doc.setTextColor(0, 150, 0);
      doc.text('IPs Familiares', 14, yPos);
      yPos += 6;

      autoTable(doc, {
        startY: yPos,
        head: [['IP', 'Usuario', 'Motivo']],
        body: analysis.familiar_ips.map(ip => [ip.ip, ip.user, ip.reason]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [34, 197, 94] },
      });
      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    // User Analysis
    if (analysis.user_analysis?.length) {
      if (yPos > 250) { doc.addPage(); yPos = 20; }
      doc.setFontSize(12);
      doc.setTextColor(33, 33, 33);
      doc.text('Análisis por Usuario', 14, yPos);
      yPos += 6;

      autoTable(doc, {
        startY: yPos,
        head: [['Usuario', 'Estado', 'Observaciones']],
        body: analysis.user_analysis.map(ua => [
          ua.user,
          ua.status === 'safe' ? 'Seguro' : ua.status === 'monitored' ? 'Monitorizado' : 'En riesgo',
          ua.notes,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });
      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    // Recommendations
    if (analysis.recommendations?.length) {
      if (yPos > 250) { doc.addPage(); yPos = 20; }
      doc.setFontSize(12);
      doc.setTextColor(33, 33, 33);
      doc.text('Recomendaciones', 14, yPos);
      yPos += 6;
      doc.setFontSize(9);
      doc.setTextColor(66, 66, 66);
      analysis.recommendations.forEach((rec, i) => {
        if (yPos > 280) { doc.addPage(); yPos = 20; }
        const lines = doc.splitTextToSize(`${i + 1}. ${rec}`, 180);
        doc.text(lines, 14, yPos);
        yPos += lines.length * 5 + 2;
      });
    }

    // Active blocks
    if (activeBlocks.length) {
      doc.addPage();
      yPos = 20;
      doc.setFontSize(12);
      doc.setTextColor(33, 33, 33);
      doc.text('Bloqueos Activos', 14, yPos);
      yPos += 6;

      autoTable(doc, {
        startY: yPos,
        head: [['Usuario', 'IP', 'Motivo', 'Expira']],
        body: activeBlocks.map(b => [
          b.user_email,
          b.ip_address || '—',
          b.reason,
          format(new Date(b.expires_at), 'dd/MM/yyyy HH:mm', { locale: es }),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [239, 68, 68] },
      });
    }

    return doc;
  };

  const handleExportPDF = () => {
    const doc = generatePDF();
    if (!doc) return;
    const fileName = `informe-seguridad-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
    doc.save(fileName);
    toast.success('Informe PDF descargado');
  };

  const handleSaveToFiles = async () => {
    const doc = generatePDF();
    if (!doc) return;

    setSavingToFiles(true);
    try {
      const fileName = `informe-seguridad-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
      const pdfBlob = doc.output('blob');
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      const filePath = `security-reports/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('shared-files')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Save record in shared_files table
      const { error: dbError } = await supabase.from('shared_files').insert({
        file_name: fileName,
        file_path: filePath,
        file_size: pdfBlob.size,
        file_type: 'application/pdf',
        description: `Informe de seguridad - Análisis IA - Riesgo: ${analysis?.risk_level === 'low' ? 'Bajo' : analysis?.risk_level === 'medium' ? 'Medio' : 'Alto'}`,
        user_id: user!.id,
      });

      if (dbError) throw dbError;

      toast.success('Informe guardado en Archivos Compartidos');
    } catch (err: any) {
      console.error('Error saving to files:', err);
      toast.error('Error al guardar el informe');
    } finally {
      setSavingToFiles(false);
    }
  };

  // Only show truly active blocks
  const activeBlocks = blocks.filter(b => b.is_active && !b.resolved_at && new Date(b.expires_at) > new Date());
  const resolvedBlocks = blocks.filter(b => !b.is_active || b.resolved_at || new Date(b.expires_at) <= new Date());

  const isIPBlocked = (ip: string) => activeBlocks.some(b => b.ip_address === ip);

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

  const priorityColor = (p: string) => {
    switch (p) {
      case 'critical': return 'border-red-500/30 bg-red-500/5';
      case 'high': return 'border-orange-500/30 bg-orange-500/5';
      case 'medium': return 'border-yellow-500/30 bg-yellow-500/5';
      default: return 'border-border bg-muted/30';
    }
  };

  const urgencyLabel = (u: string) => {
    switch (u) {
      case 'immediate': return { text: 'Inmediato', className: 'bg-red-500/10 text-red-600 border-red-500/30' };
      case 'soon': return { text: 'Pronto', className: 'bg-orange-500/10 text-orange-600 border-orange-500/30' };
      default: return { text: 'Monitorear', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' };
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
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleAnalyzeIPs}
              disabled={analyzing}
              className="gap-2 shrink-0"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {analyzing ? 'Analizando...' : 'Analizar IPs con IA'}
            </Button>
            {analysis && (
              <>
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5">
                  <FileDown className="w-4 h-4" /> Exportar PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleSaveToFiles} disabled={savingToFiles} className="gap-1.5">
                  {savingToFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderUp className="w-4 h-4" />}
                  Guardar en Archivos
                </Button>
              </>
            )}
          </div>
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

            {/* AI Block Recommendations */}
            {analysis.block_recommendations?.length ? (
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2 mb-2">
                  <Ban className="w-4 h-4 text-red-500" /> Recomendaciones de bloqueo ({analysis.block_recommendations.length})
                </h4>
                <div className="space-y-2">
                  {analysis.block_recommendations.map((rec, i) => {
                    const urgency = urgencyLabel(rec.urgency);
                    return (
                      <div key={i} className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-sm">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono bg-red-500/10 px-1.5 py-0.5 rounded">{rec.ip}</code>
                            <span className="text-xs text-muted-foreground">· {rec.user}</span>
                            <Badge variant="outline" className={`text-[9px] h-4 ${urgency.className}`}>
                              {urgency.text}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">({rec.duration_hours}h)</span>
                          </div>
                          {isIPBlocked(rec.ip) ? (
                            <Badge variant="destructive" className="text-[10px] gap-1">
                              <Ban className="w-3 h-3" /> Ya bloqueada
                            </Badge>
                          ) : (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="gap-1.5 h-7 text-xs"
                              disabled={blockingIP === rec.ip}
                              onClick={() => handleBlockIP(rec.ip, rec.reason, rec.user, rec.duration_hours)}
                            >
                              {blockingIP === rec.ip ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                              Bloquear {rec.duration_hours}h
                            </Button>
                          )}
                        </div>
                        <p className="text-xs mt-1.5">{rec.reason}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Dangerous IPs */}
            {analysis.dangerous_ips?.length > 0 && (
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-500" /> IPs peligrosas ({analysis.dangerous_ips.length})
                </h4>
                <div className="space-y-2">
                  {analysis.dangerous_ips.map((ip, i) => (
                    <div key={i} className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-red-500/10 px-1.5 py-0.5 rounded">{ip.ip}</code>
                          <span className="text-xs text-muted-foreground">· {ip.user}</span>
                          {ip.should_block && (
                            <Badge variant="outline" className="text-[9px] h-4 bg-red-500/10 text-red-600 border-red-500/30">
                              IA recomienda bloquear
                            </Badge>
                          )}
                        </div>
                        {isIPBlocked(ip.ip) ? (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <Ban className="w-3 h-3" /> Bloqueada
                          </Badge>
                        ) : (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="gap-1.5 h-7 text-xs"
                            disabled={blockingIP === ip.ip}
                            onClick={() => handleBlockIP(ip.ip, ip.reason, ip.user)}
                          >
                            {blockingIP === ip.ip ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                            Bloquear IP
                          </Button>
                        )}
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
                    <div key={i} className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-yellow-500/10 px-1.5 py-0.5 rounded">{ip.ip}</code>
                          <span className="text-xs text-muted-foreground">· {ip.user}</span>
                          {ip.should_block && (
                            <Badge variant="outline" className="text-[9px] h-4 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                              IA recomienda bloquear
                            </Badge>
                          )}
                        </div>
                        {isIPBlocked(ip.ip) ? (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Ban className="w-3 h-3" /> Bloqueada
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-7 text-xs border-yellow-500/30 text-yellow-600 hover:bg-yellow-500/10"
                            disabled={blockingIP === ip.ip}
                            onClick={() => handleBlockIP(ip.ip, ip.reason, ip.user)}
                          >
                            {blockingIP === ip.ip ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                            Bloquear
                          </Button>
                        )}
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

            {/* AI Recommendations */}
            {analysis.recommendations?.length > 0 && (
              <div>
                <h4 className="text-sm font-bold mb-2">Recomendaciones de la IA</h4>
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

      {/* Security Recommendations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Recomendaciones de seguridad
          </CardTitle>
          <CardDescription>Políticas y medidas de protección activas y recomendadas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {SECURITY_RECOMMENDATIONS.map((rec, i) => {
            const Icon = rec.icon;
            return (
              <div key={i} className={`p-3 rounded-lg border ${priorityColor(rec.priority)} flex items-start gap-3`}>
                <div className="mt-0.5 shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="text-sm font-semibold">{rec.title}</h4>
                    <Badge variant="outline" className="text-[9px] h-4">
                      {rec.priority === 'critical' ? 'Crítico' : rec.priority === 'high' ? 'Alta' : 'Media'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>
                </div>
              </div>
            );
          })}
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
                  <TableHead>IP</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedBlocks.slice(0, 20).map(block => (
                  <TableRow key={block.id} className="opacity-70">
                    <TableCell className="font-medium text-sm">{block.user_email}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{block.reason}</TableCell>
                    <TableCell className="text-xs font-mono">{block.ip_address || '—'}</TableCell>
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
