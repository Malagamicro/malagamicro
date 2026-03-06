import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FluiditosAvatar, FluiditosConfig, saveFluiditosConfig } from './FluiditosAvatar';
import { X } from 'lucide-react';

const BODY_COLORS = ['#6C63FF', '#FF6B6B', '#48DBFB', '#FF9FF3', '#1DD1A1', '#FFA502', '#EE5A24', '#7158E2', '#3AE374', '#17C0EB'];
const CHEEK_COLORS = ['#FF9FF3', '#FFC0CB', '#FFCCCC', '#FFE0B2', '#E0BBE4', '#transparent'];
const GLOW_COLORS = ['#A29BFE', '#74B9FF', '#FD79A8', '#55EFC4', '#FDCB6E', '#E17055'];

const EYE_OPTIONS: { value: FluiditosConfig['eyeStyle']; label: string }[] = [
  { value: 'round', label: '👀' },
  { value: 'happy', label: '😊' },
  { value: 'wink', label: '😉' },
  { value: 'star', label: '🤩' },
];

const ACCESSORY_OPTIONS: { value: FluiditosConfig['accessory']; label: string }[] = [
  { value: 'none', label: '❌' },
  { value: 'hat', label: '🎩' },
  { value: 'glasses', label: '👓' },
  { value: 'bow', label: '🎀' },
  { value: 'crown', label: '👑' },
  { value: 'headphones', label: '🎧' },
];

const CLOTHING_OPTIONS: { value: FluiditosConfig['clothing']; label: string }[] = [
  { value: 'none', label: '❌' },
  { value: 'tie', label: '👔' },
  { value: 'scarf', label: '🧣' },
  { value: 'cape', label: '🦸' },
  { value: 'hoodie', label: '🧥' },
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

  return (
    <div className="absolute inset-0 z-10 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-sm">Personalizar Fluiditos</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Preview */}
        <div className="flex justify-center">
          <div className="relative">
            <FluiditosAvatar config={draft} size={100} />
          </div>
        </div>

        {/* Body Color */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Color del cuerpo</Label>
          <div className="flex flex-wrap gap-2">
            {BODY_COLORS.map(color => (
              <button
                key={color}
                onClick={() => update({ bodyColor: color })}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${draft.bodyColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Eyes */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Ojos</Label>
          <div className="flex gap-2">
            {EYE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => update({ eyeStyle: opt.value })}
                className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center text-lg transition-transform ${draft.eyeStyle === opt.value ? 'border-primary bg-primary/10 scale-110' : 'border-border'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Accessories */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Accesorios</Label>
          <div className="flex flex-wrap gap-2">
            {ACCESSORY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => update({ accessory: opt.value })}
                className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center text-lg transition-transform ${draft.accessory === opt.value ? 'border-primary bg-primary/10 scale-110' : 'border-border'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clothing */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Ropa</Label>
          <div className="flex flex-wrap gap-2">
            {CLOTHING_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => update({ clothing: opt.value })}
                className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center text-lg transition-transform ${draft.clothing === opt.value ? 'border-primary bg-primary/10 scale-110' : 'border-border'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cheeks Color */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Color mejillas</Label>
          <div className="flex flex-wrap gap-2">
            {CHEEK_COLORS.map(color => (
              <button
                key={color}
                onClick={() => update({ cheeksColor: color })}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${draft.cheeksColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: color === '#transparent' ? 'transparent' : color }}
              >
                {color === '#transparent' && <span className="text-[10px]">🚫</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Glow Color */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Color resplandor</Label>
          <div className="flex flex-wrap gap-2">
            {GLOW_COLORS.map(color => (
              <button
                key={color}
                onClick={() => update({ glowColor: color })}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${draft.glowColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancelar</Button>
        <Button size="sm" className="flex-1" onClick={handleSave}>Guardar</Button>
      </div>
    </div>
  );
}
