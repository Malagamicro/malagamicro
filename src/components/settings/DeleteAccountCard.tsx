import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function DeleteAccountCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const isConfirmed = confirmText === 'ELIMINAR';

  const handleDeleteAccount = async () => {
    if (!isConfirmed || !user) return;

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account');

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Cuenta eliminada',
        description: 'Tu cuenta y todos tus datos han sido eliminados permanentemente.',
      });

      // Redirect to auth page
      navigate('/auth', { replace: true });
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast({
        title: 'Error',
        description: error.message || 'No se pudo eliminar la cuenta. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setDialogOpen(false);
      setConfirmText('');
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          Eliminar Cuenta
        </CardTitle>
        <CardDescription>
          Elimina permanentemente tu cuenta y todos los datos asociados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Advertencia:</strong> Esta acción es irreversible. Se eliminarán permanentemente:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Tu cuenta de usuario</li>
              <li>Todos tus leads y actividades</li>
              <li>Recordatorios y campañas de email</li>
              <li>Historial de auditoría</li>
              <li>Configuraciones y preferencias</li>
            </ul>
          </AlertDescription>
        </Alert>

        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar mi cuenta
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">
                ¿Estás seguro de que quieres eliminar tu cuenta?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                <p>
                  Esta acción no se puede deshacer. Todos tus datos serán eliminados permanentemente
                  de nuestros servidores.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="confirm-delete">
                    Escribe <strong>ELIMINAR</strong> para confirmar:
                  </Label>
                  <Input
                    id="confirm-delete"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                    placeholder="ELIMINAR"
                    className="font-mono"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmText('')}>
                Cancelar
              </AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={!isConfirmed || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar permanentemente
                  </>
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
