# ==============================================================================
# MalagaMicro CRM — Imagen de producción (frontend)
# Build multi-etapa: compila con Node y sirve estáticos con Nginx
# ==============================================================================

# ---------- Etapa 1: build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Dependencias (cacheables)
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Código fuente
COPY . .

# Variables públicas necesarias en tiempo de build (Vite las inyecta en el bundle)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

RUN npm run build

# ---------- Etapa 2: runtime ----------
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
