import { cn } from '@/lib/utils';
import { 
  Palette, Type, Wallpaper, RotateCcw, Circle, TextCursor, 
  Layers, Sparkles, Zap, Eye, Bot, Send, Loader2, Pipette,
  ChevronRight, BarChart3
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
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
  BACKGROUND_PATTERNS,
  FONT_FAMILIES,
  BORDER_RADIUS_OPTIONS,
  FONT_SIZE_OPTIONS,
  UI_DENSITY_OPTIONS,
  SIDEBAR_STYLE_OPTIONS,
  ANIMATION_SPEED_OPTIONS,
  type ColorPreset,
  type BackgroundPattern,
  type FontFamily,
  type BorderRadiusSize,
  type FontSizeScale,
  type UIDensity,
  type SidebarStyle,
  type AnimationSpeed,
  type CustomColors,
} from '@/hooks/useCustomTheme';

function SectionHeader({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-primary" />
      <span className="text-xs font-bold uppercase tracking-wider text-foreground">{label}</span>
    </div>
  );
}

function ColorPickerInput({ 
  label, value, onChange 
}: { 
  label: string; value: string; onChange: (v: string) => void 
}) {
  // Convert HSL string "H S% L%" to hex for the color picker
  const hslToHex = (hsl: string): string => {
    try {
      const parts = hsl.trim().split(/\s+/);
      const h = parseFloat(parts[0]) || 0;
      const s = (parseFloat(parts[1]) || 0) / 100;
      const l = (parseFloat(parts[2]) || 0) / 100;
      const a = s * Math.min(l, 1 - l);
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      };
      return `#${f(0)}${f(8)}${f(4)}`;
    } catch { return '#6366f1'; }
  };

  const hexToHsl = (hex: string): string => {
    try {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
          case g: h = ((b - r) / d + 2) * 60; break;
          case b: h = ((r - g) / d + 4) * 60; break;
        }
      }
      return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    } catch { return '0 0% 50%'; }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <input
          type="color"
          value={hslToHex(value)}
          onChange={(e) => onChange(hexToHsl(e.target.value))}
          className="w-8 h-8 rounded-lg cursor-pointer border border-border overflow-hidden"
          style={{ padding: 0 }}
        />
      </div>
      <span className="text-xs text-muted-foreground flex-1 truncate">{label}</span>
      <code className="text-[9px] text-muted-foreground/60 font-mono">{value}</code>
    </div>
  );
}

