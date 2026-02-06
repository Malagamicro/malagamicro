import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, Trash2, Save, Send, Loader2, Calculator 
} from 'lucide-react';
import { useProviders } from '@/hooks/useProviders';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface ProductLine {
  id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  iva: number;
}

const ManualBudgetUpload = () => {
  const { user } = useAuth();
  const { activeProviders } = useProviders();
  const [loading, setLoading] = useState(false);
  const [sendToStel, setSendToStel] = useState(false);

  const [formData, setFormData] = useState({
    proveedor: '',
    email_proveedor: '',
    fecha: new Date().toISOString().split('T')[0],
    validez: '',
    observaciones: ''
  });

  const [productos, setProductos] = useState<ProductLine[]>([
    { id: crypto.randomUUID(), descripcion: '', cantidad: 1, precio_unitario: 0, iva: 21 }
  ]);

  const addProductLine = () => {
    setProductos(prev => [
      ...prev,
      { id: crypto.randomUUID(), descripcion: '', cantidad: 1, precio_unitario: 0, iva: 21 }
    ]);
  };

  const removeProductLine = (id: string) => {
    if (productos.length > 1) {
      setProductos(prev => prev.filter(p => p.id !== id));
    }
  };

  const updateProductLine = (id: string, field: keyof ProductLine, value: string | number) => {
    setProductos(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const calculateLineTotal = (line: ProductLine) => {
    const subtotal = line.cantidad * line.precio_unitario;
    return subtotal * (1 + line.iva / 100);
  };

  const totalGeneral = productos.reduce((acc, p) => acc + calculateLineTotal(p), 0);
  const subtotalSinIva = productos.reduce((acc, p) => acc + (p.cantidad * p.precio_unitario), 0);
  const totalIva = totalGeneral - subtotalSinIva;

  const handleProviderSelect = (providerName: string) => {
    const provider = activeProviders.find(p => p.nombre === providerName);
    if (provider) {
      setFormData(prev => ({
        ...prev,
        proveedor: provider.nombre,
        email_proveedor: provider.email
      }));
    } else {
      setFormData(prev => ({ ...prev, proveedor: providerName }));
    }
  };

  const handleSubmit = async (sendStel: boolean = false) => {
    if (!user) {
      toast({ title: "Error", description: "Debes iniciar sesión", variant: "destructive" });
      return;
    }

    if (!formData.proveedor) {
      toast({ title: "Error", description: "Selecciona o escribe un proveedor", variant: "destructive" });
      return;
    }

    if (productos.every(p => !p.descripcion)) {
      toast({ title: "Error", description: "Añade al menos un producto", variant: "destructive" });
      return;
    }

    setLoading(true);
    setSendToStel(sendStel);

    try {
      // Insert budget
      const { data: budget, error } = await supabase
        .from('budgets_received')
        .insert({
          request_id: `MANUAL-${Date.now()}`,
          proveedor: formData.proveedor,
          email_proveedor: formData.email_proveedor,
          productos: productos.filter(p => p.descripcion).map(p => ({
            descripcion: p.descripcion,
            cantidad: p.cantidad,
            precio_unitario: p.precio_unitario,
            precio_total: calculateLineTotal(p),
            iva: p.iva
          })),
          total: totalGeneral,
          observaciones: formData.observaciones,
          validez: formData.validez,
          estado: 'revision',
          user_responsible: user.id,
          metadata: { 
            source: 'manual_upload',
            fecha_presupuesto: formData.fecha
          }
        })
        .select('id')
        .single();

      if (error) throw error;

      toast({
        title: "Presupuesto guardado",
        description: `Presupuesto de ${formData.proveedor} guardado correctamente`
      });

      // Send to STEL Order if requested
      if (sendStel && budget) {
        const { data: session } = await supabase.auth.getSession();
        
        const stelResponse = await supabase.functions.invoke('send-to-stel-order', {
          body: { budget_id: budget.id, create_type: 'budget' },
          headers: { Authorization: `Bearer ${session.session?.access_token}` }
        });

        if (stelResponse.error) {
          toast({
            title: "Error STEL Order",
            description: "Guardado localmente pero error al enviar a STEL Order",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Enviado a STEL Order",
            description: "Presupuesto creado en STEL Order correctamente"
          });
        }
      }

      // Reset form
      setFormData({
        proveedor: '',
        email_proveedor: '',
        fecha: new Date().toISOString().split('T')[0],
        validez: '',
        observaciones: ''
      });
      setProductos([
        { id: crypto.randomUUID(), descripcion: '', cantidad: 1, precio_unitario: 0, iva: 21 }
      ]);

    } catch (error) {
      console.error('Error saving budget:', error);
      toast({
        title: "Error",
        description: "Error al guardar el presupuesto",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setSendToStel(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Subida Manual de Presupuesto
        </CardTitle>
        <CardDescription>
          Añade manualmente un presupuesto recibido offline
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider & Date Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Proveedor</Label>
            <Select onValueChange={handleProviderSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar proveedor..." />
              </SelectTrigger>
              <SelectContent>
                {activeProviders.map(p => (
                  <SelectItem key={p.id} value={p.nombre}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="O escribe uno nuevo..."
              value={formData.proveedor}
              onChange={(e) => setFormData(prev => ({ ...prev, proveedor: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Email del proveedor</Label>
            <Input
              type="email"
              placeholder="proveedor@empresa.com"
              value={formData.email_proveedor}
              onChange={(e) => setFormData(prev => ({ ...prev, email_proveedor: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Fecha del presupuesto</Label>
            <Input
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Validez</Label>
            <Input
              placeholder="30 días, hasta 15/03/2024..."
              value={formData.validez}
              onChange={(e) => setFormData(prev => ({ ...prev, validez: e.target.value }))}
            />
          </div>
        </div>

        {/* Products Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Productos / Servicios</Label>
            <Button variant="outline" size="sm" onClick={addProductLine}>
              <Plus className="h-4 w-4 mr-1" />
              Añadir línea
            </Button>
          </div>

          <ScrollArea className="h-[300px] border rounded-lg">
            <div className="p-4 space-y-3">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                <div className="col-span-5">Descripción</div>
                <div className="col-span-2">Cantidad</div>
                <div className="col-span-2">Precio Unit.</div>
                <div className="col-span-1">IVA %</div>
                <div className="col-span-1 text-right">Total</div>
                <div className="col-span-1"></div>
              </div>

              {/* Lines */}
              {productos.map((producto) => (
                <div key={producto.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Input
                      placeholder="Descripción del producto..."
                      value={producto.descripcion}
                      onChange={(e) => updateProductLine(producto.id, 'descripcion', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="1"
                      value={producto.cantidad}
                      onChange={(e) => updateProductLine(producto.id, 'cantidad', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={producto.precio_unitario}
                      onChange={(e) => updateProductLine(producto.id, 'precio_unitario', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-1">
                    <Select 
                      value={String(producto.iva)}
                      onValueChange={(v) => updateProductLine(producto.id, 'iva', parseInt(v))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="4">4%</SelectItem>
                        <SelectItem value="10">10%</SelectItem>
                        <SelectItem value="21">21%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1 text-right font-medium text-sm">
                    {calculateLineTotal(producto).toFixed(2)}€
                  </div>
                  <div className="col-span-1 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeProductLine(producto.id)}
                      disabled={productos.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Totals */}
          <div className="flex justify-end pt-4 border-t">
            <div className="space-y-1 text-right">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>{subtotalSinIva.toFixed(2)}€</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">IVA:</span>
                <span>{totalIva.toFixed(2)}€</span>
              </div>
              <div className="flex items-center gap-4 text-lg font-bold">
                <span>Total:</span>
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {totalGeneral.toFixed(2)}€
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Observations */}
        <div className="space-y-2">
          <Label>Observaciones</Label>
          <Textarea
            placeholder="Notas adicionales del presupuesto..."
            value={formData.observaciones}
            onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={loading}
          >
            {loading && !sendToStel ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Guardar en CRM
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            disabled={loading}
          >
            {loading && sendToStel ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Guardar y enviar a STEL Order
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ManualBudgetUpload;
