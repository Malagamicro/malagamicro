import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Inbox, Settings, PenLine } from 'lucide-react';
import { EmailInbox } from './EmailInbox';
import { EmailProfilesManager } from './EmailProfilesManager';
import { EmailCompose } from './EmailCompose';

export function EmailModule() {
  const [tab, setTab] = useState('inbox');

  return (
    <div className="p-4 md:p-8 h-full flex flex-col animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Correo</h1>
        <p className="text-muted-foreground mt-1">Bandeja de entrada, redacción con IA y perfiles de correo</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="inbox" className="gap-2"><Inbox className="h-4 w-4" />Bandeja</TabsTrigger>
          <TabsTrigger value="compose" className="gap-2"><PenLine className="h-4 w-4" />Redactar</TabsTrigger>
          <TabsTrigger value="profiles" className="gap-2"><Settings className="h-4 w-4" />Perfiles</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox" className="flex-1 mt-4">
          <Card className="h-full overflow-hidden">
            <EmailInbox />
          </Card>
        </TabsContent>
        <TabsContent value="compose" className="flex-1 mt-4">
          <Card className="h-full overflow-hidden">
            <EmailCompose />
          </Card>
        </TabsContent>
        <TabsContent value="profiles" className="mt-4">
          <EmailProfilesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
