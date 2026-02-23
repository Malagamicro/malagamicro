import { useState, useMemo, useEffect } from 'react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, Plus, Trash2, Download, Loader2, Calendar, Clock, User, Users, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useExitRecords } from '@/hooks/useExitRecords';
import { useReports, Report } from '@/hooks/useReports';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

interface UserProfile {
  user_id: string;
  full_name: string | null;
}

function exportReportToPdf(report: Report) {
  const doc = new jsPDF();
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(report.title, pageWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 8 + 5;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(`Tipo: ${report.report_type} | Fecha: ${format(new Date(report.created_at), "d MMM yyyy HH:mm", { locale: es })}`, margin, y);
  y += 6;
  if (report.week_start && report.week_end) {
    doc.text(`Periodo: ${report.week_start} — ${report.week_end}`, margin, y);
    y += 6;
  }
  y += 4;

  doc.setDrawColor(200);
  doc.line(margin, y, margin + pageWidth, y);
  y += 8;

  doc.setTextColor(40);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const contentLines = doc.splitTextToSize(report.content, pageWidth);

  for (const line of contentLines) {
    if (y > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 5.5;
  }

  doc.save(`${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  toast.success('PDF descargado');
}

export function ReportsModule() {
  const { user } = useAuth();
  const { records, isLoading: recordsLoading, addRecord, deleteRecord } = useExitRecords();
  const { reports, isLoading: reportsLoading, isGenerating, generateReport, deleteReport } = useReports();
  const [showExitForm, setShowExitForm] = useState(false);
  const [showReportViewer, setShowReportViewer] = useState<string | null>(null);
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('all');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [exitForm, setExitForm] = useState({
    student_name: '',
    exit_date: format(new Date(), 'yyyy-MM-dd'),
    exit_time: format(new Date(), 'HH:mm'),
    return_time: '',
    reason: '',
    destination: '',
    notes: '',
  });
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [weekEnd, setWeekEnd] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));

  // Fetch users for multi-user selector
  useEffect(() => {
    supabase
      .from('profiles')
      .select('user_id, full_name')
      .then(({ data }) => {
        if (data) setAllUsers(data as UserProfile[]);
      });
  }, []);

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleAddExit = async () => {
    if (!exitForm.student_name.trim() || !exitForm.reason.trim()) return;
    await addRecord({
      student_name: exitForm.student_name,
      exit_date: exitForm.exit_date,
      exit_time: exitForm.exit_time || null,
      return_time: exitForm.return_time || null,
      reason: exitForm.reason,
      destination: exitForm.destination || null,
      notes: exitForm.notes || null,
    });
    setShowExitForm(false);
    setExitForm({
      student_name: '', exit_date: format(new Date(), 'yyyy-MM-dd'),
      exit_time: format(new Date(), 'HH:mm'), return_time: '', reason: '', destination: '', notes: '',
    });
  };

  const filteredReports = useMemo(() => {
    if (reportTypeFilter === 'all') return reports;
    return reports.filter(r => r.report_type === reportTypeFilter);
  }, [reports, reportTypeFilter]);

  const reportTypes = useMemo(() => {
    const types = new Set(reports.map(r => r.report_type));
    return Array.from(types);
  }, [reports]);

  const selectedReport = reports.find(r => r.id === showReportViewer);

  return (
    <div className="p-3 sm:p-8 space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-foreground">Informes</h1>
          <p className="text-xs sm:text-base text-muted-foreground mt-1">
            Registro de salidas e informes generados por IA
          </p>
        </div>
      </div>

      <Tabs defaultValue="exits" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="exits">Registro de Salidas</TabsTrigger>
          <TabsTrigger value="reports">Informes Generados</TabsTrigger>
        </TabsList>

        <TabsContent value="exits" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Salidas registradas</h2>
            <Button size="sm" onClick={() => setShowExitForm(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nueva salida
            </Button>
          </div>

          {recordsLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : records.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No hay registros de salidas</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {records.map(r => (
                <Card key={r.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm truncate">{r.student_name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{r.exit_date}</span>
                        {r.exit_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{r.exit_time.substring(0, 5)}</span>}
                      </div>
                      <p className="text-xs mt-1 truncate">{r.reason}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => deleteRecord(r.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Generate report section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generar Informe Semanal con IA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Semana desde</Label>
                  <Input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
                </div>
                <div>
                  <Label>Hasta</Label>
                  <Input type="date" value={weekEnd} onChange={e => setWeekEnd(e.target.value)} />
                </div>
              </div>
              <Button onClick={() => generateReport(weekStart, weekEnd)} disabled={isGenerating} className="w-full">
                {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando...</> : <><FileText className="w-4 h-4 mr-2" /> Generar informe</>}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Informes generados</h2>
            {reportTypes.length > 1 && (
              <Select value={reportTypeFilter} onValueChange={setReportTypeFilter}>
                <SelectTrigger className="w-[160px] h-8">
                  <Filter className="w-3.5 h-3.5 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {reportTypes.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {reportsLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : filteredReports.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No hay informes generados</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {filteredReports.map(r => (
                <Card key={r.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setShowReportViewer(r.id)}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: es })}
                        </p>
                        {r.week_start && r.week_end && (
                          <Badge variant="outline" className="text-[10px]">
                            {r.week_start} — {r.week_end}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{r.report_type}</Badge>
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); exportReportToPdf(r); }} title="Exportar PDF">
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteReport(r.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Exit form dialog */}
      <Dialog open={showExitForm} onOpenChange={setShowExitForm}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader><DialogTitle>Registrar salida</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Usuario *
              </Label>
              <div className="space-y-2 mt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-sm h-9"
                  onClick={() => setShowUserPicker(!showUserPicker)}
                >
                  {selectedUserIds.length > 0
                    ? `${selectedUserIds.length} usuario(s) seleccionado(s)`
                    : exitForm.student_name || 'Seleccionar usuarios...'}
                </Button>
                {showUserPicker && (
                  <ScrollArea className="max-h-32 rounded-lg border p-2">
                    <div className="space-y-1">
                      {allUsers.map(u => (
                        <label key={u.user_id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-accent/50 cursor-pointer text-sm">
                          <Checkbox
                            checked={selectedUserIds.includes(u.user_id)}
                            onCheckedChange={() => {
                              toggleUser(u.user_id);
                              // Also set student_name for backward compat
                              const names = [...selectedUserIds, u.user_id]
                                .filter((id, i, arr) => {
                                  if (selectedUserIds.includes(u.user_id)) {
                                    return id !== u.user_id;
                                  }
                                  return arr.indexOf(id) === i;
                                })
                                .map(id => allUsers.find(au => au.user_id === id)?.full_name || 'Usuario')
                                .join(', ');
                              setExitForm(p => ({ ...p, student_name: names }));
                            }}
                          />
                          {u.full_name || 'Sin nombre'}
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                {selectedUserIds.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedUserIds.map(uid => {
                      const u = allUsers.find(u => u.user_id === uid);
                      return (
                        <Badge key={uid} variant="secondary" className="text-xs">
                          {u?.full_name || 'Usuario'}
                        </Badge>
                      );
                    })}
                  </div>
                )}
                {!showUserPicker && selectedUserIds.length === 0 && (
                  <Input 
                    placeholder="O escribe un nombre manualmente..." 
                    value={exitForm.student_name} 
                    onChange={e => setExitForm(p => ({ ...p, student_name: e.target.value }))} 
                    className="h-9 text-sm"
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Fecha</Label><Input type="date" value={exitForm.exit_date} onChange={e => setExitForm(p => ({ ...p, exit_date: e.target.value }))} /></div>
              <div><Label>Hora salida</Label><Input type="time" value={exitForm.exit_time} onChange={e => setExitForm(p => ({ ...p, exit_time: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Hora retorno</Label><Input type="time" value={exitForm.return_time} onChange={e => setExitForm(p => ({ ...p, return_time: e.target.value }))} /></div>
              <div><Label>Destino</Label><Input value={exitForm.destination} onChange={e => setExitForm(p => ({ ...p, destination: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Motivo *</Label>
              <Textarea value={exitForm.reason} onChange={e => setExitForm(p => ({ ...p, reason: e.target.value }))} rows={2} />
            </div>
            <Button className="w-full" onClick={handleAddExit} disabled={!exitForm.student_name.trim() || !exitForm.reason.trim()}>
              Registrar salida
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report viewer dialog with PDF export */}
      <Dialog open={!!showReportViewer} onOpenChange={() => setShowReportViewer(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="flex-1 truncate">{selectedReport?.title}</DialogTitle>
              {selectedReport && (
                <Button size="sm" variant="outline" onClick={() => exportReportToPdf(selectedReport)}>
                  <Download className="w-4 h-4 mr-1.5" />
                  PDF
                </Button>
              )}
            </div>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {selectedReport?.content}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
