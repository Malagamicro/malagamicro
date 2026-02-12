import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FileText, Save, Download, Sparkles, Send, Loader2, X,
  Bold, Italic, Heading1, Heading2, List, ListOrdered,
  Minus, Quote, Code, Trash2,
  PanelRightOpen, PanelRightClose, Cloud, ArrowLeft,
  FileDown, Plus, Table, FileSpreadsheet, StickyNote,
  Upload, Share2, Eye, EyeOff, Columns2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import jsPDF from 'jspdf';

// ── Types ──────────────────────────────────────────
type FileType = 'markdown' | 'spreadsheet' | 'text';
type AiAction = 'write' | 'edit' | 'improve' | 'summarize';
type ViewMode = 'edit' | 'preview' | 'split';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }
interface SpreadsheetCell { value: string; }

interface DocumentEditorProps {
  initialContent?: string;
  initialTitle?: string;
  onSaveToCloud?: (title: string, content: string) => Promise<void>;
  showBackButton?: boolean;
}

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');
}

// ── Spreadsheet Component ──────────────────────────
function SpreadsheetEditor({ data, onChange }: { data: SpreadsheetCell[][]; onChange: (d: SpreadsheetCell[][]) => void }) {
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);

  const updateCell = (row: number, col: number, value: string) => {
    const newData = data.map((r, ri) => r.map((c, ci) => ri === row && ci === col ? { value } : c));
    onChange(newData);
  };

  const addRow = () => {
    const cols = data[0]?.length || 5;
    onChange([...data, Array.from({ length: cols }, () => ({ value: '' }))]);
  };

  const addCol = () => {
    onChange(data.map(r => [...r, { value: '' }]));
  };

  const deleteRow = (idx: number) => {
    if (data.length <= 1) return;
    onChange(data.filter((_, i) => i !== idx));
  };

  const deleteCol = (idx: number) => {
    if ((data[0]?.length || 0) <= 1) return;
    onChange(data.map(r => r.filter((_, i) => i !== idx)));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addRow}>
          <Plus className="h-3 w-3 mr-1" /> Fila
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addCol}>
          <Plus className="h-3 w-3 mr-1" /> Columna
        </Button>
        {selectedCell && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => deleteRow(selectedCell[0])}>
              Eliminar fila
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => deleteCol(selectedCell[1])}>
              Eliminar columna
            </Button>
          </>
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="overflow-auto">
          <table className="border-collapse w-full min-w-max">
            <thead>
              <tr>
                <th className="w-10 bg-muted/50 border text-xs text-center text-muted-foreground p-1">#</th>
                {data[0]?.map((_, ci) => (
                  <th key={ci} className="bg-muted/50 border text-xs text-center text-muted-foreground p-1 min-w-[120px]">
                    {String.fromCharCode(65 + (ci % 26))}
                    {ci >= 26 ? String.fromCharCode(65 + Math.floor(ci / 26) - 1) : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, ri) => (
                <tr key={ri}>
                  <td className="bg-muted/30 border text-xs text-center text-muted-foreground p-1 select-none">{ri + 1}</td>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        "border p-0 relative",
                        selectedCell?.[0] === ri && selectedCell?.[1] === ci && "ring-2 ring-primary ring-inset"
                      )}
                      onClick={() => setSelectedCell([ri, ci])}
                    >
                      <input
                        className="w-full h-full px-2 py-1.5 text-xs bg-transparent border-none outline-none focus:bg-primary/5"
                        value={cell.value}
                        onChange={e => updateCell(ri, ci, e.target.value)}
                        onFocus={() => setSelectedCell([ri, ci])}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </div>
  );
}

// ── CSV/Excel import helpers ───────────────────────
function parseCSV(text: string): SpreadsheetCell[][] {
  const lines = text.split('\n').filter(l => l.trim());
  return lines.map(line => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) { cells.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    cells.push(current.trim());
    return cells.map(v => ({ value: v }));
  });
}

async function parseExcelFile(file: File): Promise<SpreadsheetCell[][]> {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [[{ value: '' }]];
  const data: SpreadsheetCell[][] = [];
  ws.eachRow((row) => {
    const cells: SpreadsheetCell[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push({ value: String(cell.value ?? '') });
    });
    data.push(cells);
  });
  // Normalize column count
  const maxCols = Math.max(...data.map(r => r.length), 1);
  return data.map(r => {
    while (r.length < maxCols) r.push({ value: '' });
    return r;
  });
}

