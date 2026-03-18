import { useState } from 'react';
import { Users, X, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Conversation } from '@/hooks/useInternalChat';

interface GroupSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation | null;
  isAdmin: boolean;
  currentUserId?: string;
  onUpdateGroup?: (conversationId: string, name: string) => void;
  onRemoveParticipant?: (conversationId: string, userId: string) => void;
}

export function GroupSettingsDialog({
  open, onOpenChange, conversation, isAdmin, currentUserId,
  onUpdateGroup, onRemoveParticipant,
}: GroupSettingsDialogProps) {
  const [groupName, setGroupName] = useState(conversation?.name || '');

  const handleSave = () => {
    if (conversation && onUpdateGroup && groupName.trim()) {
      onUpdateGroup(conversation.id, groupName.trim());
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar grupo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre del grupo</label>
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Nombre del grupo" />
          </div>
          {conversation?.participants && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Participantes ({conversation.participants.length})</label>
              <div className="space-y-1 max-h-40 overflow-auto">
                {conversation.participants.map(p => (
                  <div key={p.user_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        {p.profile?.avatar_url && <AvatarImage src={p.profile.avatar_url} />}
                        <AvatarFallback className="text-[10px]">
                          {(p.profile?.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{p.profile?.full_name || 'Usuario'}</span>
                      {p.is_admin && <Badge variant="secondary" className="text-[10px] h-4">Admin</Badge>}
                    </div>
                    {isAdmin && p.user_id !== currentUserId && onRemoveParticipant && (
                      <Button
                        variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                        onClick={() => onRemoveParticipant(conversation.id, p.user_id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ParticipantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation | null;
  isAdmin: boolean;
  currentUserId?: string;
  onRemoveParticipant?: (conversationId: string, userId: string) => void;
}

export function ParticipantsDialog({
  open, onOpenChange, conversation, isAdmin, currentUserId, onRemoveParticipant,
}: ParticipantsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Participantes ({conversation?.participants?.length || 0})
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1 max-h-60 overflow-auto">
          {conversation?.participants?.map(p => (
            <div key={p.user_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  {p.profile?.avatar_url && <AvatarImage src={p.profile.avatar_url} />}
                  <AvatarFallback className="text-xs">
                    {(p.profile?.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-sm font-medium">{p.profile?.full_name || 'Usuario'}</span>
                  {p.user_id === conversation?.created_by && (
                    <Badge variant="secondary" className="ml-2 text-[10px] h-4">Creador</Badge>
                  )}
                  {p.is_admin && p.user_id !== conversation?.created_by && (
                    <Badge variant="outline" className="ml-2 text-[10px] h-4">Admin</Badge>
                  )}
                </div>
              </div>
              {isAdmin && p.user_id !== currentUserId && onRemoveParticipant && (
                <Button
                  variant="ghost" size="sm" className="h-7 text-destructive text-xs"
                  onClick={() => { onRemoveParticipant(conversation!.id, p.user_id); }}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
