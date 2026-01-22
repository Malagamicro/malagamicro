import { useMessageTemplates, MessageTemplate } from '@/hooks/useMessageTemplates';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Loader2 } from 'lucide-react';

interface TemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate?: (content: string) => void;
}

export function TemplatesModal({ open, onOpenChange, onSelectTemplate }: TemplatesModalProps) {
  const { templates, isLoading } = useMessageTemplates();

  const handleSelect = (content: string) => {
    onSelectTemplate?.(content);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Seleccionar Plantilla
          </DialogTitle>
          <DialogDescription>
            Elige una plantilla para insertar en el mensaje
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay plantillas creadas</p>
              <p className="text-sm mt-1">Ve a Plantillas en el menú para crear una</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <Button
                  key={template.id}
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3 px-4"
                  onClick={() => handleSelect(template.content)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{template.name}</p>
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                      {template.content}
                    </p>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
