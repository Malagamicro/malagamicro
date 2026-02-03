import { GeneralRemindersList } from '@/components/reminders/GeneralRemindersList';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function GeneralReminders() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al CRM
        </Button>
        <h1 className="text-2xl font-bold">Recordatorios de Empresa</h1>
        <p className="text-muted-foreground">
          Gestiona recordatorios generales para la empresa (visible para todos)
        </p>
      </div>
      <GeneralRemindersList />
    </div>
  );
}
