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
  GET: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  POST: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  PATCH: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  DELETE: 'bg-red-500/10 text-red-400 border-red-500/20',
};

function generateN8nNode(tool: N8nTool): object {
  const nodeName = `Botqueron_${tool.name.replace(/\s+/g, '')}`;
  const nodeDef: Record<string, unknown> = {
    parameters: {
      toolDescription: tool.description,
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
      options: {}
    },
    type: 'n8n-nodes-base.httpRequestTool',
    typeVersion: 4.3,
    position: [0, 0],
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7),
    name: nodeName,
  };

  if (tool.body) {
    (nodeDef.parameters as Record<string, unknown>).sendBody = true;
    (nodeDef.parameters as Record<string, unknown>).specifyBody = 'json';
    (nodeDef.parameters as Record<string, unknown>).jsonBody = JSON.stringify(tool.body, null, 2);
  }

  return {
    nodes: [nodeDef],
    connections: {
      [nodeName]: {
        ai_tool: [[]]
      }
    }
  };
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
      <div className="rounded-xl p-5 bg-slate-900 border border-slate-800 shadow-lg text-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <h3 className="font-bold text-lg mb-2 text-white flex items-center gap-2">
          <span className="text-orange-500">🤖</span> Herramientas n8n para Agentes IA
        </h3>
        <p className="text-slate-400 text-sm leading-relaxed relative z-10">
          Copia estos nodos JSON e impórtalos en tu flujo de n8n. Proveen al Agente IA la capacidad de gestionar citas automáticamente usando el nodo <strong className="text-slate-200">HTTP Request Tool</strong>.
          <br className="my-2" />
          Asegúrate de definir <code className="bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-orange-400">SUPABASE_URL</code> y{' '}
          <code className="bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-orange-400">SUPABASE_ANON_KEY</code> en tu n8n.
        </p>
      </div>

      <div className="grid gap-4">
        {TOOLS.map(tool => (
          <Card key={tool.name} className="p-4 bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors shadow-none group">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-orange-500 group-hover:scale-105 transition-transform shrink-0">
                    {tool.icon}
                  </div>
                  <h4 className="font-semibold text-slate-200 truncate">{tool.name}</h4>
                  <Badge variant="outline" className={`ml-auto shrink-0 ${METHOD_COLORS[tool.method]}`}>
                     {tool.method}
                  </Badge>
                </div>
                
                <p className="text-sm text-slate-400 mb-3 pl-11">{tool.description}</p>
                
                <div className="pl-11 space-y-2">
                  <div className="bg-slate-950 rounded-md border border-slate-800 p-2 text-xs font-mono text-slate-300 break-all">
                    {tool.path}
                  </div>
                  {tool.body && (
                    <div className="bg-slate-950 rounded-md border border-slate-800 p-2 overflow-x-auto">
                      <pre className="text-xs font-mono text-slate-400">
                        {JSON.stringify(tool.body, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
              
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(tool)}
                className="shrink-0 bg-slate-950 border-slate-700 hover:bg-orange-500/10 hover:text-orange-500 hover:border-orange-500/50 transition-colors text-slate-400"
              >
                {copiedId === tool.name ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
