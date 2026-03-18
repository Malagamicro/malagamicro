# Documentación Maestra del Proyecto: MalagaMicro CRM

## 1. Resumen Ejecutivo (High-Level Overview)

**MalagaMicro CRM** es un sistema integral de gestión de clientes y prospectos (CRM) diseñado para administrar leads, campañas, presupuestos y comunicaciones a través de múltiples canales. Este sistema unifica la atención al cliente con módulos de inteligencia artificial (chatbots, generación SEO), automatización (n8n), y facturación o tickets (osTicket, StelOrder).

**Valor de Negocio:**
El sistema actúa como el núcleo operativo de la empresa, permitiendo a los comerciales y gestores llevar un seguimiento preciso de oportunidades y soporte, con la ayuda de agentes IA para aligerar la carga operativa.

---

## 2. Arquitectura del Sistema

El proyecto sigue una arquitectura moderna, orientada a servicios serverless y un frontend "Single Page Application" robusto.

*   **Frontend (Cliente):**
    *   **Framework principal:** React 18 con Vite (modo SWC).
    *   **Lenguaje:** TypeScript estricto.
    *   **Enrutamiento:** `react-router-dom` para el manejo de rutas internas y Vistas Protegidas (`ProtectedRoute`).
    *   **Diseño/Estilado:** Tailwind CSS integrado con `shadcn-ui` (Radix UI) para componentes prefabricados accesibles. Soporta temas (claro/oscuro).
    *   **Estado y Peticiones:** `@tanstack/react-query` para caché y fetching asíncrono, reduciendo las recargas de la UI. PWA habilitado con `vite-plugin-pwa` (Workbox).
*   **Backend & Base de Datos:**
    *   **BaaS (Backend as a Service):** Supabase.
    *   **Autenticación:** Supabase Auth (Email, Redirección local/remota, JWT).
    *   **Base de Datos:** PostgreSQL alojada en Supabase (acceso via cliente `@supabase/supabase-js`).
    *   **Serverless Edge Functions:** Funciones escritas en Deno alojadas en Supabase (`supabase/functions/`), utilizadas para integraciones complejas, IA, webhooks y envíos de notificaciones.
*   **Integraciones Clave / Servicios Externos:**
    *   **APIs Genéricas:** Perplexity/Gemini/OpenAI (Inteligencia artificial).
    *   **n8n / Waha:** Para flujos de automatización de correos electrónicos, peticiones y WhatsApp.
    *   **osTicket & StelOrder:** Módulos de facturación, ERP y sistema de tickets gestionados vía webhooks en las edge functions.

---

## 3. Guía de Instalación y Configuración

### Prerrequisitos
*   Node.js v18+ y `npm` (o `bun`/`yarn`).
*   Una instancia de Supabase (local o en la nube) con sus credenciales de API.

### Configuración del Entorno Local

1.  **Clonar y Dependencias:**
    ```bash
    git clone <REPOSITORIO>
    cd <NOMBRE_PROYECTO>
    npm install
    ```
2.  **Variables de Entorno (`.env`):**
    Crea un archivo `.env` en la raíz basado en un `.env.example` y añade:
    ```env
    VITE_SUPABASE_URL=tu_supabase_url
    VITE_SUPABASE_PUBLISHABLE_KEY=tu_supabase_anon_key
    ```
3.  **Desarrollo:**
    ```bash
    npm run dev &
    ```
    El servidor se levantará por defecto en `http://localhost:8080`.
4.  **Generación PWA (opcional):**
    El proyecto tiene un manifiesto de PWA que se inyecta en el build. Al hacer `npm run build`, Workbox empaquetará el Service Worker.

---

## 4. Diccionario de Funciones y Módulos (Deep Dive)

### Módulo Core: Autenticación (`src/hooks/useAuth.tsx`)
**Propósito:** Gestionar el ciclo de vida de la sesión de los usuarios mediante Supabase Auth.
**Funciones principales:**
*   `signUp(email, password)`: Crea un usuario y lanza evento de verificación.
*   `signIn(email, password)`: Realiza el login usando contraseña y devuelve la sesión actual.
*   `signOut()`: Elimina la sesión del almacenamiento local e invalida el JWT.
*   `resetPassword(email)`: Envía link de recuperación para cambio de password seguro.
**Dependencias:** `@supabase/supabase-js`, `src/integrations/supabase/client.ts`

### Módulo Core: Enrutamiento (`src/App.tsx` y `src/components/ProtectedRoute.tsx`)
**Propósito:** Punto de entrada de la SPA, definiendo rutas públicas y privadas.
**Lógica principal:**
*   Configura `QueryClientProvider` para caché general de datos.
*   Aplica `AuthProvider` para proteger las rutas anidadas con el HOC `ProtectedRoute` (que redirige al login si `!session`).

