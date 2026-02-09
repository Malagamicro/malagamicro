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
  ExternalLink,
  Copy
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { SeoArticle } from '@/hooks/useSeoArticles';
import { toast } from 'sonner';

interface SeoArticleCardProps {
  article: SeoArticle;
  onDelete: (id: string) => void;
  onView: (article: SeoArticle) => void;
}

export const SeoArticleCard = ({ article, onDelete, onView }: SeoArticleCardProps) => {
  const [deleting, setDeleting] = useState(false);

  const getStatusBadge = () => {
    switch (article.status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pendiente</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-primary"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Procesando</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-accent-foreground text-accent"><CheckCircle2 className="h-3 w-3 mr-1" /> Completado</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Error</Badge>;
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

  return (
    <Card className="hover:shadow-md transition-shadow">
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
      <CardContent className="space-y-3">
        {article.status === 'completed' && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted/50 rounded p-2">
                <BarChart3 className="h-4 w-4 mx-auto mb-1 text-primary" />
                <p className="text-lg font-semibold">{article.seo_score || '-'}</p>
                <p className="text-xs text-muted-foreground">SEO Score</p>
              </div>
              <div className="bg-muted/50 rounded p-2">
                <FileText className="h-4 w-4 mx-auto mb-1 text-primary" />
                <p className="text-lg font-semibold">{article.word_count || '-'}</p>
                <p className="text-xs text-muted-foreground">Palabras</p>
              </div>
              <div className="bg-muted/50 rounded p-2">
                <ImageIcon className="h-4 w-4 mx-auto mb-1 text-primary" />
                <p className="text-lg font-semibold">{article.images_success_count || 0}</p>
                <p className="text-xs text-muted-foreground">Imágenes</p>
              </div>
            </div>

            {article.meta_description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {article.meta_description}
              </p>
            )}

            {article.keywords && article.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {article.keywords.slice(0, 5).map((kw, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {typeof kw === 'string' ? kw : (kw as { keyword?: string })?.keyword || ''}
                  </Badge>
                ))}
                {article.keywords.length > 5 && (
                  <Badge variant="outline" className="text-xs">+{article.keywords.length - 5}</Badge>
                )}
              </div>
            )}
          </>
        )}

        {article.status === 'processing' && (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            <span className="text-sm">Generando artículo...</span>
          </div>
        )}

        {article.status === 'error' && article.error_message && (
          <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">
            {article.error_message}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          {article.status === 'completed' && (
            <>
              <Button 
                variant="default" 
                size="sm" 
                className="flex-1"
                onClick={() => onView(article)}
              >
                <Eye className="h-4 w-4 mr-1" />
                Ver
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={copyHtml}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
