import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Settings2, RotateCcw, GripVertical, Eye, EyeOff, Pencil, Check, X,
  Plus, Trash2, ZoomIn, ZoomOut, Maximize2, Minimize2,
} from 'lucide-react';
import { useAppsConfig, AppCategory, AppItem } from '@/hooks/useAppsConfig';
import { IconPicker, getIconComponent } from '@/components/apps/IconPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

const CATEGORY_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
  '#e11d48', '#84cc16', '#0ea5e9', '#a855f7', '#64748b',
];

// Per-item size configs — each app can be a different size
const ITEM_SIZE = {
  1: { iconBox: 'w-10 h-10', iconSize: 'w-5 h-5', textSize: 'text-xs', descSize: 'text-[10px]', padding: 'p-2.5', gap: 'gap-1', span: '', minW: 'min-w-[80px]' },
  2: { iconBox: 'w-14 h-14', iconSize: 'w-7 h-7', textSize: 'text-sm', descSize: 'text-[11px]', padding: 'p-3.5', gap: 'gap-1.5', span: '', minW: 'min-w-[100px]' },
  3: { iconBox: 'w-20 h-20', iconSize: 'w-10 h-10', textSize: 'text-base', descSize: 'text-xs', padding: 'p-5', gap: 'gap-2', span: 'col-span-2', minW: 'min-w-[140px]' },
  4: { iconBox: 'w-28 h-28', iconSize: 'w-14 h-14', textSize: 'text-lg', descSize: 'text-sm', padding: 'p-6', gap: 'gap-3', span: 'col-span-2 row-span-2', minW: 'min-w-[180px]' },
};

const SIZE_LABELS = ['', 'S', 'M', 'L', 'XL'];

interface AppsHubProps {
  onOpenApp: (appId: string) => void;
}

