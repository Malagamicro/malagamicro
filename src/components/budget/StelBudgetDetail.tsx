import { ArrowLeft, Receipt, ShoppingCart, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { StelBudget } from '@/hooks/useStelOrder';
import { useStelOrder } from '@/hooks/useStelOrder';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface StelBudgetDetailProps {
  budget: StelBudget;
  onBack: () => void;
  onEdit: () => void;
}

export default function StelBudgetDetail({ budget, onBack, onEdit }: StelBudgetDetailProps) {
  const { convertToInvoice, convertToOrder } = useStelOrder();

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try { return format(new Date(dateStr), "dd 'de' MMMM yyyy", { locale: es }); }
    catch { return dateStr; }
  };

  const formatCurrency = (amount?: number) => {
    if (amount == null) return '-';
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const lines = budget.lines || [];
  const subtotal = lines.reduce((sum, l) => sum + (l.quantity || 1) * (l.price || 0) * (1 - (l.discount || 0) / 100), 0);
  const totalTax = lines.reduce((sum, l) => {
    const base = (l.quantity || 1) * (l.price || 0) * (1 - (l.discount || 0) / 100);
    return sum + base * ((l.taxPercentage || 0) / 100);
  }, 0);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <CardTitle className="text-lg">
                Presupuesto {budget.number || `#${budget.id}`}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {formatDate(budget.date || budget.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              Editar
            </Button>
            <Button 
              variant="outline" size="sm"
              onClick={() => convertToInvoice.mutate(String(budget.id))}
              disabled={convertToInvoice.isPending}
            >
              {convertToInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Receipt className="h-4 w-4 mr-1" />}
              A Factura
            </Button>
            <Button 
              variant="outline" size="sm"
              onClick={() => convertToOrder.mutate(String(budget.id))}
              disabled={convertToOrder.isPending}
            >
              {convertToOrder.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShoppingCart className="h-4 w-4 mr-1" />}
              A Pedido
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[calc(100vh-22rem)]">
          <div className="p-6 space-y-6">
            {/* Client info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Cliente</h3>
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <p className="font-medium text-lg">{budget.client?.name || budget.client?.commercialName || 'Sin cliente'}</p>
                  {budget.client?.email && <p className="text-sm text-muted-foreground">{budget.client.email}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Detalles</h3>
                <div className="p-4 rounded-lg bg-muted/30 border space-y-1">
                  {budget.subject && <p><span className="text-muted-foreground text-sm">Asunto:</span> {budget.subject}</p>}
                  <p><span className="text-muted-foreground text-sm">Válido hasta:</span> {formatDate(budget.validUntil)}</p>
                  {budget.status && (
                    <p>
                      <span className="text-muted-foreground text-sm">Estado: </span>
                      <Badge variant="outline">{budget.status}</Badge>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            {budget.notes && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notas</h3>
                <p className="text-sm bg-muted/30 p-3 rounded-lg border">{budget.notes}</p>
              </div>
            )}

            <Separator />

            {/* Lines */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Líneas</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Cant.</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Dto.</TableHead>
                    <TableHead className="text-right">IVA</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, idx) => {
                    const base = (line.quantity || 1) * (line.price || 0) * (1 - (line.discount || 0) / 100);
                    const total = base * (1 + (line.taxPercentage || 0) / 100);
                    return (
                      <TableRow key={idx}>
                        <TableCell>{line.concept}</TableCell>
                        <TableCell className="text-right">{line.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(line.price)}</TableCell>
                        <TableCell className="text-right">{line.discount || 0}%</TableCell>
                        <TableCell className="text-right">{line.taxPercentage || 0}%</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(total)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {lines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Sin líneas
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Totals */}
              <div className="flex justify-end mt-4">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IVA:</span>
                    <span>{formatCurrency(totalTax)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>{formatCurrency(budget.totalWithTax || budget.total || subtotal + totalTax)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
