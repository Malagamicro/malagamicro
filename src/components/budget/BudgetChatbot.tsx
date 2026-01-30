import { useState } from 'react';
import { FileText, Loader2, CheckCircle2, Package, Building2, ArrowRight, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const N8N_WEBHOOK_URL = 'https://n8n.srv1304274.hstgr.cloud/webhook-test/crear-presupuesto';

interface Producto {
  nombre: string;
  cantidad: number;
}

interface Proveedor {
  nombre: string;
  email: string;
  motivo_seleccion: string;
}

interface BudgetResponse {
  status: string;
  mensaje: string;
  solicitud_id: string;
  proveedor: Proveedor;
  productos: Producto[];
  cliente: string;
  siguiente_paso: string;
}

export function BudgetChatbot() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<BudgetResponse | null>(null);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setResponse(null);

    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }

      const data: BudgetResponse = await res.json();
      setResponse(data);
      
      toast({
        title: '✅ Solicitud enviada',
        description: 'La cotización ha sido procesada correctamente.',
      });
    } catch (error) {
      console.error('Error sending request to n8n:', error);
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servicio. Por favor, inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewRequest = () => {
    setPrompt('');
    setResponse(null);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Generador de Presupuestos</h2>
          <p className="text-sm text-muted-foreground">Solicita cotizaciones automáticas a proveedores</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {!response ? (
            <>
              {/* Form Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="w-5 h-5" />
                    Nueva Solicitud de Cotización
                  </CardTitle>
                  <CardDescription>
                    Describe lo que necesitas cotizar y enviaremos la solicitud automáticamente al proveedor adecuado
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe qué necesitas cotizar... Ejemplo: Necesito 10 SSDs de 1TB Samsung para el cliente TechStore Málaga"
                    className="min-h-[150px] resize-none"
                    disabled={isLoading}
                  />
                  <Button 
                    onClick={handleSubmit} 
                    disabled={!prompt.trim() || isLoading}
                    className="w-full"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Procesando solicitud...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Solicitar Cotización
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Loading State */}
              {isLoading && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      </div>
                      <div>
                        <p className="font-medium">Procesando tu solicitud...</p>
                        <p className="text-sm text-muted-foreground">
                          Analizando productos y seleccionando el mejor proveedor
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <>
              {/* Success Response */}
              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-green-700 dark:text-green-400">{response.mensaje}</p>
                      <Badge variant="outline" className="mt-2">
                        ID: {response.solicitud_id}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Provider Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="w-5 h-5" />
                    Proveedor Seleccionado
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Nombre:</span>
                    <span className="font-medium">{response.proveedor.nombre}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-medium">{response.proveedor.email}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">
                      <strong>Motivo de selección:</strong> {response.proveedor.motivo_seleccion}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Products */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Package className="w-5 h-5" />
                    Productos Detectados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {response.productos.map((producto, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <span>{producto.nombre}</span>
                        <Badge variant="secondary">x{producto.cantidad}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Client */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Cliente:</span>
                    <span className="font-medium">{response.cliente}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Next Step */}
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <ArrowRight className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium text-blue-700 dark:text-blue-400">Siguiente paso</p>
                      <p className="text-sm text-muted-foreground mt-1">{response.siguiente_paso}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* New Request Button */}
              <Button 
                onClick={handleNewRequest} 
                variant="outline" 
                className="w-full"
                size="lg"
              >
                Nueva Solicitud
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
