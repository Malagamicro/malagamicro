import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, ShieldAlert, LifeBuoy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import logoLogin from '@/assets/logo-login.png';

function getDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = 'Desconocido';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  let os = 'Desconocido';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  let device = 'Desktop';
  if (/Mobi|Android/i.test(ua)) device = 'Móvil';
  else if (/Tablet|iPad/i.test(ua)) device = 'Tablet';

  return {
    browser, os, device,
    screen: `${window.screen.width}x${window.screen.height}`,
    userAgent: ua,
  };
}

export { getDeviceInfo };

interface BlockedScreenProps {
  email: string;
  blockReason: string;
  onBack: () => void;
}

export function BlockedScreen({ email, blockReason, onBack }: BlockedScreenProps) {
  const [showBlockSupport, setShowBlockSupport] = useState(false);
  const [blockSupportMessage, setBlockSupportMessage] = useState('');
  const [isSendingBlockSupport, setIsSendingBlockSupport] = useState(false);
  const { toast } = useToast();

  const handleSendBlockSupport = async () => {
    if (!blockSupportMessage.trim()) {
      toast({ title: 'Error', description: 'Escribe un mensaje.', variant: 'destructive' });
      return;
    }

    setIsSendingBlockSupport(true);
    try {
      let ip = 'No disponible';
      let location = 'No disponible';
      try {
        const ipRes = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          ip = ipData.ip || 'No disponible';
          location = [ipData.city, ipData.region, ipData.country_name].filter(Boolean).join(', ') || 'No disponible';
        }
      } catch { /* ignore */ }

      const deviceInfo = { ...getDeviceInfo(), ip, location };

      const { error } = await supabase.functions.invoke('login-support', {
        body: {
          message: `[SOLICITUD DE DESBLOQUEO] Email: ${email}\nMotivo del bloqueo: ${blockReason}\nMensaje del usuario: ${blockSupportMessage.trim()}`,
          deviceInfo,
        },
      });

      if (error) throw error;

      setBlockSupportMessage('');
      setShowBlockSupport(false);
      toast({ title: 'Solicitud enviada', description: 'Un administrador revisará tu caso lo antes posible.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo enviar la solicitud.', variant: 'destructive' });
    } finally {
      setIsSendingBlockSupport(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-destructive/5 to-background p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex justify-center">
          <img src={logoLogin} alt="Málaga Micro" className="h-16 object-contain opacity-50" />
        </div>

        <Card className="border-destructive/30 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              <div className="p-3 rounded-full bg-destructive/10">
                <ShieldAlert className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-foreground">Acceso Bloqueado</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Se ha detectado actividad sospechosa en tu cuenta
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <p className="text-sm font-medium text-destructive mb-1">Motivo del bloqueo:</p>
              <p className="text-sm text-muted-foreground">{blockReason}</p>
            </div>

            <div className="p-3 rounded-lg bg-muted text-sm text-muted-foreground">
              <p>Tu acceso ha sido bloqueado temporalmente por seguridad. El bloqueo se levantará automáticamente en un máximo de 2 horas.</p>
              <p className="mt-2">Si crees que es un error, puedes solicitar ayuda al administrador.</p>
            </div>

            {!showBlockSupport ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowBlockSupport(true)}
              >
                <LifeBuoy className="mr-2 h-4 w-4" />
                Solicitar desbloqueo
              </Button>
            ) : (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <Textarea
                  placeholder="Explica por qué crees que es un error..."
                  value={blockSupportMessage}
                  onChange={(e) => setBlockSupportMessage(e.target.value)}
                  maxLength={500}
                  rows={3}
                  disabled={isSendingBlockSupport}
                  className="resize-none"
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBlockSupport(false)}
                    disabled={isSendingBlockSupport}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSendBlockSupport}
                    disabled={isSendingBlockSupport || !blockSupportMessage.trim()}
                    className="flex-1"
                  >
                    {isSendingBlockSupport ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="mr-1 h-3 w-3" />
                    )}
                    Enviar solicitud
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={onBack}
            >
              Volver al inicio de sesión
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

interface LoginSupportPanelProps {
  show: boolean;
  onToggle: () => void;
  cooldownRemaining: number;
}

export function LoginSupportPanel({ show, onToggle, cooldownRemaining }: LoginSupportPanelProps) {
  const [supportMessage, setSupportMessage] = useState('');
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const { toast } = useToast();

  const isCooldownActive = cooldownRemaining > 0;
  const cooldownMinutes = Math.ceil(cooldownRemaining / 60000);
  const cooldownSeconds = Math.ceil((cooldownRemaining % 60000) / 1000);

  const handleSendSupport = async () => {
    if (!supportMessage.trim()) {
      toast({ title: 'Error', description: 'Escribe un mensaje antes de enviar.', variant: 'destructive' });
      return;
    }
    if (supportMessage.length > 1000) {
      toast({ title: 'Error', description: 'Mensaje demasiado largo (máx 1000 caracteres).', variant: 'destructive' });
      return;
    }

    setIsSendingSupport(true);
    try {
      let ip = 'No disponible';
      let location = 'No disponible';
      try {
        const ipRes = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          ip = ipData.ip || 'No disponible';
          location = [ipData.city, ipData.region, ipData.country_name].filter(Boolean).join(', ') || 'No disponible';
        }
      } catch { /* ignore */ }

      const deviceInfo = { ...getDeviceInfo(), ip, location };

      const { error } = await supabase.functions.invoke('login-support', {
        body: { message: supportMessage.trim(), deviceInfo },
      });

      if (error) throw error;

      const SUPPORT_COOLDOWN_MS = 5 * 60 * 1000;
      const cooldownEnd = Date.now() + SUPPORT_COOLDOWN_MS;
      sessionStorage.setItem('login_support_last_sent', cooldownEnd.toString());
      setSupportMessage('');
      onToggle();
      toast({ title: 'Enviado', description: 'Tu mensaje ha sido enviado al administrador.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo enviar el mensaje.', variant: 'destructive' });
    } finally {
      setIsSendingSupport(false);
    }
  };

  if (!show) return null;

  return (
    <Card className="border-border/50 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className="h-4 w-4 text-primary">⚠️</span>
          Avisar al administrador
        </div>
        <p className="text-xs text-muted-foreground">
          Describe tu problema y se enviará un aviso al equipo de administración.
        </p>
        
        {isCooldownActive ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm text-muted-foreground">
            <span>⏳</span>
            Podrás enviar otro mensaje en {cooldownMinutes > 0 ? `${cooldownMinutes}m ` : ''}{cooldownSeconds}s
          </div>
        ) : (
          <>
            <Textarea
              placeholder="Describe tu problema..."
              value={supportMessage}
              onChange={(e) => setSupportMessage(e.target.value)}
              maxLength={1000}
              rows={3}
              disabled={isSendingSupport}
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{supportMessage.length}/1000</span>
              <Button
                size="sm"
                onClick={handleSendSupport}
                disabled={isSendingSupport || !supportMessage.trim()}
              >
                {isSendingSupport ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Send className="mr-1 h-3 w-3" />
                )}
                Enviar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
