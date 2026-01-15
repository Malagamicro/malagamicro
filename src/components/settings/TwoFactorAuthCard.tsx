import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { useMFA } from '@/hooks/useMFA';
import { Shield, Loader2, CheckCircle, Smartphone, Copy, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function TwoFactorAuthCard() {
  const {
    isEnabled,
    isLoading,
    isEnrolling,
    isVerifying,
    isUnenrolling,
    enrollmentData,
    verifiedFactors,
    startEnrollment,
    verifyEnrollment,
    cancelEnrollment,
    unenroll,
  } = useMFA();
  
  const { toast } = useToast();
  const [verificationCode, setVerificationCode] = useState('');
  const [copied, setCopied] = useState(false);

  const handleStartSetup = async () => {
    await startEnrollment();
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) return;
    
    const { error } = await verifyEnrollment(verificationCode);
    if (!error) {
      setVerificationCode('');
    }
  };

  const handleCopySecret = () => {
    if (enrollmentData?.secret) {
      navigator.clipboard.writeText(enrollmentData.secret);
      setCopied(true);
      toast({
        title: 'Copiado',
        description: 'El código secreto se ha copiado al portapapeles.',
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCancel = () => {
    cancelEnrollment();
    setVerificationCode('');
  };

  const handleDisable2FA = async (factorId: string) => {
    await unenroll(factorId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Autenticación de Dos Factores</CardTitle>
          </div>
          {isEnabled && (
            <Badge variant="default" className="bg-green-500 hover:bg-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Activado
            </Badge>
          )}
        </div>
        <CardDescription>
          Añade una capa extra de seguridad a tu cuenta usando una aplicación de autenticación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 2FA Not Enabled - Show setup button */}
        {!isEnabled && !enrollmentData && (
          <div className="space-y-4">
            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                Necesitarás una aplicación de autenticación como Google Authenticator, Authy, o 1Password.
              </AlertDescription>
            </Alert>
            
            <Button onClick={handleStartSetup} disabled={isEnrolling}>
              {isEnrolling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Configurando...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Configurar 2FA
                </>
              )}
            </Button>
          </div>
        )}

        {/* Enrollment in progress - Show QR code */}
        {enrollmentData && (
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="text-sm font-medium">Paso 1: Escanea el código QR</div>
              <p className="text-sm text-muted-foreground">
                Abre tu aplicación de autenticación y escanea este código QR:
              </p>
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img 
                  src={enrollmentData.qrCode} 
                  alt="QR Code para 2FA" 
                  className="w-48 h-48"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                O introduce este código manualmente:
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono break-all">
                  {enrollmentData.secret}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopySecret}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="text-sm font-medium">Paso 2: Introduce el código de verificación</div>
              <p className="text-sm text-muted-foreground">
                Introduce el código de 6 dígitos de tu aplicación de autenticación:
              </p>
              <div className="flex gap-2">
                <Input
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="font-mono text-center text-lg tracking-widest max-w-32"
                  maxLength={6}
                />
                <Button 
                  onClick={handleVerify} 
                  disabled={verificationCode.length !== 6 || isVerifying}
                >
                  {isVerifying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Verificar'
                  )}
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 2FA Enabled - Show status and disable option */}
        {isEnabled && !enrollmentData && (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                Tu cuenta está protegida con autenticación de dos factores.
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-between py-3 px-4 rounded-lg border bg-muted/50">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Aplicación de autenticación</div>
                  <div className="text-xs text-muted-foreground">
                    Configurado el {new Date(verifiedFactors[0]?.created_at).toLocaleDateString('es-ES')}
                  </div>
                </div>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isUnenrolling}>
                    {isUnenrolling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Desactivar'
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Desactivar autenticación de dos factores?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esto eliminará la capa extra de seguridad de tu cuenta. Podrás volver a configurarla en cualquier momento.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDisable2FA(verifiedFactors[0]?.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Desactivar 2FA
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
