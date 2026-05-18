import { useState, useEffect, useMemo } from 'react';
import { Download, Loader2, Music, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import type { SharedFile } from '@/hooks/useSharedFiles';
import { isOfficeDoc, canEditInEditor, parseCsv } from './sharedFilesHelpers';
import { supabase } from '@/integrations/supabase/client';

function resolveFileUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path) || path.startsWith('data:') || path.startsWith('blob:')) return path;
  return supabase.storage.from('shared-files').getPublicUrl(path).data.publicUrl;
}

export function FilePreviewDialog({
  open, onOpenChange, file, onOpenInEditor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  file: SharedFile | null;
  onOpenInEditor?: (file: SharedFile) => void;
}) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !file) { setTextContent(null); return; }
    const isText = file.file_type === 'text/markdown' || file.file_type === 'text/plain' || file.file_type === 'text/html' || file.file_type === 'text/csv';
    if (!isText) { setTextContent(null); return; }

    setLoading(true);
    fetch(file.file_path)
      .then(r => r.text())
      .then(t => setTextContent(t))
      .catch(() => setTextContent(null))
      .finally(() => setLoading(false));
  }, [open, file]);

  const isCsv = file?.file_type === 'text/csv';
  const isMarkdown = file?.file_type === 'text/markdown';
  const isText = file?.file_type === 'text/plain' || file?.file_type === 'text/html' || isCsv || isMarkdown;

  const [ReactMarkdownComp, setReactMarkdownComp] = useState<any>(null);
  const [remarkGfmPlugin, setRemarkGfmPlugin] = useState<any>(null);
  useEffect(() => {
    if (isMarkdown && open) {
      Promise.all([
        import('react-markdown'),
        import('remark-gfm'),
      ]).then(([mdMod, gfmMod]) => {
        setReactMarkdownComp(() => mdMod.default);
        setRemarkGfmPlugin(() => gfmMod.default);
      });
    }
  }, [isMarkdown, open]);

  const csvData = useMemo(() => {
    if (isCsv && textContent) return parseCsv(textContent);
    return null;
  }, [isCsv, textContent]);

  const showEditorButton = file && canEditInEditor(file.file_type) && onOpenInEditor;

  const renderContent = () => {
    if (!file) return null;

    if (file.file_type?.startsWith('image/')) {
      return <img src={file.file_path} alt={file.file_name} className="max-w-full h-auto mx-auto rounded-lg" />;
    }

    if (file.file_type === 'application/pdf') {
      return <iframe src={file.file_path} className="w-full h-[70vh] rounded-lg border" title={file.file_name} />;
    }

    if (isOfficeDoc(file.file_type)) {
      const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(file.file_path)}&embedded=true`;
      return <iframe src={viewerUrl} className="w-full h-[70vh] rounded-lg border" title={file.file_name} />;
    }

    if (file.file_type?.startsWith('video/')) {
      return (
        <video controls className="w-full max-h-[70vh] rounded-lg" preload="metadata">
          <source src={file.file_path} type={file.file_type} />
          Tu navegador no soporta la reproducción de video.
        </video>
      );
    }

    if (file.file_type?.startsWith('audio/')) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Music className="h-16 w-16 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{file.file_name}</p>
          <audio controls className="w-full max-w-md" preload="metadata">
            <source src={file.file_path} type={file.file_type} />
          </audio>
        </div>
      );
    }

    if (isText && textContent !== null) {
      if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin" /></div>;

      if (isCsv && csvData && csvData.length > 0) {
        const header = csvData[0];
        const body = csvData.slice(1);
        return (
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr>
                  {header.map((cell, i) => (
                    <th key={i} className="bg-muted border border-border px-3 py-2 text-left font-semibold text-foreground whitespace-nowrap">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri} className="hover:bg-muted/50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-border px-3 py-1.5 text-foreground whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                    {row.length < header.length && Array.from({ length: header.length - row.length }).map((_, ci) => (
                      <td key={`empty-${ci}`} className="border border-border px-3 py-1.5" />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      if (isMarkdown && ReactMarkdownComp) {
        return (
          <div className="p-6 prose prose-sm md:prose-base dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-pre:bg-muted prose-pre:text-foreground prose-code:before:hidden prose-code:after:hidden prose-table:text-sm">
            <ReactMarkdownComp remarkPlugins={remarkGfmPlugin ? [remarkGfmPlugin] : []}>
              {textContent}
            </ReactMarkdownComp>
          </div>
        );
      }

      return <pre className="p-6 text-sm whitespace-pre-wrap font-mono bg-muted rounded-lg">{textContent}</pre>;
    }

    return <div className="flex items-center justify-center h-48 text-muted-foreground">Vista previa no disponible</div>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="truncate">{file?.file_name}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto">{renderContent()}</div>
        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          {showEditorButton && (
            <Button variant="secondary" onClick={() => { onOpenInEditor!(file!); onOpenChange(false); }}>
              <Pencil className="h-4 w-4 mr-2" />
              Abrir en Editor
            </Button>
          )}
          <Button onClick={() => file && window.open(file.file_path, '_blank')}>
            <Download className="h-4 w-4 mr-2" />
            Descargar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
