import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Lead } from '@/types/lead';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

const defaultTemplates: EmailTemplate[] = [
  {
    id: 'intro',
    name: 'Presentación inicial',
    subject: 'Servicios de mantenimiento informático para {{companyName}}',
    body: `Estimado/a {{contactName}},

Me pongo en contacto con usted desde MalagaMicro, empresa especializada en servicios de mantenimiento informático para empresas.

Hemos identificado que {{companyName}} podría beneficiarse de nuestros servicios de soporte técnico y mantenimiento preventivo.

Ofrecemos:
- Mantenimiento preventivo de equipos
- Soporte técnico remoto y presencial
- Gestión de copias de seguridad
- Asesoramiento tecnológico

¿Le gustaría programar una reunión para conocer más sobre cómo podemos ayudarle?

Saludos cordiales,
El equipo de MalagaMicro`,
  },
  {
    id: 'followup',
    name: 'Seguimiento',
    subject: 'Seguimiento - Servicios informáticos para {{companyName}}',
    body: `Estimado/a {{contactName}},

Espero que este mensaje le encuentre bien. Me gustaría dar seguimiento a mi comunicación anterior sobre los servicios de mantenimiento informático que ofrecemos.

¿Ha tenido oportunidad de considerar nuestra propuesta? Estaré encantado de resolver cualquier duda que pueda tener.

Quedo a su disposición para una llamada o reunión cuando le sea conveniente.

Saludos cordiales,
El equipo de MalagaMicro`,
  },
  {
    id: 'proposal',
    name: 'Envío de propuesta',
    subject: 'Propuesta de servicios para {{companyName}}',
    body: `Estimado/a {{contactName}},

Adjunto encontrará nuestra propuesta de servicios de mantenimiento informático adaptada a las necesidades de {{companyName}}.

Puntos destacados de nuestra propuesta:
- Mantenimiento mensual con visitas programadas
- Soporte remoto ilimitado
- Tiempo de respuesta garantizado
- Precio competitivo

Quedo a la espera de sus comentarios y estaré encantado de ajustar la propuesta según sus necesidades.

Saludos cordiales,
El equipo de MalagaMicro`,
  },
];

interface EmailComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onEmailSent?: () => void;
  onActivityLogged?: () => void;
}

export function EmailComposeModal({ 
  open, 
  onOpenChange, 
  lead,
  onEmailSent 
}: EmailComposeModalProps) {
  const [to, setTo] = useState(lead.email || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
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
      setSubject(replaceVariables(template.subject));
      setBody(replaceVariables(template.body));
    }
  };

  const handleSend = async () => {
    if (!to || !subject || !body) {
      toast({
        title: 'Error',
        description: 'Por favor, completa todos los campos.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);

    try {
      // Convert plain text to HTML
      const htmlBody = body.replace(/\n/g, '<br>');

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to,
          subject,
          html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${htmlBody}</div>`,
          text: body,
          leadId: lead.id,
          leadName: lead.companyName,
        },
      });

      if (error) throw error;

      toast({
        title: 'Email enviado',
        description: `El email ha sido enviado a ${to}`,
      });

      onEmailSent?.();
      onOpenChange(false);
      
      // Reset form
      setSubject('');
      setBody('');
      setSelectedTemplate('');
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: 'Error al enviar email',
        description: error.message || 'No se pudo enviar el email. Verifica la configuración.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar Email</DialogTitle>
          <DialogDescription>
            Envía un email a {lead.companyName}
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

          {/* To */}
          <div className="space-y-2">
            <Label htmlFor="to">Para *</Label>
            <Input
              id="to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email@ejemplo.com"
              disabled={isSending}
            />
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Asunto *</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto del email"
              disabled={isSending}
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">Mensaje *</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escribe tu mensaje..."
              rows={10}
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
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
