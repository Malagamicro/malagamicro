import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WhatsAppInbox } from './WhatsAppInbox';
import { WhatsAppChat } from './WhatsAppChat';
import { WhatsAppSimpleForm } from './WhatsAppSimpleForm';
import { MessageSquare, Send, Inbox } from 'lucide-react';

export function WhatsAppPanel() {
  const [selectedChat, setSelectedChat] = useState<{
    id: string;
    name: string;
    phone: string;
  } | null>(null);

  const handleSelectChat = (chatId: string, chatName: string, phone: string) => {
    setSelectedChat({ id: chatId, name: chatName, phone });
  };

  const handleBackFromChat = () => {
    setSelectedChat(null);
  };

  return (
    <div className="h-[calc(100vh-180px)]">
      <Tabs defaultValue="inbox" className="h-full">
        <TabsList className="mb-4">
          <TabsTrigger value="inbox" className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Bandeja de entrada
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Enviar mensaje
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="h-[calc(100%-48px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
            {/* Inbox - always visible on desktop, hidden when chat selected on mobile */}
            <div className={`${selectedChat ? 'hidden lg:block' : ''}`}>
              <WhatsAppInbox
                onSelectChat={handleSelectChat}
                selectedChatId={selectedChat?.id || null}
              />
            </div>

            {/* Chat area */}
            <div className={`${!selectedChat ? 'hidden lg:flex' : ''}`}>
              {selectedChat ? (
                <WhatsAppChat
                  chatId={selectedChat.id}
                  chatName={selectedChat.name}
                  phone={selectedChat.phone}
                  onBack={handleBackFromChat}
                />
              ) : (
                <div className="hidden lg:flex h-full items-center justify-center border rounded-lg bg-muted/30">
                  <div className="text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Selecciona una conversación para ver los mensajes</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="test">
          <div className="max-w-md">
            <WhatsAppSimpleForm />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
