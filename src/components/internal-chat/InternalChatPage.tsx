import { useState } from 'react';
import { useInternalChat } from '@/hooks/useInternalChat';
import { ConversationList } from './ConversationList';
import { ChatPanel } from './ChatPanel';
import { NewConversationModal } from './NewConversationModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function InternalChatPage() {
  const {
    conversations,
    conversationsLoading,
    messages,
    messagesLoading,
    activeConversationId,
    setActiveConversationId,
    createConversation,
    sendMessage,
    uploadFile,
  } = useInternalChat();

  const [showNewConversation, setShowNewConversation] = useState(false);
  const isMobile = useIsMobile();

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
        fileUrl: file.url,
        fileName: file.name,
        fileSize: file.size,
      });
    } else if (content) {
      sendMessage.mutate({ content });
    }
  };

  const handleBack = () => {
    setActiveConversationId(null);
  };

  // Mobile: show either list or chat, not both
  if (isMobile) {
    return (
      <div className="h-[calc(100vh-8rem)] flex flex-col border rounded-xl overflow-hidden bg-card shadow-lg">
        {activeConversationId ? (
          // Show chat panel with back button
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-10 w-10"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <span className="font-medium truncate">
                {activeConversation?.name || 
                  activeConversation?.participants?.find(p => p.user_id !== activeConversation.created_by)?.profile?.full_name ||
                  'Conversación'}
              </span>
            </div>
            <div className="flex-1">
              <ChatPanel
                conversation={activeConversation}
                messages={messages}
                isLoading={messagesLoading}
                onSendMessage={handleSendMessage}
                onUploadFile={uploadFile}
                isSending={sendMessage.isPending}
                hideHeader
              />
            </div>
          </div>
        ) : (
          // Show conversation list
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={setActiveConversationId}
            onNewConversation={() => setShowNewConversation(true)}
            isLoading={conversationsLoading}
          />
        )}

        <NewConversationModal
          open={showNewConversation}
          onClose={() => setShowNewConversation(false)}
          onCreateConversation={handleCreateConversation}
          isCreating={createConversation.isPending}
        />
      </div>
    );
  }

  // Desktop: side-by-side layout
  return (
    <div className="h-[calc(100vh-8rem)] flex border rounded-xl overflow-hidden bg-card shadow-lg">
      {/* Conversation List */}
      <div className="w-80 border-r flex-shrink-0">
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={setActiveConversationId}
          onNewConversation={() => setShowNewConversation(true)}
          isLoading={conversationsLoading}
        />
      </div>

      {/* Chat Panel */}
      <div className="flex-1">
        <ChatPanel
          conversation={activeConversation}
          messages={messages}
          isLoading={messagesLoading}
          onSendMessage={handleSendMessage}
          onUploadFile={uploadFile}
          isSending={sendMessage.isPending}
        />
      </div>

      {/* New Conversation Modal */}
      <NewConversationModal
        open={showNewConversation}
        onClose={() => setShowNewConversation(false)}
        onCreateConversation={handleCreateConversation}
        isCreating={createConversation.isPending}
      />
    </div>
  );
}