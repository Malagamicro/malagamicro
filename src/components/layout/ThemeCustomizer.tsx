import { cn } from '@/lib/utils';
import { Palette, Type, Wallpaper, RotateCcw, ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import {
  useCustomTheme,
  COLOR_PRESETS,
  BACKGROUND_PATTERNS,
  FONT_FAMILIES,
  type ColorPreset,
  type BackgroundPattern,
  type FontFamily,
} from '@/hooks/useCustomTheme';

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
      <CollapsibleContent className="pl-3 pr-1 space-y-4 mt-2 mb-2 animate-accordion-down">
        {/* Color presets */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Palette className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Colores</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.entries(COLOR_PRESETS) as [ColorPreset, typeof COLOR_PRESETS[ColorPreset]][]).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => updateTheme({ colorPreset: key })}
                className={cn(
                  "flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all text-[9px] font-medium",
                  customTheme.colorPreset === key
                    ? "ring-2 ring-primary bg-sidebar-accent"
                    : "hover:bg-sidebar-accent/50"
                )}
              >
                <div
                  className="w-6 h-6 rounded-full shadow-sm border border-white/20"
                  style={{ backgroundColor: preset.preview }}
                />
                <span className="truncate w-full text-center">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Background pattern */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Wallpaper className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Fondo</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.entries(BACKGROUND_PATTERNS) as [BackgroundPattern, typeof BACKGROUND_PATTERNS[BackgroundPattern]][]).map(([key, pattern]) => (
              <button
                key={key}
                onClick={() => updateTheme({ backgroundPattern: key })}
                className={cn(
                  "px-2 py-1.5 rounded-md text-[10px] font-medium transition-all",
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
          <div className="flex items-center gap-1.5 mb-2">
            <Type className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tipografía</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.entries(FONT_FAMILIES) as [FontFamily, typeof FONT_FAMILIES[FontFamily]][]).map(([key, font]) => (
              <button
                key={key}
                onClick={() => updateTheme({ fontFamily: key })}
                className={cn(
                  "px-2 py-1.5 rounded-md text-[10px] font-medium transition-all text-left",
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

        {/* Reset */}
        <button
          onClick={resetTheme}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:bg-sidebar-accent transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Restaurar tema</span>
        </button>
      </CollapsibleContent>
    </Collapsible>
  );
}
