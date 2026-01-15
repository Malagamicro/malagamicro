import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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
import { Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Lead } from '@/types/lead';

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
    id: 'meeting',
    name: 'Recordatorio de reunión',
    message: `Hola {{contactName}}, le escribo para recordarle nuestra reunión programada.

Quedo a la espera de poder conversar sobre las necesidades tecnológicas de {{companyName}}.

¡Saludos!`,
  },
  {
    id: 'thanks',
    name: 'Agradecimiento',
    message: `Hola {{contactName}}, 

Muchas gracias por su tiempo hoy. Ha sido un placer conocer más sobre {{companyName}}.

Cualquier duda que tenga, no dude en escribirme por aquí.

¡Saludos!`,
  },
];

interface WhatsAppComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onMessageSent?: () => void;
  onActivityLogged?: () => void;
}

export function WhatsAppComposeModal({ 
  open, 
  onOpenChange, 
  lead,
  onMessageSent 
}: WhatsAppComposeModalProps) {
  const [phone, setPhone] = useState(lead.phone || '');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const replaceVariables = (text: string): string => {
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
      setMessage(replaceVariables(template.message));
    }
  };

  const handleSend = async () => {
    if (!phone || !message) {
      toast({
        title: 'Error',
        description: 'Por favor, completa todos los campos.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          to: phone,
          message,
          leadId: lead.id,
          leadName: lead.companyName,
        },
      });

      if (error) throw error;

      toast({
        title: 'Mensaje enviado',
        description: `El mensaje de WhatsApp ha sido enviado`,
      });

      onMessageSent?.();
      onOpenChange(false);
      
      // Reset form
      setMessage('');
      setSelectedTemplate('');
    } catch (error: any) {
      console.error('Error sending WhatsApp:', error);
      toast({
        title: 'Error al enviar mensaje',
        description: error.message || 'No se pudo enviar el mensaje. Verifica la configuración de WhatsApp Business API.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const characterCount = message.length;
  const isOverLimit = characterCount > 4096;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-600" />
            Enviar WhatsApp
          </DialogTitle>
          <DialogDescription>
            Envía un mensaje de WhatsApp a {lead.companyName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Selector */}
          <div className="space-y-2">
            <Label>Plantilla</Label>
            <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
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
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono *</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34 612 345 678"
              disabled={isSending}
            />
            <p className="text-xs text-muted-foreground">
              Incluye el código de país (ej: +34 para España)
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
              placeholder="Escribe tu mensaje..."
              rows={8}
              disabled={isSending}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={isSending || isOverLimit}
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
                Enviar WhatsApp
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
