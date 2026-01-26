import { useState } from 'react';
import { Search, Users, User, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAllUsers } from '@/hooks/useInternalChat';

interface NewConversationModalProps {
  open: boolean;
  onClose: () => void;
  onCreateConversation: (participantIds: string[], name?: string, isGroup?: boolean) => void;
  isCreating: boolean;
}

export function NewConversationModal({
  open,
  onClose,
  onCreateConversation,
  isCreating,
}: NewConversationModalProps) {
  const { data: users = [], isLoading } = useAllUsers();
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState('');

  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleCreate = () => {
    if (selectedUsers.length === 0) return;
    onCreateConversation(
      selectedUsers,
      isGroup && groupName ? groupName : undefined,
      isGroup || selectedUsers.length > 1
    );
    // Reset state
    setSelectedUsers([]);
    setIsGroup(false);
    setGroupName('');
    setSearch('');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva conversación</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuarios..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Group toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="is-group"
              checked={isGroup}
              onCheckedChange={(c) => setIsGroup(!!c)}
            />
            <Label htmlFor="is-group" className="text-sm cursor-pointer">
              Crear como grupo
            </Label>
          </div>

          {/* Group name */}
          {isGroup && (
            <Input
              placeholder="Nombre del grupo"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          )}

          {/* User list */}
          <ScrollArea className="h-[250px] border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <User className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No se encontraron usuarios</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredUsers.map((u) => {
                  const isSelected = selectedUsers.includes(u.user_id);

                  return (
                    <button
                      key={u.user_id}
                      onClick={() => toggleUser(u.user_id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left',
                        isSelected
                          ? 'bg-primary/10 border border-primary/20'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <Avatar className="h-9 w-9">
                        {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                        <AvatarFallback>
                          {getInitials(u.full_name || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 font-medium text-sm">
                        {u.full_name || 'Usuario'}
                      </span>
                      <Checkbox checked={isSelected} />
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Selected count */}
          {selectedUsers.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedUsers.length} usuario{selectedUsers.length !== 1 ? 's' : ''} seleccionado{selectedUsers.length !== 1 ? 's' : ''}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={selectedUsers.length === 0 || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  {isGroup ? <Users className="h-4 w-4 mr-2" /> : <User className="h-4 w-4 mr-2" />}
                  {isGroup ? 'Crear grupo' : 'Iniciar chat'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
