import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useOsTicketConfig } from '@/hooks/useOsTicketConfig';
import {
  Ticket,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Info,
  Copy,
  MessageSquare,
  Image as ImageIcon,
  Smartphone,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const SAMPLE_DATA = {
  ticket_id: '1042',
  number: '1042',
  subject: 'Problema con el equipo de climatización',
  name: 'Juan García',
  email: 'juan@empresa.com',
  department: 'Soporte Técnico',
  priority: 'Alta',
  message: 'Buenos días, necesito asistencia con el equipo de climatización del local. No enfría correctamente desde hace dos días.',
  ticket_url: 'https://soporte.malagamicro.com/scp/tickets.php?id=1042',
};

const VARIABLES = [
  { key: '{{ticket_id}}', desc: 'ID interno del ticket' },
  { key: '{{number}}', desc: 'Número visible del ticket' },
  { key: '{{subject}}', desc: 'Asunto del ticket' },
  { key: '{{name}}', desc: 'Nombre del cliente' },
  { key: '{{email}}', desc: 'Email del cliente' },
  { key: '{{department}}', desc: 'Departamento' },
  { key: '{{priority}}', desc: 'Prioridad' },
  { key: '{{message}}', desc: 'Cuerpo del ticket' },
  { key: '{{ticket_url}}', desc: 'Enlace al ticket' },
];

function renderPreview(template: string): string {
  let result = template;
  for (const [key, value] of Object.entries(SAMPLE_DATA)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

export function OsTicketConfigCard() {
  const { config, isLoading, saveConfig, isSaving, toggleEnabled, isToggling, defaultTemplate } = useOsTicketConfig();

  const [osticketUrl, setOsticketUrl] = useState('https://soporte.malagamicro.com');
  const [apiKey, setApiKey] = useState('');
  const [notificationNumbers, setNotificationNumbers] = useState('');
  const [messageTemplate, setMessageTemplate] = useState(defaultTemplate);
  const [imageUrl, setImageUrl] = useState('https://malagamicro.lovable.app/images/nuevo-ticket.png');
  const [sendImage, setSendImage] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showVars, setShowVars] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/osticket-webhook`;

  useEffect(() => {
    if (config) {
      setOsticketUrl(config.osticket_url || 'https://soporte.malagamicro.com');
      setApiKey(config.api_key || '');
      setNotificationNumbers(config.notification_numbers?.join('\n') || '');
      setMessageTemplate(config.message_template || defaultTemplate);
      setImageUrl(config.image_url || 'https://malagamicro.lovable.app/images/nuevo-ticket.png');
      setSendImage(config.send_image !== false);
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
      image_url: imageUrl,
      send_image: sendImage,
    });
  };

  const insertVariable = (variable: string) => {
    setMessageTemplate(prev => prev + variable);
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
        {/* Webhook URL */}
        <div className="space-y-2 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-500" />
            <Label className="font-medium">URL del Webhook (configurar en osTicket)</Label>
          </div>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-xs bg-background" />
            <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Configura este URL como webhook HTTP POST en osTicket para el evento "Ticket Created"
          </p>
        </div>

        {/* Basic config */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="osticket-url">URL Base de osTicket</Label>
            <Input
              id="osticket-url"
              value={osticketUrl}
              onChange={(e) => setOsticketUrl(e.target.value)}
              placeholder="https://soporte.tudominio.com"
            />
          </div>

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
              <Button variant="outline" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Notification Numbers */}
        <div className="space-y-2">
          <Label htmlFor="notification-numbers">Números de Notificación (WhatsApp)</Label>
          <Textarea
            id="notification-numbers"
            value={notificationNumbers}
            onChange={(e) => setNotificationNumbers(e.target.value)}
            placeholder="+34600123456&#10;+34600789012"
            rows={3}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Un número por línea. Incluye el código de país (ej: +34 para España)
          </p>
        </div>

        {/* Message editor with tabs */}
        <div className="space-y-3 border rounded-lg p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-green-500" />
            <Label className="font-medium text-base">Mensaje de WhatsApp</Label>
          </div>

          {/* Image config */}
          <div className="space-y-3 pb-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-blue-500" />
                <Label className="font-medium">Imagen de cabecera</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">
                  {sendImage ? 'Con imagen' : 'Solo texto'}
                </Label>
                <Switch
                  checked={sendImage}
                  onCheckedChange={setSendImage}
                />
              </div>
            </div>

            {sendImage && (
              <div className="flex gap-3 items-start">
                <div className="flex-1 space-y-1">
                  <Input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://... URL de la imagen"
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    URL pública de la imagen que se enviará como cabecera del mensaje
                  </p>
                </div>
                {imageUrl && (
                  <div className="w-16 h-16 rounded-lg border overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Variables helper */}
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-muted-foreground"
              onClick={() => setShowVars(!showVars)}
            >
              Variables disponibles
              {showVars ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
            </Button>
            {showVars && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v.key)}
                    title={v.desc}
                    className="px-2 py-0.5 bg-muted hover:bg-primary hover:text-primary-foreground rounded text-xs font-mono transition-colors cursor-pointer border border-border"
                  >
                    {v.key}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Template editor with preview */}
          <Tabs defaultValue="edit">
            <TabsList className="h-8">
              <TabsTrigger value="edit" className="text-xs h-7">
                ✏️ Editor
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs h-7">
                <Smartphone className="h-3 w-3 mr-1" />
                Vista previa
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="mt-2">
              <Textarea
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                rows={14}
                className="font-mono text-sm resize-y"
                placeholder="Escribe aquí tu plantilla de mensaje..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Usa *negrita*, _cursiva_ y emojis para dar formato al mensaje de WhatsApp
              </p>
            </TabsContent>

            <TabsContent value="preview" className="mt-2">
              <div className="bg-muted rounded-xl p-4 min-h-[280px]">
                <div className="max-w-xs ml-auto">
                  {/* WhatsApp bubble */}
                  <div className="bg-green-100 dark:bg-green-900/40 rounded-2xl rounded-tr-sm p-3 shadow-sm space-y-2 border border-green-200 dark:border-green-800">
                    {sendImage && imageUrl && (
                      <div className="rounded-xl overflow-hidden -mx-3 -mt-3 mb-2">
                        <img
                          src={imageUrl}
                          alt="Cabecera"
                          className="w-full h-32 object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <pre className="text-[13px] text-foreground whitespace-pre-wrap font-sans leading-relaxed break-words">
                      {renderPreview(messageTemplate)}
                    </pre>
                    <div className="flex justify-end">
                      <span className="text-[10px] text-muted-foreground">
                        ahora ✓✓
                      </span>
                    </div>
                  </div>
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    Vista previa con datos de ejemplo
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
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
