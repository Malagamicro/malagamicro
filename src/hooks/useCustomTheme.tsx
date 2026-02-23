import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ColorPreset = 'default' | 'ocean' | 'forest' | 'sunset' | 'berry' | 'slate' | 'midnight' | 'copper';
export type BackgroundPattern = 'none' | 'dots' | 'grid' | 'diagonal' | 'waves' | 'cross';
export type FontFamily = 'dm-sans' | 'inter' | 'poppins' | 'nunito' | 'outfit' | 'work-sans' | 'space-grotesk' | 'raleway';

export interface CustomTheme {
  colorPreset: ColorPreset;
  backgroundPattern: BackgroundPattern;
  fontFamily: FontFamily;
}

const DEFAULT_THEME: CustomTheme = {
  colorPreset: 'default',
  backgroundPattern: 'none',
  fontFamily: 'dm-sans',
};

// Color presets with HSL values for light and dark modes
export const COLOR_PRESETS: Record<ColorPreset, { 
  label: string; 
  preview: string;
  light: { primary: string; accent: string; sidebar: string };
  dark: { primary: string; accent: string; sidebar: string };
}> = {
  default: {
    label: 'MalagaMicro',
    preview: '#3C4E8C',
    light: { primary: '224 40% 39%', accent: '25 95% 53%', sidebar: '224 40% 39%' },
    dark: { primary: '224 50% 55%', accent: '25 95% 53%', sidebar: '222 47% 8%' },
  },
  ocean: {
    label: 'Océano',
    preview: '#0891b2',
    light: { primary: '192 91% 37%', accent: '172 66% 50%', sidebar: '192 91% 25%' },
    dark: { primary: '192 75% 50%', accent: '172 66% 50%', sidebar: '192 91% 8%' },
  },
  forest: {
    label: 'Bosque',
    preview: '#16a34a',
    light: { primary: '142 72% 37%', accent: '84 81% 44%', sidebar: '142 72% 22%' },
    dark: { primary: '142 60% 50%', accent: '84 81% 44%', sidebar: '142 72% 8%' },
  },
  sunset: {
    label: 'Atardecer',
    preview: '#ea580c',
    light: { primary: '21 90% 48%', accent: '346 77% 50%', sidebar: '21 90% 28%' },
    dark: { primary: '21 80% 55%', accent: '346 77% 50%', sidebar: '21 90% 8%' },
  },
  berry: {
    label: 'Frutos',
    preview: '#9333ea',
    light: { primary: '271 81% 56%', accent: '330 81% 60%', sidebar: '271 81% 30%' },
    dark: { primary: '271 70% 65%', accent: '330 81% 60%', sidebar: '271 81% 8%' },
  },
  slate: {
    label: 'Pizarra',
    preview: '#475569',
    light: { primary: '215 19% 35%', accent: '210 40% 52%', sidebar: '215 19% 25%' },
    dark: { primary: '215 19% 55%', accent: '210 40% 52%', sidebar: '215 19% 8%' },
  },
  midnight: {
    label: 'Medianoche',
    preview: '#1e1b4b',
    light: { primary: '244 47% 20%', accent: '262 83% 58%', sidebar: '244 47% 15%' },
    dark: { primary: '244 47% 55%', accent: '262 83% 58%', sidebar: '244 47% 6%' },
  },
  copper: {
    label: 'Cobre',
    preview: '#b45309',
    light: { primary: '32 95% 37%', accent: '15 75% 48%', sidebar: '32 60% 25%' },
    dark: { primary: '32 80% 52%', accent: '15 75% 48%', sidebar: '32 60% 8%' },
  },
};

export const BACKGROUND_PATTERNS: Record<BackgroundPattern, { label: string; css: string }> = {
  none: { label: 'Ninguno', css: '' },
  dots: {
    label: 'Puntos',
    css: 'radial-gradient(circle, hsl(var(--foreground) / 0.05) 1px, transparent 1px)',
  },
  grid: {
    label: 'Cuadrícula',
    css: 'linear-gradient(hsl(var(--foreground) / 0.03) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.03) 1px, transparent 1px)',
  },
  diagonal: {
    label: 'Diagonal',
    css: 'repeating-linear-gradient(45deg, transparent, transparent 10px, hsl(var(--foreground) / 0.02) 10px, hsl(var(--foreground) / 0.02) 11px)',
  },
  waves: {
    label: 'Ondas',
    css: 'radial-gradient(ellipse at 50% 0%, hsl(var(--primary) / 0.04) 0%, transparent 60%)',
  },
  cross: {
    label: 'Cruz',
    css: 'linear-gradient(hsl(var(--foreground) / 0.03) 1.5px, transparent 1.5px), linear-gradient(90deg, hsl(var(--foreground) / 0.03) 1.5px, transparent 1.5px)',
  },
};

