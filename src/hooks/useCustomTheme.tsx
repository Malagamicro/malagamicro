import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ColorPreset = 'default' | 'ocean' | 'forest' | 'sunset' | 'berry' | 'slate' | 'midnight' | 'copper' | 'rose' | 'emerald' | 'liquid-glass' | 'neon' | 'monochrome' | 'arctic' | 'warm-sand' | 'custom';
export type BackgroundPattern = 'none' | 'dots' | 'grid' | 'diagonal' | 'waves' | 'cross' | 'noise' | 'gradient-radial' | 'hexagons' | 'circuit' | 'diamonds' | 'aurora' | 'bubbles';
export type FontFamily = 'dm-sans' | 'inter' | 'poppins' | 'nunito' | 'outfit' | 'work-sans' | 'space-grotesk' | 'raleway' | 'plus-jakarta' | 'manrope';
export type BorderRadiusSize = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type FontSizeScale = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type UIDensity = 'compact' | 'comfortable' | 'spacious';
export type SidebarStyle = 'solid' | 'glass' | 'transparent';
export type AnimationSpeed = 'none' | 'reduced' | 'normal' | 'smooth';

export interface CustomColors {
  primary?: string;
  primaryForeground?: string;
  secondary?: string;
  secondaryForeground?: string;
  accent?: string;
  accentForeground?: string;
  background?: string;
  foreground?: string;
  card?: string;
  cardForeground?: string;
  muted?: string;
  mutedForeground?: string;
  border?: string;
  sidebarBackground?: string;
  sidebarForeground?: string;
  sidebarAccent?: string;
  sidebarBorder?: string;
  // Status colors
  statusNew?: string;
  statusContacted?: string;
  statusInterested?: string;
  statusClient?: string;
  // Semantic colors
  success?: string;
  warning?: string;
  info?: string;
}

export interface CustomTheme {
  colorPreset: ColorPreset;
  backgroundPattern: BackgroundPattern;
  fontFamily: FontFamily;
  borderRadius: BorderRadiusSize;
  fontSize: FontSizeScale;
  uiDensity: UIDensity;
  sidebarStyle: SidebarStyle;
  animationSpeed: AnimationSpeed;
  highContrast: boolean;
  customColors?: CustomColors;
}

export interface SavedTheme {
  id: string;
  name: string;
  theme: CustomTheme;
  createdAt: string;
}

const DEFAULT_THEME: CustomTheme = {
  colorPreset: 'default',
  backgroundPattern: 'none',
  fontFamily: 'dm-sans',
  borderRadius: 'lg',
  fontSize: 'md',
  uiDensity: 'comfortable',
  sidebarStyle: 'solid',
  animationSpeed: 'normal',
  highContrast: false,
  customColors: undefined,
};

// Full color system per preset - ALL variables covered
interface ColorSystem {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  sidebarBackground: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
}

