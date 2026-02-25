import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, MessageSquareWarning, Send, Clock } from 'lucide-react';
import { z } from 'zod';
import { RateLimitWarning } from '@/components/auth/RateLimitWarning';
import { ForgotPasswordModal } from '@/components/auth/ForgotPasswordModal';
import { useLoginRateLimit } from '@/hooks/useLoginRateLimit';
import { supabase } from '@/integrations/supabase/client';
import logoLogin from '@/assets/logo-login.png';

const authSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

const SUPPORT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const SUPPORT_COOLDOWN_KEY = 'login_support_last_sent';

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
    browser,
    os,
    device,
    screen: `${window.screen.width}x${window.screen.height}`,
    userAgent: ua,
  };
}

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  
  // Support panel
  const [showSupport, setShowSupport] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [isSendingSupport, setIsSendingSupport] = useState(false);
  const [supportCooldownEnd, setSupportCooldownEnd] = useState<number>(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const {
    isLocked,
    attemptsRemaining,
    formatRemainingTime,
    recordFailedAttempt,
    resetAttempts,
    maxAttempts,
  } = useLoginRateLimit(email);

  // Load cooldown from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(SUPPORT_COOLDOWN_KEY);
    if (stored) {
      const end = parseInt(stored, 10);
      if (end > Date.now()) {
        setSupportCooldownEnd(end);
      }
    }
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (supportCooldownEnd <= Date.now()) {
      setCooldownRemaining(0);
      return;
    }
    const interval = setInterval(() => {
      const remaining = Math.max(0, supportCooldownEnd - Date.now());
      setCooldownRemaining(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [supportCooldownEnd]);

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  const validateForm = () => {
    try {
      authSchema.parse({ email, password });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0] === 'email') fieldErrors.email = err.message;
          if (err.path[0] === 'password') fieldErrors.password = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (isLocked) {
      toast({ title: 'Cuenta bloqueada', description: 'Demasiados intentos fallidos.', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        recordFailedAttempt();
        toast({
          title: 'Error',
          description: error.message.includes('Invalid login credentials') ? 'Email o contraseña incorrectos.' : error.message,
          variant: 'destructive',
        });
      } else {
        resetAttempts();
      }
    } finally {
      setIsLoading(false);
    }
  };

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
      // Get IP and location
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

      const deviceInfo = {
        ...getDeviceInfo(),
        ip,
        location,
      };

      const { data, error } = await supabase.functions.invoke('login-support', {
        body: { message: supportMessage.trim(), deviceInfo },
      });

      if (error) throw error;

      const cooldownEnd = Date.now() + SUPPORT_COOLDOWN_MS;
      setSupportCooldownEnd(cooldownEnd);
      localStorage.setItem(SUPPORT_COOLDOWN_KEY, cooldownEnd.toString());
      setSupportMessage('');
      setShowSupport(false);
      toast({ title: 'Enviado', description: 'Tu mensaje ha sido enviado al administrador.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo enviar el mensaje.', variant: 'destructive' });
    } finally {
      setIsSendingSupport(false);
    }
  };

  const isCooldownActive = cooldownRemaining > 0;
  const cooldownMinutes = Math.ceil(cooldownRemaining / 60000);
  const cooldownSeconds = Math.ceil((cooldownRemaining % 60000) / 1000);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Logo */}
        <div className="flex justify-center">
          <img 
            src={logoLogin} 
            alt="Málaga Micro" 
            className="h-20 object-contain"
          />
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center pb-2">
            <h1 className="text-xl font-bold text-foreground">Acceder al CRM</h1>
            <p className="text-sm text-muted-foreground">Introduce tus credenciales para continuar</p>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <RateLimitWarning
                isLocked={isLocked}
                attemptsRemaining={attemptsRemaining}
                formattedTime={formatRemainingTime()}
                maxAttempts={maxAttempts}
              />
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading || isLocked}
                  autoComplete="email"
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading || isLocked}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>
              
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-primary hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isLoading || isLocked}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Iniciar sesión
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Support Button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setShowSupport(!showSupport)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquareWarning className="h-4 w-4" />
            Contactar con soporte
          </button>
        </div>

        {/* Support Panel */}
        {showSupport && (
          <Card className="border-border/50 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MessageSquareWarning className="h-4 w-4 text-primary" />
                Avisar al administrador
              </div>
              <p className="text-xs text-muted-foreground">
                Describe tu problema y se enviará un aviso al equipo de administración.
              </p>
              
              {isCooldownActive ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
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
        )}
      </div>
      
      <ForgotPasswordModal
        open={showForgotPassword}
        onOpenChange={setShowForgotPassword}
        initialEmail={email}
      />
    </div>
  );
}
