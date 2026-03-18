import { LucideIcon, Globe, Shield, Ban, AlertTriangle, ShieldCheck } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
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

export interface BlockRecommendation {
  ip: string;
  user: string;
  reason: string;
  urgency: string;
  duration_hours: number;
}

export interface IPAnalysis {
  summary: string;
  risk_level: string;
  familiar_ips: Array<{ ip: string; reason: string; user: string }>;
  suspicious_ips: Array<{ ip: string; reason: string; user: string; recommendation: string; should_block?: boolean }>;
  dangerous_ips: Array<{ ip: string; reason: string; user: string; recommendation: string; should_block?: boolean }>;
  user_analysis: Array<{ user: string; status: string; notes: string }>;
  recommendations: string[];
  block_recommendations?: BlockRecommendation[];
}

export interface SecurityRecommendation {
  priority: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export const SECURITY_RECOMMENDATIONS: SecurityRecommendation[] = [
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

export const riskColor = (level: string) => {
  switch (level) {
    case 'low': return 'text-green-500';
    case 'medium': return 'text-yellow-500';
    case 'high': return 'text-red-500';
    default: return 'text-muted-foreground';
  }
};

export const riskBg = (level: string) => {
  switch (level) {
    case 'low': return 'bg-green-500/10';
    case 'medium': return 'bg-yellow-500/10';
    case 'high': return 'bg-red-500/10';
    default: return 'bg-muted';
  }
};

export const priorityColor = (p: string) => {
  switch (p) {
    case 'critical': return 'border-red-500/30 bg-red-500/5';
    case 'high': return 'border-orange-500/30 bg-orange-500/5';
    case 'medium': return 'border-yellow-500/30 bg-yellow-500/5';
    default: return 'border-border bg-muted/30';
  }
};

export const urgencyLabel = (u: string) => {
  switch (u) {
    case 'immediate': return { text: 'Inmediato', className: 'bg-red-500/10 text-red-600 border-red-500/30' };
    case 'soon': return { text: 'Pronto', className: 'bg-orange-500/10 text-orange-600 border-orange-500/30' };
    default: return { text: 'Monitorear', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' };
  }
};

export function generateSecurityPDF(analysis: IPAnalysis, activeBlocks: SecurityBlock[]): jsPDF {
  const doc = new jsPDF();
  const now = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });

  doc.setFontSize(18);
  doc.setTextColor(33, 33, 33);
  doc.text('Informe de Seguridad - Análisis de IPs', 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generado: ${now}`, 14, 28);
  doc.text(`Nivel de riesgo: ${analysis.risk_level === 'low' ? 'Bajo' : analysis.risk_level === 'medium' ? 'Medio' : 'Alto'}`, 14, 34);

  doc.setFontSize(12);
  doc.setTextColor(33, 33, 33);
  doc.text('Resumen Ejecutivo', 14, 44);
  doc.setFontSize(9);
  doc.setTextColor(66, 66, 66);
  const summaryLines = doc.splitTextToSize(analysis.summary, 180);
  doc.text(summaryLines, 14, 52);

  let yPos = 52 + summaryLines.length * 5 + 8;

  if (analysis.block_recommendations?.length) {
    doc.setFontSize(12);
    doc.setTextColor(200, 0, 0);
    doc.text('🚨 Recomendaciones de Bloqueo de la IA', 14, yPos);
    yPos += 6;
    autoTable(doc, {
      startY: yPos,
      head: [['IP', 'Usuario', 'Urgencia', 'Duración', 'Motivo']],
      body: analysis.block_recommendations.map(r => [
        r.ip, r.user,
        r.urgency === 'immediate' ? 'Inmediato' : r.urgency === 'soon' ? 'Pronto' : 'Monitorear',
        `${r.duration_hours}h`, r.reason,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [200, 0, 0] },
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

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
        b.user_email, b.ip_address || '—', b.reason,
        format(new Date(b.expires_at), 'dd/MM/yyyy HH:mm', { locale: es }),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [239, 68, 68] },
    });
  }

  return doc;
}
