import { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface Requirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: Requirement[] = [
  { label: 'Al menos 8 caracteres', test: (p) => p.length >= 8 },
  { label: 'Una letra mayúscula', test: (p) => /[A-Z]/.test(p) },
  { label: 'Una letra minúscula', test: (p) => /[a-z]/.test(p) },
  { label: 'Un número', test: (p) => /[0-9]/.test(p) },
  { label: 'Un carácter especial (!@#$%...)', test: (p) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/.test(p) },
];

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const { score, passedRequirements } = useMemo(() => {
    const passed = requirements.filter((req) => req.test(password));
    return {
      score: passed.length,
      passedRequirements: passed.map((req) => req.label),
    };
  }, [password]);

  const strengthLabel = useMemo(() => {
    if (password.length === 0) return { text: '', color: '' };
    if (score <= 1) return { text: 'Muy débil', color: 'bg-destructive' };
    if (score === 2) return { text: 'Débil', color: 'bg-orange-500' };
    if (score === 3) return { text: 'Aceptable', color: 'bg-yellow-500' };
    if (score === 4) return { text: 'Fuerte', color: 'bg-emerald-500' };
    return { text: 'Muy fuerte', color: 'bg-emerald-600' };
  }, [password, score]);

  if (password.length === 0) return null;

  return (
    <div className="space-y-3 mt-2">
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Seguridad:</span>
          <span className={cn(
            "text-xs font-medium",
            score <= 1 && "text-destructive",
            score === 2 && "text-orange-500",
            score === 3 && "text-yellow-600",
            score >= 4 && "text-emerald-600"
          )}>
            {strengthLabel.text}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-300 rounded-full",
              strengthLabel.color
            )}
            style={{ width: `${(score / requirements.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Requirements checklist */}
      <ul className="space-y-1">
        {requirements.map((req) => {
          const isPassed = passedRequirements.includes(req.label);
          return (
            <li
              key={req.label}
              className={cn(
                "flex items-center gap-2 text-xs transition-colors",
                isPassed ? "text-emerald-600" : "text-muted-foreground"
              )}
            >
              {isPassed ? (
                <Check className="w-3 h-3" />
              ) : (
                <X className="w-3 h-3" />
              )}
              {req.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
