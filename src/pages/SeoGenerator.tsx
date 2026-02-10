import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SeoArticleGenerator } from '@/components/seo/SeoArticleGenerator';
import { SeoArticleCard } from '@/components/seo/SeoArticleCard';
import { SeoArticleViewer } from '@/components/seo/SeoArticleViewer';
import { useSeoArticles, SeoArticle } from '@/hooks/useSeoArticles';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Sparkles, ArrowLeft, CheckCircle2, XCircle, Clock, Loader2, LayoutGrid, List } from 'lucide-react';

const SeoGenerator = () => {
  const navigate = useNavigate();
  const { articles, loading, generating, generateArticle, deleteArticle } = useSeoArticles();
  const [viewingArticle, setViewingArticle] = useState<SeoArticle | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const completedArticles = articles.filter(a => a.status === 'completed');
  const processingArticles = articles.filter(a => a.status === 'processing' || a.status === 'pending');
  const errorArticles = articles.filter(a => a.status === 'error');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary-foreground" />
                  </div>
                  Generador SEO con IA
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Artículos optimizados con investigación web e imágenes generadas por IA
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <Badge variant="outline" className="gap-1.5 py-1">
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
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
        {/* Generator Section */}
        <section>
          <SeoArticleGenerator 
            onGenerate={generateArticle} 
            generating={generating} 
          />
        </section>

        {/* Results Section */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Resultados</h2>
                <p className="text-xs text-muted-foreground">
                  {articles.length} artículo{articles.length !== 1 ? 's' : ''} generado{articles.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-56 rounded-xl" />
              ))}
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/20">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-primary/50" />
              </div>
              <h3 className="font-semibold text-lg">Sin artículos aún</h3>
              <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto">
                Introduce un tema en el generador y crea tu primer artículo SEO optimizado con IA
              </p>
            </div>
          ) : (
            <Tabs defaultValue="all" className="space-y-4">
              <TabsList>
                <TabsTrigger value="all" className="gap-1.5">
                  Todos
                  <Badge variant="secondary" className="h-5 min-w-[20px] text-[10px] px-1.5">{articles.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="completed" className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Completados
                  <Badge variant="secondary" className="h-5 min-w-[20px] text-[10px] px-1.5">{completedArticles.length}</Badge>
                </TabsTrigger>
                {processingArticles.length > 0 && (
                  <TabsTrigger value="processing" className="gap-1.5">
                    <Loader2 className="h-3.5 w-3.5" />
                    En proceso
                    <Badge variant="secondary" className="h-5 min-w-[20px] text-[10px] px-1.5">{processingArticles.length}</Badge>
                  </TabsTrigger>
                )}
                {errorArticles.length > 0 && (
                  <TabsTrigger value="error" className="gap-1.5">
                    <XCircle className="h-3.5 w-3.5" />
                    Errores
                    <Badge variant="secondary" className="h-5 min-w-[20px] text-[10px] px-1.5">{errorArticles.length}</Badge>
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="all">
                <ArticleGrid articles={articles} viewMode={viewMode} onView={setViewingArticle} onDelete={deleteArticle} />
              </TabsContent>
              <TabsContent value="completed">
                <ArticleGrid articles={completedArticles} viewMode={viewMode} onView={setViewingArticle} onDelete={deleteArticle} />
              </TabsContent>
              <TabsContent value="processing">
                <ArticleGrid articles={processingArticles} viewMode={viewMode} onView={setViewingArticle} onDelete={deleteArticle} />
              </TabsContent>
              <TabsContent value="error">
                <ArticleGrid articles={errorArticles} viewMode={viewMode} onView={setViewingArticle} onDelete={deleteArticle} />
              </TabsContent>
            </Tabs>
          )}
        </section>
      </div>

      <SeoArticleViewer
        article={viewingArticle}
        open={!!viewingArticle}
        onClose={() => setViewingArticle(null)}
      />
    </div>
  );
};

interface ArticleGridProps {
  articles: SeoArticle[];
  viewMode: 'grid' | 'list';
  onView: (article: SeoArticle) => void;
  onDelete: (id: string) => void;
}

const ArticleGrid = ({ articles, viewMode, onView, onDelete }: ArticleGridProps) => {
  if (articles.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No hay artículos en esta categoría
      </div>
    );
  }

  return (
    <div className={viewMode === 'grid' ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-3'}>
      {articles.map((article) => (
        <SeoArticleCard
          key={article.id}
          article={article}
          onDelete={onDelete}
          onView={onView}
          compact={viewMode === 'list'}
        />
      ))}
    </div>
  );
};

export default SeoGenerator;
