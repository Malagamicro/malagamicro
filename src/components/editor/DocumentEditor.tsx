import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FileText, Save, Download, Sparkles, Send, Loader2, X,
  Bold, Italic, Heading1, Heading2, List, ListOrdered,
  Minus, Quote, Code, Trash2,
  PanelRightOpen, PanelRightClose, Cloud, ArrowLeft,
  FileDown, Plus, Table, FileSpreadsheet, StickyNote,
  Upload, Share2, Eye, EyeOff, Columns2,
  Zap, MessageCircle, Mail, Play, MoreHorizontal,
  Search, Filter, Settings,
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

import type { FileType, AiAction, ViewMode, ChatMessage, SpreadsheetCell } from './formulaEngine';
import { evaluateFormula, getCellDisplay, indexToCol } from './formulaEngine';
import { sanitizeFileName, parseCSV, parseExcelFile } from './documentHelpers';

// Re-export types for external consumers
export type { FileType, AiAction, ViewMode, ChatMessage, SpreadsheetCell };

// Row action types
interface RowAction {
  id: string;
  label: string;
  icon: typeof Zap;
  action: string;
  color: string;
}

const ROW_ACTIONS: RowAction[] = [
  { id: 'n8n', label: 'Enviar a n8n', icon: Zap, action: 'send_to_n8n', color: 'text-accent' },
  { id: 'whatsapp', label: 'Enviar WhatsApp', icon: MessageCircle, action: 'send_whatsapp', color: 'text-emerald-500' },
  { id: 'email', label: 'Enviar recordatorio', icon: Mail, action: 'send_email_reminder', color: 'text-primary' },
];

// NLP filter types
interface NlpFilter {
  column: string;
  operator: string;
  value: string;
}

interface NlpFilterResult {
  filters: NlpFilter[];
  sort: { column: string; direction: 'asc' | 'desc' } | null;
  visibleColumns: string[] | null;
}

// Magic column definition
interface MagicColumn {
  id: string;
  name: string;
  prompt: string;
  results: Record<number, string>; // rowIndex -> result
  loading: Set<number>;
}

interface DocumentEditorProps {
  initialContent?: string;
  initialTitle?: string;
  onSaveToCloud?: (title: string, content: string) => Promise<void>;
  showBackButton?: boolean;
}

