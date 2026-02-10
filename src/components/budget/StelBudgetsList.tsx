import { useState } from 'react';
import { 
  Search, Plus, RefreshCw, FileText, Receipt, ShoppingCart,
  MoreHorizontal, Loader2, Eye, Pencil, Trash2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useStelOrder, StelBudget } from '@/hooks/useStelOrder';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface StelBudgetsListProps {
  onCreateNew: () => void;
  onEdit: (budget: StelBudget) => void;
  onView: (budget: StelBudget) => void;
}

export default function StelBudgetsList({ onCreateNew, onEdit, onView }: StelBudgetsListProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState('1');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { useBudgets, deleteBudget, convertToInvoice, convertToOrder } = useStelOrder();
  const { data, isLoading, refetch } = useBudgets(search, page);

  const budgets: StelBudget[] = Array.isArray(data) ? data : (data?.data || data?.budgets || []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try { return format(new Date(dateStr), 'dd/MM/yyyy', { locale: es }); }
    catch { return dateStr; }
  };

  const formatCurrency = (amount?: number) => {
    if (amount == null) return '-';
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteBudget.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Presupuestos STEL Order
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo
            </Button>
          </div>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar presupuestos..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage('1'); }}
            className="pl-9"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[calc(100vh-22rem)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : budgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">No hay presupuestos</p>
              <p className="text-sm">Crea uno nuevo con el botón de arriba</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Validez</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.map((budget) => (
                  <TableRow 
                    key={budget.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onView(budget)}
                  >
                    <TableCell className="font-mono text-sm">
                      {budget.number || `#${budget.id}`}
                    </TableCell>
                    <TableCell className="font-medium max-w-[180px] truncate">
                      {budget.client?.name || budget.client?.commercialName || '-'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {budget.subject || budget.notes?.slice(0, 50) || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(budget.totalWithTax || budget.total)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(budget.date || budget.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(budget.validUntil)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(budget); }}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalle
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(budget); }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => { 
                            e.stopPropagation(); 
                            convertToInvoice.mutate(String(budget.id)); 
                          }}>
                            <Receipt className="h-4 w-4 mr-2" />
                            Convertir a factura
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { 
                            e.stopPropagation(); 
                            convertToOrder.mutate(String(budget.id)); 
                          }}>
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Convertir a pedido
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteId(String(budget.id)); }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <p className="text-sm text-muted-foreground">
            {budgets.length} presupuestos
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" size="sm"
              disabled={page === '1'}
              onClick={() => setPage(String(Math.max(1, Number(page) - 1)))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Página {page}</span>
            <Button 
              variant="outline" size="sm"
              disabled={budgets.length < 50}
              onClick={() => setPage(String(Number(page) + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar presupuesto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el presupuesto de STEL Order. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
