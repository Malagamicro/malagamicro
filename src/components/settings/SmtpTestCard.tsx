import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Mail, Loader2, CheckCircle, XCircle, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export function SmtpTestCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState(user?.email || '');
  const [isSending, setIsSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      toast({
        title: "Error",
        description: "Por favor, ingresa un correo electrónico",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('send-smtp-email', {
        body: {
          to: testEmail,
          subject: '✅ Prueba de correo SMTP - Malaga Micro',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">🎉 ¡Correo de Prueba Exitoso!</h1>
              </div>
              <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
                <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                  Este es un correo de prueba enviado desde <strong>Malaga Micro CRM</strong>.
                </p>
                <p style="color: #334155; font-size: 16px; line-height: 1.6;">
                  Si estás recibiendo este mensaje, significa que tu configuración SMTP está funcionando correctamente.
                </p>
                <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="color: #065f46; margin: 0; font-weight: 500;">
                    ✓ Conexión SMTP establecida<br>
                    ✓ Autenticación correcta<br>
                    ✓ Email enviado exitosamente
                  </p>
                </div>
                <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
                  Fecha de envío: ${new Date().toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'medium' })}
                </p>
              </div>
            </div>
          `,
          text: `¡Correo de Prueba Exitoso!\n\nEste es un correo de prueba enviado desde Malaga Micro CRM.\n\nSi estás recibiendo este mensaje, significa que tu configuración SMTP está funcionando correctamente.\n\nFecha de envío: ${new Date().toLocaleString('es-ES')}`,
        },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setLastResult({ success: true, message: 'Email enviado correctamente' });
      toast({
        title: "✅ Email enviado",
        description: `Correo de prueba enviado a ${testEmail}. Revisa tu bandeja de entrada.`,
      });
    } catch (error: any) {
      console.error('Error sending test email:', error);
      const errorMessage = error.message || 'Error desconocido';
      setLastResult({ success: false, message: errorMessage });
      toast({
        title: "❌ Error al enviar",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Probar Conexión SMTP
        </CardTitle>
        <CardDescription>
          Envía un correo de prueba para verificar que la configuración SMTP funciona correctamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="testEmail">Correo de destino</Label>
          <Input
            id="testEmail"
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="tu@email.com"
          />
        </div>

        {lastResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg ${
            lastResult.success 
              ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' 
              : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
          }`}>
            {lastResult.success ? (
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 flex-shrink-0" />
            )}
            <span className="text-sm">{lastResult.message}</span>
          </div>
        )}

        <Button 
          onClick={handleSendTestEmail} 
          disabled={isSending || !testEmail}
          className="w-full"
        >
          {isSending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Enviar correo de prueba
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          El correo se enviará usando tu servidor SMTP de Outlook/Office 365 configurado
        </p>
      </CardContent>
    </Card>
  );
}
