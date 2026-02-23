import { cn } from '@/lib/utils';
import { Palette, Type, Wallpaper, RotateCcw, ChevronDown, Circle, TextCursor, Layers, Sparkles, Zap, Eye } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { useState } from 'react';
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
} from '@/hooks/useCustomTheme';

function SectionHeader({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

export function ThemeCustomizer() {
  const { customTheme, updateTheme, resetTheme } = useCustomTheme();
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
            "hover:bg-sidebar-accent/50",
            open && "bg-sidebar-accent/30"
          )}
        >
          <Palette className="w-5 h-5 flex-shrink-0 text-accent" />
          <span className="text-sm font-semibold flex-1 text-left">Personalizar</span>
          <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-2 pr-1 space-y-4 mt-2 mb-2 animate-accordion-down max-h-[60vh] overflow-y-auto custom-scrollbar">
        {/* Color presets */}
        <div>
          <SectionHeader icon={Palette} label="Paleta de colores" />
          <div className="grid grid-cols-5 gap-1">
            {(Object.entries(COLOR_PRESETS) as [ColorPreset, typeof COLOR_PRESETS[ColorPreset]][]).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => updateTheme({ colorPreset: key })}
                title={preset.label}
                className={cn(
                  "flex flex-col items-center gap-0.5 p-1 rounded-lg transition-all",
                  customTheme.colorPreset === key
                    ? "ring-2 ring-primary bg-sidebar-accent scale-105"
                    : "hover:bg-sidebar-accent/50 hover:scale-105"
                )}
              >
                <div
                  className="w-5 h-5 rounded-full shadow-sm border border-white/20"
                  style={{ backgroundColor: preset.preview }}
                />
                <span className="text-[8px] truncate w-full text-center leading-tight">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Background pattern */}
        <div>
          <SectionHeader icon={Wallpaper} label="Estampado de fondo" />
          <div className="grid grid-cols-4 gap-1">
            {(Object.entries(BACKGROUND_PATTERNS) as [BackgroundPattern, typeof BACKGROUND_PATTERNS[BackgroundPattern]][]).map(([key, pattern]) => (
              <button
                key={key}
                onClick={() => updateTheme({ backgroundPattern: key })}
                className={cn(
                  "px-1.5 py-1 rounded-md text-[9px] font-medium transition-all",
                  customTheme.backgroundPattern === key
                    ? "ring-2 ring-primary bg-sidebar-accent"
                    : "hover:bg-sidebar-accent/50"
                )}
              >
                {pattern.label}
              </button>
            ))}
          </div>
        </div>

        {/* Font family */}
        <div>
          <SectionHeader icon={Type} label="Tipografía" />
          <div className="grid grid-cols-2 gap-1">
            {(Object.entries(FONT_FAMILIES) as [FontFamily, typeof FONT_FAMILIES[FontFamily]][]).map(([key, font]) => (
              <button
                key={key}
                onClick={() => updateTheme({ fontFamily: key })}
                className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-medium transition-all text-left",
                  customTheme.fontFamily === key
                    ? "ring-2 ring-primary bg-sidebar-accent"
                    : "hover:bg-sidebar-accent/50"
                )}
              >
                {font.label}
              </button>
            ))}
          </div>
        </div>

        {/* Font size */}
        <div>
          <SectionHeader icon={TextCursor} label="Tamaño de fuente" />
          <div className="grid grid-cols-5 gap-1">
            {(Object.entries(FONT_SIZE_OPTIONS) as [FontSizeScale, typeof FONT_SIZE_OPTIONS[FontSizeScale]][]).map(([key, opt]) => (
              <button
                key={key}
                onClick={() => updateTheme({ fontSize: key })}
                className={cn(
                  "px-1 py-1 rounded-md text-[9px] font-medium transition-all text-center",
                  customTheme.fontSize === key
                    ? "ring-2 ring-primary bg-sidebar-accent"
                    : "hover:bg-sidebar-accent/50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Border radius */}
        <div>
          <SectionHeader icon={Circle} label="Bordes" />
          <div className="grid grid-cols-3 gap-1">
            {(Object.entries(BORDER_RADIUS_OPTIONS) as [BorderRadiusSize, typeof BORDER_RADIUS_OPTIONS[BorderRadiusSize]][]).map(([key, opt]) => (
              <button
                key={key}
                onClick={() => updateTheme({ borderRadius: key })}
                className={cn(
                  "px-2 py-1 text-[9px] font-medium transition-all",
                  customTheme.borderRadius === key
                    ? "ring-2 ring-primary bg-sidebar-accent"
                    : "hover:bg-sidebar-accent/50"
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
          <div className="grid grid-cols-3 gap-1">
            {(Object.entries(UI_DENSITY_OPTIONS) as [UIDensity, typeof UI_DENSITY_OPTIONS[UIDensity]][]).map(([key, opt]) => (
              <button
                key={key}
                onClick={() => updateTheme({ uiDensity: key })}
                className={cn(
                  "px-2 py-1 rounded-md text-[9px] font-medium transition-all text-center",
                  customTheme.uiDensity === key
                    ? "ring-2 ring-primary bg-sidebar-accent"
                    : "hover:bg-sidebar-accent/50"
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
          <div className="grid grid-cols-3 gap-1">
            {(Object.entries(SIDEBAR_STYLE_OPTIONS) as [SidebarStyle, typeof SIDEBAR_STYLE_OPTIONS[SidebarStyle]][]).map(([key, opt]) => (
              <button
                key={key}
                onClick={() => updateTheme({ sidebarStyle: key })}
                className={cn(
                  "px-2 py-1 rounded-md text-[9px] font-medium transition-all text-center",
                  customTheme.sidebarStyle === key
                    ? "ring-2 ring-primary bg-sidebar-accent"
                    : "hover:bg-sidebar-accent/50"
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
          <div className="grid grid-cols-4 gap-1">
            {(Object.entries(ANIMATION_SPEED_OPTIONS) as [AnimationSpeed, typeof ANIMATION_SPEED_OPTIONS[AnimationSpeed]][]).map(([key, opt]) => (
              <button
                key={key}
                onClick={() => updateTheme({ animationSpeed: key })}
                className={cn(
                  "px-1 py-1 rounded-md text-[9px] font-medium transition-all text-center",
                  customTheme.animationSpeed === key
                    ? "ring-2 ring-primary bg-sidebar-accent"
                    : "hover:bg-sidebar-accent/50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* High contrast */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Alto contraste</span>
          </div>
          <Switch
            checked={customTheme.highContrast}
            onCheckedChange={(checked) => updateTheme({ highContrast: checked })}
            className="scale-75"
          />
        </div>

        {/* Reset */}
        <button
          onClick={resetTheme}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:bg-sidebar-accent transition-colors border border-sidebar-border/50"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Restaurar por defecto</span>
        </button>
      </CollapsibleContent>
    </Collapsible>
  );
}
