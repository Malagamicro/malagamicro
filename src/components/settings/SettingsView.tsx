import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppUpdateCard } from '@/components/settings/AppUpdateCard';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { ThemeToggleCard } from '@/components/settings/ThemeToggleCard';
import { GoogleSheetsCard } from '@/components/settings/GoogleSheetsCard';
import { OsTicketConfigCard } from '@/components/settings/OsTicketConfigCard';
import { PasswordChangeCard } from '@/components/settings/PasswordChangeCard';
import { TwoFactorAuthCard } from '@/components/settings/TwoFactorAuthCard';
import { NotificationPreferencesCard } from '@/components/settings/NotificationPreferencesCard';
import { AuditLogViewer } from '@/components/settings/AuditLogViewer';
import { DeleteAccountCard } from '@/components/settings/DeleteAccountCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { Settings, Shield, User, Plug, Activity, Bell } from 'lucide-react';

interface SettingsViewProps {
  onBack: () => void;
}

export function SettingsView({ onBack }: SettingsViewProps) {
  return (
    <div className="flex flex-col animate-fade-in h-full">
      <PageHeader
        title="Ajustes y Configuración"
        description="Gestiona tu cuenta, seguridad e integraciones"
        icon={<Settings className="h-5 w-5 text-primary" />}
        onBack={onBack}
      />
      
      <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-8">
        <div className="max-w-5xl mx-auto">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid grid-cols-2 md:grid-cols-4 mb-8 bg-muted/50 p-1 h-auto">
              <TabsTrigger value="general" className="py-2.5 gap-2 text-xs sm:text-sm">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">General</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="py-2.5 gap-2 text-xs sm:text-sm">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Seguridad</span>
              </TabsTrigger>
              <TabsTrigger value="integrations" className="py-2.5 gap-2 text-xs sm:text-sm">
                <Plug className="h-4 w-4" />
                <span className="hidden sm:inline">Integraciones</span>
              </TabsTrigger>
              <TabsTrigger value="system" className="py-2.5 gap-2 text-xs sm:text-sm">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">Sistema</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
              <ProfileSettings />
              <NotificationPreferencesCard />
              <ThemeToggleCard />
            </TabsContent>

            <TabsContent value="security" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
              <PasswordChangeCard />
              <TwoFactorAuthCard />
              <div className="pt-6 mt-6 border-t border-border/50">
                <DeleteAccountCard />
              </div>
            </TabsContent>

            <TabsContent value="integrations" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <GoogleSheetsCard />
                <OsTicketConfigCard />
              </div>
            </TabsContent>

            <TabsContent value="system" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
              <AppUpdateCard />
              <AuditLogViewer />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
