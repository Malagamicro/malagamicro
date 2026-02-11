import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Eye, 
  Trash2, 
  ImageIcon,
  BarChart3,
  Copy,
  FolderUp
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { SeoArticle } from '@/hooks/useSeoArticles';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface SeoArticleCardProps {
  article: SeoArticle;
  onDelete: (id: string) => void;
  onView: (article: SeoArticle) => void;
  compact?: boolean;
}

export const SeoArticleCard = ({ article, onDelete, onView, compact = false }: SeoArticleCardProps) => {
  const [deleting, setDeleting] = useState(false);
  const [savingToCloud, setSavingToCloud] = useState(false);
  const { user } = useAuth();

  const getStatusBadge = () => {
    switch (article.status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pendiente</Badge>;
      case 'processing':
        return <Badge className="gap-1 bg-primary/90"><Loader2 className="h-3 w-3 animate-spin" /> Procesando</Badge>;
      case 'completed':
        return <Badge className="gap-1 bg-green-600 text-white"><CheckCircle2 className="h-3 w-3" /> Completado</Badge>;
      case 'error':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Error</Badge>;
      default:
        return null;
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(article.id);
    setDeleting(false);
  };

  const copyHtml = () => {
    if (article.html_content) {
      navigator.clipboard.writeText(article.html_content);
      toast.success('HTML copiado al portapapeles');
    }
  };

  const saveToSharedFiles = async () => {
    if (!user?.id || !article.html_content) return;
    setSavingToCloud(true);
    try {
      const slug = article.slug || 'articulo';
      const folderName = `SEO - ${article.title || article.topic}`;
      const { data: folder, error: folderError } = await supabase
        .from('shared_folders')
        .insert({ name: folderName, user_id: user.id })
        .select().single();
      if (folderError) throw folderError;

      const htmlBlob = new Blob([article.html_content], { type: 'text/html' });
      const htmlPath = `${user.id}/${Date.now()}-${slug}.html`;
      const { error: htmlUpErr } = await supabase.storage.from('shared-files').upload(htmlPath, htmlBlob);
      if (htmlUpErr) throw htmlUpErr;
      const { data: { publicUrl: htmlUrl } } = supabase.storage.from('shared-files').getPublicUrl(htmlPath);
      await supabase.from('shared_files').insert({
        user_id: user.id, file_name: `${slug}.html`, file_path: htmlUrl,
        file_size: htmlBlob.size, file_type: 'text/html', folder_id: folder.id,
        description: `Artículo SEO: ${article.title || article.topic}`,
      });

      if (article.images && Array.isArray(article.images)) {
        for (const img of article.images as { url?: string }[]) {
          if (!img.url) continue;
          try {
            const resp = await fetch(img.url);
            const imgBlob = await resp.blob();
            const ext = img.url.split('.').pop()?.split('?')[0] || 'jpg';
            const imgPath = `${user.id}/${Date.now()}-${slug}-img.${ext}`;
            await supabase.storage.from('shared-files').upload(imgPath, imgBlob);
            const { data: { publicUrl: imgUrl } } = supabase.storage.from('shared-files').getPublicUrl(imgPath);
            await supabase.from('shared_files').insert({
              user_id: user.id, file_name: `${slug}-imagen.${ext}`, file_path: imgUrl,
              file_size: imgBlob.size, file_type: imgBlob.type, folder_id: folder.id,
            });
          } catch { /* skip */ }
        }
      }
      toast.success('Guardado en Archivos Compartidos');
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar');
    } finally {
      setSavingToCloud(false);
    }
  };

  // Get hero image URL
  const heroImage = article.images && article.images.length > 0 ? article.images[0]?.url : null;

  if (compact) {
    return (
      <Card className="hover:shadow-md transition-all group">
        <CardContent className="p-4 flex items-center gap-4">
          {heroImage && (
            <img src={heroImage} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{article.title || article.topic}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(article.created_at), "d MMM yyyy HH:mm", { locale: es })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {article.seo_score && (
              <Badge variant="outline" className="gap-1 text-xs">
                <BarChart3 className="h-3 w-3" />{article.seo_score}
              </Badge>
            )}
            {getStatusBadge()}
            {article.status === 'completed' && (
              <Button variant="outline" size="sm" onClick={() => onView(article)}>
                <Eye className="h-4 w-4" />
              </Button>
            )}
            <Button 
              variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleDelete} disabled={deleting}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-lg transition-all group overflow-hidden">
      {/* Hero image */}
      {heroImage && article.status === 'completed' && (
        <div className="relative h-40 overflow-hidden bg-muted">
          <img 
            src={heroImage} 
            alt={article.title || 'Artículo SEO'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="text-white font-semibold text-sm line-clamp-2 drop-shadow-md">
              {article.title || article.topic}
            </h3>
          </div>
          <div className="absolute top-3 right-3">{getStatusBadge()}</div>
        </div>
      )}

      {/* No image header */}
      {(!heroImage || article.status !== 'completed') && (
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-medium truncate">
                {article.title || article.topic}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(article.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
              </p>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
      )}

      <CardContent className={`space-y-3 ${heroImage && article.status === 'completed' ? 'pt-3' : ''}`}>
        {heroImage && article.status === 'completed' && (
          <p className="text-xs text-muted-foreground">
            {format(new Date(article.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
          </p>
        )}

        {article.status === 'completed' && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted/50 rounded-lg p-2">
                <p className="text-lg font-bold text-primary">{article.seo_score || '-'}</p>
                <p className="text-[10px] text-muted-foreground font-medium">SEO</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <p className="text-lg font-bold text-primary">{article.word_count || '-'}</p>
                <p className="text-[10px] text-muted-foreground font-medium">Palabras</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2">
                <p className="text-lg font-bold text-primary">{article.images_success_count || 0}</p>
                <p className="text-[10px] text-muted-foreground font-medium">Imágenes</p>
              </div>
            </div>

            {article.meta_description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {article.meta_description}
              </p>
            )}

            {article.keywords && article.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {article.keywords.slice(0, 4).map((kw, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                    {typeof kw === 'string' ? kw : (kw as { keyword?: string })?.keyword || ''}
                  </Badge>
                ))}
                {article.keywords.length > 4 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{article.keywords.length - 4}</Badge>
                )}
              </div>
            )}
          </>
        )}

        {article.status === 'processing' && (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            <span className="text-sm">Generando artículo...</span>
            <span className="text-[10px]">Puede tardar 1-2 minutos</span>
          </div>
        )}

        {article.status === 'error' && article.error_message && (
          <p className="text-xs text-destructive bg-destructive/10 p-3 rounded-lg">
            {article.error_message}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          {article.status === 'completed' && (
            <>
              <Button 
                variant="default" 
                size="sm" 
                className="flex-1 h-8 text-xs"
                onClick={() => onView(article)}
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                Ver artículo
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={copyHtml} title="Copiar HTML">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-8" onClick={saveToSharedFiles} disabled={savingToCloud} title="Guardar en Cloud">
                {savingToCloud ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderUp className="h-3.5 w-3.5" />}
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDelete}
                disabled={deleting}
                title="Eliminar"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </>
          )}
          {article.status !== 'completed' && (
            <Button 
              variant="ghost" 
              size="sm"
              className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
