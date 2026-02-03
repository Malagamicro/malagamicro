import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, Trash2, Send, Mail, Package, Loader2, X 
} from 'lucide-react';
import { useBudgetRequests, BudgetProduct } from '@/hooks/useBudgetRequests';

const BudgetRequestForm = () => {
  const { createRequest, submitting } = useBudgetRequests();
  
  const [prompt, setPrompt] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [products, setProducts] = useState<BudgetProduct[]>([
    { nombre: '', cantidad: 1, unidad: 'unidades' }
  ]);
  const [emailEmpresa, setEmailEmpresa] = useState('presupuestos@malagamicro.com');

  const addEmail = () => {
    if (newEmail && !emails.includes(newEmail) && newEmail.includes('@')) {
      setEmails([...emails, newEmail]);
      setNewEmail('');
    }
  };

  const removeEmail = (email: string) => {
    setEmails(emails.filter(e => e !== email));
  };

  const handleEmailKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmail();
    }
  };

  const addProduct = () => {
    setProducts([...products, { nombre: '', cantidad: 1, unidad: 'unidades' }]);
  };

  const removeProduct = (index: number) => {
    if (products.length > 1) {
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const updateProduct = (index: number, field: keyof BudgetProduct, value: string | number) => {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    setProducts(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!prompt.trim()) {
      return;
    }
    if (emails.length === 0) {
      return;
    }
    if (products.some(p => !p.nombre.trim())) {
      return;
    }

    const result = await createRequest({
      prompt: prompt.trim(),
      emails,
      products: products.filter(p => p.nombre.trim()),
      email_empresa: emailEmpresa
    });

    if (result?.success) {
      // Reset form
      setPrompt('');
      setEmails([]);
      setProducts([{ nombre: '', cantidad: 1, unidad: 'unidades' }]);
    }
  };

  const isValid = prompt.trim() && emails.length > 0 && products.every(p => p.nombre.trim());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Nueva Solicitud de Presupuesto
        </CardTitle>
        <CardDescription>
          Crea una solicitud que se enviará automáticamente a los proveedores seleccionados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Prompt/Descripción */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Descripción de la solicitud</Label>
            <Textarea
              id="prompt"
              placeholder="Describe qué necesitas presupuestar. Ej: Necesito presupuesto para mantenimiento anual de 10 equipos de aire acondicionado..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Email Empresa */}
          <div className="space-y-2">
            <Label htmlFor="emailEmpresa">Email de respuesta</Label>
            <Input
              id="emailEmpresa"
              type="email"
              placeholder="presupuestos@malagamicro.com"
              value={emailEmpresa}
              onChange={(e) => setEmailEmpresa(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Los proveedores responderán a este email
            </p>
          </div>

          {/* Emails de Proveedores */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Emails de Proveedores
            </Label>
            
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="proveedor@empresa.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyPress={handleEmailKeyPress}
              />
              <Button type="button" variant="secondary" onClick={addEmail}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {emails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {emails.map((email) => (
                  <Badge key={email} variant="secondary" className="pl-2 pr-1 py-1">
                    {email}
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {emails.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Añade al menos un email de proveedor
              </p>
            )}
          </div>

          {/* Productos */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Productos / Servicios
            </Label>

            <div className="space-y-2">
              {products.map((product, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input
                      placeholder="Nombre del producto o servicio"
                      value={product.nombre}
                      onChange={(e) => updateProduct(index, 'nombre', e.target.value)}
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Cant."
                      value={product.cantidad}
                      onChange={(e) => updateProduct(index, 'cantidad', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      placeholder="Unidad"
                      value={product.unidad}
                      onChange={(e) => updateProduct(index, 'unidad', e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProduct(index)}
                    disabled={products.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addProduct}>
              <Plus className="h-4 w-4 mr-1" />
              Añadir producto
            </Button>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-4 border-t">
            <Button type="submit" disabled={submitting || !isValid}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar Solicitud
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default BudgetRequestForm;
