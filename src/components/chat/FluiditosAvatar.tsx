import { useMemo } from 'react';

export interface FluiditosConfig {
  bodyColor: string;
  eyeStyle: 'round' | 'happy' | 'wink' | 'star' | 'cute' | 'sleepy';
  accessory: 'none' | 'hat' | 'glasses' | 'bow' | 'crown' | 'headphones' | 'antenna' | 'halo' | 'beanie' | 'sunglasses';
  clothing: 'none' | 'tie' | 'scarf' | 'cape' | 'hoodie' | 'tuxedo' | 'overalls' | 'sweater' | 'labcoat';
  mouth: 'smile' | 'grin' | 'open' | 'tongue' | 'whistle' | 'cat';
  cheeksColor: string;
  glowColor: string;
  pattern: 'none' | 'dots' | 'stripes' | 'stars' | 'hearts';
}

export const DEFAULT_CONFIG: FluiditosConfig = {
  bodyColor: '#6C63FF',
  eyeStyle: 'happy',
  accessory: 'none',
  clothing: 'none',
  mouth: 'smile',
  cheeksColor: '#FF9FF3',
  glowColor: '#A29BFE',
  pattern: 'none',
};

const STORAGE_KEY = 'fluiditos_config';

export function loadFluiditosConfig(): FluiditosConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
  } catch { return DEFAULT_CONFIG; }
}

export function saveFluiditosConfig(config: FluiditosConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  // Also persist to database for cross-device sync
  saveFluiditosConfigToDb(config);
}

async function saveFluiditosConfigToDb(config: FluiditosConfig) {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Load current custom_theme and merge micro config into it
    const { data: profile } = await supabase
      .from('profiles')
      .select('custom_theme')
      .eq('user_id', user.id)
      .maybeSingle();
    
    const currentTheme = (profile?.custom_theme as Record<string, unknown>) || {};
    await supabase
      .from('profiles')
      .update({ custom_theme: { ...currentTheme, fluiditos: config } as any })
      .eq('user_id', user.id);
  } catch (e) {
    console.error('Error saving fluiditos config to DB:', e);
  }
}

export async function loadFluiditosConfigFromDb(): Promise<FluiditosConfig | null> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data } = await supabase
      .from('profiles')
      .select('custom_theme')
      .eq('user_id', user.id)
      .maybeSingle();
    
    const theme = data?.custom_theme as any;
    if (theme?.fluiditos) {
      // Also update localStorage for fast local loading
      localStorage.setItem(STORAGE_KEY, JSON.stringify(theme.fluiditos));
      return { ...DEFAULT_CONFIG, ...theme.fluiditos };
    }
    return null;
  } catch { return null; }
}

export type FluiditosAnimState = 'idle' | 'thinking' | 'typing' | 'responding';

interface Props {
  config?: FluiditosConfig;
  size?: number;
  animated?: boolean;
  animState?: FluiditosAnimState;
  className?: string;
}

