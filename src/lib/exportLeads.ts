import * as XLSX from 'xlsx';
import { Lead } from '@/types/lead';

const formatLeadForExport = (lead: Lead) => ({
  'Empresa': lead.companyName,
  'Contacto': lead.contactName || '',
  'Email': lead.email || '',
  'Teléfono': lead.phone || '',
  'Ciudad': lead.city,
  'Dirección': lead.address || '',
  'Segmento': lead.segment,
  'Estado': lead.status,
  'Origen': lead.source,
  'Sitio Web': lead.website || '',
  'Equipos': lead.equipmentCount || '',
  'Notas': lead.notes || '',
  'Tags': lead.tags?.join(', ') || '',
  'Último Contacto': lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleDateString('es-ES') : '',
  'Creado': new Date(lead.createdAt).toLocaleDateString('es-ES'),
  'Actualizado': new Date(lead.updatedAt).toLocaleDateString('es-ES'),
});

export const exportToCSV = (leads: Lead[], filename: string = 'leads') => {
  const data = leads.map(formatLeadForExport);
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToExcel = (leads: Lead[], filename: string = 'leads') => {
  const data = leads.map(formatLeadForExport);
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  
  // Auto-size columns
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, ...data.map(row => String(row[key as keyof typeof row] || '').length))
  }));
  worksheet['!cols'] = colWidths;
  
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};
