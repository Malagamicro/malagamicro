# Documentación Técnica Maestra: MalagaMicro CRM

## Resumen Ejecutivo (High-Level Overview)

**MalagaMicro CRM** es un sistema integral de gestión de operaciones comerciales diseñado para centralizar y optimizar la administración de clientes potenciales (leads), atención al cliente, presupuestos, ventas y campañas de marketing. Su valor de negocio radica en unificar múltiples canales de comunicación (WhatsApp, Email) y herramientas operativas (n8n, integraciones IA, osTicket, StelOrder) en una única plataforma colaborativa. Esto permite a los equipos comerciales e internos mejorar su productividad, realizar prospecciones más inteligentes mediante mapas y geolocalización, y acelerar procesos apoyándose en asistentes virtuales y flujos automatizados de Inteligencia Artificial.

## Arquitectura del Sistema

El proyecto está diseñado bajo una arquitectura orientada a servicios en la nube (BaaS) y *Serverless*, priorizando escalabilidad y reactividad:

- **Frontend (Cliente):** Single Page Application (SPA) construida con **React 18** y **TypeScript**, empaquetada mediante **Vite** (con SWC). Utiliza **React Router v6** para la navegación y `vite-plugin-pwa` para funcionar como Aplicación Web Progresiva.
- **Interfaz y Estilos:** Implementado con **Tailwind CSS** y el ecosistema de componentes accesibles **shadcn/ui** (basado en Radix UI).
- **Gestión de Estado y Caching:** Manejado con **TanStack Query (React Query)**, garantizando que el estado asíncrono y las interacciones de red se mantengan sincronizados, persistentes y optimizados (configurado con `staleTime: 60_000`).
- **Backend & Base de Datos:** Delegado a **Lovable Cloud / Supabase**. Ofrece autenticación JWT, Base de Datos en **PostgreSQL**, Storage y capacidades Realtime.
- **Microservicios (Serverless):** Funciones en el borde (*Edge Functions* en Deno) alojadas en Supabase (`supabase/functions/`) para resolver integraciones pesadas, tales como webhooks, interacciones con IA, envíos transaccionales de SMTP/WhatsApp, y la API externa del CRM.
- **Integraciones Clave:** n8n (automatización de flujos), Evolution API/WAHA (para WhatsApp masivo y transaccional), osTicket (soporte) y StelOrder (ERP).

## Guía de Instalación y Configuración

Siga los siguientes pasos para levantar el entorno de desarrollo local:

### 1. Prerrequisitos
- **Node.js**: Versión 18 o superior.
- **Gestor de paquetes**: `npm`, `pnpm` o `bun`.
- Entorno de Base de Datos y Autenticación en Supabase.

### 2. Instalación de Dependencias
```bash
git clone <URL_DEL_REPOSITORIO>
cd malagamicro-crm
npm install
```

### 3. Variables de Entorno
Cree un archivo `.env` en el directorio raíz basándose en el archivo de ejemplo (si existe) o defina las siguientes credenciales correspondientes a su proyecto de Supabase:
```env
VITE_SUPABASE_URL="https://[TU_PROYECTO].supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="tu_anon_key"
VITE_SUPABASE_PROJECT_ID="tu_project_id"
```

### 4. Ejecución del Servidor
```bash
# Iniciar servidor de desarrollo con Hot Module Replacement (HMR)
npm run dev

# Generar build de producción
npm run build

# Previsualizar build de producción
npm run preview
```

## Diccionario de Funciones y Módulos (Deep Dive)

### `src/App.tsx`
**Propósito:** Es el componente de entrada (*entry point*) de la aplicación, responsable de configurar el enrutamiento principal y proveer los contextos globales para toda la SPA.

**Funciones / Lógica:**
- Instancia y configura `QueryClientProvider` para manejar el caché (1 minuto de `staleTime` para optimización).
- Implementa proveedores críticos: `AuthProvider` (sesión), `NotificationProvider` y `ActiveCallsProvider`.
- Declara e inyecta las rutas de `react-router-dom`, protegiendo el acceso al tablero mediante el HOC `ProtectedRoute` contra accesos no autorizados.

**Dependencias:** `@tanstack/react-query`, `react-router-dom`, contextos locales.

### `src/hooks/useAuth.tsx`
**Propósito:** Proporciona un hook global y un contexto de estado reactivo para interactuar con la API de autenticación de Supabase de manera limpia.

**Funciones Clave:**
| Función | Parámetros | Retorno | Descripción |
|---------|------------|---------|-------------|
| `signUp` | `email` (string), `password` (string) | `Promise<{ error: Error \| null }>` | Crea un registro y despacha la verificación por correo con redirección local. |
| `signIn` | `email` (string), `password` (string) | `Promise<{ error: Error \| null }>` | Autentica un usuario validando credenciales; devuelve y setea el JWT actual en memoria. |
| `signOut` | Ninguno | `Promise<void>` | Invalida la sesión actual en backend y limpia el caché local del cliente. |
| `resetPassword` | `email` (string) | `Promise<{ error: Error \| null }>` | Solicita un token de cambio seguro a través del correo del usuario. |

