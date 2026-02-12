import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Search, Plus, Trash2, MoreVertical, Save, RotateCcw, Loader2,
  FileText, Paperclip, PenTool, Link, BarChart3, ScanBarcode,
} from 'lucide-react';
import { useStelBudgetForm } from '@/hooks/useStelBudgetForm';
import { FORMAS_PAGO, IVA_OPTIONS } from '@/types/stelBudget';
import ClientSearchModal from './ClientSearchModal';

export default function StelOrderBudgetForm() {
  const {
    env, setEnv,
    form, updateField,
    clients, loadingClients,
    selectClient,
    addLine, removeLine, updateLine,
    calculations, lineSubtotal,
    submitting, submit, resetForm,
    aiReport, setAiReport,
  } = useStelBudgetForm();

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const handleSubmit = async () => {
    const ok = await submit();
    if (ok && aiReport) setReportOpen(true);
  };

  const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Top bar: env toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Nuevo Presupuesto de Venta
        </h2>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${env === 'test' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {env === 'test' ? '🧪 TEST' : '🚀 PRODUCCIÓN'}
          </span>
          <Switch
            checked={env === 'production'}
            onCheckedChange={v => setEnv(v ? 'production' : 'test')}
          />
        </div>
      </div>

      <div className="flex-1 p-4 space-y-6 overflow-auto">
        {/* === HEADER GRID === */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Col 1 */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium">Referencia</Label>
              <div className="flex gap-2 mt-1">
                <Select value={form.referencia_prefijo} onValueChange={v => updateField('referencia_prefijo', v)}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRV">PRV</SelectItem>
                    <SelectItem value="PED">PED</SelectItem>
                    <SelectItem value="FAC">FAC</SelectItem>
                  </SelectContent>
                </Select>
                <Input value="Automático" readOnly className="bg-muted text-muted-foreground" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Cliente</Label>
              <div className="relative mt-1">
                <Input
                  value={form.cliente_nombre}
                  placeholder="Seleccionar cliente..."
                  readOnly
                  className="pr-10 cursor-pointer"
                  onClick={() => setClientModalOpen(true)}
                />
                <Search
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer"
                  onClick={() => setClientModalOpen(true)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Forma de pago</Label>
              <Select value={form.forma_pago} onValueChange={v => updateField('forma_pago', v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona una forma de pago..." /></SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGO.map(f => (
                    <SelectItem key={f.value || '__empty'} value={f.value || '__empty'}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Col 2 */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium">Fecha</Label>
              <Input type="date" value={form.fecha} onChange={e => updateField('fecha', e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">Título</Label>
              <Input value={form.titulo} onChange={e => updateField('titulo', e.target.value)} placeholder="Título del presupuesto" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs font-medium">Creado por</Label>
              <Input value={form.creado_por} readOnly className="mt-1 bg-muted text-muted-foreground" />
            </div>
          </div>

          {/* Col 3 */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-medium">Estado</Label>
              <div className="mt-1">
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 px-3 py-1.5">
                  {form.estado}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium">Agente</Label>
              <Input value={form.agente} readOnly className="mt-1 bg-muted text-muted-foreground" />
            </div>
            <div>
              <Label className="text-xs font-medium">Tarifa</Label>
              <Select value={form.tarifa} onValueChange={v => updateField('tarifa', v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="precio_base_venta">Precio base de venta</SelectItem>
                  <SelectItem value="precio_coste">Precio de coste</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Checkboxes */}
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.sujeto_iva} onCheckedChange={v => updateField('sujeto_iva', !!v)} />
            Sujeto a IVA
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.sujeto_irpf} onCheckedChange={v => updateField('sujeto_irpf', !!v)} />
            Sujeto a IRPF
          </label>
        </div>

        {/* === PRODUCT LINES === */}
        <Tabs defaultValue="lineas" className="w-full">
          <TabsList>
            <TabsTrigger value="lineas">Líneas</TabsTrigger>
            <TabsTrigger value="mas">Más información</TabsTrigger>
            <TabsTrigger value="adjuntos">Adjuntos</TabsTrigger>
            <TabsTrigger value="firma">Firma</TabsTrigger>
            <TabsTrigger value="relacionados">Relacionados</TabsTrigger>
          </TabsList>

          <TabsContent value="lineas" className="mt-4 space-y-4">
            {/* Product table */}
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-xs font-medium text-muted-foreground">
                    <th className="p-2 text-left w-24">Referencia</th>
                    <th className="p-2 text-left">Nombre</th>
                    <th className="p-2 text-left w-40">Descripción</th>
                    <th className="p-2 text-right w-28">Precio (€)</th>
                    <th className="p-2 text-right w-20">Uds.</th>
                    <th className="p-2 text-right w-20">% Dto.</th>
                    <th className="p-2 text-right w-28">Subtotal (€)</th>
                    <th className="p-2 text-center w-24">% Imp.</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.productos.map(line => (
                    <tr key={line.id} className="border-t hover:bg-muted/30">
                      <td className="p-1.5">
                        <Input value={line.referencia} onChange={e => updateLine(line.id, 'referencia', e.target.value)} className="h-8 text-xs" />
                      </td>
                      <td className="p-1.5">
                        <Input value={line.nombre} onChange={e => updateLine(line.id, 'nombre', e.target.value)} className="h-8 text-xs" />
                      </td>
                      <td className="p-1.5">
                        <Input value={line.descripcion} onChange={e => updateLine(line.id, 'descripcion', e.target.value)} className="h-8 text-xs" />
                      </td>
                      <td className="p-1.5">
                        <Input type="number" step="0.01" value={line.precio} onChange={e => updateLine(line.id, 'precio', parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right" />
                      </td>
                      <td className="p-1.5">
                        <Input type="number" step="0.01" value={line.unidades} onChange={e => updateLine(line.id, 'unidades', parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right" />
                      </td>
                      <td className="p-1.5">
                        <Input type="number" step="0.01" value={line.descuento} onChange={e => updateLine(line.id, 'descuento', parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right" />
                      </td>
                      <td className="p-1.5 text-right font-medium text-xs tabular-nums">
                        {fmt(lineSubtotal(line))}
                      </td>
                      <td className="p-1.5">
                        <Select value={String(line.impuesto)} onValueChange={v => updateLine(line.id, 'impuesto', Number(v))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {IVA_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-1.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(line.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={addLine} className="bg-[hsl(25,95%,53%)] hover:bg-[hsl(25,95%,45%)] text-white">
                <Plus className="h-4 w-4 mr-1" /> Añadir productos o servicios
              </Button>
              <Button variant="outline" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" /> Nueva línea
              </Button>
              <Button variant="outline" onClick={addLine}>
                <FileText className="h-4 w-4 mr-1" /> Nuevo capítulo
              </Button>
              <Button variant="outline">
                <ScanBarcode className="h-4 w-4 mr-1" /> Leer código de barras
              </Button>
            </div>

            {/* Financial summary */}
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-2 bg-muted/30 rounded-lg p-4 border">
                <div className="flex items-center justify-between text-sm">
                  <span>% Dto. global</span>
                  <Input
                    type="number" step="0.01"
                    value={form.descuento_global}
                    onChange={e => updateField('descuento_global', parseFloat(e.target.value) || 0)}
                    className="w-20 h-8 text-xs text-right"
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total base (€)</span>
                  <span className="font-medium tabular-nums">{fmt(calculations.totalBase)}</span>
                </div>
                {form.sujeto_iva && (
                  <div className="flex justify-between text-sm">
                    <span>IVA (€)</span>
                    <span className="font-medium tabular-nums">{fmt(calculations.totalIva)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold border-t pt-2">
                  <span>Total (€)</span>
                  <span className="tabular-nums">{fmt(calculations.totalFinal)}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mas" className="mt-4">
            <p className="text-muted-foreground text-sm">Información adicional del presupuesto.</p>
          </TabsContent>
          <TabsContent value="adjuntos" className="mt-4">
            <p className="text-muted-foreground text-sm">Arrastra archivos aquí o haz clic para adjuntar.</p>
          </TabsContent>
          <TabsContent value="firma" className="mt-4">
            <p className="text-muted-foreground text-sm">Firma del presupuesto.</p>
          </TabsContent>
          <TabsContent value="relacionados" className="mt-4">
            <p className="text-muted-foreground text-sm">Documentos relacionados.</p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-between p-4 border-t bg-card">
        <Button variant="outline" onClick={resetForm}>
          <RotateCcw className="h-4 w-4 mr-1" /> Limpiar
        </Button>
        <div className="flex gap-2">
          {aiReport && (
            <Button variant="outline" onClick={() => setReportOpen(true)}>
              <BarChart3 className="h-4 w-4 mr-1" /> Ver informe IA
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[hsl(25,95%,53%)] hover:bg-[hsl(25,95%,45%)] text-white"
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Crear Presupuesto
          </Button>
        </div>
      </div>

      {/* Client search modal */}
      <ClientSearchModal
        open={clientModalOpen}
        onOpenChange={setClientModalOpen}
        clients={clients}
        loading={loadingClients}
        onSelect={selectClient}
      />

      {/* AI Report modal */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Informe generado por IA</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: aiReport || '' }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