export function ThemeCustomizer() {
  const { customTheme, updateTheme, resetTheme } = useCustomTheme();
  const { categories, setSidebarPosition, toggleItemVisibility } = useSidebarConfig();
  const [open, setOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

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
        if (theme.customColors) {
          updates.colorPreset = 'custom';
          updates.customColors = theme.customColors;
        }
        if (theme.backgroundPattern) updates.backgroundPattern = theme.backgroundPattern;
        if (theme.fontFamily) updates.fontFamily = theme.fontFamily;
        if (theme.borderRadius) updates.borderRadius = theme.borderRadius;
        if (theme.sidebarStyle) updates.sidebarStyle = theme.sidebarStyle;
        if (theme.animationSpeed) updates.animationSpeed = theme.animationSpeed;
        updateTheme(updates as any);

        // Apply sidebar config from AI
        if (theme.sidebarConfig) {
          if (theme.sidebarConfig.sidebarPosition) {
            setSidebarPosition(theme.sidebarConfig.sidebarPosition);
          }
          if (theme.sidebarConfig.visibleModules && categories.length > 0) {
            const visibleSet = new Set(theme.sidebarConfig.visibleModules as string[]);
            // Toggle visibility for each item based on AI response
            for (const cat of categories) {
              for (const item of cat.items) {
                const shouldBeVisible = visibleSet.has(item.id);
                const isCurrentlyHidden = !!item.hidden;
                if (shouldBeVisible === isCurrentlyHidden) {
                  toggleItemVisibility(cat.id, item.id);
                }
              }
            }
          }
        }

        toast.success('¡Tema completo generado por IA aplicado!');
        setAiPrompt('');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error al generar el tema');
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, aiLoading, customTheme, updateTheme, categories, setSidebarPosition, toggleItemVisibility]);

  const customColors = customTheme.customColors || {};
  const updateCustomColor = (key: keyof CustomColors, value: string) => {
    updateTheme({
      colorPreset: 'custom',
      customColors: { ...customColors, [key]: value },
    });
  };

  // Filter out 'custom' from the grid of preset buttons
  const presetEntries = (Object.entries(COLOR_PRESETS) as [ColorPreset, typeof COLOR_PRESETS[ColorPreset]][])
    .filter(([key]) => key !== 'custom');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
            "hover:bg-sidebar-accent/50 group"
          )}
        >
          <Palette className="w-5 h-5 flex-shrink-0 text-accent" />
          <span className="text-sm font-semibold flex-1 text-left">Personalizar</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-hidden flex flex-col bg-background p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Palette className="w-5 h-5 text-primary" />
            Personalizar Apariencia
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="colors" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="mx-6 grid grid-cols-4 mb-2">
            <TabsTrigger value="colors" className="text-xs gap-1">
              <Palette className="w-3.5 h-3.5" /> Colores
            </TabsTrigger>
            <TabsTrigger value="layout" className="text-xs gap-1">
              <Layers className="w-3.5 h-3.5" /> Interfaz
            </TabsTrigger>
            <TabsTrigger value="typography" className="text-xs gap-1">
              <Type className="w-3.5 h-3.5" /> Tipografía
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs gap-1">
              <Bot className="w-3.5 h-3.5" /> IA
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {/* COLORS TAB */}
            <TabsContent value="colors" className="mt-0 space-y-6">
              {/* Preset palettes */}
              <div>
                <SectionHeader icon={Palette} label="Paletas predefinidas" />
                <div className="grid grid-cols-5 gap-2">
                  {presetEntries.map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => updateTheme({ colorPreset: key, customColors: undefined })}
                      title={preset.label}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                        customTheme.colorPreset === key
                          ? "ring-2 ring-primary bg-muted scale-105"
                          : "hover:bg-muted/50 hover:scale-105"
                      )}
                    >
                      <div
                        className="w-8 h-8 rounded-full shadow-sm border border-border"
                        style={{ backgroundColor: preset.preview }}
                      />
                      <span className="text-[10px] font-medium truncate w-full text-center">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom color picker */}
              <div>
                <SectionHeader icon={Pipette} label="Colores personalizados" />
                <p className="text-xs text-muted-foreground mb-3">Elige colores exactos para cada elemento de la interfaz.</p>
                <div className="grid grid-cols-2 gap-3">
                  <ColorPickerInput label="Primario" value={customColors.primary || '224 50% 55%'} onChange={(v) => updateCustomColor('primary', v)} />
                  <ColorPickerInput label="Secundario" value={customColors.secondary || '232 23% 45%'} onChange={(v) => updateCustomColor('secondary', v)} />
                  <ColorPickerInput label="Acento" value={customColors.accent || '25 95% 53%'} onChange={(v) => updateCustomColor('accent', v)} />
                  <ColorPickerInput label="Fondo" value={customColors.background || '222 47% 11%'} onChange={(v) => updateCustomColor('background', v)} />
                  <ColorPickerInput label="Texto" value={customColors.foreground || '0 0% 98%'} onChange={(v) => updateCustomColor('foreground', v)} />
                  <ColorPickerInput label="Tarjetas" value={customColors.card || '222 47% 14%'} onChange={(v) => updateCustomColor('card', v)} />
                  <ColorPickerInput label="Atenuado" value={customColors.muted || '222 47% 18%'} onChange={(v) => updateCustomColor('muted', v)} />
                  <ColorPickerInput label="Bordes" value={customColors.border || '222 47% 20%'} onChange={(v) => updateCustomColor('border', v)} />
                  <ColorPickerInput label="Sidebar fondo" value={customColors.sidebarBackground || '222 47% 8%'} onChange={(v) => updateCustomColor('sidebarBackground', v)} />
                  <ColorPickerInput label="Sidebar texto" value={customColors.sidebarForeground || '0 0% 98%'} onChange={(v) => updateCustomColor('sidebarForeground', v)} />
                  <ColorPickerInput label="Sidebar acento" value={customColors.sidebarAccent || '222 47% 14%'} onChange={(v) => updateCustomColor('sidebarAccent', v)} />
                  <ColorPickerInput label="Sidebar borde" value={customColors.sidebarBorder || '222 47% 18%'} onChange={(v) => updateCustomColor('sidebarBorder', v)} />
                </div>
              </div>

              {/* Status & Semantic colors */}
              <div>
                <SectionHeader icon={BarChart3} label="Colores de estados y widgets" />
                <p className="text-xs text-muted-foreground mb-3">Colores para estados de leads, gráficos y alertas.</p>
                <div className="grid grid-cols-2 gap-3">
                  <ColorPickerInput label="Lead Nuevo" value={customColors.statusNew || '210 100% 55%'} onChange={(v) => updateCustomColor('statusNew', v)} />
                  <ColorPickerInput label="Lead Contactado" value={customColors.statusContacted || '45 93% 55%'} onChange={(v) => updateCustomColor('statusContacted', v)} />
                  <ColorPickerInput label="Lead Interesado" value={customColors.statusInterested || '142 71% 50%'} onChange={(v) => updateCustomColor('statusInterested', v)} />
                  <ColorPickerInput label="Lead Cliente" value={customColors.statusClient || '224 50% 55%'} onChange={(v) => updateCustomColor('statusClient', v)} />
                  <ColorPickerInput label="Éxito" value={customColors.success || '142 71% 45%'} onChange={(v) => updateCustomColor('success', v)} />
                  <ColorPickerInput label="Advertencia" value={customColors.warning || '45 93% 47%'} onChange={(v) => updateCustomColor('warning', v)} />
                  <ColorPickerInput label="Información" value={customColors.info || '210 100% 50%'} onChange={(v) => updateCustomColor('info', v)} />
                </div>
              </div>

              {/* Background pattern */}
              <div>
                <SectionHeader icon={Wallpaper} label="Estampado de fondo" />
                <div className="grid grid-cols-5 gap-2">
                  {(Object.entries(BACKGROUND_PATTERNS) as [BackgroundPattern, typeof BACKGROUND_PATTERNS[BackgroundPattern]][]).map(([key, pattern]) => (
                    <button
                      key={key}
                      onClick={() => updateTheme({ backgroundPattern: key })}
                      className={cn(
                        "px-3 py-2 rounded-lg text-xs font-medium transition-all",
                        customTheme.backgroundPattern === key
                          ? "ring-2 ring-primary bg-muted"
                          : "hover:bg-muted/50"
                      )}
                    >
                      {pattern.label}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* LAYOUT TAB */}
            <TabsContent value="layout" className="mt-0 space-y-6">
              {/* Border radius */}
              <div>
                <SectionHeader icon={Circle} label="Bordes redondeados" />
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(BORDER_RADIUS_OPTIONS) as [BorderRadiusSize, typeof BORDER_RADIUS_OPTIONS[BorderRadiusSize]][]).map(([key, opt]) => (
                    <button
                      key={key}
                      onClick={() => updateTheme({ borderRadius: key })}
                      className={cn(
                        "px-3 py-2 text-xs font-medium transition-all",
                        customTheme.borderRadius === key
                          ? "ring-2 ring-primary bg-muted"
                          : "hover:bg-muted/50"
                      )}
                      style={{ borderRadius: opt.value }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* UI Density */}
              <div>
                <SectionHeader icon={Layers} label="Densidad de interfaz" />
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(UI_DENSITY_OPTIONS) as [UIDensity, typeof UI_DENSITY_OPTIONS[UIDensity]][]).map(([key, opt]) => (
                    <button
                      key={key}
                      onClick={() => updateTheme({ uiDensity: key })}
                      className={cn(
                        "px-3 py-2 rounded-lg text-xs font-medium transition-all",
                        customTheme.uiDensity === key
                          ? "ring-2 ring-primary bg-muted"
                          : "hover:bg-muted/50"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sidebar style */}
              <div>
                <SectionHeader icon={Sparkles} label="Estilo del sidebar" />
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(SIDEBAR_STYLE_OPTIONS) as [SidebarStyle, typeof SIDEBAR_STYLE_OPTIONS[SidebarStyle]][]).map(([key, opt]) => (
                    <button
                      key={key}
                      onClick={() => updateTheme({ sidebarStyle: key })}
                      className={cn(
                        "px-3 py-2 rounded-lg text-xs font-medium transition-all",
                        customTheme.sidebarStyle === key
                          ? "ring-2 ring-primary bg-muted"
                          : "hover:bg-muted/50"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Animation speed */}
              <div>
                <SectionHeader icon={Zap} label="Velocidad de animación" />
                <div className="grid grid-cols-4 gap-2">
                  {(Object.entries(ANIMATION_SPEED_OPTIONS) as [AnimationSpeed, typeof ANIMATION_SPEED_OPTIONS[AnimationSpeed]][]).map(([key, opt]) => (
                    <button
                      key={key}
                      onClick={() => updateTheme({ animationSpeed: key })}
                      className={cn(
                        "px-2 py-2 rounded-lg text-xs font-medium transition-all",
                        customTheme.animationSpeed === key
                          ? "ring-2 ring-primary bg-muted"
                          : "hover:bg-muted/50"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Blur effect toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Wallpaper className="w-4 h-4 text-primary" />
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider block">Efecto blur (glassmorphism)</span>
                    <span className="text-[10px] text-muted-foreground">Aplica desenfoque a tarjetas y diálogos</span>
                  </div>
                </div>
                <Switch
                  checked={customTheme.sidebarStyle === 'glass'}
                  onCheckedChange={(checked) => updateTheme({ sidebarStyle: checked ? 'glass' : 'solid' })}
                />
              </div>

              {/* High contrast */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider block">Alto contraste</span>
                    <span className="text-[10px] text-muted-foreground">Mayor contraste entre elementos</span>
                  </div>
                </div>
                <Switch
                  checked={customTheme.highContrast}
                  onCheckedChange={(checked) => updateTheme({ highContrast: checked })}
                />
              </div>

              {/* Live Preview */}
              <div>
                <SectionHeader icon={Eye} label="Vista previa" />
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="bg-card p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">Título de ejemplo</div>
                        <div className="text-[10px] text-muted-foreground">Texto secundario de referencia</div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="px-2 py-1 rounded bg-primary text-primary-foreground text-[10px] font-medium">Primario</div>
                      <div className="px-2 py-1 rounded bg-secondary text-secondary-foreground text-[10px] font-medium">Secundario</div>
                      <div className="px-2 py-1 rounded bg-accent text-accent-foreground text-[10px] font-medium">Acento</div>
                      <div className="px-2 py-1 rounded bg-destructive text-destructive-foreground text-[10px] font-medium">Peligro</div>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="px-2 py-1 rounded bg-muted text-muted-foreground text-[10px]">Atenuado</div>
                      <div className="px-2 py-1 rounded border border-border text-foreground text-[10px]">Borde</div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TYPOGRAPHY TAB */}
            <TabsContent value="typography" className="mt-0 space-y-6">
              {/* Font family */}
              <div>
                <SectionHeader icon={Type} label="Familia tipográfica" />
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(FONT_FAMILIES) as [FontFamily, typeof FONT_FAMILIES[FontFamily]][]).map(([key, font]) => (
                    <button
                      key={key}
                      onClick={() => updateTheme({ fontFamily: key })}
                      className={cn(
                        "px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left",
                        customTheme.fontFamily === key
                          ? "ring-2 ring-primary bg-muted"
                          : "hover:bg-muted/50"
                      )}
                      style={{ fontFamily: font.family }}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font size */}
              <div>
                <SectionHeader icon={TextCursor} label="Tamaño de fuente" />
                <div className="grid grid-cols-5 gap-2">
                  {(Object.entries(FONT_SIZE_OPTIONS) as [FontSizeScale, typeof FONT_SIZE_OPTIONS[FontSizeScale]][]).map(([key, opt]) => (
                    <button
                      key={key}
                      onClick={() => updateTheme({ fontSize: key })}
                      className={cn(
                        "px-2 py-2 rounded-lg text-xs font-medium transition-all text-center",
                        customTheme.fontSize === key
                          ? "ring-2 ring-primary bg-muted"
                          : "hover:bg-muted/50"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* AI TAB */}
            <TabsContent value="ai" className="mt-0 space-y-6">
              <div>
                <SectionHeader icon={Bot} label="Personalización completa con IA" />
                <p className="text-sm text-muted-foreground mb-2">
                  Describe cómo quieres tu aplicación. La IA modificará <strong>colores, sidebar, tipografía, estados de leads, estampados y organización de módulos</strong>.
                </p>
                <p className="text-xs text-muted-foreground/70 mb-4">
                  Puedes pedir cosas como "solo quiero ver leads, WhatsApp y calendario" o "sidebar a la derecha con tema neón".
                </p>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAIGenerate()}
                      placeholder="Ej: CRM minimalista oscuro, solo leads y calendario, sidebar derecho..."
                      disabled={aiLoading}
                      className="flex-1"
                    />
                    <Button onClick={handleAIGenerate} disabled={aiLoading || !aiPrompt.trim()} size="icon">
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Tema corporativo azul, solo módulos esenciales',
                      'Diseño cálido con tonos tierra, sidebar cristal',
                      'Estilo neón futurista, sidebar a la derecha',
                      'Minimalista: solo leads, WhatsApp y calendario',
                      'Tema naturaleza con sidebar transparente',
                      'CRM de ventas agresivo, colores vivos, todos los módulos',
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setAiPrompt(suggestion)}
                        className="text-xs text-left px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer with reset */}
        <div className="px-6 py-3 border-t border-border flex justify-between items-center">
          <button
            onClick={resetTheme}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar por defecto
          </button>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