**Dependencias:** `@supabase/supabase-js`, `src/integrations/supabase/client.ts`.

### `src/components/leads/LeadsList.tsx`
**Propósito:** Componente de alto nivel para renderizar y administrar el listado principal del CRM (clientes o prospectos), permitiendo filtrado exhaustivo, operaciones de masa e importación/exportación.

**Funciones Clave:**
| Función | Parámetros | Retorno | Descripción |
|---------|------------|---------|-------------|
| `filteredAndSortedLeads` *(useMemo)* | Ninguno | `Lead[]` | Evalúa de forma eficiente en memoria los filtros activos (búsqueda, segmento, estado) y reordena el arreglo base antes del render. |
| `handleBulkDelete` | Ninguno | `void` | Extrae los leads de la variable `selectedLeadIds` y muta la base de datos a través de una función de borrado masivo invocada por React Query. |
| `toggleLeadSelection` | `leadId` (string) | `void` | Manipulador para agregar o extraer de la matriz el ID de un registro para ejecuciones masivas (Ej: envíos de plantillas WhatsApp). |

**Dependencias:** Iconografía `lucide-react`, selectores/botones de UI (`shadcn/ui`), scripts utilitarios (`exportToCSV`, `exportToExcel`).

## Flujos de Datos Clave

### Flujo de Autenticación y Carga
1. Un visitante navega a `/login` e ingresa sus datos mediante los formularios manejados por `Auth.tsx`.
2. Se despacha internamente `signIn` de `useAuth`, ejecutando una petición segura a Supabase Auth.
3. Supabase emite su evento de cambio de estado de sesión (`onAuthStateChange`). El Hook `useAuth` escucha el evento, detecta el nuevo token JWT y altera el estado de React.
4. El enrutador de nivel superior evalúa que la constante de sesión ya no es nula. `ProtectedRoute` desbloquea las vistas y monta `<Index />` trayendo asíncronamente los datos del usuario.

### Flujo de Ingesta y Operación Masiva de Leads
1. **Importación:** Un comercial usa el `LeadImportModal` para subir un archivo CSV.
2. **Procesamiento Base:** El *parser* cliente estructura los leads. Un Hook (`useLeads`) lanza una mutación enviando los lotes hacia una consulta en bloque hacia PostgreSQL (Supabase).
3. **Sincronización:** Una vez que Supabase confirma, se expira el flag de React Query, obligando a re-fecthear la tabla maestra del frontend.
4. **Acción Operativa:** El listado refrescado permite seleccionar registros. Si el usuario pulsa **"WhatsApp Bulk"**, el sistema evalúa `selectedLeadIds`, solicita los teléfonos e inyecta la plantilla al modal correspondiente para desencadenar solicitudes asíncronas hacia el microservicio WAHA.

## Puntos de Mejora (Auditoría)

Basado en la inspección del código base y la alineación a los principios SOLID y DRY, se identifican las siguientes áreas de refactorización y consolidación:

1. **Refactorización de Vistas Monolíticas:**
   - *Hallazgo:* `src/pages/Index.tsx` administra en su switch principal toda la navegación interna por pestañas (`activeTab`), montando más de 20 módulos distintos a mano.
   - *Sugerencia:* Utilizar un Router anidado (`<Outlet />` de `react-router-dom`) con **Lazy Loading** (`React.lazy`). Esto no solo dividiría el código y mejoraría dramáticamente los tiempos de renderización inicial, sino que delegaría la responsabilidad del enrutador de vuelta al ecosistema apropiado.
2. **Manejo de Errores Desacoplado:**
   - *Hallazgo:* Falta de Componentes Frontera (Error Boundaries). Si hay un error severo en un hook de vista profunda, React colapsa.
   - *Sugerencia:* Integrar un `<ErrorBoundary>` en `App.tsx` que atrape *crashes* imprevistos, proveyendo al usuario un botón de "Refrescar" y guardando el error en servicios telemétricos.
3. **Abstracción de Servicios y Fetching:**
   - *Hallazgo:* Hooks UI mezclados intensivamente con peticiones a Supabase y transformaciones.
   - *Sugerencia:* Implementar un patrón Repositorio dentro del directorio `services/` (ej: `LeadRepository.ts`) que aísle las consultas de Supabase del árbol de React, exponiéndolas a TanStack Query a través de interfaces robustamente tipadas.
4. **Acoplamiento de Subcomponentes en Listados:**
   - *Hallazgo:* `LeadsList.tsx` posee lógica de filtrado compleja atada directamente a la vista de renderizado de la tabla.
   - *Sugerencia:* Mover la "Toolbar" de filtros a un componente autónomo `<LeadFilters onFilterChange={...} />` para adelgazar el padre y maximizar su reusabilidad en cuadros de control (Dashboards).