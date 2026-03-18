import { cn } from '@/lib/utils';
import {
  Palette, Type, RotateCcw, Bot, Send, Loader2,
  ChevronRight, Save, Trash2, Download, FolderOpen,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSidebarConfig } from '@/hooks/useSidebarConfig';
import {
  useCustomTheme,
  COLOR_PRESETS,
  FONT_FAMILIES,
  FONT_SIZE_OPTIONS,
  SIDEBAR_STYLE_OPTIONS,
  type FontFamily,
  type FontSizeScale,
  type CustomColors,
} from '@/hooks/useCustomTheme';
import { Layers } from 'lucide-react';
import {
  SectionHeader, ColorsTabContent, LayoutTabContent,
} from './ThemeCustomizerTabs';

export function ThemeCustomizer() {
  const { customTheme, updateTheme, resetTheme, savedThemes, saveCurrentTheme, loadSavedTheme, deleteSavedTheme } = useCustomTheme();
  const { categories, setSidebarPosition, toggleItemVisibility } = useSidebarConfig();
  const [open, setOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saveThemeName, setSaveThemeName] = useState('');

  const handleAIGenerate = useCallback(async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-theme', {
        body: { prompt: aiPrompt, currentTheme: customTheme },
      });
      if (error) throw error;
      if (data?.theme) {
        const theme = data.theme;
        const updates: Record<string, unknown> = {};
        if (theme.customColors) { updates.colorPreset = 'custom'; updates.customColors = theme.customColors; }
        if (theme.backgroundPattern) updates.backgroundPattern = theme.backgroundPattern;
        if (theme.fontFamily) updates.fontFamily = theme.fontFamily;
        if (theme.borderRadius) updates.borderRadius = theme.borderRadius;
        if (theme.sidebarStyle) updates.sidebarStyle = theme.sidebarStyle;
        if (theme.animationSpeed) updates.animationSpeed = theme.animationSpeed;
        updateTheme(updates as any);

        if (theme.sidebarConfig) {
          if (theme.sidebarConfig.sidebarPosition) setSidebarPosition(theme.sidebarConfig.sidebarPosition);
          if (theme.sidebarConfig.visibleModules && categories.length > 0) {
            const visibleSet = new Set(theme.sidebarConfig.visibleModules as string[]);
            for (const cat of categories) {
              for (const item of cat.items) {
                const shouldBeVisible = visibleSet.has(item.id);
                if (shouldBeVisible === !!item.hidden) toggleItemVisibility(cat.id, item.id);
              }
            }
          }
        }
        toast.success('¡Tema completo generado por IA aplicado!');
        setAiPrompt('');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error al generar el tema');
    } finally { setAiLoading(false); }
  }, [aiPrompt, aiLoading, customTheme, updateTheme, categories, setSidebarPosition, toggleItemVisibility]);

  const customColors = customTheme.customColors || {};
  const updateCustomColor = (key: keyof CustomColors, value: string) => {
    updateTheme({ colorPreset: 'custom', customColors: { ...customColors, [key]: value } });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover:bg-sidebar-accent/50 group")}>
          <Palette className="w-5 h-5 flex-shrink-0 text-accent" />
          <span className="text-sm font-semibold flex-1 text-left">Personalizar</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-hidden flex flex-col bg-background p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Palette className="w-5 h-5 text-primary" />Personalizar Apariencia
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="colors" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="mx-6 grid grid-cols-5 mb-2">
            <TabsTrigger value="colors" className="text-xs gap-1"><Palette className="w-3.5 h-3.5" /> Colores</TabsTrigger>
            <TabsTrigger value="layout" className="text-xs gap-1"><Layers className="w-3.5 h-3.5" /> Interfaz</TabsTrigger>
            <TabsTrigger value="typography" className="text-xs gap-1"><Type className="w-3.5 h-3.5" /> Texto</TabsTrigger>
            <TabsTrigger value="saved" className="text-xs gap-1"><Save className="w-3.5 h-3.5" /> Temas</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs gap-1"><Bot className="w-3.5 h-3.5" /> IA</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <TabsContent value="colors" className="mt-0">
              <ColorsTabContent customTheme={customTheme} updateTheme={updateTheme} customColors={customColors} updateCustomColor={updateCustomColor} />
            </TabsContent>

            <TabsContent value="layout" className="mt-0">
              <LayoutTabContent customTheme={customTheme} updateTheme={updateTheme} />
            </TabsContent>

            {/* TYPOGRAPHY TAB */}
            <TabsContent value="typography" className="mt-0 space-y-6">
              <div>
                <SectionHeader icon={Type} label="Familia tipográfica" />
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(FONT_FAMILIES) as [FontFamily, typeof FONT_FAMILIES[FontFamily]][]).map(([key, font]) => (
                    <button key={key} onClick={() => updateTheme({ fontFamily: key })}
                      className={cn("px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left",
                        customTheme.fontFamily === key ? "ring-2 ring-primary bg-muted" : "hover:bg-muted/50")}
                      style={{ fontFamily: font.family }}>{font.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <SectionHeader icon={Type} label="Tamaño de fuente" />
                <div className="grid grid-cols-5 gap-2">
                  {(Object.entries(FONT_SIZE_OPTIONS) as [FontSizeScale, typeof FONT_SIZE_OPTIONS[FontSizeScale]][]).map(([key, opt]) => (
                    <button key={key} onClick={() => updateTheme({ fontSize: key })}
                      className={cn("px-2 py-2 rounded-lg text-xs font-medium transition-all text-center",
                        customTheme.fontSize === key ? "ring-2 ring-primary bg-muted" : "hover:bg-muted/50")}>{opt.label}</button>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* SAVED THEMES TAB */}
            <TabsContent value="saved" className="mt-0 space-y-6">
              <div>
                <SectionHeader icon={Save} label="Guardar tema actual" />
                <div className="flex gap-2">
                  <Input value={saveThemeName} onChange={(e) => setSaveThemeName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && saveThemeName.trim()) { saveCurrentTheme(saveThemeName.trim()); setSaveThemeName(''); toast.success('Tema guardado correctamente'); } }}
                    placeholder="Nombre del tema..." className="flex-1" />
                  <Button size="sm" disabled={!saveThemeName.trim()} onClick={() => { saveCurrentTheme(saveThemeName.trim()); setSaveThemeName(''); toast.success('Tema guardado correctamente'); }} className="gap-1.5">
                    <Save className="w-3.5 h-3.5" /> Guardar
                  </Button>
                </div>
              </div>
              <div>
                <SectionHeader icon={FolderOpen} label="Temas guardados" />
                {savedThemes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Save className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No tienes temas guardados</p>
                    <p className="text-xs mt-1">Personaliza la apariencia y guárdala para reutilizarla después</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedThemes.map((saved) => (
                      <div key={saved.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card/30 hover:bg-card/60 transition-colors group">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-foreground block truncate">{saved.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {saved.theme.colorPreset !== 'custom' ? COLOR_PRESETS[saved.theme.colorPreset]?.label : 'Personalizado'}
                            {' · '}{FONT_FAMILIES[saved.theme.fontFamily]?.label}
                            {' · '}{SIDEBAR_STYLE_OPTIONS[saved.theme.sidebarStyle]?.label}
                          </span>
                        </div>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => { loadSavedTheme(saved.id); toast.success(`Tema "${saved.name}" aplicado`); }}>
                          <Download className="w-3 h-3" /> Aplicar
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                          onClick={() => { deleteSavedTheme(saved.id); toast.success('Tema eliminado'); }}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* AI TAB */}
            <TabsContent value="ai" className="mt-0 space-y-6">
              <div>
                <SectionHeader icon={Bot} label="Personalización completa con IA" />
                <p className="text-sm text-muted-foreground mb-2">Describe cómo quieres tu aplicación. La IA modificará <strong>colores, sidebar, tipografía, estados de leads, estampados y organización de módulos</strong>.</p>
                <p className="text-xs text-muted-foreground/70 mb-4">Puedes pedir cosas como "solo quiero ver leads, WhatsApp y calendario" o "sidebar a la derecha con tema neón".</p>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAIGenerate()}
                      placeholder="Ej: CRM minimalista oscuro, solo leads y calendario, sidebar derecho..." disabled={aiLoading} className="flex-1" />
                    <Button onClick={handleAIGenerate} disabled={aiLoading || !aiPrompt.trim()} size="icon">
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {['Tema corporativo azul, solo módulos esenciales', 'Diseño cálido con tonos tierra, sidebar cristal',
                      'Estilo neón futurista, sidebar a la derecha', 'Minimalista: solo leads, WhatsApp y calendario',
                      'Tema naturaleza con sidebar transparente', 'CRM de ventas agresivo, colores vivos, todos los módulos',
                    ].map((suggestion) => (
                      <button key={suggestion} onClick={() => setAiPrompt(suggestion)}
                        className="text-xs text-left px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground">{suggestion}</button>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="px-6 py-3 border-t border-border flex justify-between items-center">
          <button onClick={resetTheme} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />Restaurar por defecto
          </button>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
