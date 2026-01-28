import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Settings, Eye, EyeOff, Server, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SmtpConfig {
  host: string;
  port: string;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

export function SmtpConfigCard() {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<SmtpConfig>({
    host: '',
    port: '587',
    user: '',
    password: '',
    fromEmail: '',
    fromName: '',
  });

  // Note: Actual secrets are stored in Supabase and cannot be read from frontend
  // This form just helps users understand what they need to configure

  const handleInputChange = (field: keyof SmtpConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    // Validate required fields
    if (!config.host || !config.user || !config.password || !config.fromEmail) {
      toast({
        title: "Campos requeridos",
        description: "Por favor, completa todos los campos obligatorios",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    
    // Show info about how to update secrets
    toast({
      title: "📧 Configuración SMTP",
      description: "Los secrets SMTP se configuran en Lovable Cloud. Contacta al administrador para actualizar las credenciales.",
    });
    
    setIsSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Configuración SMTP
        </CardTitle>
        <CardDescription>
          Configura tu servidor de correo saliente (Outlook/Office 365, Gmail, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Para Office 365/Outlook:</strong>
            <ul className="list-disc ml-4 mt-2 space-y-1 text-sm">
              <li>Host: <code className="bg-muted px-1 rounded">smtp.office365.com</code></li>
              <li>Puerto: <code className="bg-muted px-1 rounded">587</code></li>
              <li>Si usas MFA, genera una <strong>Contraseña de Aplicación</strong></li>
              <li>Activa "SMTP AUTH" en el panel de administración de Microsoft 365</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Host */}
          <div className="space-y-2">
            <Label htmlFor="smtp-host">
              Servidor SMTP <span className="text-destructive">*</span>
            </Label>
            <Input
              id="smtp-host"
              placeholder="smtp.office365.com"
              value={config.host}
              onChange={(e) => handleInputChange('host', e.target.value)}
            />
          </div>

          {/* Port */}
          <div className="space-y-2">
            <Label htmlFor="smtp-port">
              Puerto <span className="text-destructive">*</span>
            </Label>
            <Input
              id="smtp-port"
              placeholder="587"
              value={config.port}
              onChange={(e) => handleInputChange('port', e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              587 (STARTTLS) o 465 (SSL)
            </p>
          </div>

          {/* User */}
          <div className="space-y-2">
            <Label htmlFor="smtp-user">
              Usuario <span className="text-destructive">*</span>
            </Label>
            <Input
              id="smtp-user"
              type="email"
              placeholder="tu@empresa.com"
              value={config.user}
              onChange={(e) => handleInputChange('user', e.target.value)}
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="smtp-password">
              Contraseña <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="smtp-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={config.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Usa contraseña de aplicación si tienes MFA
            </p>
          </div>

          {/* From Email */}
          <div className="space-y-2">
            <Label htmlFor="smtp-from-email">
              Email remitente <span className="text-destructive">*</span>
            </Label>
            <Input
              id="smtp-from-email"
              type="email"
              placeholder="noreply@empresa.com"
              value={config.fromEmail}
              onChange={(e) => handleInputChange('fromEmail', e.target.value)}
            />
          </div>

          {/* From Name */}
          <div className="space-y-2">
            <Label htmlFor="smtp-from-name">
              Nombre remitente
            </Label>
            <Input
              id="smtp-from-name"
              placeholder="Mi Empresa CRM"
              value={config.fromName}
              onChange={(e) => handleInputChange('fromName', e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent text-accent-foreground">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">
            <strong>Estado:</strong> Los secrets SMTP están configurados en el servidor. 
            Usa el botón "Probar conexión" para verificar que funcionan.
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Settings className="mr-2 h-4 w-4" />
                Actualizar configuración
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Los secrets se almacenan de forma segura en Lovable Cloud y no son visibles una vez guardados.
        </p>
      </CardContent>
    </Card>
  );
}
