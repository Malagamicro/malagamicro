# Despliegue de MalagaMicro CRM — PC local y servidor cloud

Esta guía explica cómo llevarte el programa fuera de Lovable y ejecutarlo tú mismo.

El sistema tiene **dos piezas**:

| Pieza | Qué es | Dónde vive |
|---|---|---|
| **Frontend** | La aplicación web (React + Vite) | Se compila a ficheros estáticos y se sirve con Nginx |
| **Backend** | Base de datos, usuarios, ficheros y 50+ funciones serverless | Supabase (Cloud o autohospedado) |

El frontend **no funciona solo**: necesita un backend Supabase con el esquema de la base de datos ya creado.

---

## Opción A — PC local (la más rápida, para desarrollo)

### 1. Requisitos
- Node.js 20 o superior
- npm

### 2. Pasos
```bash
git clone https://github.com/Malagamicro/malagamicro.git
cd malagamicro
npm install --legacy-peer-deps
cp .env.example .env      # rellena las 3 variables con tu backend
npm run dev
```
Abre `http://localhost:8080`.

> Si quieres usar el backend actual mientras pruebas, copia las tres variables `VITE_*` del `.env` que ya existe en el proyecto de Lovable.

---

## Opción B — PC local o servidor con Docker (producción)

### 1. Requisitos
- Docker y Docker Compose

### 2. Pasos
```bash
cp .env.example .env      # rellena las variables
docker compose up -d --build
```
La app queda en `http://localhost:8081` (cambia `CRM_PORT` en el `.env` si quieres otro puerto).

Comandos útiles:
```bash
docker compose logs -f          # ver registros
docker compose up -d --build    # actualizar tras cambiar el código
docker compose down             # parar
```

### 3. Publicar en internet con HTTPS
Pon un proxy inverso delante del puerto 8081. Ejemplo con **Caddy** (SSL automático):

```
crm.tudominio.com {
    reverse_proxy localhost:8081
}
```

Con **Coolify**, **Dokploy** o **Portainer**: crea un servicio a partir de este repositorio, define las variables `VITE_*` como *build args* y activa el certificado automático.

> Importante: las variables `VITE_*` se leen **al compilar**, no al arrancar. Si las cambias hay que reconstruir la imagen (`--build`).

---

## Preparar el backend

### Opción 1 — Supabase Cloud (recomendada, sin mantenimiento)
1. Crea un proyecto en supabase.com.
2. Ejecuta en el editor SQL, **en este orden**:
   - `migracion/sql/01_ESQUEMA_COMPLETO_BASE_DATOS.sql`
   - `migracion/sql/02_DATOS_INICIALES_Y_SEMILLA.sql`
3. Crea los buckets de almacenamiento con sus políticas: `shared-files`, `chat-files`, `avatars`, `email-attachments`, `workspace-files`.
4. Despliega las funciones serverless:
   ```bash
   npx supabase login
   npx supabase link --project-ref TU_PROJECT_REF
   bash migracion/desplegar_edge_functions.sh      # Windows: migracion/desplegar_edge_functions.ps1
   ```
5. Configura los secretos de las funciones (claves de IA, WhatsApp, SMTP, n8n…). Referencia completa en `migracion/02_VARIABLES_ENTORNO.env.example`:
   ```bash
   npx supabase secrets set OPENROUTER_API_KEY=... EVOLUTION_API_KEY=...
   ```
6. Copia la URL del proyecto y la clave *anon* al `.env` del frontend.

### Opción 2 — Supabase autohospedado (todo en tu servidor)
```bash
git clone --depth 1 https://github.com/supabase/supabase
cp -r supabase/docker /opt/supabase-docker
cd /opt/supabase-docker
cp .env.example .env     # genera POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY
docker compose up -d
```
Después aplica los mismos pasos 2–5 de la opción anterior apuntando a tu propia instancia. Requisitos recomendados del servidor: **4 vCPU, 8 GB de RAM y 60 GB de disco**.

---

## Copias de seguridad

```bash
# Base de datos
pg_dump "postgresql://postgres:CLAVE@HOST:5432/postgres" > backup_$(date +%F).sql

# Ficheros de almacenamiento (autohospedado)
tar czf storage_$(date +%F).tar.gz /opt/supabase-docker/volumes/storage
```
Programa ambos comandos en un `cron` diario.

---

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| Pantalla en blanco | Faltan las variables `VITE_*` al compilar. Reconstruye con `--build`. |
| Error 404 al recargar una página interna | Falta el *fallback* SPA. Ya incluido en `nginx.conf`; si usas otro servidor, redirige todo a `index.html`. |
| `401 Unauthorized` al leer datos | Las políticas RLS no se aplicaron. Vuelve a ejecutar el script `01_...sql` completo. |
| No se ven los cambios tras actualizar | Caché del Service Worker. Usa *Ajustes → Actualizar aplicación* o `Ctrl+Shift+R`. |
| WhatsApp no conecta desde HTTPS | La API de WhatsApp necesita su propio dominio con SSL válido y CORS, o pasar por un proxy inverso. |
| Las funciones serverless fallan | Faltan secretos. Revísalos con `npx supabase secrets list`. |