export function FluiditosAvatar({ config = DEFAULT_CONFIG, size = 64, animated = true, animState = 'idle', className }: Props) {
  const c = config;
  const id = useMemo(() => Math.random().toString(36).slice(2, 8), []);

  // Animation CSS classes based on state
  const getAnimStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      filter: animated ? `drop-shadow(0 0 8px ${c.glowColor}80)` : undefined,
      transition: 'transform 0.3s ease',
    };
    if (!animated) return base;
    switch (animState) {
      case 'thinking':
        return { ...base, animation: 'fluiditos-think 1.5s ease-in-out infinite' };
      case 'typing':
        return { ...base, animation: 'fluiditos-type 0.4s ease-in-out infinite alternate' };
      case 'responding':
        return { ...base, animation: 'fluiditos-respond 2s ease-in-out infinite' };
      default:
        return { ...base, animation: 'fluiditos-idle 6s ease-in-out infinite' };
    }
  };

  const renderEyes = () => {
    switch (c.eyeStyle) {
      case 'round':
        return <>
          <ellipse cx="38" cy="42" rx="5" ry="5.5" fill="white" />
          <ellipse cx="62" cy="42" rx="5" ry="5.5" fill="white" />
          <circle cx="39.5" cy="43" r="2.5" fill="#222" />
          <circle cx="63.5" cy="43" r="2.5" fill="#222" />
          <circle cx="40.5" cy="41.5" r="1" fill="white" opacity="0.8" />
          <circle cx="64.5" cy="41.5" r="1" fill="white" opacity="0.8" />
        </>;
      case 'happy':
        return <>
          <path d="M33 42 Q38 36 43 42" stroke="white" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <path d="M57 42 Q62 36 67 42" stroke="white" strokeWidth="2.8" fill="none" strokeLinecap="round" />
        </>;
      case 'wink':
        return <>
          <ellipse cx="38" cy="42" rx="5" ry="5.5" fill="white" />
          <circle cx="39.5" cy="43" r="2.5" fill="#222" />
          <circle cx="40.5" cy="41.5" r="1" fill="white" opacity="0.8" />
          <path d="M57 42 Q62 36 67 42" stroke="white" strokeWidth="2.8" fill="none" strokeLinecap="round" />
        </>;
      case 'star':
        return <>
          <text x="31" y="47" fontSize="14" fill="white">★</text>
          <text x="55" y="47" fontSize="14" fill="white">★</text>
        </>;
      case 'cute':
        return <>
          <ellipse cx="38" cy="42" rx="6" ry="7" fill="white" />
          <ellipse cx="62" cy="42" rx="6" ry="7" fill="white" />
          <ellipse cx="39" cy="44" r="4" fill="#222" />
          <ellipse cx="63" cy="44" r="4" fill="#222" />
          <ellipse cx="40" cy="42" rx="1.5" ry="2" fill="white" opacity="0.9" />
          <ellipse cx="64" cy="42" rx="1.5" ry="2" fill="white" opacity="0.9" />
        </>;
      case 'sleepy':
        return <>
          <path d="M33 43 L43 41" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M57 41 L67 43" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <text x="68" y="38" fontSize="8" fill="white" opacity="0.7">z</text>
          <text x="73" y="33" fontSize="6" fill="white" opacity="0.5">z</text>
        </>;
    }
  };

  const renderMouth = () => {
    switch (c.mouth) {
      case 'smile':
        return <path d="M43 54 Q50 60 57 54" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />;
      case 'grin':
        return <>
          <path d="M40 53 Q50 62 60 53" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M42 54 Q50 59 58 54" fill="white" opacity="0.3" />
        </>;
      case 'open':
        return <ellipse cx="50" cy="56" rx="5" ry="4" fill="white" opacity="0.9" />;
      case 'tongue':
        return <>
          <path d="M43 54 Q50 60 57 54" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
          <ellipse cx="50" cy="59" rx="3" ry="3.5" fill="#FF6B9D" />
        </>;
      case 'whistle':
        return <circle cx="50" cy="56" r="3" fill="white" opacity="0.8" />;
      case 'cat':
        return <>
          <path d="M44 54 Q47 56 50 54" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M50 54 Q53 56 56 54" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <circle cx="50" cy="53" r="1" fill="white" />
        </>;
    }
  };

  const renderAccessory = () => {
    switch (c.accessory) {
      case 'hat':
        return <g>
          <ellipse cx="50" cy="20" rx="24" ry="4" fill="#2C3E50" />
          <rect x="36" y="5" width="28" height="17" rx="5" fill="#2C3E50" />
          <rect x="38" y="9" width="24" height="4" rx="2" fill={c.bodyColor} opacity="0.5" />
        </g>;
      case 'glasses':
        return <g>
          <rect x="28" y="37" width="16" height="12" rx="3" fill="none" stroke="white" strokeWidth="2" opacity="0.9" />
          <rect x="56" y="37" width="16" height="12" rx="3" fill="none" stroke="white" strokeWidth="2" opacity="0.9" />
          <path d="M44 43 L56 43" stroke="white" strokeWidth="2" opacity="0.9" />
          <line x1="28" y1="41" x2="22" y2="39" stroke="white" strokeWidth="1.5" opacity="0.7" />
          <line x1="72" y1="41" x2="78" y2="39" stroke="white" strokeWidth="1.5" opacity="0.7" />
          <rect x="29" y="38" width="14" height="10" rx="2" fill="#88CCFF" opacity="0.15" />
          <rect x="57" y="38" width="14" height="10" rx="2" fill="#88CCFF" opacity="0.15" />
        </g>;
      case 'sunglasses':
        return <g>
          <rect x="27" y="36" width="18" height="13" rx="4" fill="#222" opacity="0.85" />
          <rect x="55" y="36" width="18" height="13" rx="4" fill="#222" opacity="0.85" />
          <path d="M45 42 L55 42" stroke="#222" strokeWidth="2.5" />
          <line x1="27" y1="40" x2="20" y2="37" stroke="#222" strokeWidth="2" />
          <line x1="73" y1="40" x2="80" y2="37" stroke="#222" strokeWidth="2" />
          <rect x="29" y="38" width="14" height="4" rx="2" fill="white" opacity="0.1" />
          <rect x="57" y="38" width="14" height="4" rx="2" fill="white" opacity="0.1" />
        </g>;
      case 'bow':
        return <g>
          <path d="M38 20 Q50 12 50 20 Q50 12 62 20 L50 25 Z" fill="#FF6B9D" opacity="0.9" />
          <circle cx="50" cy="20" r="3.5" fill="#FF4081" />
          <path d="M39 18 Q44 14 49 19" fill="none" stroke="#FF85B3" strokeWidth="0.8" />
          <path d="M51 19 Q56 14 61 18" fill="none" stroke="#FF85B3" strokeWidth="0.8" />
        </g>;
      case 'crown':
        return <g>
          <path d="M30 22 L35 8 L42 17 L50 3 L58 17 L65 8 L70 22 Z" fill="#FFD700" />
          <rect x="30" y="20" width="40" height="6" rx="1.5" fill="#FFD700" />
          <rect x="30" y="20" width="40" height="2" fill="#FFC300" opacity="0.5" />
          <circle cx="42" cy="13" r="2.2" fill="#FF4444" />
          <circle cx="50" cy="7" r="2.5" fill="#44AAFF" />
          <circle cx="58" cy="13" r="2.2" fill="#44FF44" />
        </g>;
      case 'headphones':
        return <g>
          <path d="M26 40 Q26 16 50 16 Q74 16 74 40" fill="none" stroke="#333" strokeWidth="4" />
          <rect x="20" y="34" width="10" height="16" rx="5" fill="#444" />
          <rect x="70" y="34" width="10" height="16" rx="5" fill="#444" />
          <rect x="22" y="36" width="6" height="12" rx="3" fill="#666" />
          <rect x="72" y="36" width="6" height="12" rx="3" fill="#666" />
          <rect x="23" y="39" width="4" height="3" rx="1" fill={c.bodyColor} opacity="0.4" />
          <rect x="73" y="39" width="4" height="3" rx="1" fill={c.bodyColor} opacity="0.4" />
        </g>;
      case 'antenna':
        return <g>
          <line x1="50" y1="18" x2="50" y2="4" stroke="#888" strokeWidth="2" />
          <circle cx="50" cy="3" r="4" fill="#FF4444" opacity="0.9">
            {animated && <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1.5s" repeatCount="indefinite" />}
          </circle>
          <circle cx="50" cy="3" r="2" fill="#FF8888" />
        </g>;
      case 'halo':
        return <g>
          <ellipse cx="50" cy="12" rx="18" ry="5" fill="none" stroke="#FFD700" strokeWidth="3" opacity="0.8" />
          <ellipse cx="50" cy="12" rx="18" ry="5" fill="none" stroke="#FFF8DC" strokeWidth="1" opacity="0.5" />
          {animated && <ellipse cx="50" cy="12" rx="18" ry="5" fill="none" stroke="#FFD700" strokeWidth="1" opacity="0.3">
            <animate attributeName="ry" values="5;6;5" dur="2s" repeatCount="indefinite" />
          </ellipse>}
        </g>;
      case 'beanie':
        return <g>
          <path d="M24 30 Q24 10 50 10 Q76 10 76 30" fill="#E74C3C" />
          <rect x="24" y="26" width="52" height="7" rx="2" fill="#C0392B" />
          <rect x="24" y="26" width="52" height="3" rx="1" fill="#E74C3C" opacity="0.7" />
          <circle cx="50" cy="6" r="5" fill="#E74C3C" />
          <circle cx="50" cy="5" r="3" fill="#C0392B" />
        </g>;
      default: return null;
    }
  };

  const renderClothing = () => {
    switch (c.clothing) {
      case 'tie':
        return <g>
          <polygon points="48,56 50,58 52,56 51,62 53,68 50,72 47,68 49,62" fill="#CC3333" />
          <rect x="46.5" y="54" width="7" height="4" rx="1.5" fill="#CC3333" />
          <line x1="50" y1="56" x2="50" y2="70" stroke="#AA2222" strokeWidth="0.5" opacity="0.5" />
        </g>;
      case 'scarf':
        return <g>
          <path d="M26 52 Q38 58 50 56 Q62 58 74 52 Q74 60 68 64 Q56 68 50 66 Q44 68 32 64 Q26 60 26 52Z" fill="#FF6B35" opacity="0.85" />
          <path d="M58 58 Q62 68 58 78 Q56 82 52 80" stroke="#FF6B35" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M58 58 Q62 68 58 78 Q56 82 52 80" stroke="#E65B25" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.5" />
          <line x1="30" y1="55" x2="70" y2="55" stroke="#E65B25" strokeWidth="0.8" opacity="0.4" />
          <line x1="28" y1="58" x2="72" y2="58" stroke="#E65B25" strokeWidth="0.8" opacity="0.3" />
        </g>;
      case 'cape':
        return <g>
          <path d="M28 48 Q24 68 32 88 Q44 94 50 94 Q56 94 68 88 Q76 68 72 48" fill="#CC2222" opacity="0.65" />
          <path d="M28 48 Q24 68 32 88" stroke="#AA1111" strokeWidth="1" fill="none" opacity="0.4" />
          <path d="M72 48 Q76 68 68 88" stroke="#AA1111" strokeWidth="1" fill="none" opacity="0.4" />
          <path d="M30 50 L70 50" stroke="#FFD700" strokeWidth="1.5" opacity="0.6" />
        </g>;
      case 'hoodie':
        return <g>
          <path d="M24 46 Q22 58 26 70 Q34 82 50 82 Q66 82 74 70 Q78 58 76 46" fill="#555" opacity="0.8" />
          <path d="M34 46 Q34 38 42 36 L50 34 L58 36 Q66 38 66 46" fill="#555" opacity="0.6" />
          <path d="M42 62 Q50 70 58 62" stroke="#666" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <ellipse cx="50" cy="74" rx="5" ry="3.5" fill="#444" />
          <circle cx="50" cy="74" r="2" fill="#333" />
        </g>;
      case 'tuxedo':
        return <g>
          <path d="M30 54 L50 60 L70 54 L72 82 L28 82 Z" fill="#1a1a2e" opacity="0.85" />
          <path d="M50 56 L50 80" stroke="white" strokeWidth="1" opacity="0.3" />
          <path d="M42 54 L50 60 L58 54" fill="white" opacity="0.9" />
          <path d="M44 55 L50 59 L56 55" fill="none" stroke="#ddd" strokeWidth="0.5" />
          <rect x="48" y="62" width="4" height="3" rx="1" fill="#FF4444" />
          <circle cx="50" cy="67" r="1.2" fill="#FFD700" />
          <circle cx="50" cy="72" r="1.2" fill="#FFD700" />
        </g>;
      case 'overalls':
        return <g>
          <path d="M32 56 L32 82 L68 82 L68 56" fill="#4A90D9" opacity="0.8" />
          <path d="M38 56 L38 46" stroke="#4A90D9" strokeWidth="4" strokeLinecap="round" />
          <path d="M62 56 L62 46" stroke="#4A90D9" strokeWidth="4" strokeLinecap="round" />
          <rect x="42" y="64" width="16" height="10" rx="2" fill="#3A7BC8" opacity="0.6" />
          <circle cx="38" cy="58" r="2" fill="#FFD700" />
          <circle cx="62" cy="58" r="2" fill="#FFD700" />
        </g>;
      case 'sweater':
        return <g>
          <path d="M26 50 Q26 62 30 72 Q40 82 50 82 Q60 82 70 72 Q74 62 74 50" fill="#2ECC71" opacity="0.75" />
          <path d="M26 56 L74 56" stroke="#27AE60" strokeWidth="1" opacity="0.4" />
          <path d="M26 62 L74 62" stroke="#27AE60" strokeWidth="1" opacity="0.3" />
          <path d="M26 68 L74 68" stroke="#27AE60" strokeWidth="1" opacity="0.3" />
          <path d="M38 52 Q50 48 62 52" stroke="#27AE60" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>;
      case 'labcoat':
        return <g>
          <path d="M26 48 Q24 64 28 80 Q38 88 50 88 Q62 88 72 80 Q76 64 74 48" fill="white" opacity="0.85" />
          <path d="M50 48 L50 86" stroke="#eee" strokeWidth="1" />
          <rect x="34" y="62" width="10" height="8" rx="2" fill="#f0f0f0" stroke="#ddd" strokeWidth="0.5" />
          <circle cx="56" cy="58" r="1.5" fill="#ddd" />
          <circle cx="56" cy="64" r="1.5" fill="#ddd" />
          <circle cx="56" cy="70" r="1.5" fill="#ddd" />
        </g>;
      default: return null;
    }
  };

  const renderPattern = () => {
    switch (c.pattern) {
      case 'dots':
        return <g opacity="0.2">
          <circle cx="35" cy="35" r="1.5" fill="white" />
          <circle cx="45" cy="30" r="1.5" fill="white" />
          <circle cx="55" cy="33" r="1.5" fill="white" />
          <circle cx="65" cy="36" r="1.5" fill="white" />
          <circle cx="40" cy="65" r="1.5" fill="white" />
          <circle cx="60" cy="62" r="1.5" fill="white" />
        </g>;
      case 'stripes':
        return <g opacity="0.12">
          <line x1="30" y1="30" x2="70" y2="30" stroke="white" strokeWidth="2" />
          <line x1="25" y1="40" x2="75" y2="40" stroke="white" strokeWidth="2" />
          <line x1="25" y1="50" x2="75" y2="50" stroke="white" strokeWidth="2" />
          <line x1="25" y1="60" x2="75" y2="60" stroke="white" strokeWidth="2" />
          <line x1="30" y1="70" x2="70" y2="70" stroke="white" strokeWidth="2" />
        </g>;
      case 'stars':
        return <g opacity="0.2">
          <text x="30" y="36" fontSize="7" fill="white">✦</text>
          <text x="58" y="32" fontSize="5" fill="white">✦</text>
          <text x="42" y="70" fontSize="6" fill="white">✦</text>
          <text x="62" y="65" fontSize="4" fill="white">✦</text>
        </g>;
      case 'hearts':
        return <g opacity="0.2">
          <text x="32" y="34" fontSize="7" fill="white">♥</text>
          <text x="60" y="30" fontSize="5" fill="white">♥</text>
          <text x="40" y="68" fontSize="6" fill="white">♥</text>
        </g>;
      default: return null;
    }
  };

  const renderCheeks = () => (
    <>
      <ellipse cx="30" cy="50" rx="5" ry="3.5" fill={c.cheeksColor} opacity="0.35" />
      <ellipse cx="70" cy="50" rx="5" ry="3.5" fill={c.cheeksColor} opacity="0.35" />
    </>
  );

  return (
    <>
      <style>{`
        @keyframes fluiditos-idle {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-2px) rotate(1deg); }
          50% { transform: translateY(1px) rotate(-0.5deg); }
          75% { transform: translateY(-1px) rotate(0.5deg); }
        }
        @keyframes fluiditos-think {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.03) rotate(-3deg); }
          50% { transform: scale(0.97) rotate(3deg); }
          75% { transform: scale(1.02) rotate(-1deg); }
        }
        @keyframes fluiditos-type {
          0% { transform: scale(1) translateY(0); }
          100% { transform: scale(1.02) translateY(-1px); }
        }
        @keyframes fluiditos-respond {
          0%, 100% { transform: scale(1) translateY(0); }
          15% { transform: scale(1.06) translateY(-3px); }
          30% { transform: scale(0.98) translateY(1px); }
          50% { transform: scale(1.03) translateY(-2px) rotate(2deg); }
          70% { transform: scale(0.99) rotate(-1deg); }
        }
      `}</style>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={className}
        style={getAnimStyle()}
      >
      <defs>
        <radialGradient id={`grad-${id}`} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="white" stopOpacity="0.35" />
          <stop offset="100%" stopColor={c.bodyColor} stopOpacity="0" />
        </radialGradient>
        {animated && (
          <filter id={`glow-${id}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* Cape goes behind body */}
      {c.clothing === 'cape' && renderClothing()}

      {/* Body - organic blob shape */}
      <g filter={animated ? `url(#glow-${id})` : undefined}>
        <path
          d="M50 15 C72 15 82 28 82 50 C82 72 72 85 50 85 C28 85 18 72 18 50 C18 28 28 15 50 15Z"
          fill={c.bodyColor}
        >
          {animated && (
            <animate
              attributeName="d"
              values="M50 15 C72 15 82 28 82 50 C82 72 72 85 50 85 C28 85 18 72 18 50 C18 28 28 15 50 15Z;
                      M50 14 C74 16 84 30 80 52 C78 74 68 86 50 86 C32 86 20 74 20 52 C18 30 26 16 50 14Z;
                      M50 15 C72 15 82 28 82 50 C82 72 72 85 50 85 C28 85 18 72 18 50 C18 28 28 15 50 15Z"
              dur="4s"
              repeatCount="indefinite"
            />
          )}
        </path>
        {/* Glossy highlight */}
        <path
          d="M50 15 C72 15 82 28 82 50 C82 72 72 85 50 85 C28 85 18 72 18 50 C18 28 28 15 50 15Z"
          fill={`url(#grad-${id})`}
        />
      </g>

      {/* Pattern on body */}
      {renderPattern()}

      {/* Clothing (except cape) */}
      {c.clothing !== 'cape' && c.clothing !== 'none' && renderClothing()}

      {/* Face */}
      {renderCheeks()}
      {renderEyes()}
      {renderMouth()}

      {/* Accessory */}
      {renderAccessory()}
      </svg>
    </>
  );
}
