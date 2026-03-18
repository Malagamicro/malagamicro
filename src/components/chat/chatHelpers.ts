import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { FileAttachment } from './chatTypes';
import { isTextFile, isImageFile, ALLOWED_EXTENSIONS } from './chatTypes';

export const getAuthToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
};

export const handleFileSelection = async (
  files: FileList,
  setPendingFiles: React.Dispatch<React.SetStateAction<FileAttachment[]>>,
) => {
  const newAttachments: FileAttachment[] = [];
  for (const file of Array.from(files)) {
    if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} excede 10MB`); continue; }
    const isValid = ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!isValid) { toast.error(`${file.name}: tipo no soportado`); continue; }
    const attachment: FileAttachment = { name: file.name, type: file.type, size: file.size };
    if (isTextFile(file.name)) {
      const text = await file.text();
      attachment.content = text.substring(0, 50000);
    } else if (isImageFile(file.name)) {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      attachment.url = dataUrl;
      attachment.content = `[Imagen adjunta: ${file.name}]`;
    } else {
      const filePath = `chat-uploads/${crypto.randomUUID()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('shared-files').upload(filePath, file);
      if (uploadError) { toast.error(`Error al subir ${file.name}`); continue; }
      const { data: urlData } = supabase.storage.from('shared-files').getPublicUrl(filePath);
      attachment.url = urlData.publicUrl;
      attachment.content = `[Archivo adjunto: ${file.name} (${(file.size / 1024).toFixed(1)} KB) - URL: ${urlData.publicUrl}]`;
    }
    newAttachments.push(attachment);
  }
  setPendingFiles(prev => [...prev, ...newAttachments]);
};

export const formatSessionDate = (date: Date) => {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[date.getDay()];
  }
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};
