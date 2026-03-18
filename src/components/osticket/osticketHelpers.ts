/* ─── OsTicket helpers & constants ─── */

export const parseEmail = (raw: string | null): string => {
  if (!raw) return '';
  const str = raw.trim();
  if (str.startsWith('{') || str.startsWith('"')) {
    try {
      const parsed = JSON.parse(str);
      if (typeof parsed === 'string') {
        try { const inner = JSON.parse(parsed); if (inner.email) return inner.email; } catch { /* */ }
        const m = parsed.match(/<([^>]+)>/); if (m) return m[1]; return parsed;
      }
      if (parsed.email) return parsed.email;
      if (parsed.address) { const m = parsed.address.match(/<([^>]+)>/); return m ? m[1] : parsed.address; }
      return raw;
    } catch { /* */ }
    const m = str.match(/[\w.+-]+@[\w.-]+\.\w{2,}/); if (m) return m[0];
  }
  const m = str.match(/<([^>]+)>/); return m ? m[1] : raw;
};

export const PRIORITY_CONFIG: Record<string, { label: string; color: 'destructive' | 'default' | 'secondary' | 'outline'; dot: string }> = {
  alta: { label: 'Alta', color: 'destructive', dot: 'bg-red-500' },
  high: { label: 'Alta', color: 'destructive', dot: 'bg-red-500' },
  emergency: { label: 'Urgente', color: 'destructive', dot: 'bg-red-600' },
  media: { label: 'Media', color: 'default', dot: 'bg-amber-500' },
  normal: { label: 'Normal', color: 'default', dot: 'bg-amber-500' },
  baja: { label: 'Baja', color: 'secondary', dot: 'bg-green-500' },
  low: { label: 'Baja', color: 'secondary', dot: 'bg-green-500' },
};

export const getPriorityCfg = (p: string | null) =>
  PRIORITY_CONFIG[p?.toLowerCase() ?? ''] ?? { label: p || 'Normal', color: 'outline' as const, dot: 'bg-muted-foreground' };

export const VARIABLES = [
  { key: '{{ticket_id}}', label: 'ID' },
  { key: '{{number}}', label: 'Nº' },
  { key: '{{subject}}', label: 'Asunto' },
  { key: '{{name}}', label: 'Cliente' },
  { key: '{{email}}', label: 'Email' },
  { key: '{{department}}', label: 'Depto.' },
  { key: '{{priority}}', label: 'Prioridad' },
  { key: '{{ticket_url}}', label: 'URL' },
];

export const QUICK_PHRASES = [
  '✅ Hemos recibido tu ticket y lo estamos procesando.',
  '🔧 Un técnico se pondrá en contacto contigo en breve.',
  '📋 ¿Podrías darnos más información sobre el problema?',
  '🎉 Tu solicitud ha sido resuelta. ¡Que tengas un buen día!',
  '⏰ El tiempo estimado de resolución es de 24-48 horas.',
  '📞 Te llamaremos para coordinar la visita técnica.',
  '🔄 Estamos investigando el problema, te mantendremos informado.',
  '📧 Hemos escalado tu ticket al equipo correspondiente.',
];

export interface AttachedFile {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  isImage: boolean;
}

export const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};
