#!/usr/bin/env bash
# ==============================================================================
# SCRIPT AUTOMATIZADO DE DESPLIEGUE DE EDGE FUNCTIONS (BASH / LINUX / MAC)
# CRM MALAGAMICRO
# ==============================================================================

set -e

PROJECT_REF="$1"

if [ -z "$PROJECT_REF" ]; then
    read -p "Introduce el Project Reference ID de Supabase (ej: xyz123abc): " PROJECT_REF
fi

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Error: Se requiere el Project Reference ID de Supabase."
    exit 1
fi

echo "🚀 Iniciando despliegue de 52 Edge Functions en Supabase ($PROJECT_REF)..."

for dir in supabase/functions/*/; do
    func_name=$(basename "$dir")
    echo "📦 Desplegando función '$func_name'..."
    npx supabase functions deploy "$func_name" --project-ref "$PROJECT_REF" --no-verify-jwt
done

echo "✅ ¡Despliegue completado! Las 52 Edge Functions han sido publicadas."