export const COLOR_PRESETS: Record<ColorPreset, {
  label: string;
  preview: string;
  light: ColorSystem;
  dark: ColorSystem;
}> = {
  default: {
    label: 'MalagaMicro',
    preview: '#3C4E8C',
    light: {
      background: '0 0% 98%', foreground: '222 47% 20%',
      card: '0 0% 100%', cardForeground: '222 47% 20%',
      popover: '0 0% 100%', popoverForeground: '222 47% 20%',
      primary: '224 40% 39%', primaryForeground: '0 0% 100%',
      secondary: '232 23% 58%', secondaryForeground: '0 0% 100%',
      muted: '220 14% 96%', mutedForeground: '220 9% 46%',
      accent: '25 95% 53%', accentForeground: '0 0% 100%',
      destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
      border: '220 13% 91%', input: '220 13% 91%', ring: '224 40% 39%',
      sidebarBackground: '224 40% 39%', sidebarForeground: '0 0% 100%',
      sidebarPrimary: '0 0% 100%', sidebarPrimaryForeground: '224 40% 39%',
      sidebarAccent: '224 40% 45%', sidebarAccentForeground: '0 0% 100%',
      sidebarBorder: '224 40% 45%',
    },
    dark: {
      background: '222 47% 11%', foreground: '0 0% 98%',
      card: '222 47% 14%', cardForeground: '0 0% 98%',
      popover: '222 47% 14%', popoverForeground: '0 0% 98%',
      primary: '224 50% 55%', primaryForeground: '0 0% 100%',
      secondary: '232 23% 45%', secondaryForeground: '0 0% 100%',
      muted: '222 47% 18%', mutedForeground: '220 14% 65%',
      accent: '25 95% 53%', accentForeground: '0 0% 100%',
      destructive: '0 62% 50%', destructiveForeground: '0 0% 100%',
      border: '222 47% 20%', input: '222 47% 20%', ring: '224 50% 55%',
      sidebarBackground: '222 47% 8%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '224 50% 55%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '222 47% 14%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '222 47% 18%',
    },
  },
  ocean: {
    label: 'Océano',
    preview: '#0891b2',
    light: {
      background: '195 20% 97%', foreground: '195 50% 15%',
      card: '0 0% 100%', cardForeground: '195 50% 15%',
      popover: '0 0% 100%', popoverForeground: '195 50% 15%',
      primary: '192 91% 37%', primaryForeground: '0 0% 100%',
      secondary: '187 40% 50%', secondaryForeground: '0 0% 100%',
      muted: '195 20% 95%', mutedForeground: '195 15% 45%',
      accent: '172 66% 42%', accentForeground: '0 0% 100%',
      destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
      border: '195 15% 90%', input: '195 15% 90%', ring: '192 91% 37%',
      sidebarBackground: '195 60% 18%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '192 91% 50%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '195 50% 25%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '195 40% 25%',
    },
    dark: {
      background: '195 50% 8%', foreground: '195 10% 95%',
      card: '195 45% 12%', cardForeground: '195 10% 95%',
      popover: '195 45% 12%', popoverForeground: '195 10% 95%',
      primary: '192 75% 50%', primaryForeground: '0 0% 100%',
      secondary: '187 35% 40%', secondaryForeground: '0 0% 100%',
      muted: '195 40% 16%', mutedForeground: '195 15% 60%',
      accent: '172 66% 45%', accentForeground: '0 0% 100%',
      destructive: '0 62% 50%', destructiveForeground: '0 0% 100%',
      border: '195 40% 18%', input: '195 40% 18%', ring: '192 75% 50%',
      sidebarBackground: '195 55% 6%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '192 75% 50%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '195 45% 12%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '195 40% 15%',
    },
  },
  forest: {
    label: 'Bosque',
    preview: '#16a34a',
    light: {
      background: '140 15% 97%', foreground: '150 40% 15%',
      card: '0 0% 100%', cardForeground: '150 40% 15%',
      popover: '0 0% 100%', popoverForeground: '150 40% 15%',
      primary: '142 72% 32%', primaryForeground: '0 0% 100%',
      secondary: '152 35% 48%', secondaryForeground: '0 0% 100%',
      muted: '140 15% 95%', mutedForeground: '140 10% 45%',
      accent: '84 70% 42%', accentForeground: '0 0% 100%',
      destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
      border: '140 12% 90%', input: '140 12% 90%', ring: '142 72% 32%',
      sidebarBackground: '150 50% 15%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '142 72% 45%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '150 40% 22%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '150 35% 22%',
    },
    dark: {
      background: '150 40% 7%', foreground: '140 10% 95%',
      card: '150 35% 11%', cardForeground: '140 10% 95%',
      popover: '150 35% 11%', popoverForeground: '140 10% 95%',
      primary: '142 60% 45%', primaryForeground: '0 0% 100%',
      secondary: '152 30% 38%', secondaryForeground: '0 0% 100%',
      muted: '150 30% 15%', mutedForeground: '140 10% 60%',
      accent: '84 70% 42%', accentForeground: '0 0% 100%',
      destructive: '0 62% 50%', destructiveForeground: '0 0% 100%',
      border: '150 30% 16%', input: '150 30% 16%', ring: '142 60% 45%',
      sidebarBackground: '150 45% 5%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '142 60% 45%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '150 35% 11%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '150 30% 13%',
    },
  },
  sunset: {
    label: 'Atardecer',
    preview: '#ea580c',
    light: {
      background: '30 20% 97%', foreground: '20 50% 15%',
      card: '0 0% 100%', cardForeground: '20 50% 15%',
      popover: '0 0% 100%', popoverForeground: '20 50% 15%',
      primary: '21 90% 48%', primaryForeground: '0 0% 100%',
      secondary: '35 60% 50%', secondaryForeground: '0 0% 100%',
      muted: '30 20% 95%', mutedForeground: '20 10% 45%',
      accent: '346 77% 50%', accentForeground: '0 0% 100%',
      destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
      border: '30 15% 90%', input: '30 15% 90%', ring: '21 90% 48%',
      sidebarBackground: '15 55% 22%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '21 90% 55%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '15 45% 28%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '15 40% 28%',
    },
    dark: {
      background: '15 40% 7%', foreground: '30 10% 95%',
      card: '15 35% 11%', cardForeground: '30 10% 95%',
      popover: '15 35% 11%', popoverForeground: '30 10% 95%',
      primary: '21 80% 55%', primaryForeground: '0 0% 100%',
      secondary: '35 50% 42%', secondaryForeground: '0 0% 100%',
      muted: '15 30% 15%', mutedForeground: '20 10% 60%',
      accent: '346 77% 55%', accentForeground: '0 0% 100%',
      destructive: '0 62% 50%', destructiveForeground: '0 0% 100%',
      border: '15 30% 16%', input: '15 30% 16%', ring: '21 80% 55%',
      sidebarBackground: '15 45% 5%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '21 80% 55%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '15 35% 11%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '15 30% 13%',
    },
  },
  berry: {
    label: 'Frutos',
    preview: '#9333ea',
    light: {
      background: '270 15% 97%', foreground: '270 40% 15%',
      card: '0 0% 100%', cardForeground: '270 40% 15%',
      popover: '0 0% 100%', popoverForeground: '270 40% 15%',
      primary: '271 81% 50%', primaryForeground: '0 0% 100%',
      secondary: '290 40% 55%', secondaryForeground: '0 0% 100%',
      muted: '270 15% 95%', mutedForeground: '270 10% 45%',
      accent: '330 81% 55%', accentForeground: '0 0% 100%',
      destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
      border: '270 12% 90%', input: '270 12% 90%', ring: '271 81% 50%',
      sidebarBackground: '271 55% 25%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '271 81% 60%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '271 45% 32%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '271 40% 32%',
    },
    dark: {
      background: '271 45% 7%', foreground: '270 10% 95%',
      card: '271 40% 11%', cardForeground: '270 10% 95%',
      popover: '271 40% 11%', popoverForeground: '270 10% 95%',
      primary: '271 70% 60%', primaryForeground: '0 0% 100%',
      secondary: '290 35% 45%', secondaryForeground: '0 0% 100%',
      muted: '271 35% 15%', mutedForeground: '270 10% 60%',
      accent: '330 81% 55%', accentForeground: '0 0% 100%',
      destructive: '0 62% 50%', destructiveForeground: '0 0% 100%',
      border: '271 35% 17%', input: '271 35% 17%', ring: '271 70% 60%',
      sidebarBackground: '271 50% 5%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '271 70% 60%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '271 40% 11%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '271 35% 14%',
    },
  },
  slate: {
    label: 'Pizarra',
    preview: '#475569',
    light: {
      background: '210 15% 97%', foreground: '215 25% 20%',
      card: '0 0% 100%', cardForeground: '215 25% 20%',
      popover: '0 0% 100%', popoverForeground: '215 25% 20%',
      primary: '215 19% 35%', primaryForeground: '0 0% 100%',
      secondary: '210 15% 50%', secondaryForeground: '0 0% 100%',
      muted: '210 15% 95%', mutedForeground: '215 10% 45%',
      accent: '210 40% 52%', accentForeground: '0 0% 100%',
      destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
      border: '210 12% 90%', input: '210 12% 90%', ring: '215 19% 35%',
      sidebarBackground: '215 25% 20%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '210 40% 52%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '215 20% 27%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '215 18% 27%',
    },
    dark: {
      background: '215 25% 8%', foreground: '210 10% 95%',
      card: '215 22% 12%', cardForeground: '210 10% 95%',
      popover: '215 22% 12%', popoverForeground: '210 10% 95%',
      primary: '215 19% 55%', primaryForeground: '0 0% 100%',
      secondary: '210 15% 42%', secondaryForeground: '0 0% 100%',
      muted: '215 20% 16%', mutedForeground: '210 10% 58%',
      accent: '210 40% 52%', accentForeground: '0 0% 100%',
      destructive: '0 62% 50%', destructiveForeground: '0 0% 100%',
      border: '215 20% 17%', input: '215 20% 17%', ring: '215 19% 55%',
      sidebarBackground: '215 28% 6%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '215 19% 55%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '215 22% 12%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '215 20% 14%',
    },
  },
  midnight: {
    label: 'Medianoche',
    preview: '#1e1b4b',
    light: {
      background: '244 15% 97%', foreground: '244 40% 18%',
      card: '0 0% 100%', cardForeground: '244 40% 18%',
      popover: '0 0% 100%', popoverForeground: '244 40% 18%',
      primary: '244 47% 30%', primaryForeground: '0 0% 100%',
      secondary: '250 30% 50%', secondaryForeground: '0 0% 100%',
      muted: '244 15% 95%', mutedForeground: '244 10% 45%',
      accent: '262 83% 58%', accentForeground: '0 0% 100%',
      destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
      border: '244 12% 90%', input: '244 12% 90%', ring: '244 47% 30%',
      sidebarBackground: '244 47% 15%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '262 83% 58%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '244 40% 22%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '244 35% 22%',
    },
    dark: {
      background: '244 45% 6%', foreground: '244 10% 95%',
      card: '244 40% 10%', cardForeground: '244 10% 95%',
      popover: '244 40% 10%', popoverForeground: '244 10% 95%',
      primary: '244 47% 55%', primaryForeground: '0 0% 100%',
      secondary: '250 30% 42%', secondaryForeground: '0 0% 100%',
      muted: '244 35% 14%', mutedForeground: '244 10% 58%',
      accent: '262 83% 58%', accentForeground: '0 0% 100%',
      destructive: '0 62% 50%', destructiveForeground: '0 0% 100%',
      border: '244 35% 15%', input: '244 35% 15%', ring: '244 47% 55%',
      sidebarBackground: '244 50% 4%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '244 47% 55%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '244 40% 10%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '244 35% 12%',
    },
  },
  copper: {
    label: 'Cobre',
    preview: '#b45309',
    light: {
      background: '35 20% 97%', foreground: '32 50% 15%',
      card: '0 0% 100%', cardForeground: '32 50% 15%',
      popover: '0 0% 100%', popoverForeground: '32 50% 15%',
      primary: '32 95% 37%', primaryForeground: '0 0% 100%',
      secondary: '38 50% 48%', secondaryForeground: '0 0% 100%',
      muted: '35 18% 95%', mutedForeground: '32 10% 45%',
      accent: '15 75% 48%', accentForeground: '0 0% 100%',
      destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
      border: '35 15% 90%', input: '35 15% 90%', ring: '32 95% 37%',
      sidebarBackground: '32 50% 18%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '32 95% 50%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '32 40% 25%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '32 35% 25%',
    },
    dark: {
      background: '32 40% 6%', foreground: '35 10% 95%',
      card: '32 35% 10%', cardForeground: '35 10% 95%',
      popover: '32 35% 10%', popoverForeground: '35 10% 95%',
      primary: '32 80% 50%', primaryForeground: '0 0% 100%',
      secondary: '38 40% 40%', secondaryForeground: '0 0% 100%',
      muted: '32 30% 14%', mutedForeground: '32 10% 58%',
      accent: '15 75% 48%', accentForeground: '0 0% 100%',
      destructive: '0 62% 50%', destructiveForeground: '0 0% 100%',
      border: '32 30% 15%', input: '32 30% 15%', ring: '32 80% 50%',
      sidebarBackground: '32 45% 4%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '32 80% 50%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '32 35% 10%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '32 30% 12%',
    },
  },
  rose: {
    label: 'Rosa',
    preview: '#e11d48',
    light: {
      background: '350 15% 97%', foreground: '350 40% 15%',
      card: '0 0% 100%', cardForeground: '350 40% 15%',
      popover: '0 0% 100%', popoverForeground: '350 40% 15%',
      primary: '350 89% 50%', primaryForeground: '0 0% 100%',
      secondary: '340 50% 55%', secondaryForeground: '0 0% 100%',
      muted: '350 15% 95%', mutedForeground: '350 10% 45%',
      accent: '330 70% 55%', accentForeground: '0 0% 100%',
      destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
      border: '350 12% 90%', input: '350 12% 90%', ring: '350 89% 50%',
      sidebarBackground: '350 55% 22%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '350 89% 60%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '350 45% 28%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '350 40% 28%',
    },
    dark: {
      background: '350 40% 6%', foreground: '350 10% 95%',
      card: '350 35% 10%', cardForeground: '350 10% 95%',
      popover: '350 35% 10%', popoverForeground: '350 10% 95%',
      primary: '350 80% 55%', primaryForeground: '0 0% 100%',
      secondary: '340 40% 42%', secondaryForeground: '0 0% 100%',
      muted: '350 30% 14%', mutedForeground: '350 10% 58%',
      accent: '330 70% 55%', accentForeground: '0 0% 100%',
      destructive: '0 62% 50%', destructiveForeground: '0 0% 100%',
      border: '350 30% 15%', input: '350 30% 15%', ring: '350 80% 55%',
      sidebarBackground: '350 45% 4%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '350 80% 55%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '350 35% 10%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '350 30% 12%',
    },
  },
  emerald: {
    label: 'Esmeralda',
    preview: '#059669',
    light: {
      background: '160 15% 97%', foreground: '160 40% 15%',
      card: '0 0% 100%', cardForeground: '160 40% 15%',
      popover: '0 0% 100%', popoverForeground: '160 40% 15%',
      primary: '160 84% 30%', primaryForeground: '0 0% 100%',
      secondary: '170 50% 45%', secondaryForeground: '0 0% 100%',
      muted: '160 15% 95%', mutedForeground: '160 10% 45%',
      accent: '142 60% 48%', accentForeground: '0 0% 100%',
      destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
      border: '160 12% 90%', input: '160 12% 90%', ring: '160 84% 30%',
      sidebarBackground: '160 60% 16%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '160 84% 40%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '160 50% 22%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '160 45% 22%',
    },
    dark: {
      background: '160 40% 6%', foreground: '160 10% 95%',
      card: '160 35% 10%', cardForeground: '160 10% 95%',
      popover: '160 35% 10%', popoverForeground: '160 10% 95%',
      primary: '160 70% 42%', primaryForeground: '0 0% 100%',
      secondary: '170 40% 38%', secondaryForeground: '0 0% 100%',
      muted: '160 30% 14%', mutedForeground: '160 10% 58%',
      accent: '142 60% 48%', accentForeground: '0 0% 100%',
      destructive: '0 62% 50%', destructiveForeground: '0 0% 100%',
      border: '160 30% 15%', input: '160 30% 15%', ring: '160 70% 42%',
      sidebarBackground: '160 45% 4%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '160 70% 42%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '160 35% 10%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '160 30% 12%',
    },
  },
  'liquid-glass': {
    label: 'Liquid Glass',
    preview: '#88c8ff',
    light: {
      background: '210 40% 96%', foreground: '210 30% 15%',
      card: '0 0% 100%', cardForeground: '210 30% 15%',
      popover: '210 30% 98%', popoverForeground: '210 30% 15%',
      primary: '210 80% 60%', primaryForeground: '0 0% 100%',
      secondary: '200 40% 70%', secondaryForeground: '210 30% 15%',
      muted: '210 25% 93%', mutedForeground: '210 15% 50%',
      accent: '190 70% 55%', accentForeground: '0 0% 100%',
      destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
      border: '210 20% 88%', input: '210 20% 88%', ring: '210 80% 60%',
      sidebarBackground: '210 30% 95%', sidebarForeground: '210 30% 20%',
      sidebarPrimary: '210 80% 55%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '210 25% 90%', sidebarAccentForeground: '210 30% 20%',
      sidebarBorder: '210 20% 85%',
    },
    dark: {
      background: '210 30% 8%', foreground: '210 15% 92%',
      card: '210 25% 13%', cardForeground: '210 15% 92%',
      popover: '210 25% 13%', popoverForeground: '210 15% 92%',
      primary: '210 80% 60%', primaryForeground: '0 0% 100%',
      secondary: '200 30% 35%', secondaryForeground: '210 15% 92%',
      muted: '210 25% 16%', mutedForeground: '210 15% 55%',
      accent: '190 70% 50%', accentForeground: '0 0% 100%',
      destructive: '0 62% 50%', destructiveForeground: '0 0% 100%',
      border: '210 20% 20%', input: '210 20% 20%', ring: '210 80% 60%',
      sidebarBackground: '210 30% 6%', sidebarForeground: '210 15% 92%',
      sidebarPrimary: '210 80% 60%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '210 25% 13%', sidebarAccentForeground: '210 15% 92%',
      sidebarBorder: '210 20% 15%',
    },
  },
  neon: {
    label: 'Neón',
    preview: '#00ff88',
    light: {
      background: '160 10% 97%', foreground: '160 40% 10%',
      card: '0 0% 100%', cardForeground: '160 40% 10%',
      popover: '0 0% 100%', popoverForeground: '160 40% 10%',
      primary: '160 100% 40%', primaryForeground: '160 100% 5%',
      secondary: '280 80% 55%', secondaryForeground: '0 0% 100%',
      muted: '160 10% 94%', mutedForeground: '160 10% 45%',
      accent: '320 100% 55%', accentForeground: '0 0% 100%',
      destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
      border: '160 10% 88%', input: '160 10% 88%', ring: '160 100% 40%',
      sidebarBackground: '260 40% 12%', sidebarForeground: '160 100% 70%',
      sidebarPrimary: '160 100% 50%', sidebarPrimaryForeground: '260 40% 5%',
      sidebarAccent: '260 35% 18%', sidebarAccentForeground: '160 100% 70%',
      sidebarBorder: '260 30% 20%',
    },
    dark: {
      background: '260 40% 5%', foreground: '160 20% 90%',
      card: '260 35% 9%', cardForeground: '160 20% 90%',
      popover: '260 35% 9%', popoverForeground: '160 20% 90%',
      primary: '160 100% 45%', primaryForeground: '260 100% 5%',
      secondary: '280 80% 55%', secondaryForeground: '0 0% 100%',
      muted: '260 30% 13%', mutedForeground: '260 15% 55%',
      accent: '320 100% 55%', accentForeground: '0 0% 100%',
      destructive: '0 62% 50%', destructiveForeground: '0 0% 100%',
      border: '260 30% 15%', input: '260 30% 15%', ring: '160 100% 45%',
      sidebarBackground: '260 45% 3%', sidebarForeground: '160 100% 65%',
      sidebarPrimary: '160 100% 50%', sidebarPrimaryForeground: '260 100% 5%',
      sidebarAccent: '260 35% 9%', sidebarAccentForeground: '160 100% 65%',
      sidebarBorder: '260 30% 12%',
    },
  },
  monochrome: {
    label: 'Monocromo',
    preview: '#555555',
    light: {
      background: '0 0% 98%', foreground: '0 0% 10%',
      card: '0 0% 100%', cardForeground: '0 0% 10%',
      popover: '0 0% 100%', popoverForeground: '0 0% 10%',
      primary: '0 0% 20%', primaryForeground: '0 0% 100%',
      secondary: '0 0% 40%', secondaryForeground: '0 0% 100%',
      muted: '0 0% 95%', mutedForeground: '0 0% 45%',
      accent: '0 0% 30%', accentForeground: '0 0% 100%',
      destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
      border: '0 0% 90%', input: '0 0% 90%', ring: '0 0% 20%',
      sidebarBackground: '0 0% 8%', sidebarForeground: '0 0% 95%',
      sidebarPrimary: '0 0% 70%', sidebarPrimaryForeground: '0 0% 8%',
      sidebarAccent: '0 0% 15%', sidebarAccentForeground: '0 0% 95%',
      sidebarBorder: '0 0% 18%',
    },
    dark: {
      background: '0 0% 6%', foreground: '0 0% 92%',
      card: '0 0% 10%', cardForeground: '0 0% 92%',
      popover: '0 0% 10%', popoverForeground: '0 0% 92%',
      primary: '0 0% 80%', primaryForeground: '0 0% 6%',
      secondary: '0 0% 50%', secondaryForeground: '0 0% 100%',
      muted: '0 0% 14%', mutedForeground: '0 0% 55%',
      accent: '0 0% 65%', accentForeground: '0 0% 6%',
      destructive: '0 62% 50%', destructiveForeground: '0 0% 100%',
      border: '0 0% 16%', input: '0 0% 16%', ring: '0 0% 80%',
      sidebarBackground: '0 0% 4%', sidebarForeground: '0 0% 90%',
      sidebarPrimary: '0 0% 80%', sidebarPrimaryForeground: '0 0% 4%',
      sidebarAccent: '0 0% 10%', sidebarAccentForeground: '0 0% 90%',
      sidebarBorder: '0 0% 13%',
    },
  },
  arctic: {
    label: 'Ártico',
    preview: '#7dd3fc',
    light: {
      background: '200 30% 97%', foreground: '210 35% 15%',
      card: '200 20% 100%', cardForeground: '210 35% 15%',
      popover: '200 20% 100%', popoverForeground: '210 35% 15%',
      primary: '200 90% 55%', primaryForeground: '0 0% 100%',
      secondary: '210 50% 70%', secondaryForeground: '210 35% 15%',
      muted: '200 20% 94%', mutedForeground: '210 15% 48%',
      accent: '185 70% 48%', accentForeground: '0 0% 100%',
      destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
      border: '200 18% 89%', input: '200 18% 89%', ring: '200 90% 55%',
      sidebarBackground: '210 50% 92%', sidebarForeground: '210 35% 15%',
      sidebarPrimary: '200 90% 50%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '200 30% 87%', sidebarAccentForeground: '210 35% 15%',
      sidebarBorder: '200 20% 85%',
    },
    dark: {
      background: '210 45% 6%', foreground: '200 15% 92%',
      card: '210 40% 10%', cardForeground: '200 15% 92%',
      popover: '210 40% 10%', popoverForeground: '200 15% 92%',
      primary: '200 80% 55%', primaryForeground: '0 0% 100%',
      secondary: '210 35% 40%', secondaryForeground: '200 15% 92%',
      muted: '210 35% 14%', mutedForeground: '200 15% 55%',
      accent: '185 70% 48%', accentForeground: '0 0% 100%',
      destructive: '0 62% 50%', destructiveForeground: '0 0% 100%',
      border: '210 35% 17%', input: '210 35% 17%', ring: '200 80% 55%',
      sidebarBackground: '210 50% 4%', sidebarForeground: '200 15% 92%',
      sidebarPrimary: '200 80% 55%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '210 40% 10%', sidebarAccentForeground: '200 15% 92%',
      sidebarBorder: '210 35% 13%',
    },
  },
  'warm-sand': {
    label: 'Arena Cálida',
    preview: '#d4a574',
    light: {
      background: '35 30% 96%', foreground: '30 40% 15%',
      card: '35 20% 99%', cardForeground: '30 40% 15%',
      popover: '35 20% 99%', popoverForeground: '30 40% 15%',
      primary: '30 55% 55%', primaryForeground: '0 0% 100%',
      secondary: '25 40% 65%', secondaryForeground: '30 40% 15%',
      muted: '35 20% 93%', mutedForeground: '30 15% 48%',
      accent: '15 65% 50%', accentForeground: '0 0% 100%',
      destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
      border: '35 18% 88%', input: '35 18% 88%', ring: '30 55% 55%',
      sidebarBackground: '30 35% 90%', sidebarForeground: '30 40% 15%',
      sidebarPrimary: '30 55% 50%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '30 25% 85%', sidebarAccentForeground: '30 40% 15%',
      sidebarBorder: '30 20% 82%',
    },
    dark: {
      background: '30 25% 7%', foreground: '35 15% 90%',
      card: '30 22% 11%', cardForeground: '35 15% 90%',
      popover: '30 22% 11%', popoverForeground: '35 15% 90%',
      primary: '30 50% 55%', primaryForeground: '0 0% 100%',
      secondary: '25 30% 40%', secondaryForeground: '35 15% 90%',
      muted: '30 22% 15%', mutedForeground: '30 12% 55%',
      accent: '15 65% 50%', accentForeground: '0 0% 100%',
      destructive: '0 62% 50%', destructiveForeground: '0 0% 100%',
      border: '30 22% 17%', input: '30 22% 17%', ring: '30 50% 55%',
      sidebarBackground: '30 28% 5%', sidebarForeground: '35 15% 90%',
      sidebarPrimary: '30 50% 55%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '30 22% 11%', sidebarAccentForeground: '35 15% 90%',
      sidebarBorder: '30 22% 13%',
    },
  },
  custom: {
    label: 'Personalizado',
    preview: '#6366f1',
    light: {
      background: '0 0% 98%', foreground: '222 47% 20%',
      card: '0 0% 100%', cardForeground: '222 47% 20%',
      popover: '0 0% 100%', popoverForeground: '222 47% 20%',
      primary: '224 40% 39%', primaryForeground: '0 0% 100%',
      secondary: '232 23% 58%', secondaryForeground: '0 0% 100%',
      muted: '220 14% 96%', mutedForeground: '220 9% 46%',
      accent: '25 95% 53%', accentForeground: '0 0% 100%',
      destructive: '0 84% 60%', destructiveForeground: '0 0% 100%',
      border: '220 13% 91%', input: '220 13% 91%', ring: '224 40% 39%',
      sidebarBackground: '224 40% 39%', sidebarForeground: '0 0% 100%',
      sidebarPrimary: '0 0% 100%', sidebarPrimaryForeground: '224 40% 39%',
      sidebarAccent: '224 40% 45%', sidebarAccentForeground: '0 0% 100%',
      sidebarBorder: '224 40% 45%',
    },
    dark: {
      background: '222 47% 11%', foreground: '0 0% 98%',
      card: '222 47% 14%', cardForeground: '0 0% 98%',
      popover: '222 47% 14%', popoverForeground: '0 0% 98%',
      primary: '224 50% 55%', primaryForeground: '0 0% 100%',
      secondary: '232 23% 45%', secondaryForeground: '0 0% 100%',
      muted: '222 47% 18%', mutedForeground: '220 14% 65%',
      accent: '25 95% 53%', accentForeground: '0 0% 100%',
      destructive: '0 62% 50%', destructiveForeground: '0 0% 100%',
      border: '222 47% 20%', input: '222 47% 20%', ring: '224 50% 55%',
      sidebarBackground: '222 47% 8%', sidebarForeground: '0 0% 98%',
      sidebarPrimary: '224 50% 55%', sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '222 47% 14%', sidebarAccentForeground: '0 0% 98%',
      sidebarBorder: '222 47% 18%',
    },
  },
};