### Módulo: Gestión de Leads (`src/components/leads/LeadsList.tsx` y análogos)
**Propósito:** Proveer un CRUD robusto de clientes (Leads), su estado de conversión y embudo (Kanban).
**Funciones y Flujo Principal:**
*   Presenta interfaces ricas (Listas, Kanban, Mapa).
*   Emplea filtros complejos y búsqueda en tiempo real usando React hooks y llamadas a Supabase.
*   Componentes hijos relevantes: `LeadFormModal` (creación/edición), `LeadImportModal` (ingesta en masa).
**Dependencias:** `lucide-react` (iconografía), componentes propios en `src/components/ui`.

### Backend: API de CRM (`supabase/functions/crm-api/index.ts`)
**Propósito:** Punto de entrada seguro a modo de API REST externa (o uso de la SPA en capas específicas) con Deno.
**Lógica principal:**
*   Valida CORS y headers requeridos.
*   Posee utilidades Anti-Inyección (`SQL_INJECTION_PATTERNS`, `containsSqlInjection()`).
*   Realiza saneo de parámetros (sanitization) contra exploits maliciosos.

### Módulos Complementarios de Integración (Edge Functions)
*   `send-whatsapp`: Despacha plantillas o mensajes a un proveedor o API (ej. Waha).
*   `mascot-chat` / `workspace-ai-chat`: Implementación de agentes LLM (asistente virtual del CRM).
*   `n8n-configuracion` / `osticket-webhook`: Manejo de endpoints receptores para integraciones de flujos y generación de tickets.

---

## 5. Flujos de Datos Clave

### Flujo 1: Ingreso e Ingesta de Leads
1.  **Usuario (Comercial)** sube un CSV en `LeadImportModal` o usa una sincronización (n8n/Google Sheets).
2.  **Frontend** formatea los datos y usa el cliente de Supabase (o llama a una función) para realizar un bulk insert en la tabla `leads`.
3.  **Supabase** dispara triggers asíncronos (si existen) o notifica vía Realtime al frontend.
4.  **UI de LeadsList/LeadKanban** se invalida (via `react-query`) y se re-dibuja con los leads nuevos.

### Flujo 2: Autenticación y Verificación
1.  **Usuario** se registra con `signUp` en `Auth.tsx`.
2.  **Supabase Auth** almacena el registro en estado *unverified* y manda un correo de validación configurado en el Dashboard de Supabase.
3.  **Usuario** hace click en el correo, navega a la URL con hash (accesible por Supabase client).
4.  `useAuth` capta el evento de cambio de sesión (`onAuthStateChange`), actualiza el contexto y `ProtectedRoute` permite el acceso a `/`.

---

## 6. Puntos de Mejora (Auditoría)

Basado en la revisión arquitectónica del repositorio, se identifican las siguientes áreas de optimización:

1.  **Manejo de Errores Global (Error Boundaries):**
    *   *Hallazgo:* La aplicación React carece de un *Error Boundary* explícito a nivel de enrutador en caso de fallos catastróficos de JS.
    *   *Sugerencia:* Implementar un `<ErrorBoundary>` rodeando el `<Routes>` en `App.tsx` para mostrar fallos gráciles y evitar pantallas en blanco.
2.  **Modularización del Routing:**
    *   *Hallazgo:* `src/App.tsx` comienza a sobrecargarse de rutas y proveedore de contexto anidados (Provider Hell).
    *   *Sugerencia:* Extraer las rutas a un archivo `routes.tsx` dedicado usando la nueva API de `createBrowserRouter` de React Router v6.
3.  **Refactor de Componentes Monolíticos (SRP / Clean Architecture):**
    *   *Hallazgo:* Vistas como `LeadsList.tsx` manejan estado visual, lógica de filtros y llamadas a red implícitas (o combinaciones pesadas de hooks).
    *   *Sugerencia:* Aplicar el patrón Container/Presentational. Separar los *hooks custom* de obtención de leads de las puras tablas de renderizado.
4.  **Seguridad Backend (Edge Functions):**
    *   *Hallazgo:* En `crm-api`, el control de inyección SQL basado en Regex es frágil (`containsSqlInjection`).
    *   *Sugerencia:* No construir queries crudas jamás en Deno/Supabase. Utilizar exclusivamente el Query Builder tipado de Supabase (`supabase.from().select()`), el cual automáticamente prepara los "statements" e imposibilita SQL Injections de primer orden, haciendo redundante el Regex ineficiente.
