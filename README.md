# MalagaMicro CRM 🚀

MalagaMicro CRM es un sistema integral avanzado de gestión de clientes y prospectos. Está diseñado para unificar la atención al cliente, campañas de marketing, gestión de embudos de ventas, presupuestos y comunicaciones a través de múltiples canales.

Adicionalmente, el sistema integra módulos de inteligencia artificial (generación SEO, agentes asistentes), automatizaciones con n8n, y conexiones con ERPs y sistemas de tickets externos (osTicket, StelOrder).

## 📚 Documentación Completa
> [!IMPORTANT]
> Si eres un desarrollador nuevo en la empresa o un arquitecto, por favor revisa la **[Documentación Técnica Maestra](./documentacion_proyecto/DOCUMENTACION_MAESTRA.md)**.
>
> Dicho documento contiene:
> * Arquitectura detallada.
> * Diccionario de funciones y módulos Core (Auth, Leads, UI).
> * Flujos de datos completos.
> * Puntos de mejora a nivel de código y seguridad identificados.

---

## 🛠️ Stack Tecnológico Principal

### Frontend
- **React 18** (Vite + SWC)
- **TypeScript** (Tipado estricto)
- **Tailwind CSS** + **shadcn/ui** (Estilado y Componentes UI Base)
- **React Router v6** (Enrutamiento del lado del cliente)
- **TanStack Query (React Query)** (Gestión de estado asíncrono y fetching)

### Backend (BaaS)
- **Supabase** (Autenticación, Base de datos PostgreSQL, Realtime)
- **Supabase Edge Functions** (Funciones serverless en Deno para IA, envíos de WhatsApp, Webhooks y llamadas a APIs de terceros)

---

## 💻 Instalación y Desarrollo Local

### Prerrequisitos
Asegúrate de contar con:
- [Node.js](https://nodejs.org/) (v18 o superior)
- `npm` (o bien `yarn`, `pnpm`, `bun`).
- Un proyecto configurado en [Supabase](https://supabase.com/).

### Paso 1: Clonar e Instalar
```bash
git clone <URL_DEL_REPOSITORIO>
cd vite_react_shadcn_ts
npm install
```

### Paso 2: Variables de Entorno
Crea un archivo `.env` en el directorio raíz usando como referencia el archivo `.env.example` (si existe), o configura manualmente las variables:
```env
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=ey...
```

### Paso 3: Arrancar el Servidor
Inicia el entorno de desarrollo con Hot Module Replacement (HMR):
```bash
npm run dev &
```
La aplicación se servirá por defecto en `http://localhost:8080`.

---

## 🏗️ Estructura del Proyecto

* `/src`: Código principal de React.
  * `/components`: Componentes reutilizables, agrupados por dominio de negocio (leads, chat, auth, ui).
  * `/pages`: Vistas o pantallas principales (rutas de React Router).
  * `/hooks`: Lógica de React hooks custom (ej. `useAuth`, fetching de consultas).
  * `/integrations`: Configuración del cliente y tipos para Supabase.
* `/supabase/functions`: Funciones serverless escritas en Deno.
* `/documentacion_proyecto`: Documentación extensa e informes de arquitectura técnica.

---

## 🧪 Comandos Útiles

* `npm run dev &`: Levantar entorno local en background.
* `npm run build`: Generar el build de producción en la carpeta `dist`.
* `npm run lint`: Analizar el código con ESLint y reportar problemas.
* `npm run test`: Ejecutar la batería de tests mediante Vitest.

---

## 🤝 Contribuciones y Estándares
Para mantener una alta calidad de código:
1. Asegúrate de tipar estrictamente con TypeScript y evitar el uso generalizado de `any`.
2. Las llamadas de base de datos directas o lógica de negocio que comprometa seguridad debe aislarse en **Supabase Edge Functions** o mediante **RLS (Row Level Security)** de Supabase.
3. Actualiza siempre la *Documentación Maestra* en `documentacion_proyecto` ante la creación de módulos significativos.

---
_Creado para escalar las operaciones y ventas del equipo MalagaMicro._
