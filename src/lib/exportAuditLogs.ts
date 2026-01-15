import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AuditLogEntry } from '@/hooks/useAuditLogs';

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

function formatDetails(action: string, details: Record<string, unknown> | null): string {
  if (!details) return '';
  
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

export function exportAuditLogsToCSV(logs: AuditLogEntry[], filename?: string): void {
  const headers = ['Fecha', 'Hora', 'Acción', 'Tipo', 'Detalles', 'ID Entidad'];
  
  const rows = logs.map(log => [
    format(new Date(log.created_at), 'dd/MM/yyyy'),
    format(new Date(log.created_at), 'HH:mm:ss'),
    actionLabels[log.action] || log.action,
    log.entity_type,
    formatDetails(log.action, log.details),
    log.entity_id || '',
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
  ].join('\n');
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportAuditLogsToPDF(logs: AuditLogEntry[], filename?: string): void {
  const doc = new jsPDF();
  
  // Title
  doc.setFontSize(18);
  doc.text('Registro de Actividad', 14, 22);
  
  // Subtitle with date
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generado el ${format(new Date(), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}`, 14, 30);
  doc.text(`Total de registros: ${logs.length}`, 14, 36);
  
  // Table data
  const tableData = logs.map(log => [
    format(new Date(log.created_at), 'dd/MM/yyyy HH:mm'),
    actionLabels[log.action] || log.action,
    log.entity_type,
    formatDetails(log.action, log.details).slice(0, 50),
  ]);
  
  // Generate table
  autoTable(doc, {
    startY: 42,
    head: [['Fecha', 'Acción', 'Tipo', 'Detalles']],
    body: tableData,
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 45 },
      2: { cellWidth: 30 },
      3: { cellWidth: 'auto' },
    },
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  doc.save(filename || `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