export const BACKGROUND_PATTERNS: Record<BackgroundPattern, { label: string; css: string }> = {
  none: { label: 'Ninguno', css: '' },
  dots: { label: 'Puntos', css: 'radial-gradient(circle, hsl(var(--foreground) / 0.12) 1px, transparent 1px)' },
  grid: { label: 'Cuadrícula', css: 'linear-gradient(hsl(var(--foreground) / 0.08) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.08) 1px, transparent 1px)' },
  diagonal: { label: 'Diagonal', css: 'repeating-linear-gradient(45deg, transparent, transparent 10px, hsl(var(--foreground) / 0.07) 10px, hsl(var(--foreground) / 0.07) 11px)' },
  waves: { label: 'Ondas', css: 'radial-gradient(ellipse at 50% 0%, hsl(var(--primary) / 0.18) 0%, transparent 60%), radial-gradient(ellipse at 0% 50%, hsl(var(--accent) / 0.12) 0%, transparent 50%), radial-gradient(ellipse at 100% 80%, hsl(var(--primary) / 0.10) 0%, transparent 50%)' },
  cross: { label: 'Cruz', css: 'linear-gradient(hsl(var(--foreground) / 0.08) 1.5px, transparent 1.5px), linear-gradient(90deg, hsl(var(--foreground) / 0.08) 1.5px, transparent 1.5px)' },
  noise: { label: 'Ruido', css: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.08\'/%3E%3C/svg%3E")' },
  'gradient-radial': { label: 'Gradiente', css: 'radial-gradient(ellipse at 30% 20%, hsl(var(--primary) / 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, hsl(var(--accent) / 0.12) 0%, transparent 50%)' },
  hexagons: { label: 'Hexágonos', css: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'28\' height=\'49\' viewBox=\'0 0 28 49\'%3E%3Cg fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.08\'%3E%3Cpath d=\'M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' },
  circuit: { label: 'Circuito', css: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 40 40\'%3E%3Cg fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.08\'%3E%3Cpath d=\'M0 38.59l2.83-2.83 1.41 1.41L1.41 40H0v-1.41zM0 1.4l2.83 2.83 1.41-1.41L1.41 0H0v1.41zM38.59 40l-2.83-2.83 1.41-1.41L40 38.59V40h-1.41zM40 1.41l-2.83 2.83-1.41-1.41L38.59 0H40v1.41zM20 18.6l2.83-2.83 1.41 1.41L21.41 20l2.83 2.83-1.41 1.41L20 21.41l-2.83 2.83-1.41-1.41L18.59 20l-2.83-2.83 1.41-1.41L20 18.59z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' },
  diamonds: { label: 'Diamantes', css: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'32\' viewBox=\'0 0 16 32\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.09\'%3E%3Cpath d=\'M8 0l8 16-8 16L0 16z\'/%3E%3C/g%3E%3C/svg%3E")' },
  aurora: { label: 'Aurora', css: 'radial-gradient(ellipse at 20% 0%, hsl(var(--primary) / 0.20) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, hsl(var(--accent) / 0.15) 0%, transparent 40%), radial-gradient(ellipse at 50% 80%, hsl(var(--secondary) / 0.12) 0%, transparent 50%)' },
  bubbles: { label: 'Burbujas', css: 'radial-gradient(circle at 25% 25%, hsl(var(--primary) / 0.12) 0%, transparent 30%), radial-gradient(circle at 75% 15%, hsl(var(--accent) / 0.10) 0%, transparent 25%), radial-gradient(circle at 50% 70%, hsl(var(--secondary) / 0.08) 0%, transparent 35%), radial-gradient(circle at 85% 75%, hsl(var(--primary) / 0.08) 0%, transparent 20%)' },
};

