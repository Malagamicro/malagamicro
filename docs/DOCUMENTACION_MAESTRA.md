# Documentación Maestra del Proyecto: MalagaMicro CRM

## 1. Resumen Ejecutivo (High-Level Overview)

**MalagaMicro CRM** es un sistema integral avanzado para la gestión de clientes, prospectos (leads), presupuestos y operaciones comerciales de MalagaMicro. Este sistema actúa como el núcleo unificado de las operaciones de la empresa y aporta gran valor de negocio al centralizar múltiples procesos en una sola plataforma: atención al cliente, campañas de marketing, gestión de embudos de ventas, cotizaciones (presupuestos) y comunicaciones multicanal (Email, WhatsApp, Chat Interno).

El sistema se apoya fuertemente en integraciones y automatizaciones avanzadas a través de n8n, inteligencia artificial (para asistentes, generación de documentos SEO, agentes de cotización), osTicket para soporte, y StelOrder como ERP, permitiendo escalar las operaciones del equipo de forma eficiente y ordenada.

---

## 2. Arquitectura del Sistema

El proyecto está diseñado bajo una arquitectura de Single Page Application (SPA) apoyada por un Backend-as-a-Service (BaaS) y Microservicios (Serverless).

*   **Frontend (Cliente):**
    *   **Framework:** React 18 con TypeScript y Vite (con el compilador SWC para un desarrollo veloz).
    *   **Routing:** React Router DOM (v6) para navegación interna protegida.
    *   **Estado y Data Fetching:** React Query (TanStack Query) para el manejo de estado asíncrono y caché de datos.
    *   **UI y Estilos:** Tailwind CSS, complementado con componentes de Radix UI (shadcn/ui), iconos de `lucide-react` y manejo de temas claros/oscuros.
    *   **PWA:** Soporte para Progressive Web App (Service Worker) vía `vite-plugin-pwa`.
*   **Backend & Base de Datos (Lovable Cloud / Supabase):**
    *   **Servicio principal:** Supabase, proveyendo Auth, PostgreSQL, Storage y Edge Functions.
    *   **Autenticación:** Supabase Auth (correo electrónico, contraseñas, redirecciones seguras).
    *   **Base de Datos:** PostgreSQL con políticas de Row Level Security (RLS) muy restrictivas para el acceso seguro a los datos de cada usuario o roles de administración.
*   **Microservicios y Serverless (Edge Functions en Deno):**
    *   Más de 40 funciones alojadas en `supabase/functions/` y ejecutadas en Deno.
    *   **Funciones clave:** Endpoints tipo REST API (`crm-api`), integraciones de webhooks (n8n, WAHA, osTicket, StelOrder) e interacción con IA (`perplexity-chat`, `budget-request`).
*   **Integraciones Externas:**
    *   **n8n:** Para la creación de flujos de trabajo avanzados, orquestando servicios de automatización de correos electrónicos, peticiones y notificaciones.
    *   **WhatsApp:** A través de la API WAHA (WhatsApp HTTP API), gestionando el envío masivo y recepción de mensajes.
    *   **StelOrder & osTicket:** Interfaz directa mediante webhooks para facturación y sistema de soporte por tickets, respectivamente.

---

## 3. Guía de Instalación y Configuración

