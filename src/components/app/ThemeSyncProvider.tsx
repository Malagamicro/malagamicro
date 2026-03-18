import { useThemeSync } from '@/hooks/useThemeSync';

export function ThemeSyncProvider({ children }: { children: React.ReactNode }) {
  // Initialize theme sync - loads theme from profile on mount
  useThemeSync();
  
  return <>{children}</>;
}
