import { useState } from 'react';
import { SeoArticleGenerator } from '@/components/seo/SeoArticleGenerator';
import { SeoArticleCard } from '@/components/seo/SeoArticleCard';
import { SeoArticleViewer } from '@/components/seo/SeoArticleViewer';
import { useSeoArticles, SeoArticle } from '@/hooks/useSeoArticles';
import { Loader2, FileText, Sparkles, CheckCircle2, LayoutGrid, List } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function SeoGeneratorInline() {
  const { articles, loading, generating, generateArticle, deleteArticle } = useSeoArticles();
  const [viewingArticle, setViewingArticle] = useState<SeoArticle | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const completedArticles = articles.filter(a => a.status === 'completed');
  const processingArticles = articles.filter(a => a.status === 'processing' || a.status === 'pending');

  return (
    <div className="animate-fade-in">
      <div className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-1.5 py-1 hidden sm:flex">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                {completedArticles.length} completados
              </Badge>
              {processingArticles.length > 0 && (
                <Badge variant="outline" className="gap-1.5 py-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  {processingArticles.length} en proceso
                </Badge>
              )}
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                  <Sparkles className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Generador SEO</h1>
                  <p className="text-sm text-muted-foreground">Artículos optimizados con IA</p>
                </div>
              </div>
            </div>
            <div>
              <SeoArticleGenerator onGenerate={generateArticle} generating={generating} />
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Resultados</h2>
              <p className="text-xs text-muted-foreground">{articles.length} artículo{articles.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setViewMode('grid')}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setViewMode('list')}>
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-56 rounded-xl" />)}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-muted/10">
            <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-5">
              <Sparkles className="h-10 w-10 text-primary/30" />
            </div>
            <h3 className="font-semibold text-xl">Sin artículos aún</h3>
            <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">Introduce un tema arriba y crea tu primer artículo SEO</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
            {articles.map(article => (
              <SeoArticleCard key={article.id} article={article} onDelete={deleteArticle} onView={setViewingArticle} compact={viewMode === 'list'} />
            ))}
          </div>
        )}
      </div>
      <SeoArticleViewer article={viewingArticle} open={!!viewingArticle} onClose={() => setViewingArticle(null)} />
    </div>
  );
}
