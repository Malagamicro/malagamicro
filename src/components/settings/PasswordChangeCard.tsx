import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { Lock, Loader2, Eye, EyeOff, Check } from 'lucide-react';

export function PasswordChangeCard() {
  const { updatePassword } = useAuth();
  const { toast } = useToast();
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0;
  const isValidPassword = newPassword.length >= 8;

  const handleChangePassword = async () => {
    if (!passwordsMatch) {
      toast({
        title: 'Error',
        description: 'Las contraseñas no coinciden.',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidPassword) {
      toast({
        title: 'Error',
        description: 'La contraseña debe tener al menos 8 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdating(true);
    const { error } = await updatePassword(newPassword);
    setIsUpdating(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cambiar la contraseña. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Contraseña actualizada',
        description: 'Tu contraseña se ha cambiado correctamente.',
      });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Cambiar Contraseña
        </CardTitle>
        <CardDescription>
          Actualiza tu contraseña para mantener tu cuenta segura
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newPassword">Nueva contraseña</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Ingresa tu nueva contraseña"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          {newPassword && <PasswordStrengthIndicator password={newPassword} />}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirma tu nueva contraseña"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          {confirmPassword && (
            <div className="flex items-center gap-1 text-sm">
              {passwordsMatch ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-green-500">Las contraseñas coinciden</span>
                </>
              ) : (
                <span className="text-destructive">Las contraseñas no coinciden</span>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button 
            onClick={handleChangePassword} 
            disabled={isUpdating || !passwordsMatch || !isValidPassword}
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Actualizando...
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Cambiar contraseña
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
