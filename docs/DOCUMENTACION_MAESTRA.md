# 📋 Documentación Técnica Maestra: MalagaMicro CRM

## 1. Resumen Ejecutivo (High-Level Overview)

**MalagaMicro CRM** es un sistema integral avanzado de gestión de relaciones con clientes, leads, prospectos y operaciones comerciales. Diseñado para centralizar y optimizar todos los procesos del equipo de ventas y operaciones, este ecosistema unifica atención al cliente, campañas de marketing, embudos de ventas, cotizaciones/presupuestos, y comunicaciones de múltiples canales (Email, WhatsApp).

El valor de negocio de la plataforma recae en su profunda automatización y escalabilidad, apoyada mediante agentes de Inteligencia Artificial (IA) para la prospección, asistencia (chatbots), generación SEO de contenido y unificación operativa con servicios de contabilidad e infraestructura externa (osTicket, StelOrder y automatizaciones vía n8n).

---

## 2. Arquitectura del Sistema

El sistema obedece un patrón de **Single Page Application (SPA)** enriquecida y fuertemente desacoplada de la capa de datos gracias a los principios BaaS (Backend as a Service) y arquitectura **Serverless**.

*   **Frontend (UI/UX):**
    *   **Core:** React 18 con TypeScript y empaquetador Vite (SWC plugin).
    *   **Enrutamiento:** `react-router-dom` v6, con vistas separadas y *protected routes*.
    *   **Estado y Peticiones Asíncronas:** `@tanstack/react-query` v5, asegurando caché en el cliente, revalidación condicional (stale-while-revalidate) y minimización de peticiones HTTP.
    *   **Diseño Visual:** Sistema de componentes `shadcn/ui` montados sobre Tailwind CSS. Integración robusta de accesibilidad (Radix UI).
*   **Backend, Base de Datos y Autenticación:**
    *   **Plataforma Cloud:** Lovable Cloud / Supabase.
    *   **Motor de BD:** PostgreSQL optimizado mediante Row Level Security (RLS) para segregación de perfiles (Admin, User).
    *   **Autenticación:** Supabase Auth (JWT, email verification, MFA integrado).
    *   **Suscripciones en Tiempo Real:** Realtime API de Supabase para actualización reactiva en chats y notificaciones del Kanban.
*   **Microservicios y Automatización (Edge Computing):**
    *   **Deno Edge Functions:** 49 funciones desplegadas en el borde (`supabase/functions/`) responsables de ejecutar lógica comercial compleja (Webhooks, Waha API para WhatsApp, SMTP para correos, llamadas a LLMs tipo Perplexity/OpenAI).
    *   **n8n Orchestration:** Para la generación de reportes y cruce de datos masivos entre StelOrder, osTicket y la capa de BD.

---

## 3. Guía de Instalación y Configuración

El proyecto debe ser clonado y ejecutado en un entorno de desarrollo compatible.

### Prerrequisitos
*   Node.js v18.x o superior.
*   NPM, PNPM o Bun como manejador de dependencias.
*   Acceso al panel de Supabase y credenciales API del proyecto.

### Instalación de Dependencias
```bash
# Clonar el repositorio
git clone <URL_DEL_REPOSITORIO>
cd malagamicro-crm

# Instalar los paquetes npm
npm install
```

### Variables de Entorno
Crea un archivo `.env` en el directorio raíz. Contiene las variables necesarias para inyectar los contextos de Supabase y de los demás servicios:

```env
VITE_SUPABASE_URL="https://[TU_PROYECTO].supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="[TU_ANON_KEY]"
VITE_SUPABASE_PROJECT_ID="[TU_PROJECT_ID]"

# WhatsApp API
VITE_WAHA_API_URL="[WAHA_URL]"
VITE_WAHA_API_KEY="[WAHA_KEY]"
```

### Ejecución Local
```bash
# Iniciar servidor de desarrollo con HMR
npm run dev

# Generar bundle de producción
npm run build

# Validaciones estáticas y linting
npm run lint

# Ejecutar suite de testing (Vitest)
npm run test
```

---

## 4. Diccionario de Funciones y Módulos (Deep Dive)

A continuación, se auditan y documentan los archivos cardinales y los flujos dominantes de la arquitectura React del proyecto:

### 4.1. `src/App.tsx`
**Propósito:** Punto de entrada de la aplicación y proveedor raíz. Configura la persistencia de datos globales (`QueryClient`), define el *routing map*, e inicializa la cascada de los principales Context Providers que encapsulan a toda la SPA (Autenticación, Notificaciones, Temas).

