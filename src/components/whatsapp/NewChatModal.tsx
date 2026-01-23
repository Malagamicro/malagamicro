import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateChat: (phone: string, name?: string) => Promise<void>;
}

export function NewChatModal({ isOpen, onClose, onCreateChat }: NewChatModalProps) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const formatPhone = (input: string): string => {
    // Remove all non-numeric characters
    let cleaned = input.replace(/\D/g, '');
    
    // If it's a 9-digit Spanish number, add country code
    if (cleaned.length === 9 && !cleaned.startsWith('34')) {
      cleaned = '34' + cleaned;
    }
    
    return cleaned;
  };

  const handleCreate = async () => {
    const formattedPhone = formatPhone(phone);
    
    if (formattedPhone.length < 9) {
      toast.error('Por favor, introduce un número de teléfono válido');
      return;
    }

    setIsCreating(true);
    try {
      await onCreateChat(formattedPhone, name || undefined);
      toast.success('Chat creado');
      setPhone('');
      setName('');
      onClose();
    } catch (err) {
      console.error('Error creating chat:', err);
      toast.error('Error al crear el chat');
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nueva Conversación</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="new-phone">Número de teléfono *</Label>
            <Input
              id="new-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ej: 612345678 o 34612345678"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Para números españoles de 9 dígitos, se añadirá +34 automáticamente
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-name">Nombre (opcional)</Label>
            <Input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Nombre del contacto"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !phone.trim()}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              'Crear Chat'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}