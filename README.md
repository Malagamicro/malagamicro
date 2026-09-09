# MalagaMicro CRM 🚀

Sistema integral de gestión de clientes, prospectos y operaciones comerciales. Unifica atención al cliente, campañas de marketing, embudos de ventas, presupuestos y comunicaciones multicanal en una sola plataforma.

---

## 📚 Documentación

| Documento | Descripción |
|-----------|-------------|
| [Documentación Maestra](./docs/DOCUMENTACION_MAESTRA.md) | Arquitectura, módulos core, flujos de datos y puntos de mejora |
| [Integración N8N](./docs/INTEGRACION_N8N_DOCUMENTACION.md) | Webhooks, automatizaciones y conexión con StelOrder |
| [Despliegue local y cloud](./docs/DESPLIEGUE_LOCAL_Y_CLOUD.md) | Ejecutar el CRM en un PC o servidor propio (Docker, Nginx, Supabase) |

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **UI Framework** | React 18 + TypeScript (Vite + SWC) |
| **Estilos** | Tailwind CSS + shadcn/ui |
| **Routing** | React Router v6 |
| **Estado async** | TanStack Query (React Query) |
| **Backend** | Lovable Cloud (PostgreSQL, Auth, Realtime, Storage) |
| **Serverless** | Edge Functions (Deno) — IA, WhatsApp, Webhooks, SMTP |
| **PWA** | vite-plugin-pwa con Service Worker |

---

## 🏗️ Estructura del Proyecto

```
├── docs/                          # Documentación técnica
│   ├── DOCUMENTACION_MAESTRA.md
│   └── INTEGRACION_N8N_DOCUMENTACION.md
│
├── public/                        # Assets estáticos
│   ├── pwa-icons/                 # Iconos PWA (72–512px)
│   └── images/
│
├── src/
│   ├── assets/                    # Imágenes importadas (logos, mascota)
│   ├── components/
│   │   ├── app/                   # Providers y wrappers de aplicación
│   │   │   ├── ProtectedRoute     # Guard de autenticación
│   │   │   ├── theme-provider     # next-themes wrapper
│   │   │   ├── ThemeSyncProvider  # Sincronización de tema con BD
│   │   │   └── VersionChecker     # Detector de nuevas versiones
│   │   ├── ui/                    # Componentes base shadcn/ui
│   │   ├── shared/                # Componentes compartidos (ConfirmDialog)
│   │   ├── layout/                # Sidebar, RightSidebar, ThemeCustomizer
│   │   ├── auth/                  # Login, registro, MFA, rate-limit
│   │   ├── dashboard/             # Dashboard principal y widgets
│   │   ├── leads/                 # CRM: lista, kanban, mapa, detalle
│   │   ├── budget/                # Presupuestos y proveedores
│   │   ├── calendar/              # Calendario y eventos
│   │   ├── email/                 # Módulo email (IMAP/SMTP)
│   │   ├── campaigns/             # Campañas de email masivo
│   │   ├── whatsapp/              # WhatsApp (WAHA/Evolution)
│   │   ├── internal-chat/         # Chat interno + videollamadas WebRTC
│   │   ├── osticket/              # Integración osTicket
│   │   ├── seo/                   # Generador de artículos SEO con IA
│   │   ├── editor/                # Editor de documentos y hojas de cálculo
│   │   ├── workspaces/            # Espacios de trabajo colaborativos
│   │   ├── n8n/                   # Herramientas y API keys para n8n
│   │   ├── chat/                  # Chatbot mascota (IA asistente)
│   │   ├── ai-memory/             # Memoria persistente del agente IA
│   │   ├── apps/                  # Hub de aplicaciones configurables
│   │   ├── notes/                 # Notas rápidas (sticky notes)
│   │   ├── notifications/         # Centro de notificaciones
│   │   ├── performance/           # Dashboard de rendimiento
│   │   ├── prospection/           # Prospección con mapas y IA
│   │   ├── reminders/             # Recordatorios generales
│   │   ├── reports/               # Informes y analíticas
│   │   ├── security/              # Panel de seguridad
│   │   ├── settings/              # Configuración de perfil y SMTP
│   │   └── shared-files/          # Archivos compartidos entre usuarios
│   │
│   ├── contexts/                  # React Contexts (Notificaciones, Llamadas)
│   ├── data/                      # Datos mock para desarrollo
│   ├── hooks/                     # Custom hooks (65+ hooks de dominio)
│   ├── integrations/              # Cliente y tipos auto-generados
│   ├── lib/                       # Utilidades: sanitización, exportación, validación
│   ├── pages/                     # Vistas principales (rutas)
│   ├── services/                  # Servicios externos (WAHA, Evolution API)
│   ├── test/                      # Configuración de tests (Vitest)
│   └── types/                     # Tipos TypeScript compartidos
│
└── supabase/
    ├── config.toml                # Configuración del proyecto (auto-generado)
    ├── migrations/                # Migraciones SQL (auto-gestionadas)
    └── functions/                 # 49 Edge Functions serverless
        ├── ai-completion/         # Completions IA multi-modelo
        ├── budget-request/        # Motor de presupuestos con IA
        ├── crm-api/               # API REST pública del CRM
        ├── send-smtp-email/       # Envío SMTP con IMAP sync
        ├── send-whatsapp/         # Envío WhatsApp vía WAHA
        ├── mascot-chat/           # Chat con mascota IA
        ├── generate-seo-article/  # Generación SEO con n8n
        ├── lead-finder-agent/     # Agente buscador de leads
        └── ...                    # + 40 funciones más
```

