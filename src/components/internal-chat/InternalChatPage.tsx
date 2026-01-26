import { useState } from 'react';
import { useInternalChat } from '@/hooks/useInternalChat';
import { ConversationList } from './ConversationList';
import { ChatPanel } from './ChatPanel';
import { NewConversationModal } from './NewConversationModal';

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
