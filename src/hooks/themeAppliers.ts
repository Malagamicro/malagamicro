import {
  type ColorPreset, type BackgroundPattern, type FontFamily,
  type BorderRadiusSize, type FontSizeScale, type UIDensity,
  type SidebarStyle, type AnimationSpeed, type ScrollbarStyle,
  type CustomColors, type ColorSystem,
  COLOR_PRESETS, BACKGROUND_PATTERNS, FONT_FAMILIES,
  BORDER_RADIUS_OPTIONS, FONT_SIZE_OPTIONS,
  CSS_VAR_MAP, PATTERN_SIZES,
} from './themeConstants';

export function applyColorPreset(preset: ColorPreset, isDark: boolean, customColors?: CustomColors) {
  const config = COLOR_PRESETS[preset];
  if (!config) return;
  const mode = isDark ? config.dark : config.light;
  const root = document.documentElement;

  const derivedCustom: Partial<Record<keyof ColorSystem, string>> = {};
  if (preset === 'custom' && customColors) {
    if (customColors.primary) derivedCustom.primary = customColors.primary;
    if (customColors.primaryForeground) derivedCustom.primaryForeground = customColors.primaryForeground;
    if (customColors.secondary) derivedCustom.secondary = customColors.secondary;
    if (customColors.secondaryForeground) derivedCustom.secondaryForeground = customColors.secondaryForeground;
    if (customColors.accent) derivedCustom.accent = customColors.accent;
    if (customColors.accentForeground) derivedCustom.accentForeground = customColors.accentForeground;
    if (customColors.background) derivedCustom.background = customColors.background;
    if (customColors.foreground) derivedCustom.foreground = customColors.foreground;
    if (customColors.card) derivedCustom.card = customColors.card;
    if (customColors.cardForeground) derivedCustom.cardForeground = customColors.cardForeground;
    if (customColors.muted) derivedCustom.muted = customColors.muted;
    if (customColors.mutedForeground) derivedCustom.mutedForeground = customColors.mutedForeground;
    if (customColors.border) derivedCustom.border = customColors.border;
    if (customColors.sidebarBackground) derivedCustom.sidebarBackground = customColors.sidebarBackground;
    if (customColors.sidebarForeground) derivedCustom.sidebarForeground = customColors.sidebarForeground;
    if (customColors.sidebarAccent) derivedCustom.sidebarAccent = customColors.sidebarAccent;
    if (customColors.sidebarBorder) derivedCustom.sidebarBorder = customColors.sidebarBorder;

    derivedCustom.popover = customColors.card || customColors.background || mode.popover;
    derivedCustom.popoverForeground = customColors.cardForeground || customColors.foreground || mode.popoverForeground;
    if (!derivedCustom.cardForeground && customColors.foreground) {
      derivedCustom.cardForeground = customColors.foreground;
    }
    derivedCustom.input = customColors.border || mode.input;
    derivedCustom.ring = customColors.primary || mode.ring;
    if (!derivedCustom.primaryForeground) derivedCustom.primaryForeground = mode.primaryForeground;
    if (!derivedCustom.secondaryForeground) derivedCustom.secondaryForeground = mode.secondaryForeground;
    if (!derivedCustom.accentForeground) derivedCustom.accentForeground = mode.accentForeground;
    if (!derivedCustom.mutedForeground) derivedCustom.mutedForeground = mode.mutedForeground;
    derivedCustom.destructive = mode.destructive;
    derivedCustom.destructiveForeground = mode.destructiveForeground;
    derivedCustom.sidebarPrimary = customColors.primary || mode.sidebarPrimary;
    derivedCustom.sidebarPrimaryForeground = customColors.primaryForeground || mode.sidebarPrimaryForeground;
    derivedCustom.sidebarAccentForeground = customColors.sidebarForeground || mode.sidebarAccentForeground;
  }

  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const k = key as keyof ColorSystem;
    if (preset === 'custom' && derivedCustom[k]) {
      root.style.setProperty(cssVar, derivedCustom[k]!);
    } else {
      const value = mode[k];
      if (value) root.style.setProperty(cssVar, value);
    }
  }

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

export function applyBackgroundPattern(pattern: BackgroundPattern) {
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

export function applyFont(font: FontFamily) {
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

export function applyBorderRadius(size: BorderRadiusSize) {
  const config = BORDER_RADIUS_OPTIONS[size];
  if (!config) return;
  document.documentElement.style.setProperty('--radius', config.value);
}

export function applyFontSize(scale: FontSizeScale) {
  const config = FONT_SIZE_OPTIONS[scale];
  if (!config) return;
  document.documentElement.style.setProperty('--font-size-scale', config.scale);
  document.documentElement.style.fontSize = config.scale;
}

export function applyUIDensity(density: UIDensity) {
  const root = document.documentElement;
  root.setAttribute('data-density', density);
  const densityStyle = document.getElementById('custom-density') || document.createElement('style');
  densityStyle.id = 'custom-density';
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

export function applySidebarStyle(style: SidebarStyle) {
  document.documentElement.setAttribute('data-sidebar-style', style);
}

export function applyAnimationSpeed(speed: AnimationSpeed) {
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

export function applyScrollbarStyle(style: ScrollbarStyle) {
  const scrollStyle = document.getElementById('custom-scrollbar') || document.createElement('style');
  scrollStyle.id = 'custom-scrollbar';
  switch (style) {
    case 'thin':
      scrollStyle.textContent = `
        * { scrollbar-width: thin; scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent; }
        *::-webkit-scrollbar { width: 4px; height: 4px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground) / 0.3); border-radius: 4px; }
        *::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.5); }
      `;
      break;
    case 'hidden':
      scrollStyle.textContent = `
        * { scrollbar-width: none; }
        *::-webkit-scrollbar { display: none; }
      `;
      break;
    case 'rounded':
      scrollStyle.textContent = `
        * { scrollbar-width: thin; scrollbar-color: hsl(var(--muted-foreground) / 0.25) hsl(var(--muted) / 0.3); }
        *::-webkit-scrollbar { width: 8px; height: 8px; }
        *::-webkit-scrollbar-track { background: hsl(var(--muted) / 0.3); border-radius: 10px; margin: 4px; }
        *::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground) / 0.25); border-radius: 10px; border: 2px solid transparent; background-clip: padding-box; }
        *::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.4); border-radius: 10px; border: 2px solid transparent; background-clip: padding-box; }
      `;
      break;
    case 'colored':
      scrollStyle.textContent = `
        * { scrollbar-width: thin; scrollbar-color: hsl(var(--primary) / 0.4) hsl(var(--primary) / 0.08); }
        *::-webkit-scrollbar { width: 6px; height: 6px; }
        *::-webkit-scrollbar-track { background: hsl(var(--primary) / 0.08); border-radius: 6px; }
        *::-webkit-scrollbar-thumb { background: hsl(var(--primary) / 0.4); border-radius: 6px; }
        *::-webkit-scrollbar-thumb:hover { background: hsl(var(--primary) / 0.6); }
      `;
      break;
    default:
      scrollStyle.textContent = '';
      break;
  }
  if (!scrollStyle.parentNode) document.head.appendChild(scrollStyle);
}

export function applyHighContrast(enabled: boolean) {
  if (enabled) {
    document.documentElement.setAttribute('data-high-contrast', 'true');
  } else {
    document.documentElement.removeAttribute('data-high-contrast');
  }
}
