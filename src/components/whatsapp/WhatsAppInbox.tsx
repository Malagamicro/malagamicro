import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  RefreshCw, 
  Search, 
  MessageSquare, 
  Plus, 
  MoreVertical,
  Folder,
  FolderPlus,
  Trash2,
  Archive,
  Download,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useWhatsAppChats, WhatsAppChat } from '@/hooks/useWhatsAppChats';
import { useWhatsAppChatFolders } from '@/hooks/useWhatsAppChatFolders';
import { useRealtimeConnection } from '@/hooks/useRealtimeConnection';
import { NewChatModal } from './NewChatModal';
import { ConnectionIndicator } from './ConnectionIndicator';

interface WhatsAppInboxProps {
  onSelectChat: (chatId: string, chatName: string, phone: string) => void;
  selectedChatId: string | null;
}

const FOLDER_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', 
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
];

export function WhatsAppInbox({ onSelectChat, selectedChatId }: WhatsAppInboxProps) {
  const { 
    chats, 
    isLoadingChats, 
    refetchChats, 
    getOrCreateChat,
    updateChatLastMessage,
    syncFromEvolution,
    isSyncing,
  } = useWhatsAppChats();
  
  const {
    folders,
    createFolder,
    assignChatToFolder,
    deleteChat,
  } = useWhatsAppChatFolders();
  
  const { status: connectionStatus, reconnect } = useRealtimeConnection();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#6366f1');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  const handleCreateChat = async (phone: string, name?: string) => {
    const chatId = `${phone}@s.whatsapp.net`;
    await getOrCreateChat({ chatId, phone, customName: name });
    onSelectChat(chatId, name || phone, phone);
  };

  const handleSelectChat = async (chat: WhatsAppChat) => {
    if (chat.unreadCount > 0) {
      await updateChatLastMessage({ chatId: chat.chatId, resetUnread: true });
    }
    onSelectChat(chat.chatId, chat.customName || chat.phone, chat.phone);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder.mutateAsync({ 
      name: newFolderName.trim(), 
      color: newFolderColor 
    });
    setNewFolderName('');
    setNewFolderColor('#6366f1');
    setIsNewFolderOpen(false);
  };

  const handleAssignFolder = async (chatId: string, folderId: string | null) => {
    await assignChatToFolder.mutateAsync({ chatId, folderId });
  };

  const handleDeleteChat = async (chatId: string) => {
    await deleteChat.mutateAsync(chatId);
  };

  // Extended chat interface with folder_id
  interface ExtendedChat extends WhatsAppChat {
    folderId?: string | null;
  }

  // Filter chats by search and folder
  const filteredChats = (chats as ExtendedChat[]).filter(chat => {
    const matchesSearch = 
      chat.customName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      chat.phone.includes(searchTerm) ||
      chat.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFolder = selectedFolderId === null || (chat as any).folder_id === selectedFolderId;
    
    return matchesSearch && matchesFolder;
  });

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return format(date, 'HH:mm');
    } else if (diffDays === 1) {
      return 'Ayer';
    } else if (diffDays < 7) {
      return format(date, 'EEEE', { locale: es });
    } else {
      return format(date, 'dd/MM/yyyy');
    }
  };

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Inbox
              <ConnectionIndicator 
                status={connectionStatus} 
                onReconnect={reconnect}
              />
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsNewFolderOpen(true)}
                title="Nueva carpeta"
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsNewChatOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncFromEvolution()}
                disabled={isSyncing}
                title="Sincronizar chats desde Evolution API"
              >
                <Download className={`h-4 w-4 ${isSyncing ? 'animate-bounce' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchChats()}
                disabled={isLoadingChats}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingChats ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          
          {/* Folder tabs */}
          {folders.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              <Button
                variant={selectedFolderId === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFolderId(null)}
                className="h-7 text-xs"
              >
                Todos
              </Button>
              {folders.map((folder) => (
                <Button
                  key={folder.id}
                  variant={selectedFolderId === folder.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedFolderId(folder.id)}
                  className="h-7 text-xs gap-1"
                  style={{ 
                    borderColor: selectedFolderId !== folder.id ? folder.color : undefined,
                    backgroundColor: selectedFolderId === folder.id ? folder.color : undefined,
                  }}
                >
                  <Folder className="h-3 w-3" style={{ color: selectedFolderId === folder.id ? 'white' : folder.color }} />
                  {folder.name}
                </Button>
              ))}
            </div>
          )}
          
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-[calc(100vh-350px)]">
            {filteredChats.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {isLoadingChats ? (
                  'Cargando conversaciones...'
                ) : (
                  <div className="space-y-2">
                    <p>No hay conversaciones</p>
                    <Button
                      variant="link"
                      onClick={() => setIsNewChatOpen(true)}
                      className="text-primary"
                    >
                      Iniciar una nueva conversación
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredChats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`relative group ${
                      selectedChatId === chat.chatId ? 'bg-accent' : ''
                    }`}
                  >
                    <button
                      onClick={() => handleSelectChat(chat)}
                      className="w-full p-4 text-left hover:bg-accent transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-12 w-12">
                          {chat.avatarUrl ? (
                            <AvatarImage src={chat.avatarUrl} alt={chat.customName || chat.phone} />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {(chat.customName || chat.phone).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">
                              {chat.customName || chat.phone}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(chat.lastMessageAt)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-sm text-muted-foreground truncate max-w-[150px]">
                              {chat.lastMessage || 'Sin mensajes'}
                            </p>
                            {chat.unreadCount > 0 && (
                              <span className="ml-2 h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold leading-none">
                                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            +{chat.phone}
                          </p>
                        </div>
                      </div>
                    </button>
                    
                    {/* Chat actions dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {folders.length > 0 && (
                          <>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <Folder className="h-4 w-4 mr-2" />
                                Mover a carpeta
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem onClick={() => handleAssignFolder(chat.chatId, null)}>
                                  Sin carpeta
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {folders.map((folder) => (
                                  <DropdownMenuItem 
                                    key={folder.id}
                                    onClick={() => handleAssignFolder(chat.chatId, folder.id)}
                                  >
                                    <div 
                                      className="w-3 h-3 rounded-full mr-2" 
                                      style={{ backgroundColor: folder.color }}
                                    />
                                    {folder.name}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem 
                          onClick={() => handleDeleteChat(chat.chatId)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar chat
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onCreateChat={handleCreateChat}
      />

      {/* New Folder Dialog */}
      <Dialog open={isNewFolderOpen} onOpenChange={setIsNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva carpeta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ej: Clientes VIP"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2 flex-wrap">
                {FOLDER_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewFolderColor(color)}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      newFolderColor === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewFolderOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || createFolder.isPending}
            >
              Crear carpeta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
