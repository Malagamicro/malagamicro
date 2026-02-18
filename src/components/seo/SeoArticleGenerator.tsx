import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Loader2, ImageIcon, FlaskConical, Wand2 } from 'lucide-react';

const PRODUCTION_URL = 'https://n8n.malagamicro.com/webhook/generate-seo-article';
const TEST_URL = 'https://n8n.malagamicro.com/webhook-test/generate-seo-article';
const TEST_MODE_KEY = 'seo-generator-test-mode';

interface SeoArticleGeneratorProps {
  onGenerate: (topic: string, imageCount: number, webhookUrl?: string) => Promise<unknown>;
  generating: boolean;
}

export const SeoArticleGenerator = ({ onGenerate, generating }: SeoArticleGeneratorProps) => {
  const [topic, setTopic] = useState('');
  const [imageCount] = useState(1);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    setTestMode(localStorage.getItem(TEST_MODE_KEY) === 'true');
  }, []);

  const handleToggleTest = (checked: boolean) => {
    setTestMode(checked);
    localStorage.setItem(TEST_MODE_KEY, String(checked));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    const url = testMode ? TEST_URL : PRODUCTION_URL;
    await onGenerate(topic.trim(), imageCount, url);
    setTopic('');
  };

  return (
    <Card className="border-primary/20 bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/5">
      <CardContent className="pt-5 pb-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="topic" className="text-sm font-medium flex items-center gap-1.5">
              <Wand2 className="h-3.5 w-3.5 text-primary" />
              Tema del artículo
            </Label>
            <Input
              id="topic"
              placeholder="Ej: Mejores prácticas de IA en 2026"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={generating}
              className="h-11 text-base"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <ImageIcon className="h-3.5 w-3.5 shrink-0" />
            1 imagen generada por IA e incrustada automáticamente
          </div>

          <div className="flex items-center justify-between px-1">
            <Label htmlFor="test-mode" className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <FlaskConical className="h-3.5 w-3.5" />
              Modo test
            </Label>
            <Switch id="test-mode" checked={testMode} onCheckedChange={handleToggleTest} />
          </div>

          <Button 
            type="submit" 
            className="w-full h-11 text-base font-medium shadow-md shadow-primary/20" 
            disabled={!topic.trim() || generating}
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generando... (1-2 min)</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" />Generar Artículo SEO</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
