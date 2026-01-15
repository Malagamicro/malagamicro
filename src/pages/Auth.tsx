import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Building2 } from 'lucide-react';
import { z } from 'zod';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { RateLimitWarning } from '@/components/auth/RateLimitWarning';
import { ForgotPasswordModal } from '@/components/auth/ForgotPasswordModal';
import { useLoginRateLimit } from '@/hooks/useLoginRateLimit';

const authSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  
  const { signIn, signUp, user, loading } = useAuth();
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
    
    // Check rate limit for login attempts
    if (!isSignUp && isLocked) {
      toast({
        title: 'Cuenta bloqueada',
        description: 'Demasiados intentos fallidos. Espera antes de intentar de nuevo.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) {
          if (error.message.includes('User already registered')) {
            toast({
              title: 'Error',
              description: 'Este email ya está registrado. Intenta iniciar sesión.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Error',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Cuenta creada',
            description: '¡Bienvenido! Tu cuenta ha sido creada correctamente.',
          });
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          // Record failed attempt for rate limiting
          recordFailedAttempt();
          
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: 'Error',
              description: 'Email o contraseña incorrectos.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Error',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          // Successful login, reset attempts
          resetAttempts();
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
          </CardTitle>
          <CardDescription>
            {isSignUp 
              ? 'Crea tu cuenta para gestionar tus leads' 
              : 'Accede a tu panel de gestión de leads'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Rate limit warning for login */}
            {!isSignUp && (
              <RateLimitWarning
                isLocked={isLocked}
                attemptsRemaining={attemptsRemaining}
                formattedTime={formatRemainingTime()}
                maxAttempts={maxAttempts}
              />
            )}
            
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
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || isLocked}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
              {isSignUp && <PasswordStrengthIndicator password={password} />}
            </div>
            
            {/* Forgot password link */}
            {!isSignUp && (
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-primary hover:underline self-start"
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || (!isSignUp && isLocked)}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
            </Button>
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSignUp 
                ? '¿Ya tienes cuenta? Inicia sesión' 
                : '¿No tienes cuenta? Regístrate'}
            </button>
          </CardFooter>
        </form>
      </Card>
      
      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        open={showForgotPassword}
        onOpenChange={setShowForgotPassword}
        initialEmail={email}
      />
    </div>
  );
}