export const FONT_FAMILIES: Record<FontFamily, { label: string; import: string; family: string }> = {
  'dm-sans': {
    label: 'DM Sans',
    import: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap",
    family: "'DM Sans', system-ui, sans-serif",
  },
  inter: {
    label: 'Inter',
    import: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
    family: "'Inter', system-ui, sans-serif",
  },
  poppins: {
    label: 'Poppins',
    import: "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap",
    family: "'Poppins', system-ui, sans-serif",
  },
  nunito: {
    label: 'Nunito',
    import: "https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700;800&display=swap",
    family: "'Nunito', system-ui, sans-serif",
  },
  outfit: {
    label: 'Outfit',
    import: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap",
    family: "'Outfit', system-ui, sans-serif",
  },
  'work-sans': {
    label: 'Work Sans',
    import: "https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;500;600;700&display=swap",
    family: "'Work Sans', system-ui, sans-serif",
  },
  'space-grotesk': {
    label: 'Space Grotesk',
    import: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
    family: "'Space Grotesk', system-ui, sans-serif",
  },
  raleway: {
    label: 'Raleway',
    import: "https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap",
    family: "'Raleway', system-ui, sans-serif",
  },
};

const PATTERN_SIZES: Record<BackgroundPattern, string> = {
  none: '',
  dots: '20px 20px',
  grid: '24px 24px, 24px 24px',
  diagonal: '',
  waves: '',
  cross: '16px 16px, 16px 16px',
};

function applyColorPreset(preset: ColorPreset, isDark: boolean) {
  const config = COLOR_PRESETS[preset];
  if (!config) return;
  const mode = isDark ? config.dark : config.light;
  const root = document.documentElement;
  root.style.setProperty('--primary', mode.primary);
  root.style.setProperty('--ring', mode.primary);
  root.style.setProperty('--accent', mode.accent);
  root.style.setProperty('--sidebar-background', mode.sidebar);
}

function applyBackgroundPattern(pattern: BackgroundPattern) {
  const config = BACKGROUND_PATTERNS[pattern];
  const main = document.querySelector('main') || document.body;
  if (!config.css || pattern === 'none') {
    (main as HTMLElement).style.backgroundImage = '';
    (main as HTMLElement).style.backgroundSize = '';
  } else {
    (main as HTMLElement).style.backgroundImage = config.css;
    const size = PATTERN_SIZES[pattern];
    if (size) (main as HTMLElement).style.backgroundSize = size;
  }
}

function applyFont(font: FontFamily) {
  const config = FONT_FAMILIES[font];
  if (!config) return;

  // Ensure font is loaded
  const existingLink = document.querySelector(`link[data-custom-font]`);
  if (existingLink) existingLink.remove();
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = config.import;
  link.setAttribute('data-custom-font', 'true');
  document.head.appendChild(link);

  document.body.style.fontFamily = config.family;
}

export function useCustomTheme() {
  const { user } = useAuth();
  const [customTheme, setCustomTheme] = useState<CustomTheme>(DEFAULT_THEME);
  const initialized = useRef(false);
  const saving = useRef(false);

  // Load from DB
  useEffect(() => {
    if (!user?.id || initialized.current) return;
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('custom_theme')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.custom_theme && typeof data.custom_theme === 'object') {
        const loaded = { ...DEFAULT_THEME, ...(data.custom_theme as Record<string, unknown>) } as CustomTheme;
        initialized.current = true;
        setCustomTheme(loaded);
      } else {
        initialized.current = true;
      }
    };
    load();
  }, [user?.id]);

  // Apply theme whenever it changes
  useEffect(() => {
    if (!initialized.current) return;
    const isDark = document.documentElement.classList.contains('dark');
    applyColorPreset(customTheme.colorPreset, isDark);
    applyBackgroundPattern(customTheme.backgroundPattern);
    applyFont(customTheme.fontFamily);
  }, [customTheme]);

  // Re-apply colors when dark/light mode changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      applyColorPreset(customTheme.colorPreset, isDark);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [customTheme.colorPreset]);

  // Save to DB
  const saveTheme = useCallback(async (theme: CustomTheme) => {
    if (!user?.id || saving.current) return;
    saving.current = true;
    await supabase
      .from('profiles')
      .update({ custom_theme: theme as unknown as import('@/integrations/supabase/types').Json })
      .eq('user_id', user.id);
    saving.current = false;
  }, [user?.id]);

  const updateTheme = useCallback((partial: Partial<CustomTheme>) => {
    setCustomTheme(prev => {
      const next = { ...prev, ...partial };
      saveTheme(next);
      return next;
    });
  }, [saveTheme]);

  const resetTheme = useCallback(() => {
    setCustomTheme(DEFAULT_THEME);
    saveTheme(DEFAULT_THEME);
    // Reset inline styles
    document.documentElement.style.removeProperty('--primary');
    document.documentElement.style.removeProperty('--ring');
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--sidebar-background');
    const main = document.querySelector('main') || document.body;
    (main as HTMLElement).style.backgroundImage = '';
    (main as HTMLElement).style.backgroundSize = '';
    document.body.style.fontFamily = '';
    const link = document.querySelector('link[data-custom-font]');
    if (link) link.remove();
  }, [saveTheme]);

  return { customTheme, updateTheme, resetTheme };
}
