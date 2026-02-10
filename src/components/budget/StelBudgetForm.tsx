import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Loader2, Search, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useStelOrder, StelBudget, StelBudgetLine } from '@/hooks/useStelOrder';
import { useDebounce } from '@/hooks/useDebounce';

interface StelBudgetFormProps {
  budget?: StelBudget | null;
  onBack: () => void;
}

const emptyLine: StelBudgetLine = {
  concept: '',
  quantity: 1,
  price: 0,
  taxPercentage: 21,
  discount: 0,
};

export default function StelBudgetForm({ budget, onBack }: StelBudgetFormProps) {
  const { createBudget, updateBudget, useClients } = useStelOrder();
  const isEditing = !!budget;

  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<{ id: number | string; name: string } | null>(
    budget?.client ? { id: budget.client.id, name: budget.client.name || budget.client.commercialName || '' } : null
  );
  const [clientName, setClientName] = useState(budget?.client?.name || '');
  const [clientEmail, setClientEmail] = useState(budget?.client?.email || '');
  const [subject, setSubject] = useState(budget?.subject || '');
  const [notes, setNotes] = useState(budget?.notes || '');
  const [validUntil, setValidUntil] = useState(budget?.validUntil || '');
  const [lines, setLines] = useState<StelBudgetLine[]>(
    budget?.lines?.length ? budget.lines.map(l => ({
      concept: l.concept || '',
      quantity: l.quantity || 1,
      price: l.price || 0,
      taxPercentage: l.taxPercentage || 21,
      discount: l.discount || 0,
    })) : [{ ...emptyLine }]
  );
  const [showClientSearch, setShowClientSearch] = useState(false);

  const debouncedSearch = useDebounce(clientSearch, 400);
  const { data: clientsData, isLoading: clientsLoading } = useClients(debouncedSearch);
  const clients = Array.isArray(clientsData) ? clientsData : (clientsData?.data || []);

  const addLine = () => setLines(prev => [...prev, { ...emptyLine }]);
  
  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof StelBudgetLine, value: string | number) => {
    setLines(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line));
  };

  const lineTotal = (line: StelBudgetLine) => {
    const subtotal = line.quantity * line.price;
    const discounted = subtotal * (1 - (line.discount || 0) / 100);
    return discounted * (1 + (line.taxPercentage || 0) / 100);
  };

  const subtotal = lines.reduce((sum, l) => sum + (l.quantity * l.price * (1 - (l.discount || 0) / 100)), 0);
  const totalTax = lines.reduce((sum, l) => {
    const base = l.quantity * l.price * (1 - (l.discount || 0) / 100);
    return sum + base * ((l.taxPercentage || 0) / 100);
  }, 0);
  const grandTotal = subtotal + totalTax;

  const handleSubmit = () => {
    if (!selectedClient && !clientName) {
      return;
    }
    if (lines.every(l => !l.concept)) return;

    const payload: any = {
      items: lines.filter(l => l.concept),
      notes,
      subject,
      valid_until: validUntil || undefined,
    };

    if (selectedClient) {
      payload.client_id = selectedClient.id;
    } else {
      payload.client_name = clientName;
      payload.client_email = clientEmail;
    }

    if (isEditing && budget) {
      updateBudget.mutate({ id: budget.id, ...payload }, {
        onSuccess: () => onBack(),
      });
    } else {
      createBudget.mutate(payload, {
        onSuccess: () => onBack(),
      });
    }
  };

  const isPending = createBudget.isPending || updateBudget.isPending;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <CardTitle className="text-lg">
            {isEditing ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
          </CardTitle>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[calc(100vh-22rem)]">
          <div className="p-6 space-y-6">
            {/* Client Section */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Cliente</h3>
              
              <div className="relative">
                <Label>Buscar cliente existente</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre..."
                    value={clientSearch}
                    onChange={(e) => { setClientSearch(e.target.value); setShowClientSearch(true); }}
                    onFocus={() => setShowClientSearch(true)}
                    className="pl-9"
                  />
                </div>
                {showClientSearch && clientSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto">
                    {clientsLoading ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                        Buscando...
                      </div>
                    ) : clients.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        No se encontraron clientes
                      </div>
                    ) : (
                      clients.map((client: any) => (
                        <button
                          key={client.id}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                          onClick={() => {
                            setSelectedClient({ id: client.id, name: client.name || client.commercialName });
                            setClientName(client.name || client.commercialName || '');
                            setClientEmail(client.email || '');
                            setClientSearch('');
                            setShowClientSearch(false);
                          }}
                        >
                          <p className="font-medium">{client.name || client.commercialName}</p>
                          {client.email && <p className="text-xs text-muted-foreground">{client.email}</p>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {selectedClient && (
                <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-md border">
                  <span className="text-sm font-medium flex-1">{selectedClient.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedClient(null); setClientName(''); setClientEmail(''); }}>
                    Cambiar
                  </Button>
                </div>
              )}

              {!selectedClient && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Nombre del cliente *</Label>
                    <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nombre o razón social" className="mt-1" />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="cliente@empresa.com" type="email" className="mt-1" />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Asunto</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ej: Presupuesto instalación..." className="mt-1" />
              </div>
              <div>
                <Label>Válido hasta</Label>
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="mt-1" />
              </div>
            </div>

            <div>
              <Label>Notas</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas adicionales..." rows={2} className="mt-1" />
            </div>

            <Separator />

            {/* Lines */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Líneas del presupuesto</h3>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Añadir línea
                </Button>
              </div>

              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/30 rounded-lg">
                  <div className="col-span-12 md:col-span-4">
                    <Label className="text-xs">Concepto</Label>
                    <Input 
                      value={line.concept} 
                      onChange={(e) => updateLine(idx, 'concept', e.target.value)} 
                      placeholder="Descripción del producto/servicio"
                      className="mt-0.5"
                    />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <Label className="text-xs">Cantidad</Label>
                    <Input 
                      type="number" min={1} step={1}
                      value={line.quantity} 
                      onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))} 
                      className="mt-0.5"
                    />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <Label className="text-xs">Precio (€)</Label>
                    <Input 
                      type="number" min={0} step={0.01}
                      value={line.price} 
                      onChange={(e) => updateLine(idx, 'price', Number(e.target.value))} 
                      className="mt-0.5"
                    />
                  </div>
                  <div className="col-span-3 md:col-span-1">
                    <Label className="text-xs">IVA %</Label>
                    <Input 
                      type="number" min={0} max={100}
                      value={line.taxPercentage} 
                      onChange={(e) => updateLine(idx, 'taxPercentage', Number(e.target.value))} 
                      className="mt-0.5"
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <Label className="text-xs">Dto %</Label>
                    <Input 
                      type="number" min={0} max={100}
                      value={line.discount} 
                      onChange={(e) => updateLine(idx, 'discount', Number(e.target.value))} 
                      className="mt-0.5"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-1 text-right">
                    <Label className="text-xs">Total</Label>
                    <p className="text-sm font-medium mt-2">{lineTotal(line).toFixed(2)}€</p>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeLine(idx)} disabled={lines.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{subtotal.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IVA:</span>
                    <span>{totalTax.toFixed(2)} €</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total:</span>
                    <span>{grandTotal.toFixed(2)} €</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Submit */}
        <div className="p-4 border-t flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onBack}>Cancelar</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isPending || (!selectedClient && !clientName) || lines.every(l => !l.concept)}
          >
            {isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" />{isEditing ? 'Actualizar' : 'Crear presupuesto'}</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
