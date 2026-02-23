import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Home, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FolderTreeNode } from '@/hooks/useAllSharedFiles';
import { Button } from '@/components/ui/button';

interface FolderTreeSidebarProps {
  tree: FolderTreeNode[];
  currentFolderId: string | null;
  onNavigate: (folderId: string | null, breadcrumbPath: { id: string | null; name: string }[]) => void;
  onSearchMode: () => void;
  isSearchMode: boolean;
}

function TreeNode({
  node,
  level,
  currentFolderId,
  onNavigate,
  parentPath,
}: {
  node: FolderTreeNode;
  level: number;
  currentFolderId: string | null;
  onNavigate: FolderTreeSidebarProps['onNavigate'];
  parentPath: { id: string | null; name: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children.length > 0;
  const isActive = currentFolderId === node.id;
  const currentPath = [...parentPath, { id: node.id, name: node.name }];

  return (
    <div>
      <button
        onClick={() => {
          onNavigate(node.id, currentPath);
          if (hasChildren) setExpanded(!expanded);
        }}
        className={cn(
          'w-full flex items-center gap-1.5 py-1.5 px-2 rounded text-sm text-left transition-colors',
          isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'
        )}
        style={{ paddingLeft: `${8 + level * 16}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="shrink-0"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {isActive ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-amber-500" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              currentFolderId={currentFolderId}
              onNavigate={onNavigate}
              parentPath={currentPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTreeSidebar({ tree, currentFolderId, onNavigate, onSearchMode, isSearchMode }: FolderTreeSidebarProps) {
  const rootPath = [{ id: null as string | null, name: 'Inicio' }];

  return (
    <div className="w-48 lg:w-56 border-r bg-card/50 flex flex-col shrink-0 hidden md:flex">
      <div className="p-2 space-y-0.5">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
          Explorador
        </div>
        <button
          onClick={() => onNavigate(null, rootPath)}
          className={cn(
            'w-full flex items-center gap-1.5 py-1.5 px-2 rounded text-sm text-left transition-colors',
            currentFolderId === null && !isSearchMode ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
          )}
        >
          <Home className="h-4 w-4 shrink-0" />
          <span>Inicio</span>
        </button>
        <Button
          variant={isSearchMode ? 'secondary' : 'ghost'}
          size="sm"
          className="w-full justify-start h-8 text-sm"
          onClick={onSearchMode}
        >
          <Search className="h-4 w-4 mr-1.5" />
          Búsqueda global
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-2 pt-0 space-y-0.5">
        {tree.map(node => (
          <TreeNode
            key={node.id}
            node={node}
            level={0}
            currentFolderId={currentFolderId}
            onNavigate={onNavigate}
            parentPath={rootPath}
          />
        ))}
      </div>
    </div>
  );
}