export function AppsHub({ onOpenApp }: AppsHubProps) {
  const {
    categories, defaultSize, editMode, setEditMode,
    updateDefaultSize, setItemSize, setAllItemsSize,
    renameCategory, setCategoryIcon, setCategoryColor, setItemIcon,
    addCategory, deleteCategory,
    reorderCategories, reorderItems, moveItem, toggleItemVisibility, resetToDefault,
  } = useAppsConfig();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);

  const startRename = (catId: string, name: string) => {
    setRenamingId(catId);
    setRenameValue(name);
  };

  const finishRename = (catId: string) => {
    if (renameValue.trim()) renameCategory(catId, renameValue.trim());
    setRenamingId(null);
  };

  const handleAddCategory = () => {
    if (newCatName.trim()) {
      addCategory(newCatName.trim());
      setNewCatName('');
      setShowNewCat(false);
    }
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

  const cycleItemSize = (categoryId: string, itemId: string, currentSize: number) => {
    const next = currentSize >= 4 ? 1 : currentSize + 1;
    setItemSize(categoryId, itemId, next);
  };

  const renderAppCard = (app: AppItem, categoryId: string, isDragging?: boolean) => {
    const Icon = getIconComponent(app.icon);
    const size = app.size || defaultSize || 1;
    const sc = ITEM_SIZE[size as keyof typeof ITEM_SIZE] || ITEM_SIZE[1];

    return (
      <div className={cn('relative group/card', sc.span)}>
        <button
          onClick={() => !editMode && onOpenApp(app.id)}
          disabled={editMode}
          className={cn(
            'w-full h-full flex flex-col items-center justify-center', sc.gap, sc.padding,
            'rounded-2xl border border-border/50',
            'bg-gradient-to-br', app.bgGradient,
            !editMode && 'hover:shadow-lg hover:scale-[1.03] hover:border-primary/30 active:scale-[0.98]',
            'transition-all duration-200',
            app.hidden && 'opacity-40',
            isDragging && 'shadow-xl scale-105 z-50',
          )}
        >
          <div className={cn(
            sc.iconBox, 'rounded-2xl flex items-center justify-center',
            'bg-background/80 shadow-sm',
            'group-hover/card:shadow-md transition-shadow'
          )}>
            <Icon className={cn(sc.iconSize, app.color)} />
          </div>
          <div className="text-center">
            <span className={cn(sc.textSize, 'font-semibold text-foreground block leading-tight')}>{app.label}</span>
            {size >= 2 && (
              <span className={cn(sc.descSize, 'text-muted-foreground leading-tight')}>{app.description}</span>
            )}
          </div>
        </button>

        {/* Edit overlay */}
        {editMode && (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
            {/* Size cycle button */}
            <button
              onClick={(e) => { e.stopPropagation(); cycleItemSize(categoryId, app.id, size); }}
              className="p-1 rounded-md bg-background/90 border border-border/50 shadow-sm hover:bg-muted transition-colors"
              title={`Tamaño: ${SIZE_LABELS[size]} → ${SIZE_LABELS[size >= 4 ? 1 : size + 1]}`}
            >
              {size < 3
                ? <Maximize2 className="w-3 h-3 text-muted-foreground" />
                : <Minimize2 className="w-3 h-3 text-muted-foreground" />
              }
            </button>
            <IconPicker
              value={app.icon}
              onChange={(icon) => setItemIcon(categoryId, app.id, icon)}
              triggerClassName="bg-background/90 shadow-sm !p-1 !rounded-md"
            />
            <button
              onClick={(e) => { e.stopPropagation(); toggleItemVisibility(categoryId, app.id); }}
              className="p-1 rounded-md bg-background/90 border border-border/50 shadow-sm hover:bg-muted transition-colors"
            >
              {app.hidden
                ? <EyeOff className="w-3 h-3 text-muted-foreground" />
                : <Eye className="w-3 h-3 text-muted-foreground" />
              }
            </button>
          </div>
        )}

        {/* Size badge in edit mode */}
        {editMode && (
          <span className="absolute bottom-1 right-1.5 text-[9px] font-bold text-muted-foreground/60 select-none">
            {SIZE_LABELS[size]}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-8 animate-fade-in max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Aplicaciones</h1>
          <p className="text-sm text-muted-foreground mt-1">Accede a todas las herramientas y utilidades</p>
        </div>
        <div className="flex items-center gap-2">
          {editMode && (
            <>
              <Button variant="ghost" size="sm" onClick={resetToDefault} className="text-xs gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> Restaurar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowNewCat(true)} className="text-xs gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Categoría
              </Button>
            </>
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

      {/* Bulk size controls */}
      {editMode && (
        <div className="flex items-center gap-2 flex-wrap bg-card/50 border border-border/50 rounded-xl p-3">
          <span className="text-xs text-muted-foreground font-medium">Tamaño global:</span>
          {[1, 2, 3, 4].map(s => (
            <Button
              key={s}
              variant="outline"
              size="sm"
              className={cn('h-7 px-3 text-xs', defaultSize === s && 'bg-primary text-primary-foreground')}
              onClick={() => setAllItemsSize(s)}
            >
              {SIZE_LABELS[s]}
            </Button>
          ))}
          <span className="text-[10px] text-muted-foreground ml-2">
            (o cambia cada icono individualmente con ⤢)
          </span>
        </div>
      )}

      {/* New category form */}
      {showNewCat && (
        <div className="flex items-center gap-2 bg-card/50 border border-border/50 rounded-xl p-3">
          <Input
            placeholder="Nombre de la categoría..."
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
            className="h-8 text-sm flex-1"
            autoFocus
          />
          <Button size="sm" onClick={handleAddCategory} className="h-8 gap-1">
            <Check className="w-3.5 h-3.5" /> Crear
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setShowNewCat(false); setNewCatName(''); }} className="h-8">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

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

                          <IconPicker
                            value={category.icon || 'Folder'}
                            onChange={(icon) => setCategoryIcon(category.id, icon)}
                          />

                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className="w-5 h-5 rounded-full border border-border/50 shrink-0"
                                style={{ backgroundColor: category.color || '#6366f1' }}
                              />
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2" align="start">
                              <div className="grid grid-cols-5 gap-1.5">
                                {CATEGORY_COLORS.map(c => (
                                  <button
                                    key={c}
                                    onClick={() => setCategoryColor(category.id, c)}
                                    className={cn(
                                      'w-7 h-7 rounded-full border-2 transition-transform hover:scale-110',
                                      category.color === c ? 'border-foreground scale-110' : 'border-transparent'
                                    )}
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>

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
                                className="p-1 hover:bg-muted rounded"
                              >
                                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                              <button
                                onClick={() => deleteCategory(category.id)}
                                className="p-1 hover:bg-destructive/20 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* Droppable items — flex wrap for mixed sizes */}
                        <Droppable droppableId={category.id} type="APP_ITEM">
                          {(itemsProvided) => (
                            <div
                              ref={itemsProvided.innerRef}
                              {...itemsProvided.droppableProps}
                              className="flex flex-wrap gap-3 min-h-[80px]"
                            >
                              {category.items.map((app, appIdx) => (
                                <Draggable key={app.id} draggableId={`app-${app.id}`} index={appIdx}>
                                  {(appProvided, appSnap) => (
                                    <div
                                      ref={appProvided.innerRef}
                                      {...appProvided.draggableProps}
                                      {...appProvided.dragHandleProps}
                                      className={cn(ITEM_SIZE[(app.size || 1) as keyof typeof ITEM_SIZE]?.minW)}
                                      style={{ ...appProvided.draggableProps.style, flex: '0 0 auto' }}
                                    >
                                      {renderAppCard(app, category.id, appSnap.isDragging)}
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
        /* Normal view — flex wrap for mixed sizes */
        <div className="space-y-8">
          {categories.map((category) => {
            const visibleApps = category.items.filter(a => !a.hidden);
            if (visibleApps.length === 0) return null;
            const CatIcon = getIconComponent(category.icon || 'Folder');
            return (
              <div key={category.id}>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: (category.color || '#6366f1') + '20' }}
                  >
                    <CatIcon className="w-3.5 h-3.5" style={{ color: category.color || '#6366f1' }} />
                  </div>
                  <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {category.label}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-3">
                  {visibleApps.map((app) => (
                    <div key={app.id} className={cn(ITEM_SIZE[(app.size || 1) as keyof typeof ITEM_SIZE]?.minW)} style={{ flex: '0 0 auto' }}>
                      {renderAppCard(app, category.id)}
                    </div>
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
