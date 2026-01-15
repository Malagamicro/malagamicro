import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, X, Loader2, CheckCircle } from 'lucide-react';

export function EmailVerificationBanner() {
  const { user, isEmailVerified, resendVerification } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Don't show if verified, dismissed, or no user
  if (!user || isEmailVerified || isDismissed) {
    return null;
  }

  const handleResend = async () => {
    setIsLoading(true);
    
    try {
      const { error } = await resendVerification();
      
      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setEmailSent(true);
        toast({
          title: 'Email enviado',
          description: 'Revisa tu bandeja de entrada para verificar tu cuenta.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Alert className="rounded-none border-x-0 border-t-0 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4 text-amber-600 dark:text-amber-500 flex-shrink-0" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            {emailSent ? (
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                Email de verificación enviado a <strong>{user.email}</strong>
              </span>
            ) : (
              <>
                Tu email <strong>{user.email}</strong> no está verificado.{' '}
                <span className="hidden sm:inline">Verifica tu cuenta para mayor seguridad.</span>
              </>
            )}
          </AlertDescription>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!emailSent && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResend}
              disabled={isLoading}
              className="bg-white dark:bg-transparent border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200"
            >
              {isLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Reenviar
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDismissed(true)}
            className="h-8 w-8 p-0 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Cerrar</span>
          </Button>
        </div>
      </div>
    </Alert>
  );
}
