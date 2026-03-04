import { N8nToolsLibrary } from './N8nToolsLibrary';
import { PageHeader } from '@/components/layout/PageHeader';
import { Workflow } from 'lucide-react';

export function N8nIntegrationPage() {
  return (
    <div className="p-4 sm:p-6 animate-fade-in max-w-5xl mx-auto">
      <PageHeader
        title="Integración n8n"
        description="Conecta tu CRM con agentes de IA en n8n usando estas herramientas HTTP"
        icon={<Workflow className="w-6 h-6" />}
      />
      <div className="mt-6">
        <N8nToolsLibrary />
      </div>
    </div>
  );
}
