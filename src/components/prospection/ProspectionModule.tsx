import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, Bot, Map, UserPlus } from 'lucide-react';
import { LeadFinderAgent } from './LeadFinderAgent';
import { ManualLeadEntry } from './ManualLeadEntry';
import { ProspectionMap } from './ProspectionMap';

export function ProspectionModule() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoadingKey, setIsLoadingKey] = useState(true);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-maps-key');
        if (error) { setKeyError('No se pudo cargar el mapa'); return; }
        if (data?.apiKey) setApiKey(data.apiKey);
        else setKeyError('API key no configurada');
      } catch { setKeyError('Error al conectar'); }
      finally { setIsLoadingKey(false); }
    };
    fetchApiKey();
  }, []);

  return (
    <Tabs defaultValue="agent" className="h-full flex flex-col">
      <TabsList className="mx-4 mt-2 w-fit">
        <TabsTrigger value="agent" className="gap-1.5">
          <Bot className="w-4 h-4" />
          Agente IA
        </TabsTrigger>
        <TabsTrigger value="maps" className="gap-1.5">
          <Map className="w-4 h-4" />
          Google Maps
        </TabsTrigger>
        <TabsTrigger value="manual" className="gap-1.5">
          <UserPlus className="w-4 h-4" />
          Manual
        </TabsTrigger>
      </TabsList>

      <TabsContent value="agent" className="flex-1 min-h-0 mt-0">
        <LeadFinderAgent />
      </TabsContent>

      <TabsContent value="maps" className="flex-1 min-h-0 mt-0">
        {isLoadingKey ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : keyError || !apiKey ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
              <p className="text-destructive font-medium">{keyError}</p>
            </div>
          </div>
        ) : (
          <ProspectionMap apiKey={apiKey} />
        )}
      </TabsContent>

      <TabsContent value="manual" className="flex-1 min-h-0 mt-0 overflow-auto">
        <ManualLeadEntry />
      </TabsContent>
    </Tabs>
  );
}
