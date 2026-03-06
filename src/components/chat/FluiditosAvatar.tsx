import { useMemo } from 'react';

export interface FluiditosConfig {
  bodyColor: string;
  eyeStyle: 'round' | 'happy' | 'wink' | 'star';
  accessory: 'none' | 'hat' | 'glasses' | 'bow' | 'crown' | 'headphones';
  clothing: 'none' | 'tie' | 'scarf' | 'cape' | 'hoodie';
  cheeksColor: string;
  glowColor: string;
}

export const DEFAULT_CONFIG: FluiditosConfig = {
  bodyColor: '#6C63FF',
  eyeStyle: 'happy',
  accessory: 'none',
  clothing: 'none',
  cheeksColor: '#FF9FF3',
  glowColor: '#A29BFE',
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
}

interface Props {
  config?: FluiditosConfig;
  size?: number;
  animated?: boolean;
  className?: string;
}

export function FluiditosAvatar({ config = DEFAULT_CONFIG, size = 64, animated = true, className }: Props) {
  const c = config;
  const id = useMemo(() => Math.random().toString(36).slice(2, 8), []);

  const renderEyes = () => {
    switch (c.eyeStyle) {
      case 'round':
        return <>
          <circle cx="38" cy="42" r="4" fill="white" />
          <circle cx="62" cy="42" r="4" fill="white" />
          <circle cx="39" cy="43" r="2" fill="#222" />
          <circle cx="63" cy="43" r="2" fill="#222" />
        </>;
      case 'happy':
        return <>
          <path d="M34 42 Q38 38 42 42" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M58 42 Q62 38 66 42" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>;
      case 'wink':
        return <>
          <circle cx="38" cy="42" r="4" fill="white" />
          <circle cx="39" cy="43" r="2" fill="#222" />
          <path d="M58 42 Q62 38 66 42" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>;
      case 'star':
        return <>
          <text x="33" y="47" fontSize="12" fill="white">★</text>
          <text x="57" y="47" fontSize="12" fill="white">★</text>
        </>;
    }
  };

  const renderAccessory = () => {
    switch (c.accessory) {
      case 'hat':
        return <g>
          <rect x="30" y="14" width="40" height="6" rx="2" fill="#333" />
          <rect x="38" y="4" width="24" height="14" rx="4" fill="#333" />
          <rect x="40" y="7" width="20" height="3" rx="1" fill={c.bodyColor} opacity="0.6" />
        </g>;
      case 'glasses':
        return <g>
          <circle cx="38" cy="42" r="8" fill="none" stroke="#333" strokeWidth="2" />
          <circle cx="62" cy="42" r="8" fill="none" stroke="#333" strokeWidth="2" />
          <path d="M46 42 L54 42" stroke="#333" strokeWidth="2" />
          <path d="M30 40 L28 38" stroke="#333" strokeWidth="2" />
          <path d="M70 40 L72 38" stroke="#333" strokeWidth="2" />
        </g>;
      case 'bow':
        return <g>
          <path d="M42 22 Q50 16 50 22 Q50 16 58 22 L50 26 Z" fill="#FF6B9D" />
          <circle cx="50" cy="22" r="3" fill="#FF4081" />
        </g>;
      case 'crown':
        return <g>
          <path d="M32 22 L36 10 L42 18 L50 6 L58 18 L64 10 L68 22 Z" fill="#FFD700" />
          <rect x="32" y="20" width="36" height="5" rx="1" fill="#FFD700" />
          <circle cx="42" cy="14" r="2" fill="#FF4444" />
          <circle cx="50" cy="9" r="2" fill="#44AAFF" />
          <circle cx="58" cy="14" r="2" fill="#44FF44" />
        </g>;
      case 'headphones':
        return <g>
          <path d="M28 42 Q28 20 50 20 Q72 20 72 42" fill="none" stroke="#444" strokeWidth="3" />
          <rect x="24" y="36" width="8" height="14" rx="4" fill="#555" />
          <rect x="68" y="36" width="8" height="14" rx="4" fill="#555" />
          <rect x="25" y="38" width="6" height="10" rx="3" fill="#888" />
          <rect x="69" y="38" width="6" height="10" rx="3" fill="#888" />
        </g>;
      default: return null;
    }
  };

  const renderClothing = () => {
    switch (c.clothing) {
      case 'tie':
        return <g>
          <path d="M48 58 L50 72 L52 58 Z" fill="#CC3333" />
          <rect x="47" y="56" width="6" height="4" rx="1" fill="#CC3333" />
        </g>;
      case 'scarf':
        return <g>
          <path d="M30 55 Q50 62 70 55 Q70 62 65 64 Q50 68 35 64 Q30 62 30 55Z" fill="#FF6B35" opacity="0.9" />
          <path d="M55 60 Q58 70 54 78" stroke="#FF6B35" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>;
      case 'cape':
        return <g>
          <path d="M30 50 Q28 70 35 85 Q50 90 65 85 Q72 70 70 50" fill="#CC2222" opacity="0.7" />
          <path d="M30 50 Q28 70 35 85 Q50 90 65 85 Q72 70 70 50" fill="none" stroke="#AA1111" strokeWidth="1" />
        </g>;
      case 'hoodie':
        return <g>
          <path d="M28 48 Q28 60 32 70 Q40 78 50 78 Q60 78 68 70 Q72 60 72 48" fill="#555" opacity="0.85" />
          <path d="M44 62 Q50 68 56 62" stroke="#666" strokeWidth="2" fill="none" />
          <ellipse cx="50" cy="72" rx="4" ry="3" fill="#444" />
        </g>;
      default: return null;
    }
  };

  const renderMouth = () => (
    <path d="M43 52 Q50 58 57 52" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
  );

  const renderCheeks = () => (
    <>
      <ellipse cx="30" cy="50" rx="5" ry="3.5" fill={c.cheeksColor} opacity="0.4" />
      <ellipse cx="70" cy="50" rx="5" ry="3.5" fill={c.cheeksColor} opacity="0.4" />
    </>
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={{ filter: animated ? `drop-shadow(0 0 8px ${c.glowColor}80)` : undefined }}
    >
      <defs>
        <radialGradient id={`grad-${id}`} cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="white" stopOpacity="0.3" />
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

      {/* Clothing (except cape) */}
      {c.clothing !== 'cape' && c.clothing !== 'none' && renderClothing()}

      {/* Face */}
      {renderCheeks()}
      {renderEyes()}
      {renderMouth()}

      {/* Accessory */}
      {renderAccessory()}
    </svg>
  );
}
