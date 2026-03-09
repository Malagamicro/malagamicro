import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FluiditosAvatar, FluiditosConfig, saveFluiditosConfig } from './MicroAvatar';
import { X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

const BODY_COLORS = ['#6C63FF', '#FF6B6B', '#48DBFB', '#FF9FF3', '#1DD1A1', '#FFA502', '#EE5A24', '#7158E2', '#3AE374', '#17C0EB', '#FDA7DF', '#2C3E50', '#F39C12', '#1ABC9C'];
const CHEEK_COLORS = ['#FF9FF3', '#FFC0CB', '#FFCCCC', '#FFE0B2', '#E0BBE4', 'transparent'];
const GLOW_COLORS = ['#A29BFE', '#74B9FF', '#FD79A8', '#55EFC4', '#FDCB6E', '#E17055', '#00CEC9', '#6C5CE7', 'transparent'];

const EYE_OPTIONS: { value: FluiditosConfig['eyeStyle']; label: string; desc: string }[] = [
  { value: 'round', label: '👀', desc: 'Redondos' },
  { value: 'happy', label: '😊', desc: 'Feliz' },
  { value: 'wink', label: '😉', desc: 'Guiño' },
  { value: 'star', label: '🤩', desc: 'Estrellas' },
  { value: 'cute', label: '🥺', desc: 'Tierno' },
  { value: 'sleepy', label: '😴', desc: 'Dormilón' },
];

const MOUTH_OPTIONS: { value: FluiditosConfig['mouth']; label: string; desc: string }[] = [
  { value: 'smile', label: '😊', desc: 'Sonrisa' },
  { value: 'grin', label: '😄', desc: 'Sonrisota' },
  { value: 'open', label: '😮', desc: 'Abierta' },
  { value: 'tongue', label: '😛', desc: 'Lengua' },
  { value: 'whistle', label: '😗', desc: 'Silbar' },
  { value: 'cat', label: '😺', desc: 'Gatito' },
];

const ACCESSORY_OPTIONS: { value: FluiditosConfig['accessory']; label: string; desc: string }[] = [
  { value: 'none', label: '❌', desc: 'Ninguno' },
  { value: 'hat', label: '🎩', desc: 'Sombrero' },
  { value: 'glasses', label: '👓', desc: 'Gafas' },
  { value: 'sunglasses', label: '🕶️', desc: 'Sol' },
  { value: 'bow', label: '🎀', desc: 'Lazo' },
  { value: 'crown', label: '👑', desc: 'Corona' },
  { value: 'headphones', label: '🎧', desc: 'Auriculares' },
  { value: 'antenna', label: '📡', desc: 'Antena' },
  { value: 'halo', label: '😇', desc: 'Halo' },
  { value: 'beanie', label: '🧢', desc: 'Gorro' },
];

const CLOTHING_OPTIONS: { value: FluiditosConfig['clothing']; label: string; desc: string }[] = [
  { value: 'none', label: '❌', desc: 'Ninguna' },
  { value: 'tie', label: '👔', desc: 'Corbata' },
  { value: 'scarf', label: '🧣', desc: 'Bufanda' },
  { value: 'cape', label: '🦸', desc: 'Capa' },
  { value: 'hoodie', label: '🧥', desc: 'Sudadera' },
  { value: 'tuxedo', label: '🤵', desc: 'Esmoquin' },
  { value: 'overalls', label: '👷', desc: 'Peto' },
  { value: 'sweater', label: '🧶', desc: 'Jersey' },
  { value: 'labcoat', label: '🥼', desc: 'Bata' },
];

const PATTERN_OPTIONS: { value: FluiditosConfig['pattern']; label: string; desc: string }[] = [
  { value: 'none', label: '❌', desc: 'Ninguno' },
  { value: 'dots', label: '⚬', desc: 'Puntos' },
  { value: 'stripes', label: '☰', desc: 'Rayas' },
  { value: 'stars', label: '✦', desc: 'Estrellas' },
  { value: 'hearts', label: '♥', desc: 'Corazones' },
];

interface Props {
  config: FluiditosConfig;
  onChange: (config: FluiditosConfig) => void;
  onClose: () => void;
}

export function FluiditosCustomizer({ config, onChange, onClose }: Props) {
  const [draft, setDraft] = useState<FluiditosConfig>(config);

  const update = (partial: Partial<FluiditosConfig>) => {
    setDraft(prev => ({ ...prev, ...partial }));
  };

  const handleSave = () => {
    saveFluiditosConfig(draft);
    onChange(draft);
    onClose();
  };

  const handleReset = () => {
    const { DEFAULT_CONFIG } = require('./MicroAvatar');
    setDraft(DEFAULT_CONFIG);
  };

  const OptionButton = ({ selected, onClick, label, desc }: { selected: boolean; onClick: () => void; label: string; desc: string }) => (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-0.5 p-1.5 rounded-lg border-2 transition-all text-center min-w-[3rem]',
        selected ? 'border-primary bg-primary/10 scale-105' : 'border-border hover:border-primary/40'
      )}
    >
      <span className="text-base leading-none">{label}</span>
      <span className="text-[9px] text-muted-foreground leading-tight">{desc}</span>
    </button>
  );

  const ColorPicker = ({ colors, value, onChange: onColorChange, allowTransparent = false }: { colors: string[]; value: string; onChange: (c: string) => void; allowTransparent?: boolean }) => (
    <div className="flex flex-wrap gap-1.5">
      {colors.map(color => (
        <button
          key={color}
          onClick={() => onColorChange(color)}
          className={cn(
            'w-6 h-6 rounded-full border-2 transition-transform',
            value === color ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
          )}
          style={{ backgroundColor: color === 'transparent' ? 'transparent' : color }}
        >
          {color === 'transparent' && <span className="text-[8px]">🚫</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-sm">Personalizar Micro</h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset} title="Restablecer">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Preview */}
          <div className="flex justify-center py-2">
            <div className="relative bg-muted/30 rounded-2xl p-4">
              <FluiditosAvatar config={draft} size={120} />
            </div>
          </div>

          {/* Body Color */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Color del cuerpo</Label>
            <ColorPicker colors={BODY_COLORS} value={draft.bodyColor} onChange={c => update({ bodyColor: c })} />
          </div>

          {/* Eyes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Ojos</Label>
            <div className="flex flex-wrap gap-1.5">
              {EYE_OPTIONS.map(opt => (
                <OptionButton key={opt.value} selected={draft.eyeStyle === opt.value} onClick={() => update({ eyeStyle: opt.value })} label={opt.label} desc={opt.desc} />
              ))}
            </div>
          </div>

          {/* Mouth */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Boca</Label>
            <div className="flex flex-wrap gap-1.5">
              {MOUTH_OPTIONS.map(opt => (
                <OptionButton key={opt.value} selected={draft.mouth === opt.value} onClick={() => update({ mouth: opt.value })} label={opt.label} desc={opt.desc} />
              ))}
            </div>
          </div>

          {/* Accessories */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Accesorios</Label>
            <div className="flex flex-wrap gap-1.5">
              {ACCESSORY_OPTIONS.map(opt => (
                <OptionButton key={opt.value} selected={draft.accessory === opt.value} onClick={() => update({ accessory: opt.value })} label={opt.label} desc={opt.desc} />
              ))}
            </div>
          </div>

          {/* Clothing */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Ropa</Label>
            <div className="flex flex-wrap gap-1.5">
              {CLOTHING_OPTIONS.map(opt => (
                <OptionButton key={opt.value} selected={draft.clothing === opt.value} onClick={() => update({ clothing: opt.value })} label={opt.label} desc={opt.desc} />
              ))}
            </div>
          </div>

          {/* Pattern */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Patrón corporal</Label>
            <div className="flex flex-wrap gap-1.5">
              {PATTERN_OPTIONS.map(opt => (
                <OptionButton key={opt.value} selected={draft.pattern === opt.value} onClick={() => update({ pattern: opt.value })} label={opt.label} desc={opt.desc} />
              ))}
            </div>
          </div>

          {/* Cheeks Color */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Color mejillas</Label>
            <ColorPicker colors={CHEEK_COLORS} value={draft.cheeksColor} onChange={c => update({ cheeksColor: c })} allowTransparent />
          </div>

          {/* Glow Color */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Color resplandor</Label>
            <ColorPicker colors={GLOW_COLORS} value={draft.glowColor} onChange={c => update({ glowColor: c })} allowTransparent />
          </div>
        </div>
      </ScrollArea>

      <div className="p-3 border-t flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancelar</Button>
        <Button size="sm" className="flex-1" onClick={handleSave}>Guardar</Button>
      </div>
    </div>
  );
}
