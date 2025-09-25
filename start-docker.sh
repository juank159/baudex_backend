#!/bin/bash

# Script para iniciar el sistema completo con Docker
# Uso: ./start-docker.sh [dev|prod]

set -e

MODE=${1:-dev}
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐳 Iniciando sistema PEPS/FIFO con Docker - Modo: $MODE${NC}"

# Verificar que Docker esté corriendo
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker no está corriendo. Por favor inicia Docker primero.${NC}"
    exit 1
fi

# Verificar que existe el archivo .env
if [ ! -f .env ]; then
    echo -e "${RED}❌ Archivo .env no encontrado. Copiando desde ejemplo...${NC}"
    cp .env.example .env 2>/dev/null || echo "Crea el archivo .env con las variables necesarias"
    echo -e "${BLUE}📝 Por favor configura las variables en .env antes de continuar${NC}"
    exit 1
fi

# Función para limpiar containers anteriores
cleanup() {
    echo -e "${BLUE}🧹 Limpiando containers anteriores...${NC}"
    if [ "$MODE" = "prod" ]; then
        docker-compose -f docker-compose.prod.yml down --remove-orphans
    else
        docker-compose down --remove-orphans
    fi
}

# Función para iniciar servicios
start_services() {
    echo -e "${BLUE}🚀 Construyendo e iniciando servicios...${NC}"
    
    if [ "$MODE" = "prod" ]; then
        echo -e "${GREEN}🏭 Modo Producción${NC}"
        docker-compose -f docker-compose.prod.yml up -d --build
        COMPOSE_FILE="docker-compose.prod.yml"
    else
        echo -e "${GREEN}🔧 Modo Desarrollo${NC}"
        docker-compose up -d --build
        COMPOSE_FILE="docker-compose.yaml"
    fi
    
    echo -e "${BLUE}⏳ Esperando que los servicios estén listos...${NC}"
    sleep 30
    
    # Ejecutar migraciones
    echo -e "${BLUE}🗄️ Ejecutando migraciones de base de datos...${NC}"
    if [ "$MODE" = "prod" ]; then
        docker-compose -f docker-compose.prod.yml exec -T app npm run migration:run || true
    else
        docker-compose exec -T app npm run migration:run || true
    fi
    
    # Mostrar estado de servicios
    echo -e "${GREEN}✅ Estado de los servicios:${NC}"
    if [ "$MODE" = "prod" ]; then
        docker-compose -f docker-compose.prod.yml ps
    else
        docker-compose ps
    fi
    
    # Mostrar URLs disponibles
    echo -e "${GREEN}🌐 URLs disponibles:${NC}"
    echo -e "  API: http://localhost:3000"
    echo -e "  API Docs: http://localhost:3000/api-docs"
    echo -e "  Health Check: http://localhost:3000/health"
    if [ "$MODE" != "prod" ]; then
        echo -e "  pgAdmin: http://localhost:5050"
    fi
    
    # Test de conectividad
    echo -e "${BLUE}🔍 Verificando conectividad...${NC}"
    sleep 5
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Sistema funcionando correctamente!${NC}"
    else
        echo -e "${RED}❌ Error: El sistema no responde. Revisando logs...${NC}"
        if [ "$MODE" = "prod" ]; then
            docker-compose -f docker-compose.prod.yml logs --tail=20 app
        else
            docker-compose logs --tail=20 app
        fi
    fi
}

# Trap para limpiar en caso de interrupción
trap cleanup EXIT

# Limpiar y iniciar
cleanup
start_services

echo -e "${GREEN}🎉 ¡Sistema PEPS/FIFO iniciado exitosamente!${NC}"
echo -e "${BLUE}📋 Para ver logs en tiempo real: docker-compose logs -f${NC}"
echo -e "${BLUE}🛑 Para parar: docker-compose down${NC}"