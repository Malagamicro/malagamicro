import { WahaSessionManager } from './WahaSessionManager';
import { WhatsAppSimpleForm } from './WhatsAppSimpleForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Send } from 'lucide-react';

export function WhatsAppPanel() {
  return (
    <div className="space-y-4">
      <WahaSessionManager />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar mensaje de WhatsApp
          </CardTitle>
          <CardDescription>
            Envía mensajes directamente a cualquier número de teléfono
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WhatsAppSimpleForm />
        </CardContent>
      </Card>
    </div>
  );
}