export const FONT_FAMILIES: Record<FontFamily, { label: string; import: string; family: string; heading: string }> = {
  'dm-sans': {
    label: 'DM Sans',
    import: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Space+Grotesk:wght@400;500;600;700&display=swap",
    family: "'DM Sans', system-ui, sans-serif",
    heading: "'Space Grotesk', 'DM Sans', system-ui, sans-serif",
  },
  inter: {
    label: 'Inter',
    import: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Sora:wght@400;500;600;700;800&display=swap",
    family: "'Inter', system-ui, sans-serif",
    heading: "'Sora', 'Inter', system-ui, sans-serif",
  },
  poppins: {
    label: 'Poppins',
    import: "https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap",
    family: "'Poppins', system-ui, sans-serif",
    heading: "'Poppins', system-ui, sans-serif",
  },
  nunito: {
    label: 'Nunito',
    import: "https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700;800&display=swap",
    family: "'Nunito', system-ui, sans-serif",
    heading: "'Nunito', system-ui, sans-serif",
  },
  outfit: {
    label: 'Outfit',
    import: "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap",
    family: "'Outfit', system-ui, sans-serif",
    heading: "'Outfit', system-ui, sans-serif",
  },
  'work-sans': {
    label: 'Work Sans',
    import: "https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;500;600;700&display=swap",
    family: "'Work Sans', system-ui, sans-serif",
    heading: "'Work Sans', system-ui, sans-serif",
  },
  'space-grotesk': {
    label: 'Space Grotesk',
    import: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
    family: "'Space Grotesk', system-ui, sans-serif",
    heading: "'Space Grotesk', system-ui, sans-serif",
  },
  raleway: {
    label: 'Raleway',
    import: "https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap",
    family: "'Raleway', system-ui, sans-serif",
    heading: "'Raleway', system-ui, sans-serif",
  },
  'plus-jakarta': {
    label: 'Plus Jakarta',
    import: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap",
    family: "'Plus Jakarta Sans', system-ui, sans-serif",
    heading: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  manrope: {
    label: 'Manrope',
    import: "https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap",
    family: "'Manrope', system-ui, sans-serif",
    heading: "'Manrope', system-ui, sans-serif",
  },
};

export const BORDER_RADIUS_OPTIONS: Record<BorderRadiusSize, { label: string; value: string }> = {
  none: { label: 'Sin bordes', value: '0rem' },
  sm: { label: 'Sutil', value: '0.3rem' },
  md: { label: 'Medio', value: '0.5rem' },
  lg: { label: 'Grande', value: '0.625rem' },
  xl: { label: 'Extra', value: '1rem' },
  full: { label: 'Máximo', value: '1.5rem' },
};

export const FONT_SIZE_OPTIONS: Record<FontSizeScale, { label: string; scale: string }> = {
  xs: { label: 'Muy pequeña', scale: '87.5%' },
  sm: { label: 'Pequeña', scale: '93.75%' },
  md: { label: 'Normal', scale: '100%' },
  lg: { label: 'Grande', scale: '106.25%' },
  xl: { label: 'Muy grande', scale: '112.5%' },
};

export const UI_DENSITY_OPTIONS: Record<UIDensity, { label: string; spacing: string }> = {
  compact: { label: 'Compacto', spacing: '0.5' },
  comfortable: { label: 'Cómodo', spacing: '1' },
  spacious: { label: 'Amplio', spacing: '1.5' },
};

export const SIDEBAR_STYLE_OPTIONS: Record<SidebarStyle, { label: string; description: string }> = {
  solid: { label: 'Sólido', description: 'Fondo opaco sin transparencia' },
  glass: { label: 'Cristal', description: 'Glassmorphism con blur y transparencia' },
  transparent: { label: 'Transparente', description: 'Fondo muy transparente, minimalista' },
};

export const ANIMATION_SPEED_OPTIONS: Record<AnimationSpeed, { label: string }> = {
  none: { label: 'Sin animación' },
  reduced: { label: 'Reducida' },
  normal: { label: 'Normal' },
  smooth: { label: 'Suave' },
};

const PATTERN_SIZES: Record<BackgroundPattern, string> = {
  none: '', dots: '20px 20px', grid: '24px 24px, 24px 24px',
  diagonal: '', waves: '', cross: '16px 16px, 16px 16px',
  noise: '256px 256px', 'gradient-radial': '',
  hexagons: '28px 49px', circuit: '40px 40px', diamonds: '16px 32px',
  aurora: '', bubbles: '',
};

const CSS_VAR_MAP: Record<keyof ColorSystem, string> = {
  background: '--background', foreground: '--foreground',
  card: '--card', cardForeground: '--card-foreground',
  popover: '--popover', popoverForeground: '--popover-foreground',
  primary: '--primary', primaryForeground: '--primary-foreground',
  secondary: '--secondary', secondaryForeground: '--secondary-foreground',
  muted: '--muted', mutedForeground: '--muted-foreground',
  accent: '--accent', accentForeground: '--accent-foreground',
  destructive: '--destructive', destructiveForeground: '--destructive-foreground',
  border: '--border', input: '--input', ring: '--ring',
  sidebarBackground: '--sidebar-background', sidebarForeground: '--sidebar-foreground',
  sidebarPrimary: '--sidebar-primary', sidebarPrimaryForeground: '--sidebar-primary-foreground',
  sidebarAccent: '--sidebar-accent', sidebarAccentForeground: '--sidebar-accent-foreground',
  sidebarBorder: '--sidebar-border',
};

function applyColorPreset(preset: ColorPreset, isDark: boolean, customColors?: CustomColors) {
  const config = COLOR_PRESETS[preset];
  if (!config) return;
  const mode = isDark ? config.dark : config.light;
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    if (preset === 'custom' && customColors && customColors[key as keyof CustomColors]) {
      root.style.setProperty(cssVar, customColors[key as keyof CustomColors]!);
    } else {
      const value = mode[key as keyof ColorSystem];
      if (value) root.style.setProperty(cssVar, value);
    }
  }
  // Apply custom status & semantic colors
  if (customColors) {
    if (customColors.statusNew) root.style.setProperty('--status-new', customColors.statusNew);
    if (customColors.statusContacted) root.style.setProperty('--status-contacted', customColors.statusContacted);
    if (customColors.statusInterested) root.style.setProperty('--status-interested', customColors.statusInterested);
    if (customColors.statusClient) root.style.setProperty('--status-client', customColors.statusClient);
    if (customColors.success) root.style.setProperty('--success', customColors.success);
    if (customColors.warning) root.style.setProperty('--warning', customColors.warning);
    if (customColors.info) root.style.setProperty('--info', customColors.info);
  }
}

