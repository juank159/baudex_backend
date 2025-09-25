# Makefile para el Sistema PEPS/FIFO - Baudex
# Uso: make [comando]

.PHONY: help dev prod build up down logs clean test migrate backup restore

# Configuración
COMPOSE_FILE_DEV = docker-compose.yaml
COMPOSE_FILE_PROD = docker-compose.prod.yml
APP_NAME = baudex

# Colores para output
GREEN = \033[0;32m
BLUE = \033[0;34m
RED = \033[0;31m
NC = \033[0m

help: ## Mostrar ayuda
	@echo "$(BLUE)🐳 Makefile para Sistema PEPS/FIFO - Baudex$(NC)"
	@echo ""
	@echo "$(GREEN)Comandos disponibles:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

dev: ## Iniciar en modo desarrollo
	@echo "$(BLUE)🔧 Iniciando en modo desarrollo...$(NC)"
	@docker-compose -f $(COMPOSE_FILE_DEV) up -d --build
	@echo "$(GREEN)✅ Sistema iniciado en: http://localhost:3000$(NC)"

prod: ## Iniciar en modo producción
	@echo "$(BLUE)🏭 Iniciando en modo producción...$(NC)"
	@docker-compose -f $(COMPOSE_FILE_PROD) up -d --build
	@echo "$(GREEN)✅ Sistema iniciado en modo producción$(NC)"

build: ## Construir imágenes
	@echo "$(BLUE)🏗️ Construyendo imágenes...$(NC)"
	@docker-compose -f $(COMPOSE_FILE_DEV) build --no-cache

up: ## Levantar servicios (desarrollo)
	@docker-compose -f $(COMPOSE_FILE_DEV) up -d

down: ## Parar servicios
	@echo "$(BLUE)🛑 Deteniendo servicios...$(NC)"
	@docker-compose -f $(COMPOSE_FILE_DEV) down
	@docker-compose -f $(COMPOSE_FILE_PROD) down 2>/dev/null || true

logs: ## Ver logs en tiempo real
	@docker-compose -f $(COMPOSE_FILE_DEV) logs -f

logs-prod: ## Ver logs de producción
	@docker-compose -f $(COMPOSE_FILE_PROD) logs -f

status: ## Ver estado de servicios
	@echo "$(BLUE)📊 Estado de servicios:$(NC)"
	@docker-compose -f $(COMPOSE_FILE_DEV) ps

clean: ## Limpiar containers, imágenes y volúmenes
	@echo "$(RED)🧹 Limpiando sistema Docker...$(NC)"
	@docker-compose -f $(COMPOSE_FILE_DEV) down -v --rmi all --remove-orphans
	@docker-compose -f $(COMPOSE_FILE_PROD) down -v --rmi all --remove-orphans 2>/dev/null || true
	@docker system prune -f

migrate: ## Ejecutar migraciones de BD
	@echo "$(BLUE)🗄️ Ejecutando migraciones...$(NC)"
	@docker-compose -f $(COMPOSE_FILE_DEV) exec app npm run migration:run

migrate-prod: ## Ejecutar migraciones en producción
	@echo "$(BLUE)🗄️ Ejecutando migraciones en producción...$(NC)"
	@docker-compose -f $(COMPOSE_FILE_PROD) exec app npm run migration:run

shell: ## Acceder al shell del container de la app
	@docker-compose -f $(COMPOSE_FILE_DEV) exec app sh

db-shell: ## Acceder al shell de PostgreSQL
	@docker-compose -f $(COMPOSE_FILE_DEV) exec db psql -U postgres -d baudex

backup: ## Crear backup de la base de datos
	@echo "$(BLUE)💾 Creando backup de la base de datos...$(NC)"
	@mkdir -p backups
	@docker-compose -f $(COMPOSE_FILE_DEV) exec -T db pg_dump -U postgres baudex > backups/backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)✅ Backup creado en backups/$(NC)"

restore: ## Restaurar backup de BD (uso: make restore FILE=backup.sql)
	@echo "$(BLUE)🔄 Restaurando backup: $(FILE)$(NC)"
	@docker-compose -f $(COMPOSE_FILE_DEV) exec -T db psql -U postgres baudex < $(FILE)
	@echo "$(GREEN)✅ Backup restaurado$(NC)"

test: ## Ejecutar tests
	@echo "$(BLUE)🧪 Ejecutando tests...$(NC)"
	@docker-compose -f $(COMPOSE_FILE_DEV) exec app npm test

health: ## Verificar salud de la aplicación
	@echo "$(BLUE)❤️ Verificando salud de la aplicación...$(NC)"
	@curl -f http://localhost:3000/health && echo "$(GREEN)✅ Aplicación saludable$(NC)" || echo "$(RED)❌ Aplicación no responde$(NC)"

restart: down up ## Reiniciar servicios

restart-prod: ## Reiniciar servicios en producción
	@docker-compose -f $(COMPOSE_FILE_PROD) down
	@docker-compose -f $(COMPOSE_FILE_PROD) up -d

quick-dev: ## Inicio rápido para desarrollo
	@echo "$(BLUE)⚡ Inicio rápido - desarrollo$(NC)"
	@make down
	@make dev
	@sleep 10
	@make migrate
	@make health

quick-prod: ## Inicio rápido para producción
	@echo "$(BLUE)⚡ Inicio rápido - producción$(NC)"
	@make down
	@make prod
	@sleep 15
	@make migrate-prod
	@make health

install: ## Instalar dependencias localmente
	@echo "$(BLUE)📦 Instalando dependencias...$(NC)"
	@npm install

# Comando por defecto
.DEFAULT_GOAL := help