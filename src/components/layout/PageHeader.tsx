import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PageAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive';
  /** If true, shows in overflow menu instead of primary bar */
  overflow?: boolean;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: PageAction[];
  children?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon, actions = [], children, className }: PageHeaderProps) {
  const primaryActions = actions.filter(a => !a.overflow).slice(0, 4);
  const overflowActions = [
    ...actions.filter(a => a.overflow),
    ...actions.filter(a => !a.overflow).slice(4),
  ];

  return (
    <div className={cn("px-4 sm:px-8 py-4 sm:py-5 border-b bg-card/50 flex-shrink-0", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight truncate">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{description}</p>
            )}
          </div>
        </div>

        {(primaryActions.length > 0 || overflowActions.length > 0) && (
          <div className="flex items-center gap-2 shrink-0">
            {primaryActions.map((action, i) => (
              <Button
                key={i}
                variant={action.variant || (i === 0 ? 'default' : 'outline')}
                size="sm"
                onClick={action.onClick}
                className="gap-1.5"
              >
                {action.icon}
                <span className="hidden sm:inline">{action.label}</span>
              </Button>
            ))}

            {overflowActions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {overflowActions.map((action, i) => (
                    <DropdownMenuItem key={i} onClick={action.onClick} className="gap-2 cursor-pointer">
                      {action.icon}
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