function applyBackgroundPattern(pattern: BackgroundPattern) {
  const config = BACKGROUND_PATTERNS[pattern];
  const root = document.documentElement;
  if (!config.css || pattern === 'none') {
    root.style.removeProperty('--custom-bg-pattern');
    root.style.removeProperty('--custom-bg-size');
  } else {
    root.style.setProperty('--custom-bg-pattern', config.css);
    const size = PATTERN_SIZES[pattern];
    root.style.setProperty('--custom-bg-size', size || 'auto');
  }
}

function applyFont(font: FontFamily) {
  const config = FONT_FAMILIES[font];
  if (!config) return;
  const existingLink = document.querySelector('link[data-custom-font]');
  if (existingLink) existingLink.remove();
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = config.import;
  link.setAttribute('data-custom-font', 'true');
  document.head.appendChild(link);
  document.documentElement.style.setProperty('--font-body', config.family);
  document.documentElement.style.setProperty('--font-heading', config.heading);
  document.body.style.fontFamily = config.family;
  const style = document.getElementById('custom-heading-font') || document.createElement('style');
  style.id = 'custom-heading-font';
  style.textContent = `h1,h2,h3,h4,h5,h6{font-family:${config.heading} !important;}`;
  if (!style.parentNode) document.head.appendChild(style);
}

