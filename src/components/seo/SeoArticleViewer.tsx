import { useState } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Code, 
  ImageIcon, 
  BarChart3, 
  Link2, 
  Copy,
  Download,
  ExternalLink,
  FolderUp,
  Loader2,
  AlertCircle,
  Video,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { SeoArticle } from '@/hooks/useSeoArticles';

interface SeoArticleViewerProps {
  article: SeoArticle | null;
  open: boolean;
  onClose: () => void;
}

export const SeoArticleViewer = ({ article, open, onClose }: SeoArticleViewerProps) => {
  const [activeTab, setActiveTab] = useState('preview');
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const { user } = useAuth();

  if (!article) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
  };

  const downloadHtml = () => {
    if (!article.html_content) return;
    
    const blob = new Blob([article.html_content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${article.slug || 'article'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('HTML descargado');
  };

  const saveToSharedFiles = async () => {
    if (!user?.id || !article.html_content) return;
    setIsSavingToCloud(true);
    try {
      const slug = article.slug || 'articulo';
      const folderName = `SEO - ${article.title || article.topic}`;

      // Create folder
      const { data: folder, error: folderError } = await supabase
        .from('shared_folders')
        .insert({ name: folderName, user_id: user.id })
        .select()
        .single();

      if (folderError) throw folderError;

      // Upload HTML file
      const htmlBlob = new Blob([article.html_content], { type: 'text/html' });
      const htmlPath = `${user.id}/${Date.now()}-${slug}.html`;
      const { error: htmlUpErr } = await supabase.storage
        .from('shared-files')
        .upload(htmlPath, htmlBlob);
      if (htmlUpErr) throw htmlUpErr;
      const { data: { publicUrl: htmlUrl } } = supabase.storage.from('shared-files').getPublicUrl(htmlPath);

      await supabase.from('shared_files').insert({
        user_id: user.id, file_name: `${slug}.html`, file_path: htmlUrl,
        file_size: htmlBlob.size, file_type: 'text/html', folder_id: folder.id,
        description: `Artículo SEO: ${article.title || article.topic}`,
      });

      // Upload images if any
      if (article.images && Array.isArray(article.images)) {
        for (const img of article.images as { url?: string; alt?: string }[]) {
          if (!img.url) continue;
          try {
            const resp = await fetch(img.url);
            const imgBlob = await resp.blob();
            const ext = img.url.split('.').pop()?.split('?')[0] || 'jpg';
            const imgPath = `${user.id}/${Date.now()}-${slug}-img.${ext}`;
            const { error: imgUpErr } = await supabase.storage.from('shared-files').upload(imgPath, imgBlob);
            if (imgUpErr) continue;
            const { data: { publicUrl: imgUrl } } = supabase.storage.from('shared-files').getPublicUrl(imgPath);
            await supabase.from('shared_files').insert({
              user_id: user.id, file_name: `${slug}-imagen.${ext}`, file_path: imgUrl,
              file_size: imgBlob.size, file_type: imgBlob.type, folder_id: folder.id,
            });
          } catch { /* skip failed image */ }
        }
      }

      // Upload video if any
      if (article.video_url && article.video_status === 'completed') {
        try {
          const resp = await fetch(article.video_url);
          const videoBlob = await resp.blob();
          const videoPath = `${user.id}/${Date.now()}-${slug}-video.mp4`;
          const { error: videoUpErr } = await supabase.storage.from('shared-files').upload(videoPath, videoBlob);
          if (!videoUpErr) {
            const { data: { publicUrl: videoUrl } } = supabase.storage.from('shared-files').getPublicUrl(videoPath);
            await supabase.from('shared_files').insert({
              user_id: user.id, file_name: `${slug}-video.mp4`, file_path: videoUrl,
              file_size: videoBlob.size, file_type: videoBlob.type, folder_id: folder.id,
            });
          }
        } catch { /* skip */ }
      }

      toast.success('Artículo guardado en Archivos Compartidos');
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar en archivos compartidos');
    } finally {
      setIsSavingToCloud(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {article.title || article.topic}
          </DialogTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {article.seo_score && (
              <Badge variant="secondary">
                <BarChart3 className="h-3 w-3 mr-1" />
                SEO: {article.seo_score}/100
              </Badge>
            )}
            {article.word_count && (
              <Badge variant="outline">{article.word_count} palabras</Badge>
            )}
            {article.images && Array.isArray(article.images) && (article.images as any[]).length > 0 && (
              <Badge variant="outline">
                <ImageIcon className="h-3 w-3 mr-1" />
                {(article.images as any[]).length} imágenes
              </Badge>
            )}
            {article.video_status && article.video_status !== 'none' && (
              <Badge variant="outline">
                <Video className="h-3 w-3 mr-1" />
                Video: {article.video_status}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="preview">Vista Previa</TabsTrigger>
            <TabsTrigger value="html">HTML</TabsTrigger>
            <TabsTrigger value="video">Video</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
            <TabsTrigger value="meta">Meta</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 mt-4">
            <TabsContent value="preview" className="h-full m-0">
              <ScrollArea className="h-[60vh] border rounded-lg p-4">
                {article.html_content ? (
                  <div 
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.html_content) }}
                  />
                ) : (
                  <p className="text-muted-foreground">No hay contenido disponible</p>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="html" className="h-full m-0">
              <div className="flex gap-2 mb-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(article.html_content || '', 'HTML')}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copiar
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={downloadHtml}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Descargar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={saveToSharedFiles}
                  disabled={isSavingToCloud}
                >
                  {isSavingToCloud ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FolderUp className="h-4 w-4 mr-1" />}
                  Guardar en Cloud
                </Button>
              </div>
              <ScrollArea className="h-[55vh] border rounded-lg">
                <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
                  {article.html_content || 'No hay contenido HTML'}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="video" className="h-full m-0">
              <div className="flex justify-center items-center h-[60vh] border rounded-lg p-6 bg-muted/5">
                {article.video_status === 'completed' && article.video_url ? (
                  <div className="space-y-4 w-full max-w-xl flex flex-col items-center">
                    <video 
                      controls 
                      src={article.video_url} 
                      className="w-full rounded-lg max-h-[45vh] bg-black shadow-lg"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = article.video_url!;
                          a.download = `${article.slug || 'video'}.mp4`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Descargar Video
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(article.video_url, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Ver en pestaña
                      </Button>
                    </div>
                  </div>
                ) : article.video_status === 'processing' ? (
                  <div className="flex flex-col items-center justify-center text-muted-foreground gap-4 text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Generando video con google/veo-3.1-fast...</p>
                      <p className="text-xs mt-1">El proceso tarda entre 1 y 2 minutos. El reproductor aparecerá automáticamente cuando esté listo.</p>
                    </div>
                  </div>
                ) : article.video_status === 'error' ? (
                  <div className="flex flex-col items-center justify-center text-destructive gap-3 text-center">
                    <AlertCircle className="h-10 w-10" />
                    <div>
                      <p className="text-sm font-semibold">Error al generar el video</p>
                      <p className="text-xs text-muted-foreground mt-1">{article.error_message || 'Fallo desconocido en el servidor.'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground gap-3 text-center">
                    <Video className="h-10 w-10 opacity-30" />
                    <div>
                      <p className="text-sm font-semibold">No se solicitó video</p>
                      <p className="text-xs mt-1">Habilita la opción de video al crear un nuevo artículo para generarlo de forma automática.</p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="seo" className="h-full m-0">
              <ScrollArea className="h-[60vh]">
                <div className="space-y-4">
                  {article.research_summary && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Resumen de Investigación</h4>
                      <p className="text-sm text-muted-foreground">{article.research_summary}</p>
                    </div>
                  )}

                  {article.keywords && article.keywords.length > 0 && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Keywords</h4>
                      <div className="flex flex-wrap gap-2">
                        {article.keywords.map((kw, i) => (
                          <Badge key={i} variant="secondary">
                            {typeof kw === 'string' ? kw : (kw as { keyword?: string })?.keyword || ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {article.optimizations && article.optimizations.length > 0 && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Optimizaciones Aplicadas</h4>
                      <ul className="text-sm space-y-1">
                        {article.optimizations.map((opt, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            {opt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {article.suggested_links && article.suggested_links.length > 0 && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Link2 className="h-4 w-4" />
                        Enlaces Sugeridos
                      </h4>
                      <ul className="text-sm space-y-2">
                        {article.suggested_links.map((link, i) => (
                          <li key={i} className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded">
                            <span>{link.anchor}</span>
                            <Badge variant="outline">{link.targetUrl}</Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="meta" className="h-full m-0">
              <ScrollArea className="h-[60vh]">
                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Meta Tags</h4>
                    <dl className="text-sm space-y-2">
                      <div>
                        <dt className="text-muted-foreground">Title</dt>
                        <dd className="font-medium">{article.title || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Slug</dt>
                        <dd className="font-mono text-xs">{article.slug || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Meta Description</dt>
                        <dd>{article.meta_description || '-'}</dd>
                      </div>
                    </dl>
                  </div>

                  {article.meta_tags && Object.keys(article.meta_tags).length > 0 && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Open Graph / Social</h4>
                      <dl className="text-sm space-y-2">
                        {Object.entries(article.meta_tags).map(([key, value]) => (
                          <div key={key}>
                            <dt className="text-muted-foreground font-mono text-xs">{key}</dt>
                            <dd className="truncate">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {article.structured_data && (
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Datos Estructurados (JSON-LD)</h4>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-48">
                        {JSON.stringify(article.structured_data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
