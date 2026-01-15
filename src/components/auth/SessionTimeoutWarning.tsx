import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, LogOut } from 'lucide-react';

interface SessionTimeoutWarningProps {
  open: boolean;
  formattedTime: string;
  onExtend: () => void;
  onLogout: () => void;
}

export function SessionTimeoutWarning({
  open,
  formattedTime,
  onExtend,
  onLogout,
}: SessionTimeoutWarningProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-500" />
            </div>
          </div>
          <AlertDialogTitle>Tu sesión está por expirar</AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-2">
            <p>
              Por seguridad, tu sesión se cerrará automáticamente debido a inactividad.
            </p>
            <p className="text-2xl font-mono font-bold text-foreground">
              {formattedTime}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={onLogout}
            className="w-full sm:w-auto"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </Button>
          <Button onClick={onExtend} className="w-full sm:w-auto">
            Continuar trabajando
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
