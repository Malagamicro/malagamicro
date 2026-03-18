export type ColorPreset = 'default' | 'ocean' | 'forest' | 'sunset' | 'berry' | 'slate' | 'midnight' | 'copper' | 'rose' | 'emerald' | 'liquid-glass' | 'neon' | 'monochrome' | 'arctic' | 'warm-sand' | 'custom';
export type BackgroundPattern = 'none' | 'dots' | 'grid' | 'diagonal' | 'waves' | 'cross' | 'noise' | 'gradient-radial' | 'hexagons' | 'circuit' | 'diamonds' | 'aurora' | 'bubbles';
export type FontFamily = 'dm-sans' | 'inter' | 'poppins' | 'nunito' | 'outfit' | 'work-sans' | 'space-grotesk' | 'raleway' | 'plus-jakarta' | 'manrope';
export type BorderRadiusSize = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type FontSizeScale = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type UIDensity = 'compact' | 'comfortable' | 'spacious';
export type SidebarStyle = 'solid' | 'glass' | 'transparent';
export type AnimationSpeed = 'none' | 'reduced' | 'normal' | 'smooth';
export type ScrollbarStyle = 'default' | 'thin' | 'hidden' | 'rounded' | 'colored';

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
  statusNew?: string;
  statusContacted?: string;
  statusInterested?: string;
  statusClient?: string;
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
  scrollbarStyle: ScrollbarStyle;
  highContrast: boolean;
  customColors?: CustomColors;
}

export interface SavedTheme {
  id: string;
  name: string;
  theme: CustomTheme;
  createdAt: string;
}

export const DEFAULT_THEME: CustomTheme = {
  colorPreset: 'default',
  backgroundPattern: 'none',
  fontFamily: 'dm-sans',
  borderRadius: 'lg',
  fontSize: 'md',
  uiDensity: 'comfortable',
  sidebarStyle: 'solid',
  animationSpeed: 'normal',
  scrollbarStyle: 'default',
  highContrast: false,
  customColors: undefined,
};

export interface ColorSystem {
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

export const CSS_VAR_MAP: Record<keyof ColorSystem, string> = {
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

export const PATTERN_SIZES: Record<BackgroundPattern, string> = {
  none: '', dots: '20px 20px', grid: '24px 24px, 24px 24px',
  diagonal: '', waves: '', cross: '16px 16px, 16px 16px',
  noise: '256px 256px', 'gradient-radial': '',
  hexagons: '28px 49px', circuit: '40px 40px', diamonds: '16px 32px',
  aurora: '', bubbles: '',
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

export const SCROLLBAR_STYLE_OPTIONS: Record<ScrollbarStyle, { label: string; description: string }> = {
  default: { label: 'Por defecto', description: 'Scrollbar nativo del sistema' },
  thin: { label: 'Fino', description: 'Scrollbar estrecho y discreto' },
  hidden: { label: 'Oculto', description: 'Sin scrollbar visible' },
  rounded: { label: 'Redondeado', description: 'Scrollbar con bordes suaves' },
  colored: { label: 'Con color', description: 'Scrollbar con el color primario' },
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