function applyBorderRadius(size: BorderRadiusSize) {
  const config = BORDER_RADIUS_OPTIONS[size];
  if (!config) return;
  document.documentElement.style.setProperty('--radius', config.value);
}

function applyFontSize(scale: FontSizeScale) {
  const config = FONT_SIZE_OPTIONS[scale];
  if (!config) return;
  document.documentElement.style.setProperty('--font-size-scale', config.scale);
  document.documentElement.style.fontSize = config.scale;
}

function applyUIDensity(density: UIDensity) {
  const root = document.documentElement;
  root.setAttribute('data-density', density);
  const densityStyle = document.getElementById('custom-density') || document.createElement('style');
  densityStyle.id = 'custom-density';
  const multiplier = density === 'compact' ? 0.75 : density === 'spacious' ? 1.35 : 1;
  densityStyle.textContent = `
    [data-density="compact"] .p-3 { padding: 0.5rem !important; }
    [data-density="compact"] .p-4 { padding: 0.625rem !important; }
    [data-density="compact"] .gap-3 { gap: 0.5rem !important; }
    [data-density="compact"] .gap-4 { gap: 0.625rem !important; }
    [data-density="compact"] .space-y-3 > * + * { margin-top: 0.5rem !important; }
    [data-density="compact"] .space-y-4 > * + * { margin-top: 0.625rem !important; }
    [data-density="spacious"] .p-3 { padding: 1rem !important; }
    [data-density="spacious"] .p-4 { padding: 1.5rem !important; }
    [data-density="spacious"] .gap-3 { gap: 1rem !important; }
    [data-density="spacious"] .gap-4 { gap: 1.25rem !important; }
    [data-density="spacious"] .space-y-3 > * + * { margin-top: 1rem !important; }
    [data-density="spacious"] .space-y-4 > * + * { margin-top: 1.25rem !important; }
  `;
  if (!densityStyle.parentNode) document.head.appendChild(densityStyle);
}