**Dependencias principales:** `react-router-dom`, `@tanstack/react-query`, Contextos y componentes anidados de `src/components/app/`.

| Función / Constante | Parámetros | Retorno | Descripción |
| :--- | :--- | :--- | :--- |
| `queryClient` (instancia) | `{ defaultOptions: ... }` | `QueryClient` | Establece el cliente global para React Query con políticas `staleTime` de 60 segundos y exclusión de re-tries en errores `4xx`. |
| `App()` | *Ninguno* | `JSX.Element` | Renderiza el árbol completo. Inyecta `ThemeProvider`, `AuthProvider`, y el `BrowserRouter` listando rutas como `/login` o el *dashboard* `/`. |

### 4.2. `src/hooks/useAuth.tsx`
**Propósito:** Centralizar e interconectar el SDK de Supabase Auth con el contexto React, exponiendo métodos de validación, registro y ciclo de vida de sesión a cualquier componente del árbol.

**Dependencias principales:** `@supabase/supabase-js`, `src/integrations/supabase/client.ts`.

| Función | Parámetros | Retorno | Descripción |
| :--- | :--- | :--- | :--- |
| `signUp` | `email` (string), `password` (string) | `Promise<{ error: Error \| null }>` | Emite una petición de registro. Dispara un evento `onAuthStateChange` tras recibir el hash de confirmación localmente o vía email. |
| `signIn` | `email` (string), `password` (string) | `Promise<{ error: Error \| null }>` | Autentica un usuario. Devuelve y propaga un JSON Web Token (JWT) asincrónicamente y actualiza el Provider. |
| `signOut` | *Ninguno* | `Promise<void>` | Invalida y destruye la sesión existente a nivel servidor y elimina los cachés locales. |
| `resetPassword` | `email` (string) | `Promise<{ error: Error \| null }>` | Orquesta un flujo de recuperación de contraseña mandando un correo seguro con el callback `/reset-password`. |

### 4.3. `src/hooks/useLeads.tsx`
**Propósito:** Consolidar toda la lógica de obtención y mutación para el módulo principal del CRM (el registro e interacciones con *Leads*). Utiliza paginación infinita, peticiones optimistas y loguea la auditoría.

**Dependencias principales:** `@tanstack/react-query`, `src/lib/phoneEnrichment`, Edge function de Geocoding.

| Función | Parámetros | Retorno | Descripción |
| :--- | :--- | :--- | :--- |
| `useLeads` | *Ninguno* | `Object (Estado, mutaciones)` | Hook compuesto que ejecuta `useInfiniteQuery`. Retorna los `leads` paginados, banderas de `isLoading` y funciones expuestas (CRUD). |
| `addLead` | `Omit<Lead, 'id' \| 'createdAt' \| 'updatedAt'>` | `Promise<Lead>` | Inserta un cliente, ejecuta el geocoding automático (`geocodeAddress`) para obtener lat/lng y manda un trigger a la auditoría. |
| `updateLeadStatus` | `{ id: string, status: LeadStatus, previousStatus?: LeadStatus }` | `Promise<void>` | Muta el estado de un lead en la Base de Datos. Implementa un **optimistic update** en el caché de `react-query` para visualización instantánea. |
| `importLeads` | `Array<Omit<Lead...>>` | `Promise<{count, insertedLeads}>` | Interfaz Bulk que inserta múltiples leads de CSV. Paraleliza en segundo plano análisis telefónico e invoca edge functions (`enrich-lead-phone`). |

### 4.4. `src/pages/Index.tsx`
**Propósito:** Es la Vista Maestra (Layout principal) tras pasar el *Gate* de autenticación. Este gran componente orquesta un enrutamiento en formato de Pestañas (Tabs) o Sidebars y renderiza sub-módulos condicionales basados en el rol (Admin vs User).

**Dependencias principales:** Decenas de componentes funcionales (`Dashboard`, `LeadsList`, `LeadKanban`, `EmailModule`, `InternalChatPage`), `src/hooks/useSidebarConfig.tsx`.

| Función / Bloque | Parámetros | Retorno | Descripción |
| :--- | :--- | :--- | :--- |
| `renderContent` | *Ninguno* | `JSX.Element` | Gran condicional (`switch(activeTab)`) que evalúa el estado actual (`activeTab`) para montar el árbol correspondiente (Ej: "leads" -> `<LeadsList>`, "pipeline" -> `<LeadKanban>`). Implementa además control de acceso para `ADMIN_ONLY_TABS`. |
| `handleFormSubmit` | `data` (any) | `void` | Delega las operaciones formales de inserción/edición de leads al hook `useLeads`, ejecutando llamadas HTTP en segundo plano. |

