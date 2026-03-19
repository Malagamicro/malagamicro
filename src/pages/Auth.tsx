import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff, MessageSquareWarning } from 'lucide-react';
import { z } from 'zod';
import { RateLimitWarning } from '@/components/auth/RateLimitWarning';
import { ForgotPasswordModal } from '@/components/auth/ForgotPasswordModal';
import { BlockedScreen, LoginSupportPanel } from '@/components/auth/AuthSubComponents';
import { useLoginRateLimit } from '@/hooks/useLoginRateLimit';
import { supabase } from '@/integrations/supabase/client';
import logoLogin from '@/assets/logo-login.png';

const authSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

const SUPPORT_COOLDOWN_MS = 5 * 60 * 1000;
const SUPPORT_COOLDOWN_KEY = 'login_support_last_sent';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  
  const [showSupport, setShowSupport] = useState(false);
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

  // Cleared local storage logic removed as we now use memory

  // Load cooldown from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem(SUPPORT_COOLDOWN_KEY);
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
    if (!loading && user && !isBlocked) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate, isBlocked]);

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
        
        try {
          const isMobile = /Mobi|Android/i.test(navigator.userAgent);
          const { data } = await supabase.functions.invoke('track-login', {
            body: {
              user_agent: navigator.userAgent,
              device_type: isMobile ? 'mobile' : 'desktop',
            },
          });
          
          if (data?.blocked) {
            await supabase.auth.signOut();
            setIsBlocked(true);
            setBlockReason(data.reason || 'Actividad sospechosa detectada');
            return;
          }
        } catch (trackErr) {
          console.error('Track login error:', trackErr);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isBlocked) {
    return (
      <BlockedScreen
        email={email}
        blockReason={blockReason}
        onBack={() => { setIsBlocked(false); setBlockReason(''); }}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="flex justify-center">
          <img src={logoLogin} alt="Málaga Micro" className="h-20 object-contain" />
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

        <LoginSupportPanel
          show={showSupport}
          onToggle={() => setShowSupport(false)}
          cooldownRemaining={cooldownRemaining}
        />
      </div>
      
      <ForgotPasswordModal
        open={showForgotPassword}
        onOpenChange={setShowForgotPassword}
        initialEmail={email}
      />
    </div>
  );
}
