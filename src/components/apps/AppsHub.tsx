import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Settings2, RotateCcw, GripVertical, Eye, EyeOff, Pencil, Check, X,
  Plus, Trash2, Maximize2, Minimize2, ExternalLink, Palette,
} from 'lucide-react';
import { useAppsConfig, AppCategory, AppItem, ICON_COLORS } from '@/hooks/useAppsConfig';
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

const ITEM_SIZE = {
  1: { iconBox: 'w-10 h-10', iconSize: 'w-5 h-5', textSize: 'text-xs', descSize: 'text-[10px]', padding: 'p-2.5', gap: 'gap-1', minW: 'min-w-[80px] max-w-[100px]' },
  2: { iconBox: 'w-14 h-14', iconSize: 'w-7 h-7', textSize: 'text-sm', descSize: 'text-[11px]', padding: 'p-3.5', gap: 'gap-1.5', minW: 'min-w-[110px] max-w-[130px]' },
  3: { iconBox: 'w-20 h-20', iconSize: 'w-10 h-10', textSize: 'text-base', descSize: 'text-xs', padding: 'p-5', gap: 'gap-2', minW: 'min-w-[150px] max-w-[180px]' },
  4: { iconBox: 'w-28 h-28', iconSize: 'w-14 h-14', textSize: 'text-lg', descSize: 'text-sm', padding: 'p-6', gap: 'gap-3', minW: 'min-w-[200px] max-w-[240px]' },
};

const SIZE_LABELS = ['', 'S', 'M', 'L', 'XL'];

interface AppsHubProps {
  onOpenApp: (appId: string) => void;
}

