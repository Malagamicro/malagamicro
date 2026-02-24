import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Settings2, RotateCcw, GripVertical, Eye, EyeOff, Pencil, Check, X,
  Plus, Trash2, ZoomIn, ZoomOut,
} from 'lucide-react';
import { useAppsConfig, AppCategory, AppItem } from '@/hooks/useAppsConfig';
import { IconPicker, getIconComponent } from '@/components/apps/IconPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

const CATEGORY_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
  '#e11d48', '#84cc16', '#0ea5e9', '#a855f7', '#64748b',
];

const SIZE_CONFIGS = {
  1: { grid: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6', iconBox: 'w-10 h-10', iconSize: 'w-5 h-5', textSize: 'text-xs', descSize: 'text-[10px]', padding: 'p-3', gap: 'gap-1.5' },
  2: { grid: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4', iconBox: 'w-12 h-12', iconSize: 'w-6 h-6', iconBox2: 'rounded-2xl', textSize: 'text-sm', descSize: 'text-[11px]', padding: 'p-5', gap: 'gap-2.5' },
  3: { grid: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3', iconBox: 'w-16 h-16', iconSize: 'w-8 h-8', textSize: 'text-base', descSize: 'text-xs', padding: 'p-6', gap: 'gap-3' },
  4: { grid: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2', iconBox: 'w-20 h-20', iconSize: 'w-10 h-10', textSize: 'text-lg', descSize: 'text-sm', padding: 'p-8', gap: 'gap-4' },
};

interface AppsHubProps {
  onOpenApp: (appId: string) => void;
}

export function AppsHub({ onOpenApp }: AppsHubProps) {
  const {
    categories, iconSize, editMode, setEditMode,
    updateIconSize, renameCategory, setCategoryIcon, setCategoryColor, setItemIcon,
    addCategory, deleteCategory,
    reorderCategories, reorderItems, moveItem, toggleItemVisibility, resetToDefault,
  } = useAppsConfig();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);

  const sizeConfig = SIZE_CONFIGS[iconSize as keyof typeof SIZE_CONFIGS] || SIZE_CONFIGS[2];

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

  const renderAppCard = (app: AppItem, categoryId: string, isDragging?: boolean) => {
    const Icon = getIconComponent(app.icon);
    return (
      <div className="relative group/card">
        <button
          onClick={() => !editMode && onOpenApp(app.id)}
          disabled={editMode}
          className={cn(
            'w-full flex flex-col items-center', sizeConfig.gap, sizeConfig.padding,
            'rounded-2xl border border-border/50',
            'bg-gradient-to-br', app.bgGradient,
            !editMode && 'hover:shadow-lg hover:scale-[1.03] hover:border-primary/30 active:scale-[0.98]',
            'transition-all duration-200',
            app.hidden && 'opacity-40',
            isDragging && 'shadow-xl scale-105 z-50',
          )}
        >
          <div className={cn(
            sizeConfig.iconBox, 'rounded-2xl flex items-center justify-center',
            'bg-background/80 shadow-sm',
            'group-hover/card:shadow-md transition-shadow'
          )}>
            <Icon className={cn(sizeConfig.iconSize, app.color)} />
          </div>
          <div className="text-center">
            <span className={cn(sizeConfig.textSize, 'font-semibold text-foreground block')}>{app.label}</span>
            <span className={cn(sizeConfig.descSize, 'text-muted-foreground leading-tight')}>{app.description}</span>
          </div>
        </button>

        {/* Edit overlay */}
        {editMode && (
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <IconPicker
              value={app.icon}
              onChange={(icon) => setItemIcon(categoryId, app.id, icon)}
              triggerClassName="bg-background/90 shadow-sm"
            />
            <button
              onClick={(e) => { e.stopPropagation(); toggleItemVisibility(categoryId, app.id); }}
              className="p-1.5 rounded-lg bg-background/90 border border-border/50 shadow-sm hover:bg-muted transition-colors"
            >
              {app.hidden
                ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                : <Eye className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-8 animate-fade-in max-w-5xl mx-auto space-y-6">
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

      {/* Icon size slider */}
      {editMode && (
        <div className="flex items-center gap-3 bg-card/50 border border-border/50 rounded-xl p-3">
          <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
          <Slider
            value={[iconSize]}
            onValueChange={([v]) => updateIconSize(v)}
            min={1}
            max={4}
            step={1}
            className="flex-1"
          />
          <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground w-12 text-right">
            {['', 'S', 'M', 'L', 'XL'][iconSize]}
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
                {categories.map((category, catIdx) => {
                  const CatIcon = getIconComponent(category.icon || 'Folder');
                  return (
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

                            {/* Category icon picker */}
                            <IconPicker
                              value={category.icon || 'Folder'}
                              onChange={(icon) => setCategoryIcon(category.id, icon)}
                            />

                            {/* Category color */}
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

                          {/* Droppable items */}
                          <Droppable droppableId={category.id} type="APP_ITEM">
                            {(itemsProvided) => (
                              <div
                                ref={itemsProvided.innerRef}
                                {...itemsProvided.droppableProps}
                                className={cn(sizeConfig.grid, 'gap-3 min-h-[80px]')}
                              >
                                {category.items.map((app, appIdx) => (
                                  <Draggable key={app.id} draggableId={`app-${app.id}`} index={appIdx}>
                                    {(appProvided, appSnap) => (
                                      <div
                                        ref={appProvided.innerRef}
                                        {...appProvided.draggableProps}
                                        {...appProvided.dragHandleProps}
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
                  );
                })}
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
                <div className={cn(sizeConfig.grid, 'gap-3')}>
                  {visibleApps.map((app) => (
                    <div key={app.id}>{renderAppCard(app, category.id)}</div>
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
