import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Sparkles, Loader2, FileText, ImageIcon } from 'lucide-react';

interface SeoArticleGeneratorProps {
  onGenerate: (topic: string, imageCount: number) => Promise<unknown>;
  generating: boolean;
}

export const SeoArticleGenerator = ({ onGenerate, generating }: SeoArticleGeneratorProps) => {
  const [topic, setTopic] = useState('');
  const [imageCount, setImageCount] = useState(3);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    
    await onGenerate(topic.trim(), imageCount);
    setTopic('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Generador de Artículos SEO
        </CardTitle>
        <CardDescription>
          Genera artículos optimizados para SEO con investigación web en tiempo real e imágenes generadas por IA
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="topic">Tema del artículo</Label>
            <Input
              id="topic"
              placeholder="Ej: Mejores prácticas de inteligencia artificial en 2026"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={generating}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Número de imágenes: {imageCount}
              </Label>
            </div>
            <Slider
              value={[imageCount]}
              onValueChange={(v) => setImageCount(v[0])}
              min={1}
              max={5}
              step={1}
              disabled={generating}
            />
            <p className="text-xs text-muted-foreground">
              Las imágenes serán generadas por IA y optimizadas para el artículo
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />
              El sistema generará:
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1 ml-6">
              <li>• Investigación SEO y análisis de competencia</li>
              <li>• Estructura optimizada con H1, H2, H3...</li>
              <li>• Contenido HTML listo para publicar</li>
              <li>• {imageCount} imagen{imageCount !== 1 ? 'es' : ''} generada{imageCount !== 1 ? 's' : ''} por IA</li>
              <li>• Meta tags y datos estructurados</li>
              <li>• Puntuación SEO y métricas</li>
            </ul>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={!topic.trim() || generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generando artículo... (puede tardar 1-2 minutos)
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generar Artículo SEO
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
