import { useState } from 'react';
import { Copy, Check, ExternalLink, Calendar, List, Edit2, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const BASE_URL_PLACEHOLDER = '{{SUPABASE_URL}}';

interface N8nTool {
  name: string;
  description: string;
  method: string;
  path: string;
  icon: React.ReactNode;
  body?: Record<string, unknown>;
  params?: Record<string, string>;
}

const TOOLS: N8nTool[] = [
  {
    name: 'Crear Cita',
    description: 'Crea una nueva cita en el calendario de Botquerón',
    method: 'POST',
    path: '/rest/v1/botqueron_appointments',
    icon: <Calendar className="w-4 h-4" />,
    body: {
      client_name: '{{client_name}}',
      client_email: '{{client_email}}',
      client_phone: '{{client_phone}}',
      appointment_date: '{{YYYY-MM-DD}}',
      appointment_time: '{{HH:mm}}',
      duration_minutes: 30,
      service: 'Consulta Agente IA',
      notes: '{{notes}}',
      status: 'pendiente',
    },
  },
  {
    name: 'Listar Citas del Día',
    description: 'Obtiene todas las citas para una fecha específica',
    method: 'GET',
    path: '/rest/v1/botqueron_appointments?appointment_date=eq.{{YYYY-MM-DD}}&order=appointment_time.asc',
    icon: <List className="w-4 h-4" />,
  },
  {
    name: 'Listar Citas Pendientes',
    description: 'Obtiene citas pendientes ordenadas por fecha',
    method: 'GET',
    path: '/rest/v1/botqueron_appointments?status=eq.pendiente&order=appointment_date.asc,appointment_time.asc',
    icon: <List className="w-4 h-4" />,
  },
  {
    name: 'Actualizar Estado de Cita',
    description: 'Cambia el estado de una cita (pendiente, confirmada, completada, cancelada)',
    method: 'PATCH',
    path: '/rest/v1/botqueron_appointments?id=eq.{{appointment_id}}',
    icon: <Edit2 className="w-4 h-4" />,
    body: { status: '{{new_status}}' },
  },
  {
    name: 'Eliminar Cita',
    description: 'Elimina una cita por su ID',
    method: 'DELETE',
    path: '/rest/v1/botqueron_appointments?id=eq.{{appointment_id}}',
    icon: <Trash2 className="w-4 h-4" />,
  },
  {
    name: 'Buscar Citas por Cliente',
    description: 'Busca citas por nombre de cliente',
    method: 'GET',
    path: '/rest/v1/botqueron_appointments?client_name=ilike.*{{search_term}}*&order=appointment_date.desc',
    icon: <List className="w-4 h-4" />,
  },
  {
    name: 'Verificar Disponibilidad',
    description: 'Comprueba las citas existentes en una fecha y hora',
    method: 'GET',
    path: '/rest/v1/botqueron_appointments?appointment_date=eq.{{YYYY-MM-DD}}&appointment_time=eq.{{HH:mm}}&status=neq.cancelada',
    icon: <Calendar className="w-4 h-4" />,
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  POST: 'bg-sky-100 text-sky-700 border-sky-300',
  PATCH: 'bg-amber-100 text-amber-700 border-amber-300',
  DELETE: 'bg-red-100 text-red-700 border-red-300',
};

function generateN8nNode(tool: N8nTool): object {
  const node: Record<string, unknown> = {
    parameters: {
      method: tool.method,
      url: `=${BASE_URL_PLACEHOLDER}${tool.path}`,
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'apikey', value: '={{$env.SUPABASE_ANON_KEY}}' },
          { name: 'Authorization', value: 'Bearer ={{$env.SUPABASE_ANON_KEY}}' },
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Prefer', value: 'return=representation' },
        ],
      },
    },
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [0, 0],
    name: `Botquerón: ${tool.name}`,
  };

  if (tool.body) {
    (node.parameters as Record<string, unknown>).sendBody = true;
    (node.parameters as Record<string, unknown>).specifyBody = 'json';
    (node.parameters as Record<string, unknown>).jsonBody = JSON.stringify(tool.body, null, 2);
  }

  return node;
}

export function BotqueronN8nTools() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (tool: N8nTool) => {
    const node = generateN8nNode(tool);
    navigator.clipboard.writeText(JSON.stringify(node, null, 2));
    setCopiedId(tool.name);
    toast.success(`Nodo "${tool.name}" copiado al portapapeles`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg, #0369a1, #0ea5e9)', color: 'white' }}>
        <h3 className="font-bold text-base mb-1">🤖 Herramientas n8n para tu Agente IA</h3>
        <p className="text-sky-100 text-xs">
          Copia estos nodos JSON en tu workflow de n8n para que tu agente de IA pueda gestionar citas automáticamente.
          Recuerda configurar las variables <code className="bg-white/20 px-1 rounded">SUPABASE_URL</code> y{' '}
          <code className="bg-white/20 px-1 rounded">SUPABASE_ANON_KEY</code> en tu entorno de n8n.
        </p>
      </div>

      {TOOLS.map(tool => (
        <Card key={tool.name} className="p-4 border hover:shadow-md transition-shadow" style={{ background: 'white', borderColor: '#bae6fd' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: '#f97316' }}>{tool.icon}</span>
                <span className="font-semibold text-sm" style={{ color: '#0369a1' }}>{tool.name}</span>
                <Badge variant="outline" className={`text-xs ${METHOD_COLORS[tool.method]}`}>{tool.method}</Badge>
              </div>
              <p className="text-xs mb-2" style={{ color: '#64748b' }}>{tool.description}</p>
              <code className="text-xs block p-2 rounded" style={{ background: '#f0f9ff', color: '#0369a1', wordBreak: 'break-all' }}>
                {tool.path}
              </code>
              {tool.body && (
                <pre className="text-xs mt-2 p-2 rounded overflow-x-auto" style={{ background: '#f8fafc', color: '#334155' }}>
                  {JSON.stringify(tool.body, null, 2)}
                </pre>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopy(tool)}
              style={{ borderColor: '#f97316', color: '#f97316' }}
              className="shrink-0"
            >
              {copiedId === tool.name ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
