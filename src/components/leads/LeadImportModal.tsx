import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ParsedRow {
  [key: string]: string;
}

interface ColumnMapping {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  segment: string;
  source: string;
  equipmentCount: string;
  notes: string;
  tags: string;
}

interface LeadImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (leads: any[]) => void;
  isImporting?: boolean;
}

const requiredFields = ['companyName', 'city'];

const fieldLabels: Record<keyof ColumnMapping, string> = {
  companyName: 'Nombre de Empresa *',
  contactName: 'Nombre de Contacto',
  email: 'Email',
  phone: 'Teléfono',
  website: 'Web',
  address: 'Dirección',
  city: 'Ciudad *',
  segment: 'Segmento',
  source: 'Fuente',
  equipmentCount: 'Nº Equipos',
  notes: 'Notas',
  tags: 'Etiquetas',
};

export function LeadImportModal({ 
  open, 
  onOpenChange, 
  onImport,
  isImporting = false 
}: LeadImportModalProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep('upload');
    setParsedData([]);
    setHeaders([]);
    setMapping({});
    setError(null);
    setFileName('');
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const parseFile = async (file: File) => {
    setError(null);
    setFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<ParsedRow>(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        setError('El archivo debe tener al menos una fila de cabecera y una fila de datos.');
        return;
      }

      const headerRow = jsonData[0] as unknown as string[];
      const dataRows = jsonData.slice(1).map((row: any) => {
        const obj: ParsedRow = {};
        headerRow.forEach((header, index) => {
          obj[header] = row[index]?.toString() || '';
        });
        return obj;
      }).filter(row => Object.values(row).some(v => v.trim() !== ''));

      if (dataRows.length === 0) {
        setError('No se encontraron datos válidos en el archivo.');
        return;
      }

      setHeaders(headerRow.filter(h => h));
      setParsedData(dataRows);
      
      // Auto-map columns based on common names
      const autoMapping: Partial<ColumnMapping> = {};
      headerRow.forEach(header => {
        const lowerHeader = header.toLowerCase().trim();
        if (lowerHeader.includes('empresa') || lowerHeader.includes('company') || lowerHeader.includes('nombre empresa')) {
          autoMapping.companyName = header;
        } else if (lowerHeader.includes('contacto') || lowerHeader.includes('contact')) {
          autoMapping.contactName = header;
        } else if (lowerHeader.includes('email') || lowerHeader.includes('correo')) {
          autoMapping.email = header;
        } else if (lowerHeader.includes('teléfono') || lowerHeader.includes('telefono') || lowerHeader.includes('phone') || lowerHeader.includes('tel')) {
          autoMapping.phone = header;
        } else if (lowerHeader.includes('web') || lowerHeader.includes('website') || lowerHeader.includes('sitio')) {
          autoMapping.website = header;
        } else if (lowerHeader.includes('dirección') || lowerHeader.includes('direccion') || lowerHeader.includes('address')) {
          autoMapping.address = header;
        } else if (lowerHeader.includes('ciudad') || lowerHeader.includes('city')) {
          autoMapping.city = header;
        } else if (lowerHeader.includes('segmento') || lowerHeader.includes('segment')) {
          autoMapping.segment = header;
        } else if (lowerHeader.includes('fuente') || lowerHeader.includes('source') || lowerHeader.includes('origen')) {
          autoMapping.source = header;
        } else if (lowerHeader.includes('equipo') || lowerHeader.includes('equipment')) {
          autoMapping.equipmentCount = header;
        } else if (lowerHeader.includes('nota') || lowerHeader.includes('notes') || lowerHeader.includes('comentario')) {
          autoMapping.notes = header;
        } else if (lowerHeader.includes('etiqueta') || lowerHeader.includes('tag')) {
          autoMapping.tags = header;
        }
      });
      
      setMapping(autoMapping);
      setStep('mapping');
    } catch (err) {
      setError('Error al leer el archivo. Asegúrate de que es un archivo CSV o Excel válido.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      parseFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const isValidMapping = () => {
    return requiredFields.every(field => mapping[field as keyof ColumnMapping]);
  };

  const getMappedLeads = () => {
    return parsedData.map(row => {
      const normalizeSegment = (value: string): 'pyme' | 'franquicia' => {
        const lower = value.toLowerCase().trim();
        if (lower.includes('franquicia') || lower === 'franchise') return 'franquicia';
        return 'pyme';
      };

      const normalizeSource = (value: string): 'manual' | 'google_maps' | 'web_scraping' | 'referido' => {
        const lower = value.toLowerCase().trim();
        if (lower.includes('google') || lower.includes('maps')) return 'google_maps';
        if (lower.includes('web') || lower.includes('scraping')) return 'web_scraping';
        if (lower.includes('referido') || lower.includes('referral')) return 'referido';
        return 'manual';
      };

      const parseTags = (value: string): string[] => {
        if (!value) return [];
        return value.split(/[,;]/).map(t => t.trim()).filter(t => t);
      };

      return {
        companyName: row[mapping.companyName || ''] || '',
        contactName: row[mapping.contactName || ''] || undefined,
        email: row[mapping.email || ''] || undefined,
        phone: row[mapping.phone || ''] || undefined,
        website: row[mapping.website || ''] || undefined,
        address: row[mapping.address || ''] || undefined,
        city: row[mapping.city || ''] || 'Málaga',
        segment: normalizeSegment(row[mapping.segment || ''] || ''),
        source: normalizeSource(row[mapping.source || ''] || ''),
        equipmentCount: parseInt(row[mapping.equipmentCount || '']) || undefined,
        notes: row[mapping.notes || ''] || undefined,
        tags: parseTags(row[mapping.tags || ''] || ''),
        status: 'nuevo' as const,
      };
    }).filter(lead => lead.companyName.trim() !== '');
  };

  const handleImport = () => {
    const leads = getMappedLeads();
    onImport(leads);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'upload' && 'Importar Leads'}
            {step === 'mapping' && 'Mapear Columnas'}
            {step === 'preview' && 'Vista Previa'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Sube un archivo CSV o Excel con tus leads.'}
            {step === 'mapping' && 'Asocia las columnas del archivo con los campos de lead.'}
            {step === 'preview' && `Se importarán ${getMappedLeads().length} leads.`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex-1 overflow-hidden">
          {step === 'upload' && (
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground mb-2">
                Arrastra tu archivo aquí
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                o haz clic para seleccionar
              </p>
              <p className="text-xs text-muted-foreground">
                Formatos soportados: CSV, XLSX, XLS
              </p>
            </div>
          )}

          {step === 'mapping' && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="font-medium text-foreground mb-1">Archivo: {fileName}</p>
                  <p className="text-muted-foreground">{parsedData.length} filas encontradas</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {(Object.keys(fieldLabels) as Array<keyof ColumnMapping>).map((field) => (
                    <div key={field} className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        {fieldLabels[field]}
                      </label>
                      <Select
                        value={mapping[field] || ''}
                        onValueChange={(value) => setMapping(prev => ({ ...prev, [field]: value || undefined }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar columna" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">-- No mapear --</SelectItem>
                          {headers.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          )}

          {step === 'preview' && (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Ciudad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getMappedLeads().slice(0, 50).map((lead, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{lead.companyName}</TableCell>
                      <TableCell>{lead.contactName || '-'}</TableCell>
                      <TableCell>{lead.email || '-'}</TableCell>
                      <TableCell>{lead.city}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {getMappedLeads().length > 50 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  ... y {getMappedLeads().length - 50} más
                </p>
              )}
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Atrás
              </Button>
              <Button onClick={() => setStep('preview')} disabled={!isValidMapping()}>
                Continuar
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Atrás
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Importar {getMappedLeads().length} leads
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
