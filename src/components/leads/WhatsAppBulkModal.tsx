import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, MessageSquare, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Lead } from '@/types/lead';
import { Progress } from '@/components/ui/progress';

interface MessageTemplate {
  id: string;
  name: string;
  message: string;
}

const defaultTemplates: MessageTemplate[] = [
  {
    id: 'intro',
    name: 'Presentación inicial',
    message: `Hola {{contactName}}, soy del equipo de MalagaMicro. 

Nos gustaría presentarle nuestros servicios de mantenimiento informático para {{companyName}}.

¿Tendría unos minutos para hablar sobre cómo podemos ayudarle?`,
  },
  {
    id: 'followup',
    name: 'Seguimiento',
    message: `Hola {{contactName}}, espero que esté bien.

Le escribo para dar seguimiento a nuestra conversación anterior sobre los servicios de mantenimiento informático para {{companyName}}.

¿Ha tenido oportunidad de revisar nuestra propuesta?`,
  },
  {
    id: 'promo',
    name: 'Promoción',
    message: `Hola {{contactName}}, 

¡Tenemos una oferta especial para {{companyName}}!

Contáctenos para más detalles sobre nuestros servicios de mantenimiento informático.`,
  },
];

interface SendResult {
  leadId: string;
  companyName: string;
  success: boolean;
  error?: string;
}

interface WhatsAppBulkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeads: Lead[];
  onComplete?: () => void;
}

export function WhatsAppBulkModal({ 
  open, 
  onOpenChange, 
  selectedLeads,
  onComplete 
}: WhatsAppBulkModalProps) {
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [results, setResults] = useState<SendResult[]>([]);
  const { toast } = useToast();

  // Leads con teléfono válido
  const leadsWithPhone = selectedLeads.filter(lead => lead.phone && lead.phone.trim() !== '');

  const replaceVariables = (text: string, lead: Lead): string => {
    return text
      .replace(/\{\{companyName\}\}/g, lead.companyName)
      .replace(/\{\{contactName\}\}/g, lead.contactName || 'Cliente')
      .replace(/\{\{city\}\}/g, lead.city)
      .replace(/\{\{email\}\}/g, lead.email || '');
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = defaultTemplates.find(t => t.id === templateId);
    if (template) {
      setMessage(template.message);
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    let cleanPhone = phone.replace(/\D/g, "");
    
    // Si el número no empieza con código de país (34 para España), lo añadimos
    if (!cleanPhone.startsWith("34") && cleanPhone.length === 9) {
      cleanPhone = "34" + cleanPhone;
    }
    
    return cleanPhone;
  };

  const sendWhatsApp = async (lead: Lead, personalizedMessage: string): Promise<SendResult> => {
    try {
      const cleanPhone = formatPhoneNumber(lead.phone || '');
      const chatId = `${cleanPhone}@c.us`;
      
      const payload = {
        chatId,
        text: personalizedMessage,
        session: "default",
      };
      
      console.log(`📤 Enviando WhatsApp a ${lead.companyName}:`, payload);
      
      const response = await fetch("http://localhost:3000/api/sendText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": "123456",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Error ${response.status}: ${errorData}`);
      }

      return {
        leadId: lead.id,
        companyName: lead.companyName,
        success: true,
      };
    } catch (error: any) {
      console.error(`❌ Error enviando a ${lead.companyName}:`, error);
      return {
        leadId: lead.id,
        companyName: lead.companyName,
        success: false,
        error: error.message || 'Error desconocido',
      };
    }
  };

  const handleSend = async () => {
    if (!message) {
      toast({
        title: 'Error',
        description: 'Por favor, escribe un mensaje.',
        variant: 'destructive',
      });
      return;
    }

    if (leadsWithPhone.length === 0) {
      toast({
        title: 'Sin destinatarios',
        description: 'Ninguno de los leads seleccionados tiene teléfono.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    setResults([]);
    setSendProgress(0);

    const newResults: SendResult[] = [];

    for (let i = 0; i < leadsWithPhone.length; i++) {
      const lead = leadsWithPhone[i];
      const personalizedMessage = replaceVariables(message, lead);
      
      const result = await sendWhatsApp(lead, personalizedMessage);
      newResults.push(result);
      setResults([...newResults]);
      setSendProgress(((i + 1) / leadsWithPhone.length) * 100);

      // Pequeña pausa entre mensajes para no saturar la API
      if (i < leadsWithPhone.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successCount = newResults.filter(r => r.success).length;
    const failCount = newResults.filter(r => !r.success).length;

    setIsSending(false);

    toast({
      title: 'Envío completado',
      description: `${successCount} enviados correctamente, ${failCount} fallidos`,
      variant: failCount > 0 ? 'destructive' : 'default',
    });

    if (successCount > 0) {
      onComplete?.();
    }
  };

  const handleClose = () => {
    if (!isSending) {
      setMessage('');
      setSelectedTemplate('');
      setResults([]);
      setSendProgress(0);
      onOpenChange(false);
    }
  };

  const characterCount = message.length;
  const isOverLimit = characterCount > 4096;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-600" />
            Envío masivo de WhatsApp
          </DialogTitle>
          <DialogDescription>
            Enviar mensaje a {leadsWithPhone.length} leads con teléfono
            {selectedLeads.length !== leadsWithPhone.length && (
              <span className="text-amber-500 ml-1">
                ({selectedLeads.length - leadsWithPhone.length} sin teléfono)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lista de destinatarios */}
          <div className="space-y-2">
            <Label>Destinatarios ({leadsWithPhone.length})</Label>
            <div className="max-h-32 overflow-y-auto border rounded-lg p-2 bg-muted/30">
              {leadsWithPhone.map((lead) => (
                <div key={lead.id} className="flex items-center gap-2 py-1 text-sm">
                  <span className="font-medium">{lead.companyName}</span>
                  <span className="text-muted-foreground">- {lead.phone}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Template Selector */}
          <div className="space-y-2">
            <Label>Plantilla</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange} disabled={isSending}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar plantilla (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {defaultTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Variables disponibles: {'{{contactName}}'}, {'{{companyName}}'}, {'{{city}}'}
            </p>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="message">Mensaje *</Label>
              <span className={`text-xs ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                {characterCount}/4096
              </span>
            </div>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe tu mensaje... Usa {{contactName}} para personalizar."
              rows={6}
              disabled={isSending}
              className="resize-none"
            />
          </div>

          {/* Progress */}
          {isSending && (
            <div className="space-y-2">
              <Label>Progreso</Label>
              <Progress value={sendProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {Math.round(sendProgress)}% completado
              </p>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              <Label>Resultados</Label>
              <div className="max-h-32 overflow-y-auto border rounded-lg p-2 space-y-1">
                {results.map((result) => (
                  <div key={result.leadId} className="flex items-center gap-2 text-sm">
                    {result.success ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                    <span className={result.success ? '' : 'text-destructive'}>
                      {result.companyName}
                    </span>
                    {result.error && (
                      <span className="text-xs text-muted-foreground truncate">
                        - {result.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleClose}
            disabled={isSending}
          >
            {results.length > 0 ? 'Cerrar' : 'Cancelar'}
          </Button>
          {results.length === 0 && (
            <Button 
              onClick={handleSend} 
              disabled={isSending || isOverLimit || leadsWithPhone.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Enviar a {leadsWithPhone.length} leads
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