function applySidebarStyle(style: SidebarStyle) {
  const root = document.documentElement;
  root.setAttribute('data-sidebar-style', style);
}

function applyAnimationSpeed(speed: AnimationSpeed) {
  const root = document.documentElement;
  const animStyle = document.getElementById('custom-animations') || document.createElement('style');
  animStyle.id = 'custom-animations';
  if (speed === 'none') {
    animStyle.textContent = `*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }`;
  } else if (speed === 'reduced') {
    animStyle.textContent = `*, *::before, *::after { animation-duration: 0.1s !important; transition-duration: 0.1s !important; }`;
  } else if (speed === 'smooth') {
    animStyle.textContent = `*, *::before, *::after { transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) !important; transition-duration: 0.4s !important; }`;
  } else {
    animStyle.textContent = '';
  }
  if (!animStyle.parentNode) document.head.appendChild(animStyle);
}

function applyHighContrast(enabled: boolean) {
  const root = document.documentElement;
  if (enabled) {
    root.setAttribute('data-high-contrast', 'true');
  } else {
    root.removeAttribute('data-high-contrast');
  }
}

const SAVED_THEMES_KEY = 'crm-saved-themes';

function loadSavedThemes(): SavedTheme[] {
  try {
    const raw = localStorage.getItem(SAVED_THEMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistSavedThemes(themes: SavedTheme[]) {
  localStorage.setItem(SAVED_THEMES_KEY, JSON.stringify(themes));
}

export function useCustomTheme() {
  const { user } = useAuth();
  const [customTheme, setCustomTheme] = useState<CustomTheme>(DEFAULT_THEME);
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>(loadSavedThemes);
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
    applyHighContrast(customTheme.highContrast);
  }, [customTheme]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      applyColorPreset(customTheme.colorPreset, isDark, customTheme.customColors);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [customTheme.colorPreset]);

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
    ['custom-heading-font', 'custom-density', 'custom-animations'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }, [saveTheme]);

  const saveCurrentTheme = useCallback((name: string) => {
    const newTheme: SavedTheme = {
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
