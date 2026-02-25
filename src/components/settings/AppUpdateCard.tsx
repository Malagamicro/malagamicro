import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function AppUpdateCard() {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleForceUpdate = async () => {
    setIsUpdating(true);
    try {
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }

      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      toast.success('Caché limpiada. Recargando aplicación…');
      
      // Small delay so user sees the toast
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (error) {
      console.error('Error al actualizar:', error);
      toast.error('Error al limpiar la caché. Intenta recargar manualmente.');
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Actualizar Aplicación
        </CardTitle>
        <CardDescription>
          Fuerza la limpieza de caché del service worker y recarga la versión más reciente del cliente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleForceUpdate} disabled={isUpdating} variant="outline" className="w-full sm:w-auto">
          {isUpdating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Actualizando…
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Forzar actualización ahora
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