function SpreadsheetEditor({ data, onChange }: { data: SpreadsheetCell[][]; onChange: (d: SpreadsheetCell[][]) => void }) {
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [editingCell, setEditingCell] = useState<[number, number] | null>(null);
  const [editValue, setEditValue] = useState('');
  const [actionLoading, setActionLoading] = useState<{ row: number; action: string } | null>(null);
  const formulaBarRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // NLP Search state
  const [nlpQuery, setNlpQuery] = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState<NlpFilterResult | null>(null);
  const [filterDescription, setFilterDescription] = useState('');

  // Magic Columns state
  const [magicColumns, setMagicColumns] = useState<MagicColumn[]>([]);
  const [showMagicDialog, setShowMagicDialog] = useState(false);
  const [newMagicName, setNewMagicName] = useState('');
  const [newMagicPrompt, setNewMagicPrompt] = useState('');
  const [magicProcessing, setMagicProcessing] = useState(false);

  // Webhook config state
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem('spreadsheet_webhook_url') || '');
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);

  // Extract headers from first row for structured data
  const headerRow = useMemo(() => {
    if (data.length === 0) return [];
    return data[0].map(c => c.formula ? evaluateFormula(c.formula, data) : c.value);
  }, [data]);

  // Apply NLP filters to data
  const filteredRowIndices = useMemo(() => {
    if (!activeFilters?.filters?.length) return data.map((_, i) => i);
    
    return data.map((_, i) => i).filter(ri => {
      if (ri === 0) return true; // Always show header row
      const row = data[ri];
      return activeFilters.filters.every(f => {
        const colIdx = headerRow.findIndex(h => h.toLowerCase() === f.column.toLowerCase());
        if (colIdx === -1) return true;
        const cellVal = getCellDisplay(data, ri, colIdx).toLowerCase();
        const filterVal = f.value.toLowerCase();
        switch (f.operator) {
          case 'contains': return cellVal.includes(filterVal);
          case 'equals': return cellVal === filterVal;
          case 'not_equals': return cellVal !== filterVal;
          case 'gt': return parseFloat(cellVal) > parseFloat(filterVal);
          case 'lt': return parseFloat(cellVal) < parseFloat(filterVal);
          case 'gte': return parseFloat(cellVal) >= parseFloat(filterVal);
          case 'lte': return parseFloat(cellVal) <= parseFloat(filterVal);
          case 'starts_with': return cellVal.startsWith(filterVal);
          case 'ends_with': return cellVal.endsWith(filterVal);
          default: return cellVal.includes(filterVal);
        }
      });
    });
  }, [data, activeFilters, headerRow]);

  // Sort filtered data
  const sortedFilteredIndices = useMemo(() => {
    if (!activeFilters?.sort) return filteredRowIndices;
    const { column, direction } = activeFilters.sort;
    const colIdx = headerRow.findIndex(h => h.toLowerCase() === column.toLowerCase());
    if (colIdx === -1) return filteredRowIndices;
    
    const headerIdx = filteredRowIndices[0] === 0 ? 0 : -1;
    const dataIndices = filteredRowIndices.filter(i => i !== 0);
    
    dataIndices.sort((a, b) => {
      const va = getCellDisplay(data, a, colIdx);
      const vb = getCellDisplay(data, b, colIdx);
      const na = parseFloat(va), nb = parseFloat(vb);
      const cmp = (!isNaN(na) && !isNaN(nb)) ? na - nb : va.localeCompare(vb);
      return direction === 'desc' ? -cmp : cmp;
    });

    return headerIdx === 0 ? [0, ...dataIndices] : dataIndices;
  }, [filteredRowIndices, activeFilters, headerRow, data]);

  // NLP search handler
  const handleNlpSearch = async () => {
    if (!nlpQuery.trim()) { clearFilters(); return; }
    setNlpLoading(true);
    try {
      const sampleRows = data.slice(1, 4).map(row => 
        row.map((c, ci) => getCellDisplay(data, data.indexOf(row), ci))
      );
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/spreadsheet-nlp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          query: nlpQuery,
          headers: headerRow,
          sampleRows,
          mode: 'filter',
        }),
      });
      const result = await resp.json();
      if (result.success && result.result) {
        setActiveFilters(result.result);
        setFilterDescription(nlpQuery);
        toast.success('Filtros aplicados');
      } else {
        toast.error(result.error || 'No se pudieron interpretar los filtros');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error al procesar búsqueda');
    } finally {
      setNlpLoading(false);
    }
  };

  const clearFilters = () => {
    setActiveFilters(null);
    setFilterDescription('');
    setNlpQuery('');
  };

  // Magic column handlers
  const addMagicColumn = () => {
    if (!newMagicName.trim() || !newMagicPrompt.trim()) return;
    const col: MagicColumn = {
      id: `magic_${Date.now()}`,
      name: newMagicName,
      prompt: newMagicPrompt,
      results: {},
      loading: new Set(),
    };
    setMagicColumns(prev => [...prev, col]);
    setShowMagicDialog(false);
    setNewMagicName('');
    setNewMagicPrompt('');
    // Auto-process all rows
    processMagicColumn(col, data);
  };

  const processMagicColumn = async (col: MagicColumn, currentData: SpreadsheetCell[][]) => {
    setMagicProcessing(true);
    const newResults: Record<number, string> = { ...col.results };

    for (let ri = 1; ri < currentData.length; ri++) {
      const rowValues: Record<string, string> = {};
      headerRow.forEach((h, ci) => {
        if (h) rowValues[h] = getCellDisplay(currentData, ri, ci);
      });
      
      // Skip empty rows
      if (Object.values(rowValues).every(v => !v.trim())) continue;

      try {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/spreadsheet-nlp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            query: col.prompt,
            headers: headerRow,
            sampleRows: rowValues,
            mode: 'magic_column',
          }),
        });
        const result = await resp.json();
        newResults[ri] = result.success ? result.result : '⚠️';
      } catch {
        newResults[ri] = '⚠️';
      }
    }

    setMagicColumns(prev => prev.map(c => c.id === col.id ? { ...c, results: newResults, loading: new Set() } : c));
    setMagicProcessing(false);
    toast.success(`Columna "${col.name}" procesada`);
  };

  const removeMagicColumn = (colId: string) => {
    setMagicColumns(prev => prev.filter(c => c.id !== colId));
  };

  const executeRowAction = async (rowIndex: number, action: string) => {
    const row = data[rowIndex];
    if (!row) return;
    
    setActionLoading({ row: rowIndex, action });
    try {
      const rowValues = row.map((c, ci) => getCellDisplay(data, rowIndex, ci));
      
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('No hay sesión activa. Inicia sesión de nuevo.');

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/spreadsheet-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action,
          rowData: rowValues,
          rowIndex,
          headers: headerRow,
          customWebhookUrl: webhookUrl || undefined,
        }),
      });

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Error al ejecutar acción');
      toast.success(result.message || 'Acción ejecutada correctamente');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error al ejecutar la acción');
    } finally {
      setActionLoading(null);
    }
  };

  const updateCell = (row: number, col: number, rawValue: string) => {
    const isFormula = rawValue.startsWith('=');
    const newData = data.map((r, ri) => r.map((c, ci) => {
      if (ri === row && ci === col) {
        return isFormula
          ? { value: '', formula: rawValue.slice(1) }
          : { value: rawValue, formula: undefined };
      }
      return c;
    }));
    onChange(newData);
  };

  const commitEdit = () => {
    if (editingCell) {
      updateCell(editingCell[0], editingCell[1], editValue);
      setEditingCell(null);
    }
  };

  const startEdit = (row: number, col: number) => {
    setEditingCell([row, col]);
    const cell = data[row]?.[col];
    setEditValue(cell?.formula ? `=${cell.formula}` : cell?.value || '');
  };

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedCell || editingCell) return;
    const [r, c] = selectedCell;
    let newR = r, newC = c;

    switch (e.key) {
      case 'ArrowUp': newR = Math.max(0, r - 1); break;
      case 'ArrowDown': newR = Math.min(data.length - 1, r + 1); break;
      case 'ArrowLeft': newC = Math.max(0, c - 1); break;
      case 'ArrowRight': newC = Math.min((data[0]?.length || 1) - 1, c + 1); break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) newC = Math.max(0, c - 1);
        else newC = Math.min((data[0]?.length || 1) - 1, c + 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (e.shiftKey) newR = Math.max(0, r - 1);
        else startEdit(r, c);
        return;
      case 'Delete': case 'Backspace':
        e.preventDefault();
        updateCell(r, c, '');
        return;
      case 'F2':
        e.preventDefault();
        startEdit(r, c);
        return;
      case 'Escape':
        setSelectedCell(null);
        return;
      default:
        // Start typing to edit
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          startEdit(r, c);
          setEditValue(e.key);
          return;
        }
        return;
    }
    e.preventDefault();
    setSelectedCell([newR, newC]);
  }, [selectedCell, editingCell, data]);

  const cellLabel = selectedCell
    ? `${indexToCol(selectedCell[1])}${selectedCell[0] + 1}`
    : '';

  const selectedCellRaw = selectedCell
    ? (data[selectedCell[0]]?.[selectedCell[1]]?.formula
      ? `=${data[selectedCell[0]][selectedCell[1]].formula}`
      : data[selectedCell[0]]?.[selectedCell[1]]?.value || '')
    : '';

  const addRow = () => {
    const cols = data[0]?.length || 5;
    onChange([...data, Array.from({ length: cols }, () => ({ value: '' }))]);
  };
  const addCol = () => onChange(data.map(r => [...r, { value: '' }]));
  const deleteRow = (idx: number) => { if (data.length > 1) onChange(data.filter((_, i) => i !== idx)); };
  const deleteCol = (idx: number) => { if ((data[0]?.length || 0) > 1) onChange(data.map(r => r.filter((_, i) => i !== idx))); };

  const totalCols = data[0]?.length || 0;

  return (
    <div className="h-full flex flex-col" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* NLP Search Bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-card/50 backdrop-blur-sm">
        <div className="relative flex-1 max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            className="w-full h-8 pl-9 pr-4 text-sm bg-muted/50 border border-border/50 rounded-lg outline-none focus:ring-2 ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground/60 transition-all"
            value={nlpQuery}
            onChange={e => setNlpQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); handleNlpSearch(); } }}
            placeholder='Busca con lenguaje natural: "Clientes de Málaga con más de 50€" ...'
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={handleNlpSearch}
          disabled={nlpLoading}
        >
          {nlpLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Filtrar con IA
        </Button>
        {activeFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground" onClick={clearFilters}>
            <X className="h-3 w-3" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Active filters indicator */}
      {activeFilters && filterDescription && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border-b border-primary/10">
          <Badge variant="secondary" className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/20">
            <Filter className="h-2.5 w-2.5" />
            {filterDescription}
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            {sortedFilteredIndices.length - (sortedFilteredIndices.includes(0) ? 1 : 0)} resultados
          </span>
        </div>
      )}

      {/* Formula bar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/20">
        <span className="text-[10px] font-mono w-10 text-center text-muted-foreground font-semibold tracking-wider">{cellLabel}</span>
        <span className="text-muted-foreground text-[10px] font-bold">ƒx</span>
        <input
          ref={formulaBarRef}
          className="flex-1 h-7 px-2 text-sm bg-background/80 border border-border/30 rounded-md outline-none focus:ring-1 ring-primary/40 font-mono text-foreground"
          value={editingCell ? editValue : selectedCellRaw}
          onChange={e => {
            if (editingCell) setEditValue(e.target.value);
            else if (selectedCell) {
              startEdit(selectedCell[0], selectedCell[1]);
              setEditValue(e.target.value);
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') { commitEdit(); formulaBarRef.current?.blur(); }
            if (e.key === 'Escape') { setEditingCell(null); }
          }}
          onBlur={commitEdit}
          placeholder="Introduce valor o fórmula (=SUM, =AVERAGE, =IF...)"
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-card/30">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 hover:bg-primary/10" onClick={addRow}>
          <Plus className="h-3 w-3" /> Fila
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 hover:bg-primary/10" onClick={addCol}>
          <Plus className="h-3 w-3" /> Columna
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 hover:bg-accent/10 text-accent"
          onClick={() => setShowMagicDialog(true)}
        >
          <Sparkles className="h-3 w-3" /> Columna Mágica
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 hover:bg-muted/50"
          onClick={() => setShowWebhookConfig(true)}
        >
          <Settings className="h-3 w-3" /> Webhook
        </Button>
        {selectedCell && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={() => deleteRow(selectedCell[0])}>
              Eliminar fila
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={() => deleteCol(selectedCell[1])}>
              Eliminar columna
            </Button>
          </>
        )}
        <div className="ml-auto text-[10px] text-muted-foreground/50 hidden md:flex items-center gap-2">
          <kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border/30 font-mono">Tab</kbd> navegar
          <kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border/30 font-mono">Enter</kbd> editar
          <kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border/30 font-mono">Esc</kbd> salir
          <kbd className="px-1 py-0.5 rounded bg-muted/50 border border-border/30 font-mono">F2</kbd> fórmula
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto" ref={tableRef}>
        <table className="border-collapse w-full min-w-max">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="w-10 bg-muted/80 backdrop-blur-sm border-b border-r border-border/30 text-[10px] text-center text-muted-foreground p-1 sticky left-0 z-30">#</th>
              {data[0]?.map((_, ci) => {
                const colName = headerRow[ci]?.toLowerCase() || '';
                const isHidden = activeFilters?.visibleColumns && !activeFilters.visibleColumns.some(vc => vc.toLowerCase() === colName);
                if (isHidden) return null;
                return (
                  <th key={ci} className="bg-muted/80 backdrop-blur-sm border-b border-r border-border/30 text-[10px] text-center text-muted-foreground p-1.5 min-w-[120px] font-medium tracking-wider uppercase">
                    {indexToCol(ci)}
                  </th>
                );
              })}
              {/* Magic columns headers */}
              {magicColumns.map(mc => (
                <th key={mc.id} className="bg-accent/5 backdrop-blur-sm border-b border-r border-accent/20 text-[10px] text-center p-1.5 min-w-[140px]">
                  <div className="flex items-center justify-center gap-1">
                    <Sparkles className="h-2.5 w-2.5 text-accent" />
                    <span className="text-accent font-medium truncate">{mc.name}</span>
                    <button onClick={() => removeMagicColumn(mc.id)} className="ml-1 hover:text-destructive">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="bg-muted/80 backdrop-blur-sm border-b border-border/30 text-[10px] text-center text-muted-foreground p-1 min-w-[40px] sticky right-0 z-30">
                <Zap className="h-3 w-3 mx-auto" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedFilteredIndices.map(ri => {
              const row = data[ri];
              const isLoadingRow = actionLoading?.row === ri;
              const isHeaderRow = ri === 0;
              return (
                <tr key={ri} className={cn(
                  "group transition-colors duration-75",
                  isHeaderRow ? "bg-muted/30" : "hover:bg-muted/20",
                )}>
                  <td className={cn(
                    "border-b border-r border-border/20 text-[10px] text-center text-muted-foreground/60 p-1 select-none sticky left-0 z-10",
                    isHeaderRow ? "bg-muted/40 font-semibold" : "bg-card/80"
                  )}>{ri + 1}</td>
                  {row.map((cell, ci) => {
                    const colName = headerRow[ci]?.toLowerCase() || '';
                    const isHidden = activeFilters?.visibleColumns && !activeFilters.visibleColumns.some(vc => vc.toLowerCase() === colName);
                    if (isHidden) return null;
                    
                    const isEditing = editingCell?.[0] === ri && editingCell?.[1] === ci;
                    const isSelected = selectedCell?.[0] === ri && selectedCell?.[1] === ci;
                    const displayVal = cell.formula ? evaluateFormula(cell.formula, data) : cell.value;
                    const hasFormula = !!cell.formula;
                    return (
                      <td
                        key={ci}
                        className={cn(
                          "border-b border-r border-border/20 p-0 relative transition-all duration-75",
                          isSelected && "ring-2 ring-primary ring-inset shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.3)]",
                          hasFormula && !isEditing && "bg-primary/[0.03]",
                          isHeaderRow && "font-semibold bg-muted/20",
                        )}
                        onClick={() => { setSelectedCell([ri, ci]); if (!isEditing) setEditingCell(null); }}
                        onDoubleClick={() => startEdit(ri, ci)}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            className="w-full h-full px-2.5 py-1.5 text-xs bg-background border-none outline-none font-mono"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { commitEdit(); e.preventDefault(); const nr = ri + 1; if (nr < data.length) setSelectedCell([nr, ci]); }
                              if (e.key === 'Escape') setEditingCell(null);
                              if (e.key === 'Tab') { e.preventDefault(); commitEdit(); const nc = e.shiftKey ? Math.max(0, ci - 1) : Math.min(row.length - 1, ci + 1); setSelectedCell([ri, nc]); startEdit(ri, nc); }
                            }}
                            onBlur={commitEdit}
                          />
                        ) : (
                          <div className={cn(
                            "w-full px-2.5 py-1.5 text-xs min-h-[30px] cursor-cell flex items-center",
                            displayVal.startsWith('#') && "text-destructive font-semibold"
                          )}>
                            {displayVal}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {/* Magic column values */}
                  {magicColumns.map(mc => (
                    <td key={mc.id} className="border-b border-r border-accent/10 p-0 bg-accent/[0.02]">
                      <div className="px-2.5 py-1.5 text-xs min-h-[30px] flex items-center text-muted-foreground">
                        {isHeaderRow ? (
                          <span className="font-medium text-accent">{mc.name}</span>
                        ) : mc.results[ri] !== undefined ? (
                          mc.results[ri]
                        ) : magicProcessing ? (
                          <Loader2 className="h-3 w-3 animate-spin text-accent/50" />
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </div>
                    </td>
                  ))}
                  {/* Actions column */}
                  <td className="border-b border-border/20 p-0 sticky right-0 z-10 bg-card/90 backdrop-blur-sm">
                    {!isHeaderRow && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-full h-full flex items-center justify-center p-1.5 opacity-0 group-hover:opacity-100 transition-opacity" disabled={isLoadingRow}>
                            {isLoadingRow ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            ) : (
                              <Play className="h-3 w-3 text-muted-foreground/50 hover:text-foreground transition-colors" />
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[180px]">
                          {ROW_ACTIONS.map(act => (
                            <DropdownMenuItem
                              key={act.id}
                              onClick={() => executeRowAction(ri, act.action)}
                              disabled={isLoadingRow}
                              className="gap-2"
                            >
                              <act.icon className={cn("h-4 w-4", act.color)} />
                              {act.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t bg-muted/10 text-[10px] text-muted-foreground/60">
        <span>{data.length} filas × {totalCols} cols{activeFilters ? ` · ${sortedFilteredIndices.length - 1} visibles` : ''}</span>
        {magicColumns.length > 0 && (
          <span className="flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5 text-accent" />
            {magicColumns.length} columna{magicColumns.length > 1 ? 's' : ''} mágica{magicColumns.length > 1 ? 's' : ''}
          </span>
        )}
        <span>
          {selectedCell ? `${cellLabel}: ${selectedCellRaw || 'vacía'}` : 'Selecciona una celda'}
        </span>
      </div>

      {/* Magic Column Dialog */}
      <Dialog open={showMagicDialog} onOpenChange={setShowMagicDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              Nueva Columna Mágica
            </DialogTitle>
            <DialogDescription>
              Crea una columna que usa IA para extraer, categorizar o transformar datos automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nombre de la columna</label>
              <Input
                value={newMagicName}
                onChange={e => setNewMagicName(e.target.value)}
                placeholder="Ej: Sentimiento, Teléfono extraído, Categoría..."
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Instrucción IA (prompt)</label>
              <Textarea
                value={newMagicPrompt}
                onChange={e => setNewMagicPrompt(e.target.value)}
                placeholder="Ej: Extrae el número de teléfono del campo Email. / Clasifica el tono como Positivo, Negativo o Neutro. / Resume en 5 palabras."
                className="text-sm min-h-[80px]"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['Extrae el teléfono', 'Clasifica el sentimiento', 'Extrae el nombre de empresa', 'Resume en 3 palabras'].map(s => (
                <button
                  key={s}
                  onClick={() => { setNewMagicPrompt(s); if (!newMagicName) setNewMagicName(s.split(' ').slice(0, 2).join(' ')); }}
                  className="text-[10px] px-2 py-1 rounded-full border border-border/50 hover:bg-muted transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
            <Button onClick={addMagicColumn} disabled={!newMagicName.trim() || !newMagicPrompt.trim()} className="w-full gap-2">
              <Sparkles className="h-4 w-4" />
              Crear columna mágica
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Webhook Config Dialog */}
      <Dialog open={showWebhookConfig} onOpenChange={setShowWebhookConfig}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurar Webhook
            </DialogTitle>
            <DialogDescription>
              Configura la URL del webhook para las acciones de fila (n8n, Make, Zapier, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">URL del Webhook</label>
              <Input
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://tu-n8n.ejemplo.com/webhook/..."
                className="text-sm font-mono"
                type="url"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Esta URL se usará para las acciones "Enviar a n8n" y "Enviar recordatorio". Si se deja vacía se usará la URL configurada en el servidor.
              </p>
            </div>
            <Button
              onClick={() => {
                localStorage.setItem('spreadsheet_webhook_url', webhookUrl);
                toast.success('Webhook configurado correctamente');
                setShowWebhookConfig(false);
              }}
              className="w-full gap-2"
            >
              <Zap className="h-4 w-4" />
              Guardar configuración
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
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
  const streamAi = useCallback(async (messages: ChatMessage[], action: AiAction, docType: FileType | null) => {
    setIsStreaming(true);
    let assistantContent = '';
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages, action, fileType: docType || 'markdown' }),
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
      ? spreadsheetData.map(r => r.map(c => c.formula ? `=${c.formula}` : c.value).join('\t')).join('\n')
      : content;
    if ((aiAction === 'edit' || aiAction === 'improve' || aiAction === 'summarize') && docContent) {
      userMessage = `Documento actual:\n\n${docContent}\n\n---\n\nInstrucciones: ${userMessage}`;
    }
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
    const newMessages = [...chatMessages, { role: 'user' as const, content: userMessage }];
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    await streamAi(newMessages, aiAction, fileType);
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
