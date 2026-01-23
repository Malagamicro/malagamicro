import { useState, useRef } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

interface EditContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  phone: string;
  currentName: string | null;
  currentAvatar: string | null;
  onSave: (name: string, avatarFile?: File) => Promise<void>;
}

export function EditContactModal({
  isOpen,
  onClose,
  chatId,
  phone,
  currentName,
  currentAvatar,
  onSave,
}: EditContactModalProps) {
  const [name, setName] = useState(currentName || '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(currentAvatar);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('La imagen no puede superar 2MB');
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(name || phone, avatarFile || undefined);
      toast.success('Contacto actualizado');
      onClose();
    } catch (err) {
      console.error('Error saving contact:', err);
      toast.error('Error al guardar el contacto');
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = name || phone;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Contacto</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Avatar className="h-24 w-24">
                {avatarPreview ? (
                  <AvatarImage src={avatarPreview} alt={displayName} />
                ) : null}
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarSelect}
                className="hidden"
              />
              
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-4 w-4" />
              </Button>

              {avatarPreview && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-1 -right-1 h-6 w-6 rounded-full"
                  onClick={removeAvatar}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Haz clic en el icono de cámara para cambiar la foto
            </p>
          </div>

          {/* Name Input */}
          <div className="grid gap-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del contacto"
            />
          </div>

          {/* Phone (read-only) */}
          <div className="grid gap-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={`+${phone}`}
              disabled
              className="bg-muted"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}