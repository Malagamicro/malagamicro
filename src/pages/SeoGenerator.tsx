import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SeoArticleGenerator } from '@/components/seo/SeoArticleGenerator';
import { SeoArticleCard } from '@/components/seo/SeoArticleCard';
import { SeoArticleViewer } from '@/components/seo/SeoArticleViewer';
import { useSeoArticles, SeoArticle } from '@/hooks/useSeoArticles';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FileText, Sparkles, ArrowLeft } from 'lucide-react';

const SeoGenerator = () => {
  const navigate = useNavigate();
  const { articles, loading, generating, generateArticle, deleteArticle } = useSeoArticles();
  const [viewingArticle, setViewingArticle] = useState<SeoArticle | null>(null);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Generador SEO con IA
            </h1>
            <p className="text-muted-foreground">
              Crea artículos optimizados para SEO con investigación web en tiempo real e imágenes generadas por IA
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <SeoArticleGenerator 
              onGenerate={generateArticle} 
              generating={generating} 
            />
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Artículos Generados</h2>
              <span className="text-sm text-muted-foreground">
                ({articles.length})
              </span>
            </div>

            {loading ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-48 rounded-lg" />
                ))}
              </div>
            ) : articles.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-lg">No hay artículos</h3>
                <p className="text-muted-foreground">
                  Genera tu primer artículo SEO usando el formulario
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {articles.map((article) => (
                  <SeoArticleCard
                    key={article.id}
                    article={article}
                    onDelete={deleteArticle}
                    onView={setViewingArticle}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <SeoArticleViewer
        article={viewingArticle}
        open={!!viewingArticle}
        onClose={() => setViewingArticle(null)}
      />
    </div>
  );
};

export default SeoGenerator;
