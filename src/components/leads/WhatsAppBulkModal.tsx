import { useState, useRef } from 'react';
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
import { Loader2, MessageSquare, CheckCircle, XCircle, ImagePlus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Lead } from '@/types/lead';
import { Progress } from '@/components/ui/progress';
import { sendText, sendImage } from '@/services/wahaService';
import { useMessageTemplates } from '@/hooks/useMessageTemplates';

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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Obtener plantillas de la BD
  const { templates, isLoading: isLoadingTemplates } = useMessageTemplates();

  // Leads con teléfono válido
  const leadsWithPhone = selectedLeads.filter(lead => lead.phone && lead.phone.trim() !== '');

  const replaceVariables = (text: string, lead: Lead): string => {
    return text
      .replace(/\{\{companyName\}\}/g, lead.companyName)
      .replace(/\{\{contactName\}\}/g, lead.contactName || 'Cliente')
      .replace(/\{\{city\}\}/g, lead.city)
      .replace(/\{\{email\}\}/g, lead.email || '')
      .replace(/\{\{phone\}\}/g, lead.phone || '');
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setMessage(template.content);
    }
  };

  

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Error',
          description: 'Solo se permiten archivos de imagen.',
          variant: 'destructive',
        });
        return;
      }
      
      // Validar tamaño (máx 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'Error',
          description: 'La imagen no puede superar 5MB.',
          variant: 'destructive',
        });
        return;
      }

      setImageFile(file);
      
      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remover el prefijo "data:image/xxx;base64," para obtener solo el base64
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const sendWhatsAppMessage = async (lead: Lead, personalizedMessage: string, imageBase64?: string): Promise<SendResult> => {
    try {
      if (imageBase64 && imageFile) {
        // Send image with caption using centralized service
        await sendImage({
          phone: lead.phone || '',
          caption: personalizedMessage,
          imageBase64,
          imageMimeType: imageFile.type,
          imageFilename: imageFile.name,
        });
      } else {
        // Send text only using centralized service
        await sendText({
          phone: lead.phone || '',
          message: personalizedMessage,
        });
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
    if (!message && !imageFile) {
      toast({
        title: 'Error',
        description: 'Por favor, escribe un mensaje o adjunta una imagen.',
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

    // Convertir imagen a base64 una sola vez
    let imageBase64: string | undefined;
    if (imageFile) {
      try {
        imageBase64 = await fileToBase64(imageFile);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'No se pudo procesar la imagen.',
          variant: 'destructive',
        });
        setIsSending(false);
        return;
      }
    }

    const newResults: SendResult[] = [];

    for (let i = 0; i < leadsWithPhone.length; i++) {
      const lead = leadsWithPhone[i];
      const personalizedMessage = replaceVariables(message, lead);
      
      const result = await sendWhatsAppMessage(lead, personalizedMessage, imageBase64);
      newResults.push(result);
      setResults([...newResults]);
      setSendProgress(((i + 1) / leadsWithPhone.length) * 100);

      // Pequeña pausa entre mensajes para no saturar la API
      if (i < leadsWithPhone.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
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
      removeImage();
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
            <Select 
              value={selectedTemplate} 
              onValueChange={handleTemplateChange} 
              disabled={isSending || isLoadingTemplates}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={isLoadingTemplates ? "Cargando..." : "Seleccionar plantilla (opcional)"} />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {templates.length === 0 ? (
                  <SelectItem value="__empty__" disabled>
                    No hay plantillas - Créalas en Plantillas
                  </SelectItem>
                ) : (
                  templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Variables disponibles: {'{{contactName}}'}, {'{{companyName}}'}, {'{{city}}'}, {'{{phone}}'}
            </p>
          </div>

          {/* Image Attachment */}
          <div className="space-y-2">
            <Label>Imagen (opcional)</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                disabled={isSending}
                className="hidden"
                id="image-upload"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending}
                className="gap-2"
              >
                <ImagePlus className="w-4 h-4" />
                Adjuntar imagen
              </Button>
              {imageFile && (
                <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {imageFile.name}
                </span>
              )}
            </div>
            
            {/* Image Preview */}
            {imagePreview && (
              <div className="relative inline-block">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="max-h-32 rounded-lg border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6"
                  onClick={removeImage}
                  disabled={isSending}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Formatos: JPG, PNG, GIF. Máximo 5MB.
            </p>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="message">
                {imageFile ? 'Texto (caption)' : 'Mensaje *'}
              </Label>
              <span className={`text-xs ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                {characterCount}/4096
              </span>
            </div>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={imageFile ? "Escribe un texto para acompañar la imagen..." : "Escribe tu mensaje... Usa {{contactName}} para personalizar."}
              rows={4}
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
              disabled={isSending || isOverLimit || leadsWithPhone.length === 0 || (!message && !imageFile)}
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
