import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useOsTicketConfig } from '@/hooks/useOsTicketConfig';
import { Ticket, Save, Loader2, Eye, EyeOff, Info, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export function OsTicketConfigCard() {
  const { config, isLoading, saveConfig, isSaving, toggleEnabled, isToggling, defaultTemplate } = useOsTicketConfig();

  const [osticketUrl, setOsticketUrl] = useState('https://soporte.malagamicro.com');
  const [apiKey, setApiKey] = useState('');
  const [notificationNumbers, setNotificationNumbers] = useState('');
  const [messageTemplate, setMessageTemplate] = useState(defaultTemplate);
  const [showApiKey, setShowApiKey] = useState(false);

  // Generate webhook URL
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/osticket-webhook`;

  useEffect(() => {
    if (config) {
      setOsticketUrl(config.osticket_url || 'https://soporte.malagamicro.com');
      setApiKey(config.api_key || '');
      setNotificationNumbers(config.notification_numbers?.join('\n') || '');
      setMessageTemplate(config.message_template || defaultTemplate);
    }
  }, [config, defaultTemplate]);

  const handleSave = () => {
    const numbers = notificationNumbers
      .split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 0);

    saveConfig({
      osticket_url: osticketUrl,
      api_key: apiKey,
      notification_numbers: numbers,
      message_template: messageTemplate,
      is_enabled: config?.is_enabled || false,
    });
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL del webhook copiada al portapapeles');
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
            <Ticket className="h-5 w-5 text-orange-500" />
            <CardTitle>Integración osTicket</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="osticket-enabled" className="text-sm text-muted-foreground">
              {config?.is_enabled ? 'Activo' : 'Inactivo'}
            </Label>
            <Switch
              id="osticket-enabled"
              checked={config?.is_enabled || false}
              onCheckedChange={(checked) => {
                if (config?.id) {
                  toggleEnabled(checked);
                } else {
                  toast.error('Guarda la configuración primero');
                }
              }}
              disabled={isToggling || !config?.id}
            />
          </div>
        </div>
        <CardDescription>
          Recibe notificaciones de WhatsApp cuando se creen nuevos tickets en osTicket
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Webhook URL - for user to configure in osTicket */}
        <div className="space-y-2 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-500" />
            <Label className="font-medium">URL del Webhook (configurar en osTicket)</Label>
          </div>
          <div className="flex gap-2">
            <Input
              value={webhookUrl}
              readOnly
              className="font-mono text-xs bg-background"
            />
            <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Configura este URL como webhook HTTP POST en osTicket para el evento "Ticket Created"
          </p>
        </div>

        {/* osTicket URL */}
        <div className="space-y-2">
          <Label htmlFor="osticket-url">URL Base de osTicket</Label>
          <Input
            id="osticket-url"
            value={osticketUrl}
            onChange={(e) => setOsticketUrl(e.target.value)}
            placeholder="https://soporte.tudominio.com"
          />
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <Label htmlFor="osticket-api-key">API Key de osTicket</Label>
          <div className="flex gap-2">
            <Input
              id="osticket-api-key"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Tu API key de osTicket"
              className="font-mono"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Notification Numbers */}
        <div className="space-y-2">
          <Label htmlFor="notification-numbers">Números de Notificación (WhatsApp)</Label>
          <Textarea
            id="notification-numbers"
            value={notificationNumbers}
            onChange={(e) => setNotificationNumbers(e.target.value)}
            placeholder="+34600123456&#10;+34600789012&#10;+34611222333"
            rows={4}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Un número por línea. Incluye el código de país (ej: +34 para España)
          </p>
        </div>

        {/* Message Template */}
        <div className="space-y-2">
          <Label htmlFor="message-template">Plantilla del Mensaje</Label>
          <Textarea
            id="message-template"
            value={messageTemplate}
            onChange={(e) => setMessageTemplate(e.target.value)}
            rows={12}
            className="font-mono text-sm"
          />
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Variables disponibles:</p>
            <div className="flex flex-wrap gap-2">
              {['{{ticket_id}}', '{{number}}', '{{subject}}', '{{name}}', '{{email}}', '{{department}}', '{{priority}}', '{{message}}', '{{ticket_url}}'].map((v) => (
                <code key={v} className="px-1.5 py-0.5 bg-muted rounded text-foreground">{v}</code>
              ))}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar configuración
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
