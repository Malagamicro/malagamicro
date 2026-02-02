import { GeneralRemindersList } from '@/components/reminders/GeneralRemindersList';

export default function GeneralReminders() {
  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Recordatorios de Empresa</h1>
        <p className="text-muted-foreground">
          Gestiona recordatorios generales para la empresa
        </p>
      </div>
      <GeneralRemindersList />
    </div>
  );
}