### Prerrequisitos
*   [Node.js](https://nodejs.org/) (versión 18 o superior).
*   Gestor de paquetes `npm`, `pnpm` o `bun`.
*   Una cuenta y proyecto en Supabase (o un contenedor local con Docker de Supabase).

### Configuración del Entorno

1.  **Clonación e instalación de dependencias:**
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd malagamicro-crm
    npm install
    ```

2.  **Variables de Entorno:**
    Es necesario crear un archivo `.env` en la raíz del proyecto. Las credenciales básicas para el frontend son:
    ```env
    VITE_SUPABASE_URL=https://<TU_PROYECTO_ID>.supabase.co
    VITE_SUPABASE_PUBLISHABLE_KEY=ey...
    VITE_SUPABASE_PROJECT_ID=<TU_PROYECTO_ID>

    # Opcionales según las integraciones
    VITE_WAHA_API_URL=https://<TU_INSTANCIA_WAHA>
    VITE_WAHA_API_KEY=<TU_WAHA_API_KEY>
    ```

    *Nota: Para el backend, las funciones Deno requieren definir `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y claves de servicios externos (`N8N_WEBHOOK_SECRET`, `SMTP_HOST`, `PERPLEXITY_API_KEY`, etc.) directamente en los Secrets de Supabase.*

3.  **Ejecución del Servidor de Desarrollo:**
    ```bash
    npm run dev
    ```
    El servidor levantará en modo desarrollo, normalmente en el puerto `:8080` (o configurado en `vite.config.ts`), y ofrecerá Hot Module Replacement (HMR).

4.  **Generación de Build de Producción:**
    ```bash
    npm run build
    ```

---

## 4. Diccionario de Funciones y Módulos (Deep Dive)

### Módulo: Autenticación (`src/hooks/useAuth.tsx`)

**Propósito:** Provee un Custom Hook basado en React Context para gestionar de forma centralizada el estado de la sesión, registro y logueo de usuarios mediante Supabase Auth.

**Funciones Clave:**

| Función | Parámetros | Retorno | Lógica Breve |
| :--- | :--- | :--- | :--- |
| `signUp` | `email` (string), `password` (string) | `Promise<{ error: Error \| null }>` | Crea un usuario y envía el correo de validación con URL de redirección local. |
| `signIn` | `email` (string), `password` (string) | `Promise<{ error: Error \| null }>` | Autentica al usuario en Supabase con contraseña. |
| `signOut` | Ninguno | `Promise<void>` | Finaliza y destruye la sesión actual del usuario. |
| `resetPassword` | `email` (string) | `Promise<{ error: Error \| null }>` | Envía un email para restablecer contraseña con redirección a `/reset-password`. |

**Dependencias:**
*   `@supabase/supabase-js` (Tipos)
*   `@/integrations/supabase/client` (Instancia singleton del cliente de Supabase).

---

### Módulo: Listado de Leads (`src/components/leads/LeadsList.tsx`)

**Propósito:** Muestra un listado interactivo (Grid o Lista) de clientes potenciales. Soporta funcionalidades avanzadas como filtros, búsqueda, eliminación masiva, mensajería de WhatsApp rápida y exportación de datos.

**Funciones / Propiedades de Interfaz:**

| Función / Prop | Parámetros | Retorno | Lógica Breve |
| :--- | :--- | :--- | :--- |
| `filteredAndSortedLeads` | N/A (Memoized value) | `Lead[]` | Evalúa parámetros de búsqueda, estados, carpetas, y devuelve los leads filtrados y ordenados (ej. por score). |
| `toggleLeadSelection` | `leadId` (string) | `void` | Agrega o elimina el ID del lead en el array de selección masiva (`selectedLeadIds`). |
| `handleBulkDelete` | Ninguno | `void` | Ejecuta la función del hook `bulkDeleteLeads` pasando el array de seleccionados, y limpia la selección en caso de éxito. |

**Dependencias:**
*   Componentes de UI: `LeadCard`, `Select`, `Input`, `Button`, `DropdownMenu`, etc.
*   Hooks: `useLeads`, `useLeadFolders`, `useGoogleSheetsSync`.
*   Utilidades: `exportToCSV`, `exportToExcel`.

---

### Backend: CRM API Publica (`supabase/functions/crm-api/index.ts`)

**Propósito:** Sirve como un gateway (API RESTful) para peticiones directas de usuarios o servicios de terceros a la base de datos CRM, manteniendo controles rigurosos de acceso y mitigación de ataques de inyección SQL.

**Funciones / Helpers:**

| Función | Parámetros | Retorno | Lógica Breve |
| :--- | :--- | :--- | :--- |
| `containsSqlInjection`| `input` (string) | `boolean` | Verifica cadenas de entrada usando expresiones regulares predefinidas (`SQL_INJECTION_PATTERNS`) para detectar palabras clave (SELECT, DROP, etc.) o escapes de SQL. |
| `sanitizeBodyForDb` | `obj` (Record) | `Record` | Recorre de manera recursiva un objeto de payload y sanea inyecciones SQL reemplazando caracteres prohibidos como `;`, `--`, `/*`. |
| `checkRateLimit` | `ip` (string) | `boolean` | Valida si la IP del usuario ha superado el máximo de peticiones permitidas por minuto (utilizando un Map en memoria). |

**Dependencias:**
*   Deno standard library (`serve`).
*   `@supabase/supabase-js` (Para interacción con BD usando llaves de servicio para saltar RLS cuando sea necesario dentro de la Edge Function, previa validación de API Key).

---

### Backend: Integración N8N (Documentado en `INTEGRACION_N8N_DOCUMENTACION.md`)

**Propósito:** Proveer webhooks consumibles por flujos de n8n para el procesamiento automático de presupuestos (lectura, recepción, envíos).

**Módulos / Endpoints asociados:**
*   **POST `/functions/v1/receive-budget-from-n8n`:** Webhook para recibir un presupuesto procesado de proveedor por n8n (parámetros: `request_id`, `proveedor`, `productos`, `total_general`). Guarda el presupuesto validado en la tabla `budgets_received`.
*   **POST `/functions/v1/notify-n8n-approval`:** Notifica de vuelta a un flujo de n8n cuando se ha aprobado/rechazado una cotización y la manda a STEL Order.

**Dependencias:** `Deno`, variables de entorno secretas (`N8N_WEBHOOK_SECRET`).

---

## 5. Flujos de Datos Clave

### Flujo 1: Solicitud y Recepción de Presupuesto (Cotización)
1.  **Creación:** Un usuario interactúa con el `BudgetChatbot` en el front-end y genera una solicitud. Se inserta en la tabla `budget_requests` con estado `pending`.
2.  **Llamada a Automatización:** El sistema (o Edge Function) notifica a n8n de que hay una solicitud pendiente.
3.  **Procesamiento N8N:** n8n formatea la información y dispara emails a los proveedores asociados.
4.  **Respuesta Proveedor:** El proveedor responde el correo. N8N capta el correo usando un nodo de polling IMAP o webhook desde el proveedor de correo.
5.  **Ingesta de Webhook:** N8N procesa el texto, extrae el presupuesto y llama a la Edge Function `/v1/receive-budget-from-n8n`.
6.  **Actualización BD & UI:** La base de datos guarda el registro en `budgets_received`, actualizando a estado `revision`. El usuario es notificado en la interfaz web de que un proveedor ha contestado, gracias a las suscripciones de Supabase Realtime.

### Flujo 2: Autenticación de Usuarios
1.  **Login:** El usuario ingresa email y contraseña. Llama a `signIn` del hook `useAuth`.
2.  **Validación de Credenciales:** La solicitud va a Supabase Auth; si es correcta, el backend devuelve el JWT de sesión al frontend.
3.  **Actualización de Contexto:** El listener `onAuthStateChange` dentro del `AuthProvider` capta el evento.
4.  **Acceso a SPA:** El HOC (High Order Component) `ProtectedRoute` que envuelve las rutas valida si la sesión existe y permite la navegación al Dashboard. Si falla, el usuario permanece en `/login`.

---

## 6. Puntos de Mejora (Auditoría)

1.  **Sanitización Frágil de SQL Injections (`crm-api`):**
    *   **Observación:** En `supabase/functions/crm-api/index.ts` existe un sistema artesanal de `containsSqlInjection` y sanitización a base de Regex. Esto es frágil y costoso computacionalmente.
    *   **Recomendación:** Supabase Postgres y su SDK ya preparan las queries y evitan la inyección SQL de primer orden al usar su API (e.g. `.from().select()`). Si bien es buena práctica sanear el HTML contra XSS (ej. DOMPurify), el saneo de SQL manual es anti-patrón en un entorno que usa un ORM o Query Builder moderno. Se aconseja eliminar esta regex o cambiarla por bibliotecas más maduras de validación estricta de tipos (Zod) sobre el *request payload*.

2.  **Componentes Monolíticos (`LeadsList.tsx`):**
    *   **Observación:** El componente `LeadsList.tsx` maneja más de 300 líneas realizando al mismo tiempo el estado de los filtros, lógica de ordenamiento de tablas, interacciones modales y sincronizaciones complejas de dependencias múltiples (`useLeads`, `useGoogleSheetsSync`).
    *   **Recomendación:** Implementar el principio de responsabilidad única (SRP). Extraer la lógica de filtrado y ordenamiento en un Hook propio personalizado (ej. `useLeadsFilter`). Dividir los menús de filtros en su propio sub-componente.

3.  **Manejo Global de Errores React (Error Boundaries):**
    *   **Observación:** Carece de fronteras de error a nivel jerárquico. Si algo crashea en el pipeline de React o en las validaciones de un objeto en particular durante un render, la pantalla entera quedará en blanco.
    *   **Recomendación:** Envolver en `<ErrorBoundary>` las páginas protegidas o la raíz de enrutamiento (`Routes` en `App.tsx`), proveyendo un fallback amigable y notificando del error (por ejemplo, mandando el error a un canal interno de logging/WhatsApp).

4.  **Email Polling (IMAP):**
    *   **Observación:** De acuerdo al documento `INTEGRACION_N8N_DOCUMENTACION.md`, aunque está planeado y se define la infraestructura base, IMAP no está implementado para la recepción de correos desde la plataforma.
    *   **Recomendación:** Desarrollar un Worker (Deno Deploy o en Node externo si hay bloqueos en Deno) utilizando bibliotecas maduras como `imapflow` que escuche constantemente los correos, y cree la tabla requerida `emails_received` para el empalme directo de respuestas de prospectos.

---
*Documentación generada para Málaga Micro CRM.*
