import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Inbox, Eye, Check, X, Send, Search, Filter,
  Loader2, FileText, Clock, CheckCircle, AlertCircle, ExternalLink
} from 'lucide-react';
import { useBudgetRequests, BudgetReceived } from '@/hooks/useBudgetRequests';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type EstadoFilter = 'all' | 'revision' | 'aprobado' | 'rechazado' | 'enviado_stel';

const BudgetsReceivedTable = () => {
  const { budgetsReceived, fetchBudgetsReceived } = useBudgetRequests();
  const [searchQuery, setSearchQuery] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('all');
  const [detailBudget, setDetailBudget] = useState<BudgetReceived | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filter budgets
  const filteredBudgets = budgetsReceived.filter(b => {
    const matchesSearch = 
      b.proveedor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.email_proveedor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.request_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const estado = (b as any).estado || (b.selected ? 'aprobado' : 'revision');
    const matchesEstado = estadoFilter === 'all' || estado === estadoFilter;
    
    return matchesSearch && matchesEstado;
  });

  const getEstadoBadge = (budget: BudgetReceived) => {
    const estado = (budget as any).estado || (budget.selected ? 'aprobado' : budget.invoice_id ? 'enviado_stel' : 'revision');
    
    switch (estado) {
      case 'revision':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><Clock className="h-3 w-3 mr-1" />Revisión</Badge>;
      case 'aprobado':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><Check className="h-3 w-3 mr-1" />Aprobado</Badge>;
      case 'rechazado':
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rechazado</Badge>;
      case 'enviado_stel':
        return <Badge variant="outline" className="border-blue-500 text-blue-600"><CheckCircle className="h-3 w-3 mr-1" />En STEL</Badge>;
      default:
        return <Badge variant="secondary">{estado}</Badge>;
    }
  };

  const handleApprove = async (budget: BudgetReceived, sendToStel: boolean = false) => {
    setActionLoading(budget.id);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      
      // First approve via notify-n8n-approval
      const approveResponse = await supabase.functions.invoke('notify-n8n-approval', {
        body: { 
          budget_id: budget.id,
          request_id: budget.request_id,
          accion: 'aprobar',
          enviar_stel: sendToStel
        },
        headers: { Authorization: `Bearer ${session.session?.access_token}` }
      });

      if (approveResponse.error) throw new Error(approveResponse.error.message);

      // If sending to STEL Order
      if (sendToStel) {
        const stelResponse = await supabase.functions.invoke('send-to-stel-order', {
          body: { budget_id: budget.id, create_type: 'budget' },
          headers: { Authorization: `Bearer ${session.session?.access_token}` }
        });

        if (stelResponse.error) {
          toast({
            title: "Aprobado pero error en STEL",
            description: "El presupuesto fue aprobado pero falló el envío a STEL Order",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Aprobado y enviado",
            description: "Presupuesto aprobado y creado en STEL Order"
          });
        }
      } else {
        toast({
          title: "Presupuesto aprobado",
          description: `Presupuesto de ${budget.proveedor} aprobado`
        });
      }

      fetchBudgetsReceived();
    } catch (error) {
      console.error('Error approving:', error);
      toast({
        title: "Error",
        description: "Error al aprobar el presupuesto",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (budget: BudgetReceived) => {
    setActionLoading(budget.id);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('notify-n8n-approval', {
        body: { 
          budget_id: budget.id,
          request_id: budget.request_id,
          accion: 'rechazar'
        },
        headers: { Authorization: `Bearer ${session.session?.access_token}` }
      });

      if (response.error) throw new Error(response.error.message);

      toast({
        title: "Presupuesto rechazado",
        description: `Presupuesto de ${budget.proveedor} rechazado`
      });

      fetchBudgetsReceived();
    } catch (error) {
      console.error('Error rejecting:', error);
      toast({
        title: "Error",
        description: "Error al rechazar el presupuesto",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendToStel = async (budget: BudgetReceived) => {
    setActionLoading(budget.id);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('send-to-stel-order', {
        body: { budget_id: budget.id, create_type: 'budget' },
        headers: { Authorization: `Bearer ${session.session?.access_token}` }
      });

      if (response.error) throw new Error(response.error.message);

      toast({
        title: "Enviado a STEL Order",
        description: "Presupuesto creado correctamente en STEL Order"
      });

      fetchBudgetsReceived();
    } catch (error) {
      console.error('Error sending to STEL:', error);
      toast({
        title: "Error",
        description: "Error al enviar a STEL Order",
        variant: "destructive"
      });
    } finally {
      setActionLoading(null);
    }
  };

  const productos = detailBudget?.productos || [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Presupuestos Recibidos
          </CardTitle>
          <CardDescription>
            Presupuestos enviados por los proveedores - Revisa, aprueba y envía a STEL Order
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por proveedor, email o ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={estadoFilter} onValueChange={(v) => setEstadoFilter(v as EstadoFilter)}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="revision">En revisión</SelectItem>
                <SelectItem value="aprobado">Aprobados</SelectItem>
                <SelectItem value="rechazado">Rechazados</SelectItem>
                <SelectItem value="enviado_stel">Enviados a STEL</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBudgets.map(budget => {
                  const estado = (budget as any).estado || (budget.selected ? 'aprobado' : 'revision');
                  const isLoading = actionLoading === budget.id;
                  const canApprove = estado === 'revision';
                  const canSendToStel = estado === 'aprobado' && !budget.invoice_id;
                  
                  return (
                    <TableRow key={budget.id}>
                      <TableCell className="font-medium">
                        {budget.proveedor}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {budget.email_proveedor}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {budget.productos?.length || 0} items
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {budget.total ? `${budget.total.toFixed(2)}€` : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(budget.fecha_recepcion), "dd/MM/yyyy", { locale: es })}
                      </TableCell>
                      <TableCell>
                        {getEstadoBadge(budget)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {/* View Details */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDetailBudget(budget)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {/* Approve */}
                          {canApprove && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleApprove(budget, false)}
                              disabled={isLoading}
                            >
                              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </Button>
                          )}

                          {/* Reject */}
                          {canApprove && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleReject(budget)}
                              disabled={isLoading}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Approve & Send to STEL */}
                          {canApprove && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600"
                              onClick={() => handleApprove(budget, true)}
                              disabled={isLoading}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              STEL
                            </Button>
                          )}

                          {/* Send to STEL (already approved) */}
                          {canSendToStel && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendToStel(budget)}
                              disabled={isLoading}
                            >
                              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                              Enviar STEL
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredBudgets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      {searchQuery || estadoFilter !== 'all' 
                        ? 'No se encontraron presupuestos con esos filtros'
                        : 'No hay presupuestos recibidos aún'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!detailBudget} onOpenChange={() => setDetailBudget(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalle del Presupuesto
            </DialogTitle>
            <DialogDescription>
              Presupuesto de {detailBudget?.proveedor}
            </DialogDescription>
          </DialogHeader>

          {detailBudget && (
            <div className="space-y-6 py-4">
              {/* Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Proveedor</p>
                  <p className="font-medium">{detailBudget.proveedor}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{detailBudget.email_proveedor}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha recepción</p>
                  <p className="font-medium">
                    {format(new Date(detailBudget.fecha_recepcion), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Validez</p>
                  <p className="font-medium">{(detailBudget as any).validez || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ID Solicitud</p>
                  <p className="font-mono text-sm">{detailBudget.request_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Estado</p>
                  {getEstadoBadge(detailBudget)}
                </div>
              </div>

              {/* Products Table */}
              <div>
                <h4 className="text-sm font-medium mb-2">Productos / Servicios</h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead className="text-right">Precio Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productos.map((p: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>{p.descripcion || p.nombre || '-'}</TableCell>
                          <TableCell className="text-right">{p.cantidad || 1}</TableCell>
                          <TableCell className="text-right">
                            {p.precio_unitario ? `${p.precio_unitario.toFixed(2)}€` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {p.precio_total ? `${p.precio_total.toFixed(2)}€` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {productos.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                            No hay productos detallados
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-end">
                <div className="bg-muted px-6 py-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total General</p>
                  <p className="text-2xl font-bold">
                    {detailBudget.total ? `${detailBudget.total.toFixed(2)}€` : '-'}
                  </p>
                </div>
              </div>

              {/* Observations */}
              {detailBudget.observaciones && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Observaciones</h4>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    {detailBudget.observaciones}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailBudget(null)}>
              Cerrar
            </Button>
            {detailBudget && (detailBudget as any).estado === 'revision' && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleReject(detailBudget);
                    setDetailBudget(null);
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Rechazar
                </Button>
                <Button
                  onClick={() => {
                    handleApprove(detailBudget, true);
                    setDetailBudget(null);
                  }}
                >
                  <Send className="h-4 w-4 mr-1" />
                  Aprobar y enviar a STEL
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BudgetsReceivedTable;
