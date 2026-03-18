import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Re-export all types and constants for backward compatibility
export type {
  ColorPreset, BackgroundPattern, FontFamily, BorderRadiusSize,
  FontSizeScale, UIDensity, SidebarStyle, AnimationSpeed, ScrollbarStyle,
  CustomColors, CustomTheme, SavedTheme, ColorSystem,
} from './themeConstants';

export {
  DEFAULT_THEME, COLOR_PRESETS, BACKGROUND_PATTERNS, FONT_FAMILIES,
  BORDER_RADIUS_OPTIONS, FONT_SIZE_OPTIONS, UI_DENSITY_OPTIONS,
  SIDEBAR_STYLE_OPTIONS, ANIMATION_SPEED_OPTIONS, SCROLLBAR_STYLE_OPTIONS,
  CSS_VAR_MAP, PATTERN_SIZES,
} from './themeConstants';

import { type CustomTheme, DEFAULT_THEME, CSS_VAR_MAP } from './themeConstants';
import {
  applyColorPreset, applyBackgroundPattern, applyFont, applyBorderRadius,
  applyFontSize, applyUIDensity, applySidebarStyle, applyAnimationSpeed,
  applyScrollbarStyle, applyHighContrast,
} from './themeAppliers';

const SAVED_THEMES_KEY = 'crm-saved-themes';

interface SavedThemeLocal {
  id: string;
  name: string;
  theme: CustomTheme;
  createdAt: string;
}

function loadSavedThemes(): SavedThemeLocal[] {
  try {
    const raw = localStorage.getItem(SAVED_THEMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistSavedThemes(themes: SavedThemeLocal[]) {
  localStorage.setItem(SAVED_THEMES_KEY, JSON.stringify(themes));
}

export function useCustomTheme() {
  const { user } = useAuth();
  const [customTheme, setCustomTheme] = useState<CustomTheme>(DEFAULT_THEME);
  const [savedThemes, setSavedThemes] = useState<SavedThemeLocal[]>(loadSavedThemes);
  const initialized = useRef(false);
  const saving = useRef(false);

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

  useEffect(() => {
    if (!initialized.current) return;
    const isDark = document.documentElement.classList.contains('dark');
    applyColorPreset(customTheme.colorPreset, isDark, customTheme.customColors);
    applyBackgroundPattern(customTheme.backgroundPattern);
    applyFont(customTheme.fontFamily);
    applyBorderRadius(customTheme.borderRadius);
    applyFontSize(customTheme.fontSize);
    applyUIDensity(customTheme.uiDensity);
    applySidebarStyle(customTheme.sidebarStyle);
    applyAnimationSpeed(customTheme.animationSpeed);
    applyScrollbarStyle(customTheme.scrollbarStyle);
    applyHighContrast(customTheme.highContrast);
  }, [customTheme]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      applyColorPreset(customTheme.colorPreset, isDark, customTheme.customColors);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [customTheme.colorPreset, customTheme.customColors]);

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
    const root = document.documentElement;
    for (const cssVar of Object.values(CSS_VAR_MAP)) {
      root.style.removeProperty(cssVar);
    }
    root.style.removeProperty('--custom-bg-pattern');
    root.style.removeProperty('--custom-bg-size');
    root.style.removeProperty('--font-body');
    root.style.removeProperty('--font-heading');
    root.style.removeProperty('--radius');
    root.style.removeProperty('--font-size-scale');
    root.style.fontSize = '';
    root.removeAttribute('data-density');
    root.removeAttribute('data-sidebar-style');
    root.removeAttribute('data-high-contrast');
    document.body.style.fontFamily = '';
    const link = document.querySelector('link[data-custom-font]');
    if (link) link.remove();
    ['custom-heading-font', 'custom-density', 'custom-animations', 'custom-scrollbar'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }, [saveTheme]);

  const saveCurrentTheme = useCallback((name: string) => {
    const newTheme: SavedThemeLocal = {
      id: crypto.randomUUID(),
      name,
      theme: { ...customTheme },
      createdAt: new Date().toISOString(),
    };
    const updated = [...savedThemes, newTheme];
    setSavedThemes(updated);
    persistSavedThemes(updated);
    return newTheme;
  }, [customTheme, savedThemes]);

  const loadSavedTheme = useCallback((themeId: string) => {
    const found = savedThemes.find(t => t.id === themeId);
    if (found) {
      setCustomTheme(found.theme);
      saveTheme(found.theme);
    }
  }, [savedThemes, saveTheme]);

  const deleteSavedTheme = useCallback((themeId: string) => {
    const updated = savedThemes.filter(t => t.id !== themeId);
    setSavedThemes(updated);
    persistSavedThemes(updated);
  }, [savedThemes]);

  return { customTheme, updateTheme, resetTheme, savedThemes, saveCurrentTheme, loadSavedTheme, deleteSavedTheme };
}
