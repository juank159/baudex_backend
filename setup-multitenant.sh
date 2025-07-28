#!/bin/bash

echo "🏢 BAUDEX - MULTITENANT SETUP"
echo "==============================="
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar mensajes
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar si estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    log_error "Por favor ejecuta este script desde el directorio backend/"
    exit 1
fi

log_info "Configurando sistema multitenant para Baudex..."
echo ""

# 1. Verificar Node.js y npm
log_info "1. Verificando dependencias..."
if ! command -v node &> /dev/null; then
    log_error "Node.js no está instalado. Por favor instálalo primero."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    log_error "npm no está instalado. Por favor instálalo primero."
    exit 1
fi

node_version=$(node --version)
log_success "Node.js detectado: $node_version"

# 2. Instalar dependencias
log_info "2. Instalando dependencias de Node.js..."
if npm install; then
    log_success "Dependencias instaladas correctamente"
else
    log_error "Error al instalar dependencias"
    exit 1
fi

# 3. Configurar variables de entorno
log_info "3. Configurando variables de entorno..."
if [ ! -f ".env" ]; then
    if [ -f ".env.multitenant.example" ]; then
        cp .env.multitenant.example .env
        log_success "Archivo .env creado desde .env.multitenant.example"
        log_warning "Por favor edita el archivo .env con tus configuraciones específicas"
    else
        log_warning "Archivo .env no encontrado. Créalo manualmente."
    fi
else
    log_success "Archivo .env ya existe"
fi

# 4. Verificar conexión a base de datos
log_info "4. Verificando configuración de base de datos..."
if command -v psql &> /dev/null; then
    log_success "PostgreSQL cliente detectado"
    log_info "Asegúrate de que PostgreSQL esté ejecutándose y la configuración en .env sea correcta"
else
    log_warning "Cliente PostgreSQL no detectado. Asegúrate de tener PostgreSQL instalado y ejecutándose."
fi

# 5. Ejecutar migraciones
log_info "5. Ejecutando migraciones de base de datos..."
echo "IMPORTANTE: Asegúrate de que la base de datos esté creada y PostgreSQL ejecutándose."
read -p "¿Continuar con las migraciones? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if npm run migration:run; then
        log_success "Migraciones ejecutadas correctamente"
    else
        log_error "Error al ejecutar migraciones"
        log_info "Revisa la configuración de la base de datos en .env"
        exit 1
    fi
else
    log_warning "Migraciones omitidas. Ejecuta 'npm run migration:run' manualmente cuando esté listo."
fi

# 6. Ejecutar seeds
log_info "6. Ejecutando seeds de datos iniciales..."
read -p "¿Ejecutar seeds para crear organizaciones y usuarios de ejemplo? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if npm run seed; then
        log_success "Seeds ejecutados correctamente"
        echo ""
        log_info "Usuarios creados:"
        echo "  • admin@default.com / admin123 (Super Admin)"
        echo "  • admin@acme.com / acme123 (Acme Corp Admin)" 
        echo "  • admin@techstart.com / tech123 (TechStart Admin)"
        echo "  • admin@globalent.com / global123 (Global Enterprises Admin)"
    else
        log_error "Error al ejecutar seeds"
        log_info "Puedes ejecutar 'npm run seed' manualmente después"
    fi
else
    log_warning "Seeds omitidos. Ejecuta 'npm run seed' manualmente si deseas datos de ejemplo."
fi

# 7. Compilar proyecto
log_info "7. Compilando proyecto..."
if npm run build; then
    log_success "Proyecto compilado correctamente"
else
    log_warning "Error al compilar. El proyecto aún puede ejecutarse en modo desarrollo."
fi

echo ""
echo "🎉 CONFIGURACIÓN MULTITENANT COMPLETADA"
echo "======================================="
echo ""
log_info "Para iniciar el servidor:"
echo "  Desarrollo: npm run start:dev"
echo "  Producción: npm run start:prod"
echo ""
log_info "URLs de acceso por organización:"
echo "  • http://localhost:3000 (Default - Sin subdominio)"
echo "  • http://acme-corp.localhost:3000 (Acme Corporation)"
echo "  • http://techstart.localhost:3000 (TechStart Solutions)"
echo "  • http://global-ent.localhost:3000 (Global Enterprises)"
echo ""
log_info "También puedes usar headers:"
echo "  X-Tenant-Slug: acme-corp"
echo ""
log_info "Documentación API:"
echo "  http://localhost:3000/api-docs"
echo ""
log_success "¡El sistema multitenant está listo para usar!"
echo ""
log_warning "NOTA: Para subdominios en desarrollo local, agrega las entradas a tu archivo /etc/hosts:"
echo "  127.0.0.1 acme-corp.localhost"
echo "  127.0.0.1 techstart.localhost"
echo "  127.0.0.1 global-ent.localhost"