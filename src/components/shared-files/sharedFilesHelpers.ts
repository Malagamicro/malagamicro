import {
  File, FileText, FileSpreadsheet, Presentation,
  Video, Music, Image as ImageIcon,
} from 'lucide-react';

export const TEMPLATE_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'soporte', label: 'Soporte' },
  { value: 'bienvenida', label: 'Bienvenida' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'otros', label: 'Otros' },
];

export function getFileIcon(fileType: string | null) {
  if (!fileType) return File;
  if (fileType.startsWith('image/')) return ImageIcon;
  if (fileType.startsWith('video/')) return Video;
  if (fileType.startsWith('audio/')) return Music;
  if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType.includes('csv')) return FileSpreadsheet;
  if (fileType.includes('presentation') || fileType.includes('powerpoint')) return Presentation;
  if (fileType.includes('pdf') || fileType.includes('document') || fileType.includes('text') || fileType.includes('word')) return FileText;
  return File;
}

export function getInitials(name: string | null | undefined) {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function canPreview(fileType: string | null): boolean {
  if (!fileType) return false;
  return (
    fileType.startsWith('image/') ||
    fileType.startsWith('video/') ||
    fileType.startsWith('audio/') ||
    fileType === 'application/pdf' ||
    fileType === 'text/markdown' ||
    fileType === 'text/plain' ||
    fileType === 'text/html' ||
    fileType === 'text/csv' ||
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileType === 'application/msword' ||
    fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileType === 'application/vnd.ms-excel' ||
    fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    fileType === 'application/vnd.ms-powerpoint'
  );
}

export function isOfficeDoc(fileType: string | null): boolean {
  if (!fileType) return false;
  return (
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileType === 'application/msword' ||
    fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    fileType === 'application/vnd.ms-excel' ||
    fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    fileType === 'application/vnd.ms-powerpoint'
  );
}

export function canEditInEditor(fileType: string | null): boolean {
  if (!fileType) return false;
  return (
    fileType === 'text/markdown' ||
    fileType === 'text/plain' ||
    fileType === 'text/csv' ||
    fileType === 'text/html' ||
    fileType.includes('spreadsheet') ||
    fileType.includes('excel')
  );
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(current); current = ''; }
      else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        row.push(current); current = ''; rows.push(row); row = [];
        if (ch === '\r') i++;
      } else { current += ch; }
    }
  }
  if (current || row.length > 0) { row.push(current); rows.push(row); }
  return rows;
}