// ── Main Menu Component ────────────────────────────
function EditorMainMenu({ onCreateNew, onImportFile }: {
  onCreateNew: (type: FileType) => void;
  onImportFile: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileTypes = [
    { type: 'markdown' as FileType, icon: FileText, label: 'Documento Markdown', desc: 'Texto con formato, títulos, listas, código', color: 'text-blue-500', bg: 'bg-blue-500/10 hover:bg-blue-500/20' },
    { type: 'spreadsheet' as FileType, icon: FileSpreadsheet, label: 'Hoja de Cálculo', desc: 'Tablas, datos, importar CSV/Excel', color: 'text-emerald-500', bg: 'bg-emerald-500/10 hover:bg-emerald-500/20' },
    { type: 'text' as FileType, icon: StickyNote, label: 'Texto Plano', desc: 'Notas rápidas sin formato', color: 'text-amber-500', bg: 'bg-amber-500/10 hover:bg-amber-500/20' },
  ];

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImportFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Editor IA</h1>
          <p className="text-muted-foreground">Crea documentos, hojas de cálculo y notas con asistencia de inteligencia artificial</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {fileTypes.map(ft => (
            <button
              key={ft.type}
              onClick={() => onCreateNew(ft.type)}
              className={cn(
                "flex flex-col items-center gap-3 p-6 rounded-xl border transition-all duration-200",
                ft.bg, "border-transparent"
              )}
            >
              <ft.icon className={cn("h-10 w-10", ft.color)} />
              <div className="text-center">
                <p className="font-semibold text-sm">{ft.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{ft.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-center">
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Importar archivo (CSV, Excel, Markdown, TXT)
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.md,.txt,.tsv"
            className="hidden"
            onChange={handleFileImport}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main Editor ────────────────────────────────────
export function DocumentEditor({ initialContent = '', initialTitle = '', onSaveToCloud, showBackButton = true }: DocumentEditorProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [fileType, setFileType] = useState<FileType | null>(initialContent ? 'markdown' : null);
  const [title, setTitle] = useState(initialTitle || 'Sin título');
  const [content, setContent] = useState(initialContent);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [showAi, setShowAi] = useState(false);
  const [aiAction, setAiAction] = useState<AiAction>('write');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetCell[][]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // If initial content is provided, skip menu
  useEffect(() => {
    if (initialContent) setFileType('markdown');
  }, [initialContent]);

  // ── Create / Import ──
  const handleCreateNew = (type: FileType) => {
    setFileType(type);
    setContent('');
    setTitle('Sin título');
    if (type === 'spreadsheet') {
      setSpreadsheetData(
        Array.from({ length: 10 }, () => Array.from({ length: 6 }, () => ({ value: '' })))
      );
    }
    if (type === 'markdown') setViewMode('split');
    else setViewMode('edit');
  };

  const handleImportFile = async (file: File) => {
    const name = file.name;
    const ext = name.split('.').pop()?.toLowerCase() || '';

    try {
      if (ext === 'csv' || ext === 'tsv') {
        const text = await file.text();
        const data = parseCSV(text);
        setSpreadsheetData(data);
        setFileType('spreadsheet');
        setTitle(name.replace(/\.\w+$/, ''));
        toast.success(`Importado: ${data.length} filas`);
      } else if (ext === 'xlsx' || ext === 'xls') {
        const data = await parseExcelFile(file);
        setSpreadsheetData(data);
        setFileType('spreadsheet');
        setTitle(name.replace(/\.\w+$/, ''));
        toast.success(`Importado: ${data.length} filas`);
      } else if (ext === 'md' || ext === 'txt') {
        const text = await file.text();
        setContent(text);
        setFileType(ext === 'md' ? 'markdown' : 'text');
        setTitle(name.replace(/\.\w+$/, ''));
        setViewMode('split');
        toast.success('Archivo importado');
      } else {
        toast.error('Formato no soportado. Usa CSV, Excel, Markdown o TXT.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al importar el archivo');
    }
  };

  // ── Markdown helpers ──
  const insertMarkdown = (before: string, after = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${before}${selected || 'texto'}${after}`;
    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + (selected || 'texto').length);
    }, 0);
  };

  // ── AI streaming ──
  const streamAi = useCallback(async (messages: ChatMessage[], action: AiAction) => {
    setIsStreaming(true);
    let assistantContent = '';
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages, action }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Error de conexión' }));
        toast.error(err.error || 'Error al conectar con la IA');
        setIsStreaming(false);
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const updateAssistant = (text: string) => {
        setChatMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: text } : m);
          }
          return [...prev, { role: 'assistant', content: text }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) { assistantContent += delta; updateAssistant(assistantContent); }
          } catch { /* partial */ }
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Error de conexión con la IA');
    } finally {
      setIsStreaming(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, []);

  const handleSendChat = async () => {
    if (!chatInput.trim() || isStreaming) return;
    let userMessage = chatInput.trim();
    const docContent = fileType === 'spreadsheet' 
      ? spreadsheetData.map(r => r.map(c => c.value).join('\t')).join('\n')
      : content;
    if ((aiAction === 'edit' || aiAction === 'improve' || aiAction === 'summarize') && docContent) {
      userMessage = `Documento actual:\n\n${docContent}\n\n---\n\nInstrucciones: ${userMessage}`;
    }
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
    const newMessages = [...chatMessages, { role: 'user' as const, content: userMessage }];
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    await streamAi(newMessages, aiAction);
  };

  const applyAiToDocument = () => {
    const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant');
    if (lastAssistant) {
      if (fileType === 'spreadsheet') {
        // Try to parse as CSV
        const parsed = parseCSV(lastAssistant.content);
        if (parsed.length > 0) {
          setSpreadsheetData(parsed);
          toast.success('Datos aplicados a la hoja');
        }
      } else {
        setContent(lastAssistant.content);
        toast.success('Contenido aplicado al documento');
      }
    }
  };

  const appendAiToDocument = () => {
    const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant');
    if (lastAssistant) {
      setContent(prev => prev ? `${prev}\n\n${lastAssistant.content}` : lastAssistant.content);
      toast.success('Contenido añadido al documento');
    }
  };

  // ── Downloads ──
  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadMd = () => {
    downloadBlob(new Blob([content], { type: 'text/markdown' }), `${title || 'documento'}.md`);
    toast.success('Descargado como Markdown');
  };

  const handleDownloadTxt = () => {
    const plain = content.replace(/#{1,6}\s/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1').replace(/>\s/g, '').replace(/---/g, '');
    downloadBlob(new Blob([plain], { type: 'text/plain' }), `${title || 'documento'}.txt`);
    toast.success('Descargado como TXT');
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const pageHeight = doc.internal.pageSize.getHeight() - margin * 2;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    doc.text(title || 'Documento', margin, margin + 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
    const plain = content.replace(/#{1,6}\s/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1').replace(/>\s/g, '').replace(/---/g, '────────────────');
    const lines = doc.splitTextToSize(plain, pageWidth);
    let y = margin + 20;
    for (const line of lines) {
      if (y > pageHeight + margin) { doc.addPage(); y = margin; }
      doc.text(line, margin, y); y += 6;
    }
    doc.save(`${title || 'documento'}.pdf`);
    toast.success('Descargado como PDF');
  };

  const handleDownloadCsv = () => {
    const csv = spreadsheetData.map(r => r.map(c => {
      const v = c.value;
      return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv' }), `${title || 'hoja'}.csv`);
    toast.success('Descargado como CSV');
  };

  const handleDownloadXlsx = async () => {
    try {
      const ExcelJS = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Hoja 1');
      spreadsheetData.forEach(row => {
        ws.addRow(row.map(c => c.value));
      });
      const buffer = await wb.xlsx.writeBuffer();
      downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${title || 'hoja'}.xlsx`);
      toast.success('Descargado como Excel');
    } catch (e) {
      console.error(e);
      toast.error('Error al exportar Excel');
    }
  };

  // ── Save to Cloud ──
  const handleSaveToCloud = async () => {
    if (onSaveToCloud) {
      setIsSaving(true);
      try {
        const saveContent = fileType === 'spreadsheet'
          ? spreadsheetData.map(r => r.map(c => c.value).join('\t')).join('\n')
          : content;
        await onSaveToCloud(title, saveContent);
        toast.success('Documento guardado en Cloud');
      } catch { toast.error('Error al guardar'); }
      finally { setIsSaving(false); }
      return;
    }

    if (!user) return;
    setIsSaving(true);
    try {
      const isSpreadsheet = fileType === 'spreadsheet';
      const ext = isSpreadsheet ? 'csv' : 'md';
      const mimeType = isSpreadsheet ? 'text/csv' : 'text/markdown';
      const saveContent = isSpreadsheet
        ? spreadsheetData.map(r => r.map(c => c.value).join(',')).join('\n')
        : content;

      const safeName = sanitizeFileName(title || 'documento');
      const fileName = `${safeName}.${ext}`;
      const blob = new Blob([saveContent], { type: mimeType });
      const file = new File([blob], fileName, { type: mimeType });
      const filePath = `${user.id}/${Date.now()}-${fileName}`;

      const { error: uploadError } = await supabase.storage.from('shared-files').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('shared-files').getPublicUrl(filePath);

      const { error: dbError } = await supabase.from('shared_files').insert({
        user_id: user.id,
        file_name: `${title || 'documento'}.${ext}`,
        file_path: urlData.publicUrl,
        file_size: blob.size,
        file_type: mimeType,
        description: `Creado con el Editor IA (${isSpreadsheet ? 'Hoja de cálculo' : 'Documento'})`,
      });
      if (dbError) throw dbError;
      toast.success('Guardado en Archivos Compartidos');
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar');
    } finally { setIsSaving(false); }
  };

  const handleBack = () => {
    if (fileType && !initialContent) {
      setFileType(null);
      return;
    }
    if (location.pathname === '/tools/editor') navigate('/');
    else window.history.back();
  };

  // ── If no file type selected, show main menu ──
  if (!fileType) {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b bg-card px-3 py-2 flex items-center gap-2">
          {showBackButton && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
              if (location.pathname === '/tools/editor') navigate('/');
              else window.history.back();
            }}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Editor IA</span>
        </div>
        <EditorMainMenu onCreateNew={handleCreateNew} onImportFile={handleImportFile} />
      </div>
    );
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  // ── Spreadsheet view ──
  if (fileType === 'spreadsheet') {
    return (
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="border-b bg-card px-3 py-2 flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input value={title} onChange={e => setTitle(e.target.value)} className="max-w-[250px] h-8 text-sm font-medium" placeholder="Título" />
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Badge variant="secondary" className="text-xs">{spreadsheetData.length} filas × {spreadsheetData[0]?.length || 0} cols</Badge>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs"><FileDown className="h-3.5 w-3.5 mr-1" />Descargar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDownloadCsv}><FileText className="h-4 w-4 mr-2" />CSV (.csv)</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadXlsx}><FileSpreadsheet className="h-4 w-4 mr-2" />Excel (.xlsx)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSaveToCloud} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Cloud className="h-3.5 w-3.5 mr-1" />}
            Guardar
          </Button>
          <Button variant={showAi ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setShowAi(!showAi)}>
            {showAi ? <PanelRightClose className="h-3.5 w-3.5 mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}IA
          </Button>
        </div>

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-h-0">
            <SpreadsheetEditor data={spreadsheetData} onChange={setSpreadsheetData} />
          </div>
          {showAi && renderAiPanel()}
        </div>
      </div>
    );
  }

  // ── Text/Markdown view ──
  function renderAiPanel() {
    return (
      <div className="w-[340px] border-l flex flex-col bg-card">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Asistente IA</span>
          </div>
          <div className="flex items-center gap-1">
            <Select value={aiAction} onValueChange={(v: AiAction) => setAiAction(v)}>
              <SelectTrigger className="h-7 text-xs w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="write">Escribir</SelectItem>
                <SelectItem value="edit">Editar</SelectItem>
                <SelectItem value="improve">Mejorar</SelectItem>
                <SelectItem value="summarize">Resumir</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setChatMessages([])}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-xs space-y-2">
                <Sparkles className="h-8 w-8 mx-auto opacity-50" />
                <p>Pide a la IA que escriba, edite o mejore tu documento</p>
                <div className="flex flex-wrap gap-1 justify-center mt-3">
                  {(fileType === 'spreadsheet'
                    ? ['Crea una tabla de gastos', 'Genera datos de ejemplo', 'Organiza estos datos']
                    : ['Escribe un informe', 'Crea un acta de reunión', 'Redacta una propuesta']
                  ).map(suggestion => (
                    <button key={suggestion} onClick={() => setChatInput(suggestion)}
                      className="text-[10px] px-2 py-1 rounded-full border hover:bg-muted transition-colors">{suggestion}</button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[90%] rounded-lg px-3 py-2 text-xs',
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-xs dark:prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                  ) : (<p className="whitespace-pre-wrap">{msg.content}</p>)}
                </div>
              </div>
            ))}
            {isStreaming && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />Generando...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>
        {chatMessages.some(m => m.role === 'assistant') && !isStreaming && (
          <div className="px-3 py-2 border-t flex gap-2">
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={applyAiToDocument}>Reemplazar</Button>
            {fileType !== 'spreadsheet' && (
              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={appendAiToDocument}>Añadir al final</Button>
            )}
          </div>
        )}
        <div className="p-3 border-t">
          <div className="flex gap-2">
            <Input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
              placeholder={aiAction === 'write' ? 'Describe qué crear...' : aiAction === 'edit' ? 'Describe los cambios...' : aiAction === 'improve' ? 'Instrucciones de mejora...' : 'Pide un resumen...'}
              className="h-8 text-xs" disabled={isStreaming} />
            <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSendChat} disabled={isStreaming || !chatInput.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="border-b bg-card px-3 py-2 flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBack} title="Volver">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input value={title} onChange={e => setTitle(e.target.value)} className="max-w-[250px] h-8 text-sm font-medium" placeholder="Título del documento" />
        <Separator orientation="vertical" className="h-6 mx-1" />

        {fileType === 'markdown' && (
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('**', '**')} title="Negrita"><Bold className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('*', '*')} title="Cursiva"><Italic className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('# ')} title="Título 1"><Heading1 className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('## ')} title="Título 2"><Heading2 className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('- ')} title="Lista"><List className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('1. ')} title="Lista numerada"><ListOrdered className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('> ')} title="Cita"><Quote className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('`', '`')} title="Código"><Code className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => insertMarkdown('\n---\n')} title="Separador"><Minus className="h-3.5 w-3.5" /></Button>
            <Separator orientation="vertical" className="h-6 mx-1" />
          </div>
        )}

        {/* View mode buttons */}
        {fileType === 'markdown' && (
          <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
            <Button variant={viewMode === 'edit' ? 'secondary' : 'ghost'} size="sm" className="h-6 text-[10px] px-2"
              onClick={() => setViewMode('edit')}>Editar</Button>
            <Button variant={viewMode === 'split' ? 'secondary' : 'ghost'} size="sm" className="h-6 text-[10px] px-2"
              onClick={() => setViewMode('split')}>
              <Columns2 className="h-3 w-3 mr-1" />Split
            </Button>
            <Button variant={viewMode === 'preview' ? 'secondary' : 'ghost'} size="sm" className="h-6 text-[10px] px-2"
              onClick={() => setViewMode('preview')}>Vista previa</Button>
          </div>
        )}

        <div className="flex-1" />
        <Badge variant="secondary" className="text-xs font-normal hidden sm:inline-flex">
          {wordCount} palabras · {charCount} caracteres
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs"><FileDown className="h-3.5 w-3.5 mr-1" />Descargar</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleDownloadMd}><FileText className="h-4 w-4 mr-2" />Markdown (.md)</DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadTxt}><FileText className="h-4 w-4 mr-2" />Texto plano (.txt)</DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadPdf}><FileText className="h-4 w-4 mr-2" />PDF (.pdf)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSaveToCloud} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Cloud className="h-3.5 w-3.5 mr-1" />}
          Guardar
        </Button>
        <Button variant={showAi ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setShowAi(!showAi)}>
          {showAi ? <PanelRightClose className="h-3.5 w-3.5 mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}IA
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Editor area */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={cn("min-h-0", viewMode === 'split' ? 'flex-1 border-r' : 'flex-1')}>
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Empieza a escribir o usa la IA para generar contenido..."
              className="h-full w-full resize-none border-0 rounded-none focus-visible:ring-0 p-6 md:p-10 font-mono text-sm leading-relaxed"
            />
          </div>
        )}

        {/* Preview area */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={cn("min-h-0", viewMode === 'split' ? 'flex-1' : 'flex-1')}>
            <ScrollArea className="h-full">
              <div className="p-6 md:p-10 max-w-3xl mx-auto prose prose-sm dark:prose-invert">
                {content ? <ReactMarkdown>{content}</ReactMarkdown> : (
                  <p className="text-muted-foreground italic">La vista previa aparecerá aquí...</p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* AI Panel */}
        {showAi && renderAiPanel()}
      </div>
    </div>
  );
}
