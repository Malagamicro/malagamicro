import { useState } from 'react';
import { useInternalChat } from '@/hooks/useInternalChat';
import { ConversationList } from './ConversationList';
import { ChatPanel } from './ChatPanel';
import { NewConversationModal } from './NewConversationModal';
import { VideoCallModal } from './VideoCallModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, Phone, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function InternalChatPage() {
  const {
    conversations, conversationsLoading, messages, messagesLoading,
    activeConversationId, setActiveConversationId,
    createConversation, sendMessage, uploadFile,
    editMessage, deleteMessage, leaveConversation, updateGroup, removeParticipant,
  } = useInternalChat();

  const [showNewConversation, setShowNewConversation] = useState(false);
  const [mobileCallOpen, setMobileCallOpen] = useState(false);
  const [mobileIsVideo, setMobileIsVideo] = useState(false);
  const isMobile = useIsMobile();
  const { user } = useAuth();

  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

  const handleCreateConversation = async (participantIds: string[], name?: string, isGroup?: boolean) => {
    const result = await createConversation.mutateAsync({ participantIds, name, isGroup });
    if (result) {
      setActiveConversationId(result.id);
      setShowNewConversation(false);
    }
  };

  const handleSendMessage = (content?: string, file?: { url: string; name: string; size: number }) => {
    if (file) {
      sendMessage.mutate({
        content: undefined,
        messageType: file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'image' : 'file',
        fileUrl: file.url, fileName: file.name, fileSize: file.size,
      });
    } else if (content) {
      sendMessage.mutate({ content });
    }
  };

  const handleBack = () => setActiveConversationId(null);
  const handleLeave = (convId: string) => leaveConversation.mutate(convId);
  const handleEditMsg = (msgId: string, content: string) => editMessage.mutate({ messageId: msgId, newContent: content });
  const handleDeleteMsg = (msgId: string) => deleteMessage.mutate(msgId);
  const handleUpdateGroup = (convId: string, name: string) => updateGroup.mutate({ conversationId: convId, name });
  const handleRemoveParticipant = (convId: string, userId: string) => removeParticipant.mutate({ conversationId: convId, userId });

  const chatPanelProps = {
    conversation: activeConversation,
    messages, isLoading: messagesLoading,
    onSendMessage: handleSendMessage,
    onUploadFile: uploadFile,
    isSending: sendMessage.isPending,
    onLeaveConversation: handleLeave,
    onEditMessage: handleEditMsg,
    onDeleteMessage: handleDeleteMsg,
    onUpdateGroup: handleUpdateGroup,
    onRemoveParticipant: handleRemoveParticipant,
  };

  if (isMobile) {
    return (
      <div className="h-full flex flex-col border rounded-xl overflow-hidden bg-card shadow-lg">
        {activeConversationId ? (
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
              <Button variant="ghost" size="icon" onClick={handleBack} className="h-10 w-10 shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <span className="font-medium truncate flex-1">
                {activeConversation?.name ||
                  activeConversation?.participants?.find(p => p.user_id !== activeConversation.created_by)?.profile?.full_name ||
                  'Conversación'}
              </span>
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0"
                onClick={() => { setMobileIsVideo(false); setMobileCallOpen(true); }}>
                <Phone className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0"
                onClick={() => { setMobileIsVideo(true); setMobileCallOpen(true); }}>
                <Video className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1">
              <ChatPanel {...chatPanelProps} hideHeader />
            </div>
          </div>
        ) : (
          <ConversationList
            conversations={conversations} activeConversationId={activeConversationId}
            onSelectConversation={setActiveConversationId}
            onNewConversation={() => setShowNewConversation(true)}
            isLoading={conversationsLoading}
          />
        )}
        <NewConversationModal open={showNewConversation} onClose={() => setShowNewConversation(false)}
          onCreateConversation={handleCreateConversation} isCreating={createConversation.isPending} />
        {activeConversationId && (
          <VideoCallModal open={mobileCallOpen} onClose={() => setMobileCallOpen(false)}
            roomName={activeConversationId.replace(/-/g, '')}
            displayName={user?.email?.split('@')[0] || 'Usuario'} isVideoCall={mobileIsVideo} />
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden bg-card">
      <div className="w-96 min-w-[384px] border-r flex-shrink-0 overflow-hidden">
        <ConversationList conversations={conversations} activeConversationId={activeConversationId}
          onSelectConversation={setActiveConversationId}
          onNewConversation={() => setShowNewConversation(true)} isLoading={conversationsLoading} />
      </div>
      <div className="flex-1 min-w-0">
        <ChatPanel {...chatPanelProps} />
      </div>
      <NewConversationModal open={showNewConversation} onClose={() => setShowNewConversation(false)}
        onCreateConversation={handleCreateConversation} isCreating={createConversation.isPending} />
    </div>
  );
}
