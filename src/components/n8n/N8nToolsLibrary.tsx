import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Copy, Search, Download, BookOpen, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { ApiKeysManager } from './ApiKeysManager';
import { TOOLS, BASE_URL_PLACEHOLDER, METHOD_COLORS, generateN8nJson, N8nTool } from './n8nToolsConstants';

export function N8nToolsLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = ['all', ...Array.from(new Set(TOOLS.map(t => t.category)))];

  const filteredTools = TOOLS.filter(t => {
    const matchesSearch = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = activeCategory === 'all' || t.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const copyJson = (tool: N8nTool) => {
    const json = generateN8nJson(tool);
    navigator.clipboard.writeText(JSON.stringify(json, null, 2));
    toast.success(`JSON de "${tool.name}" copiado. Pégalo en n8n con Ctrl+V`);
  };

  const downloadJson = (tool: N8nTool) => {
    const json = generateN8nJson(tool);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `n8n-tool-${tool.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Cómo usar con n8n
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li><strong className="text-foreground">Genera una API Key</strong> en la sección de arriba.</li>
            <li>En n8n, crea una credencial de tipo <strong className="text-foreground">Header Auth</strong> con nombre <code className="bg-muted px-1 rounded">Authorization</code> y valor <code className="bg-muted px-1 rounded">Bearer TU_API_KEY</code></li>
            <li><strong className="text-foreground">Copia el JSON</strong> de la herramienta que necesites y pégalo en el canvas de n8n (<kbd className="bg-muted px-1 rounded text-xs">Ctrl+V</kbd>).</li>
            <li>Conecta el nodo HTTP Request Tool a tu <strong className="text-foreground">AI Agent</strong> como herramienta.</li>
            <li>Asigna la credencial Bearer Auth que creaste.</li>
          </ol>
          <div className="bg-muted/50 rounded-lg p-3 mt-3 border border-border/50">
            <p className="text-xs font-medium text-foreground mb-1">📌 URL Base de la API:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-background px-2 py-1 rounded flex-1 break-all">{BASE_URL_PLACEHOLDER}</code>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { navigator.clipboard.writeText(BASE_URL_PLACEHOLDER); toast.success('URL copiada'); }}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <ApiKeysManager />

      {/* Tools Library */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Herramientas disponibles ({TOOLS.length})
          </CardTitle>
          <CardDescription>
            Cada herramienta es un nodo HTTP Request Tool listo para n8n. Copia y pega.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar herramienta..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {categories.map(cat => (
                <Button key={cat} variant={activeCategory === cat ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setActiveCategory(cat)}>
                  {cat === 'all' ? 'Todas' : cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Tools Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredTools.map(tool => (
              <div key={tool.id} className="border border-border rounded-lg p-3 space-y-2 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {tool.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">{tool.name}</h4>
                      <p className="text-xs text-muted-foreground">{tool.description}</p>
                    </div>
                  </div>
                  <Badge className={`text-[10px] ${METHOD_COLORS[tool.method] || ''}`} variant="outline">
                    {tool.method}
                  </Badge>
                </div>

                <code className="text-[11px] text-muted-foreground block bg-muted/50 px-2 py-1 rounded break-all">
                  {tool.path}
                </code>

                {tool.bodyFields && (
                  <div className="text-xs space-y-0.5">
                    <span className="font-medium text-muted-foreground">Campos:</span>
                    {tool.bodyFields.map(f => (
                      <div key={f.name} className="flex items-center gap-1 ml-2">
                        <code className="text-primary">{f.name}</code>
                        <span className="text-muted-foreground">({f.type})</span>
                        {f.required && <Badge variant="destructive" className="text-[8px] h-3 px-1">req</Badge>}
                      </div>
                    ))}
                  </div>
                )}

                {tool.queryParams && (
                  <div className="text-xs space-y-0.5">
                    <span className="font-medium text-muted-foreground">Query params:</span>
                    {tool.queryParams.map(p => (
                      <div key={p.name} className="flex items-center gap-1 ml-2">
                        <code className="text-primary">{p.name}</code>
                        <span className="text-muted-foreground">— {p.description}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-1.5 pt-1">
                  <Button size="sm" variant="outline" className="text-xs gap-1 flex-1" onClick={() => copyJson(tool)}>
                    <Copy className="w-3 h-3" /> Copiar JSON
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs gap-1" onClick={() => downloadJson(tool)}>
                    <Download className="w-3 h-3" /> .json
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