export function AppsHub({ onOpenApp }: AppsHubProps) {
  const {
    categories, defaultSize, editMode, setEditMode,
    updateDefaultSize, setItemSize, setAllItemsSize, setItemColor,
    renameCategory, setCategoryIcon, setCategoryColor, setItemIcon,
    addCategory, addCustomApp, deleteItem, deleteCategory,
    reorderCategories, reorderItems, moveItem, toggleItemVisibility, resetToDefault,
  } = useAppsConfig();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);

  // New custom app form state
  const [addingAppToCat, setAddingAppToCat] = useState<string | null>(null);
  const [newAppLabel, setNewAppLabel] = useState('');
  const [newAppUrl, setNewAppUrl] = useState('');

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

  const handleAddCustomApp = (catId: string) => {
    if (newAppLabel.trim() && newAppUrl.trim()) {
      addCustomApp(catId, newAppLabel.trim(), newAppUrl.trim());
      setNewAppLabel('');
      setNewAppUrl('');
      setAddingAppToCat(null);
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

  const handleAppClick = (app: AppItem) => {
    if (editMode) return;
    if (app.externalUrl) {
      window.open(app.externalUrl, '_blank', 'noopener,noreferrer');
    } else {
      onOpenApp(app.id);
    }
  };

  const getIconColor = (color: string): { className?: string; style?: React.CSSProperties } => {
    if (color.startsWith('text-')) return { className: color };
    return { style: { color } };
  };

  const renderAppCard = (app: AppItem, categoryId: string, isDragging?: boolean) => {
    const Icon = getIconComponent(app.icon);
    const size = app.size || defaultSize || 1;
    const sc = ITEM_SIZE[size as keyof typeof ITEM_SIZE] || ITEM_SIZE[1];
    const iconColor = getIconColor(app.color);

    return (
      <div className="relative group/card h-full">
        <button
          onClick={() => handleAppClick(app)}
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
            'group-hover/card:shadow-md transition-shadow relative'
          )}>
            <Icon className={cn(sc.iconSize, iconColor.className)} style={iconColor.style} />
            {app.externalUrl && (
              <ExternalLink className="w-2.5 h-2.5 absolute top-1 right-1 text-muted-foreground/50" />
            )}
          </div>
          <div className="text-center w-full">
            <span className={cn(sc.textSize, 'font-semibold text-foreground block leading-tight truncate')}>{app.label}</span>
            {size >= 2 && (
              <span className={cn(sc.descSize, 'text-muted-foreground leading-tight truncate block')}>
                {app.externalUrl ? app.externalUrl.replace(/^https?:\/\//, '').slice(0, 30) : app.description}
              </span>
            )}
          </div>
        </button>

        {/* Edit overlay */}
        {editMode && (
          <div className="absolute top-1 right-1 flex items-center gap-0.5">
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
            {/* Color picker */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="p-1 rounded-md bg-background/90 border border-border/50 shadow-sm hover:bg-muted transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <Palette className="w-3 h-3" style={{ color: app.color.startsWith('#') ? app.color : undefined }} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="end" onClick={e => e.stopPropagation()}>
                <div className="grid grid-cols-5 gap-1">
                  {ICON_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setItemColor(categoryId, app.id, c)}
                      className={cn(
                        'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                        app.color === c ? 'border-foreground scale-110' : 'border-transparent'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <button
              onClick={(e) => { e.stopPropagation(); toggleItemVisibility(categoryId, app.id); }}
              className="p-1 rounded-md bg-background/90 border border-border/50 shadow-sm hover:bg-muted transition-colors"
            >
              {app.hidden
                ? <EyeOff className="w-3 h-3 text-muted-foreground" />
                : <Eye className="w-3 h-3 text-muted-foreground" />
              }
            </button>
            {app.isCustom && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteItem(categoryId, app.id); }}
                className="p-1 rounded-md bg-background/90 border border-border/50 shadow-sm hover:bg-destructive/20 transition-colors"
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </button>
            )}
          </div>
        )}

        {editMode && (
          <span className="absolute bottom-0.5 right-1 text-[9px] font-bold text-muted-foreground/50 select-none">
            {SIZE_LABELS[size]}
          </span>
        )}
      </div>
    );
  };

  const renderCategoryBlock = (category: AppCategory, isEditMode: boolean) => {
    const CatIcon = getIconComponent(category.icon || 'Folder');
    const visibleApps = isEditMode ? category.items : category.items.filter(a => !a.hidden);
    if (!isEditMode && visibleApps.length === 0) return null;

    return (
      <div
        key={category.id}
        className={cn(
          'rounded-xl border border-border/30 bg-card/30 p-3 flex-shrink-0',
          // Let categories take their natural width but allow growing
          'flex-grow-0 basis-auto'
        )}
        style={{ minWidth: '200px' }}
      >
        {/* Category header */}
        <div className="flex items-center gap-1.5 mb-2">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ backgroundColor: (category.color || '#6366f1') + '20' }}
          >
            <CatIcon className="w-3 h-3" style={{ color: category.color || '#6366f1' }} />
          </div>
          <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {category.label}
          </h2>
        </div>
        {/* Items */}
        <div className="flex flex-wrap gap-2">
          {visibleApps.map((app) => (
            <div key={app.id} className={cn(ITEM_SIZE[(app.size || 1) as keyof typeof ITEM_SIZE]?.minW)} style={{ flex: '0 0 auto' }}>
              {renderAppCard(app, category.id)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Aplicaciones</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Accede a todas las herramientas y utilidades</p>
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

      {/* Bulk size + info */}
      {editMode && (
        <div className="flex items-center gap-2 flex-wrap bg-card/50 border border-border/50 rounded-xl p-2.5">
          <span className="text-xs text-muted-foreground font-medium">Todos:</span>
          {[1, 2, 3, 4].map(s => (
            <Button
              key={s}
              variant="outline"
              size="sm"
              className={cn('h-6 px-2.5 text-[11px]', defaultSize === s && 'bg-primary text-primary-foreground')}
              onClick={() => setAllItemsSize(s)}
            >
              {SIZE_LABELS[s]}
            </Button>
          ))}
          <span className="text-[10px] text-muted-foreground ml-1">
            · Cada icono se redimensiona individualmente · Clic en 🎨 para cambiar color
          </span>
        </div>
      )}

      {/* New category form */}
      {showNewCat && (
        <div className="flex items-center gap-2 bg-card/50 border border-border/50 rounded-xl p-2.5">
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
              <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-wrap gap-4">
                {categories.map((category, catIdx) => (
                  <Draggable key={category.id} draggableId={`cat-${category.id}`} index={catIdx}>
                    {(catProvided, catSnap) => (
                      <div
                        ref={catProvided.innerRef}
                        {...catProvided.draggableProps}
                        className={cn(
                          'rounded-xl border border-border/50 bg-card/50 p-3 flex-shrink-0',
                          catSnap.isDragging && 'shadow-xl',
                        )}
                        style={{ ...catProvided.draggableProps.style, minWidth: '220px', maxWidth: '500px' }}
                      >
                        {/* Category header */}
                        <div className="flex items-center gap-1.5 mb-2">
                          <div {...catProvided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5">
                            <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>

                          <IconPicker
                            value={category.icon || 'Folder'}
                            onChange={(icon) => setCategoryIcon(category.id, icon)}
                          />

                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className="w-4 h-4 rounded-full border border-border/50 shrink-0"
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
                                      'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
                                      category.color === c ? 'border-foreground scale-110' : 'border-transparent'
                                    )}
                                    style={{ backgroundColor: c }}
                                  />
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>

                          {renamingId === category.id ? (
                            <div className="flex items-center gap-1 flex-1">
                              <Input
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && finishRename(category.id)}
                                className="h-6 text-xs"
                                autoFocus
                              />
                              <button onClick={() => finishRename(category.id)} className="p-0.5 hover:bg-muted rounded">
                                <Check className="w-3 h-3 text-green-500" />
                              </button>
                              <button onClick={() => setRenamingId(null)} className="p-0.5 hover:bg-muted rounded">
                                <X className="w-3 h-3 text-muted-foreground" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex-1 truncate">
                                {category.label}
                              </h2>
                              <button onClick={() => startRename(category.id, category.label)} className="p-0.5 hover:bg-muted rounded">
                                <Pencil className="w-3 h-3 text-muted-foreground" />
                              </button>
                              <button
                                onClick={() => setAddingAppToCat(addingAppToCat === category.id ? null : category.id)}
                                className="p-0.5 hover:bg-muted rounded"
                                title="Añadir app externa"
                              >
                                <Plus className="w-3 h-3 text-muted-foreground" />
                              </button>
                              <button onClick={() => deleteCategory(category.id)} className="p-0.5 hover:bg-destructive/20 rounded">
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* Add custom app form */}
                        {addingAppToCat === category.id && (
                          <div className="flex flex-col gap-1.5 mb-2 p-2 rounded-lg bg-muted/50 border border-border/30">
                            <Input
                              placeholder="Nombre de la app..."
                              value={newAppLabel}
                              onChange={e => setNewAppLabel(e.target.value)}
                              className="h-7 text-xs"
                              autoFocus
                            />
                            <Input
                              placeholder="https://ejemplo.com"
                              value={newAppUrl}
                              onChange={e => setNewAppUrl(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleAddCustomApp(category.id)}
                              className="h-7 text-xs"
                            />
                            <div className="flex gap-1">
                              <Button size="sm" onClick={() => handleAddCustomApp(category.id)} className="h-6 text-[10px] gap-1 flex-1">
                                <ExternalLink className="w-3 h-3" /> Añadir
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setAddingAppToCat(null); setNewAppLabel(''); setNewAppUrl(''); }} className="h-6 text-[10px]">
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Droppable items */}
                        <Droppable droppableId={category.id} type="APP_ITEM">
                          {(itemsProvided) => (
                            <div
                              ref={itemsProvided.innerRef}
                              {...itemsProvided.droppableProps}
                              className="flex flex-wrap gap-2 min-h-[60px]"
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
        /* Normal view — categories side by side, wrapping */
        <div className="flex flex-wrap gap-4">
          {categories.map((category) => renderCategoryBlock(category, false))}
        </div>
      )}
    </div>
  );
}
