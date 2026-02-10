import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Sparkles, Loader2, ImageIcon, Settings, ChevronDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect } from 'react';

const DEFAULT_WEBHOOK_URL = 'https://n8n.srv1304274.hstgr.cloud/webhook/generate-seo-article';
const STORAGE_KEY = 'seo-generator-webhook-url';

interface SeoArticleGeneratorProps {
  onGenerate: (topic: string, imageCount: number, webhookUrl?: string) => Promise<unknown>;
  generating: boolean;
}

export const SeoArticleGenerator = ({ onGenerate, generating }: SeoArticleGeneratorProps) => {
  const [topic, setTopic] = useState('');
  const [imageCount] = useState(1);
  const [webhookUrl, setWebhookUrl] = useState(DEFAULT_WEBHOOK_URL);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setWebhookUrl(stored);
    }
  }, []);

  const handleSaveWebhook = () => {
    localStorage.setItem(STORAGE_KEY, webhookUrl);
    setSaved(true);
    toast.success('Webhook guardado');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    
    await onGenerate(topic.trim(), imageCount, webhookUrl);
    setTopic('');
  };

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Nuevo Artículo
        </CardTitle>
        <CardDescription className="text-xs">
          Introduce un tema y el sistema generará un artículo SEO completo con imagen
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="topic" className="text-sm">Tema del artículo</Label>
            <Input
              id="topic"
              placeholder="Ej: Mejores prácticas de IA en 2026"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={generating}
              className="h-10"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <ImageIcon className="h-3.5 w-3.5 shrink-0" />
            Se generará 1 imagen por IA optimizada e incrustada en el artículo
          </div>

          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground h-8 text-xs">
                <span className="flex items-center gap-2">
                  <Settings className="h-3.5 w-3.5" />
                  Configuración avanzada
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-2">
              <div className="space-y-1.5">
                <Label htmlFor="webhook" className="text-xs">URL del Webhook n8n</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhook"
                    placeholder="https://n8n.example.com/webhook/..."
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="text-xs h-8"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={handleSaveWebhook}
                    className="shrink-0 h-8 text-xs"
                  >
                    {saved ? <Check className="h-3.5 w-3.5" /> : 'Guardar'}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Usa <code className="bg-muted px-1 rounded">webhook-test</code> para pruebas
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Button 
            type="submit" 
            className="w-full h-10" 
            disabled={!topic.trim() || generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generando... (1-2 min)
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
