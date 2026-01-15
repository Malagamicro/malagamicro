import ExcelJS from 'exceljs';
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
  
  if (data.length === 0) return;
  
  // Get headers from the first row
  const headers = Object.keys(data[0]);
  
  // Create CSV content with proper escaping
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = String(row[header as keyof typeof row] || '');
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToExcel = async (leads: Lead[], filename: string = 'leads') => {
  const data = leads.map(formatLeadForExport);
  
  if (data.length === 0) return;
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Leads');
  
  // Get headers and add as first row
  const headers = Object.keys(data[0]);
  worksheet.addRow(headers);
  
  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  
  // Add data rows
  data.forEach(row => {
    worksheet.addRow(headers.map(header => row[header as keyof typeof row] || ''));
  });
  
  // Auto-size columns
  worksheet.columns.forEach((column, index) => {
    const header = headers[index] || '';
    let maxLength = header.length;
    
    data.forEach(row => {
      const value = String(row[header as keyof typeof row] || '');
      if (value.length > maxLength) {
        maxLength = value.length;
      }
    });
    
    column.width = Math.min(maxLength + 2, 50);
  });
  
  // Generate and download file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.xlsx`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
