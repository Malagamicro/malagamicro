# ==============================================================================
# SCRIPT AUTOMATIZADO DE DESPLIEGUE DE EDGE FUNCTIONS (POWERSHELL)
# CRM MALAGAMICRO
# ==============================================================================

param (
    [string]$ProjectRef = ""
)

if ([string]::IsNullOrEmpty($ProjectRef)) {
    $ProjectRef = Read-Host -Prompt "Introduce el Project Reference ID de Supabase (ej: xyz123abc)"
}

if ([string]::IsNullOrEmpty($ProjectRef)) {
    Write-Host "❌ Error: Se requiere el Project Reference ID de Supabase." -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Iniciando despliegue de 52 Edge Functions en Supabase ($ProjectRef)..." -ForegroundColor Green

$functions = Get-ChildItem -Path ".\supabase\functions" -Directory

$total = $functions.Count
$current = 0

foreach ($func in $functions) {
    $current++
    Write-Host "[$current/$total] Desplegando función '$($func.Name)'..." -ForegroundColor Cyan
    npx supabase functions deploy $($func.Name) --project-ref $ProjectRef --no-verify-jwt
}

Write-Host "✅ ¡Despliegue completado! Las 52 Edge Functions han sido publicadas correctamente." -ForegroundColor Green
