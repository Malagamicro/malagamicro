import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Mail, MessageSquare, FileText, Inbox, MessagesSquare, Ticket,
  Calendar, BarChart3, Bell, Cloud, Bot, FileEdit, Sparkles, Megaphone,
  Settings2, RotateCcw, GripVertical, Eye, EyeOff, Pencil, Check, X,
} from 'lucide-react';
import { useAppsConfig, AppCategory, AppItem } from '@/hooks/useAppsConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Mail, MessageSquare, FileText, Inbox, MessagesSquare, Ticket,
  Calendar, BarChart3, Bell, Cloud, Bot, FileEdit, Sparkles, Megaphone,
};

function getIcon(name: string) {
  return ICON_MAP[name] || Cloud;
}

interface AppsHubProps {
  onOpenApp: (appId: string) => void;
}

export function AppsHub({ onOpenApp }: AppsHubProps) {
  const {
    categories, editMode, setEditMode, renameCategory,
    reorderCategories, reorderItems, moveItem, toggleItemVisibility, resetToDefault,
  } = useAppsConfig();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const startRename = (catId: string, name: string) => {
    setRenamingId(catId);
    setRenameValue(name);
  };

  const finishRename = (catId: string) => {
    if (renameValue.trim()) renameCategory(catId, renameValue.trim());
    setRenamingId(null);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, type } = result;

    if (type === 'APP_CATEGORY') {
      reorderCategories(source.index, destination.index);
      return;
    }

    if (source.droppableId === destination.droppableId) {
      reorderItems(source.droppableId, source.index, destination.index);
    } else {
      const fromCat = categories.find(c => c.id === source.droppableId);
      if (!fromCat) return;
      const item = fromCat.items[source.index];
      if (item) moveItem(item.id, source.droppableId, destination.droppableId);
    }
  };

  const renderAppCard = (app: AppItem, isDragging?: boolean) => {
    const Icon = getIcon(app.icon);
    return (
      <button
        onClick={() => !editMode && onOpenApp(app.id)}
        disabled={editMode}
        className={cn(
          'group flex flex-col items-center gap-2.5 p-5 rounded-2xl border border-border/50',
          'bg-gradient-to-br', app.bgGradient,
          !editMode && 'hover:shadow-lg hover:scale-[1.03] hover:border-primary/30 active:scale-[0.98]',
          'transition-all duration-200',
          app.hidden && 'opacity-40',
          isDragging && 'shadow-xl scale-105 z-50',
        )}
      >
        <div className={cn(
          'w-12 h-12 rounded-2xl flex items-center justify-center',
          'bg-background/80 shadow-sm',
          'group-hover:shadow-md transition-shadow'
        )}>
          <Icon className={cn('w-6 h-6', app.color)} />
        </div>
        <div className="text-center">
          <span className="text-sm font-semibold text-foreground block">{app.label}</span>
          <span className="text-[11px] text-muted-foreground leading-tight">{app.description}</span>
        </div>
      </button>
    );
  };

  return (
    <div className="p-4 sm:p-8 animate-fade-in max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Aplicaciones</h1>
          <p className="text-sm text-muted-foreground mt-1">Accede a todas las herramientas y utilidades</p>
        </div>
        <div className="flex items-center gap-2">
          {editMode && (
            <Button variant="ghost" size="sm" onClick={resetToDefault} className="text-xs gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> Restaurar
            </Button>
          )}
          <Button
            variant={editMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setEditMode(!editMode)}
            className="gap-1.5"
          >
            <Settings2 className="w-4 h-4" />
            {editMode ? 'Listo' : 'Organizar'}
          </Button>
        </div>
      </div>

      {/* Content */}
      {editMode ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="app-categories" type="APP_CATEGORY">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-6">
                {categories.map((category, catIdx) => (
                  <Draggable key={category.id} draggableId={`cat-${category.id}`} index={catIdx}>
                    {(catProvided, catSnap) => (
                      <div
                        ref={catProvided.innerRef}
                        {...catProvided.draggableProps}
                        className={cn(
                          'rounded-xl border border-border/50 bg-card/50 p-4',
                          catSnap.isDragging && 'shadow-xl'
                        )}
                      >
                        {/* Category header */}
                        <div className="flex items-center gap-2 mb-3">
                          <div {...catProvided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-1">
                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                          </div>
                          {renamingId === category.id ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <Input
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && finishRename(category.id)}
                                className="h-7 text-sm"
                                autoFocus
                              />
                              <button onClick={() => finishRename(category.id)} className="p-1 hover:bg-muted rounded">
                                <Check className="w-3.5 h-3.5 text-green-500" />
                              </button>
                              <button onClick={() => setRenamingId(null)} className="p-1 hover:bg-muted rounded">
                                <X className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">
                                {category.label}
                              </h2>
                              <button
                                onClick={() => startRename(category.id, category.label)}
                                className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100"
                              >
                                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* Droppable items */}
                        <Droppable droppableId={category.id} type="APP_ITEM">
                          {(itemsProvided) => (
                            <div
                              ref={itemsProvided.innerRef}
                              {...itemsProvided.droppableProps}
                              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 min-h-[80px]"
                            >
                              {category.items.map((app, appIdx) => (
                                <Draggable key={app.id} draggableId={`app-${app.id}`} index={appIdx}>
                                  {(appProvided, appSnap) => (
                                    <div
                                      ref={appProvided.innerRef}
                                      {...appProvided.draggableProps}
                                      {...appProvided.dragHandleProps}
                                      className="relative"
                                    >
                                      {renderAppCard(app, appSnap.isDragging)}
                                      {/* Visibility toggle */}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); toggleItemVisibility(category.id, app.id); }}
                                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/90 border border-border/50 shadow-sm hover:bg-muted transition-colors"
                                      >
                                        {app.hidden
                                          ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                                          : <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                                        }
                                      </button>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {itemsProvided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        /* Normal view */
        <div className="space-y-8">
          {categories.map((category) => {
            const visibleApps = category.items.filter(a => !a.hidden);
            if (visibleApps.length === 0) return null;
            return (
              <div key={category.id}>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {category.label}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {visibleApps.map((app) => (
                    <div key={app.id}>{renderAppCard(app)}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