---

## 🧩 Módulos Principales

| Módulo | Descripción |
|--------|-------------|
| **CRM / Leads** | Gestión completa: lista, kanban, mapa geolocalizado, scoring, carpetas, importación CSV/Google Sheets |
| **Presupuestos** | Chatbot IA para solicitar y comparar presupuestos de proveedores. Integración StelOrder |
| **Email** | Perfiles SMTP/IMAP, bandeja de entrada, composición con IA, campañas masivas |
| **WhatsApp** | Integración WAHA — envío/recepción, plantillas, envío masivo |
| **Chat Interno** | Mensajería entre usuarios, grupos, emojis, archivos, videollamadas WebRTC |
| **Calendario** | Eventos con recordatorios, participantes y colores |
| **osTicket** | Webhooks para tickets, notas internas, notificaciones WhatsApp |
| **SEO** | Generación de artículos optimizados con IA vía n8n |
| **Editor** | Documentos de texto y hojas de cálculo con motor de fórmulas |
| **Workspaces** | Espacios colaborativos con archivos, chat IA y canvas |
| **Seguridad** | Auditoría, MFA, bloqueos por IP, rate limiting, timeout de sesión |
| **IA Asistente** | Mascota chatbot, memoria persistente, sub-agentes configurables |

---

## 💻 Desarrollo Local

### Prerrequisitos
- [Node.js](https://nodejs.org/) v18+
- npm / pnpm / bun

### Instalación
```bash
git clone <URL_DEL_REPOSITORIO>
cd malagamicro-crm
npm install
```

### Variables de Entorno
El archivo `.env` se genera automáticamente con las credenciales del proyecto. Variables disponibles:
```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

### Comandos
| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Build de producción |
| `npm run lint` | Análisis estático con ESLint |
| `npm run test` | Tests con Vitest |

---

## 🔐 Seguridad

- **RLS (Row Level Security)** en todas las tablas con datos de usuario
- **Roles** gestionados en tabla separada `user_roles` (admin, moderator, user)
- **Función `has_role()`** con `SECURITY DEFINER` para evitar recursión en políticas
- **MFA** opcional con TOTP
- **Rate limiting** en login con bloqueo temporal
- **Auditoría** completa de acciones con IP y user-agent
- **Sanitización** de inputs con DOMPurify

---

## 🤝 Contribuciones

1. Tipar estrictamente con TypeScript — evitar `any`
2. Aislar lógica de negocio en Edge Functions o RLS
3. Componentes < 300 líneas — extraer sub-componentes y helpers
4. Actualizar documentación en `docs/` al crear módulos significativos
5. Usar tokens semánticos de diseño — nunca colores directos en componentes

---

_Creado para escalar las operaciones y ventas del equipo MalagaMicro._