---

## 5. Flujos de Datos Clave

### A. Flujo de Autenticación Reactiva
1.  **Interacción:** El usuario somete el formulario en `/login`.
2.  **Mutación API:** El método `signIn` despacha la credencial a Supabase Auth.
3.  **Suscripción a Eventos:** En el useEffect principal de `useAuth`, el listener `onAuthStateChange` captura el token exitoso entrante.
4.  **Propagación de Estado:** El componente actualiza el estado `session` a nivel global.
5.  **Renderizado Seguro:** El guard de ruta `<ProtectedRoute>` avala el JWT y transiciona automáticamente la UI principal (`<Index />`), activando la hidratación asíncrona de datos del usuario actual y preferencias.

### B. Flujo CRUD Optimista (Actualización de Estado en Pipeline de Ventas)
1.  **Interacción:** En la vista `<LeadKanban />`, el usuario arrastra la tarjeta de un prospecto de "Nuevo" a "Contactado".
2.  **Ejecución de Hook:** Se invoca a `updateLeadStatus` desde `useLeads`.
3.  **Actualización Optimista (Caché local):** React Query intercepta el evento `onMutate`, congela re-peticiones y modifica inmediatamente el arreglo cacheado en memoria; la UI se re-pinta instantáneamente dando un "UX" fluido.
4.  **Confirmación API:** Paralelamente, se ejecuta la petición SQL asincrónica real hacia Supabase.
5.  **Liquidación:** Si ocurre fallo de red (`onError`), se restaura la variable original (Rollback). Si tiene éxito, se despacha en el `onSuccess` el logging de auditoría en la tabla `lead_activities` y se marca la llave como `stale` para refrescos subyacentes.

---

## 6. Puntos de Mejora (Auditoría Arquitectónica y Código Limpio)

Una revisión profunda basada en principios S.O.L.I.D. y diseño de SPA, detecta importantes oportunidades de refactorización para garantizar una escalabilidad a largo plazo:

1.  **Sobrecarga del Componente `src/pages/Index.tsx` (Monolito de Routing):**
    *   **Diagnóstico:** El archivo `Index.tsx` actualmente opera como un enorme router local manejando múltiples pestañas con un `switch(activeTab)`. Esto obliga a empaquetar todos los módulos grandes (`Dashboard`, `Leads`, `Reports`, `Editors`, `Mail`) en un solo bulto sincrónico, perjudicando el tiempo de carga (Time To Interactive).
    *   **Refactorización sugerida:** Transicionar este componente a un sistema de rutas de primer nivel mediante `<Outlet />` de `react-router-dom`. Cada sub-módulo debería estar apoyado por **Code Splitting (Lazy Loading)** usando `React.lazy()` y `Suspense`, delegando eficientemente fragmentos de código.

2.  **Carencia de *Error Boundaries* en Enrutador Principal:**
    *   **Diagnóstico:** Actualmente, una excepción no capturada de JavaScript en cualquier submódulo montado crashearía el ciclo de vida entero de `App.tsx` dejando la pantalla en blanco.
    *   **Refactorización sugerida:** Implementar un HOC (Higher-Order Component) `<ErrorBoundary>` cubriendo las capas de rutas y el interior de los módulos pesados. Esto permitiría a la interfaz fallar elegantemente y ofrecer botones de "Forzar Recarga".

3.  **Alto Acoplamiento en Componentes Complejos (ej: `LeadsList`):**
    *   **Diagnóstico:** Archivos que manejan listas suelen combinar filtros de UI, hooks asincrónicos, exportación a CSV/Excel y maquetación JSX dentro de las mismas cientos de líneas de código.
    *   **Refactorización sugerida (SRP - Single Responsibility):** Mover toda la capa de filtrado, la capa de exportación y los constructores de tablas hacia hooks o componentes abstractos puros. Usar Patrón *Smart/Dumb components*, delegando a vistas de UI (Presentational) el JSX puro e invadiendo lógicas complejas un nivel más arriba (Container).

4.  **Estandarización de Endpoints con Cliente Backend (Edge Functions):**
    *   **Diagnóstico:** Muchos de los hooks (ej: `useLeads`, `useBudgetRequests`) usan métodos directos con `supabase.from()` o inyectan llamadas HTTP directamente a Edge Functions repitiendo lógicas y headers.
    *   **Refactorización sugerida:** Envolver las operaciones a través del concepto de factorías y servicios (`src/services/api/`) para un control robusto de errores o retries; definiendo explícitamente las interfaces de Input/Output antes de que estas pasen a la mutación de TanStack Query.
