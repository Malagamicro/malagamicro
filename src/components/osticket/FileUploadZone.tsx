import { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import type { AttachedFile } from './osticketHelpers';

export function FileUploadZone({
  onFileUploaded,
  accept,
  children,
  className,
}: {
  onFileUploaded: (file: AttachedFile) => void;
  accept?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setProgress(10);
    try {
      const ext = file.name.split('.').pop();
      const path = `tickets/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      setProgress(40);
      const { data, error } = await supabase.storage
        .from('ticket-files')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      setProgress(80);
      const { data: urlData } = supabase.storage.from('ticket-files').getPublicUrl(data.path);
      setProgress(100);
      onFileUploaded({
        id: Date.now().toString(),
        name: file.name,
        url: urlData.publicUrl,
        type: file.type,
        size: file.size,
        isImage: file.type.startsWith('image/'),
      });
      toast.success(`Archivo subido: ${file.name}`);
    } catch (err: any) {
      toast.error(`Error al subir: ${err.message}`);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept || 'image/*,application/pdf,.txt'}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />
      <div onClick={() => !uploading && inputRef.current?.click()} className="cursor-pointer">
        {uploading ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Subiendo... {progress}%
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        ) : children}
      </div>
    </div>
  );
}
