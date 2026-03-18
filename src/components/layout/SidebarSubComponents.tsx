import { cn } from '@/lib/utils';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { SidebarItem } from '@/hooks/useSidebarConfig';
import { getIcon } from './sidebarConstants';

// Custom Toggle Switch Component
export function SidebarToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "group relative flex items-center justify-center w-full h-10 rounded-xl",
        "bg-sidebar-accent/50 hover:bg-sidebar-accent transition-all duration-300",
        "border border-sidebar-border/50"
      )}
      aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
    >
      <div className="relative flex items-center gap-2">
        {collapsed ? (
          <PanelLeft className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
        ) : (
          <>
            <PanelLeftClose className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
            <span className="text-xs font-medium opacity-70">Colapsar</span>
          </>
        )}
      </div>
      <div className={cn(
        "absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-primary rounded-full transition-all duration-300",
        collapsed ? "w-4" : "w-12"
      )} />
    </button>
  );
}

// Collapsed Icon Button with Tooltip
export function CollapsedIconButton({ item, isActive, onClick, badgeCount }: { 
  item: SidebarItem; isActive: boolean; onClick: () => void; badgeCount?: number;
}) {
  const Icon = getIcon(item.icon);
  const count = badgeCount || 0;
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors duration-150",
              "hover:bg-sidebar-accent",
              isActive && "bg-primary/15 shadow-sm ring-2 ring-primary/30"
            )}>
            <Icon className={cn("w-5 h-5", isActive ? "text-primary" : item.color)} />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 animate-pulse">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
