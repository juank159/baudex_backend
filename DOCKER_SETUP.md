# 🐳 CONFIGURACIÓN DE DOCKER PARA EL SISTEMA PEPS/FIFO

## 📋 CONFIGURACIÓN ACTUAL

El sistema ya tiene toda la configuración de Docker lista y optimizada:

### 📁 Archivos Docker incluidos:
- ✅ `Dockerfile` - Imagen optimizada multi-stage para producción
- ✅ `docker-compose.yaml` - Configuración para desarrollo
- ✅ `docker-compose.prod.yml` - Configuración optimizada para producción
- ✅ `.dockerignore` - Exclusión de archivos innecesarios
- ✅ `src/healthcheck.js` - Health check para containers

## 🚀 CÓMO SUBIR Y USAR LOS CONTENEDORES

### 1. 📦 PREPARACIÓN INICIAL

**Instalar Docker (si no lo tienes):**
```bash
# En macOS
brew install docker docker-compose

# En Ubuntu/Debian
sudo apt update
sudo apt install docker.io docker-compose

# En Windows
# Descargar Docker Desktop desde https://docker.com
```

**Verificar que Docker esté funcionando:**
```bash
docker --version
docker-compose --version
```

### 2. 🔧 CONFIGURAR VARIABLES DE ENTORNO

**Asegúrate de que tu archivo `.env` tenga todas las variables:**
```bash
NODE_ENV=production
PORT=3000

# Database Configuration
DB_HOST=db
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=tu_password_seguro
DB_NAME=baudex

# JWT Configuration
JWT_SECRET=tu_jwt_secret_super_seguro_aqui
JWT_EXPIRATION=7d

# pgAdmin (opcional)
PGADMIN_EMAIL=admin@baudex.com
PGADMIN_PASSWORD=admin_password
```

### 3. 🏗️ CONSTRUIR Y SUBIR CONTENEDORES

#### **Para Desarrollo:**
```bash
# Navegar al directorio del backend
cd /Users/mac/Documents/baudex/backend

# Construir y levantar todos los servicios en background
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f app
docker-compose logs -f db
```

#### **Para Producción:**
```bash
# Usar la configuración optimizada de producción
docker-compose -f docker-compose.prod.yml up -d

# Construir imagen personalizada (opcional)
docker build -t baudex-api:latest .

# Ver estado de containers
docker-compose -f docker-compose.prod.yml ps
```

### 4. 🗄️ CONFIGURAR BASE DE DATOS

**Ejecutar migraciones automáticamente:**
```bash
# Acceder al container de la app
docker-compose exec app sh

# Dentro del container, ejecutar migraciones
npm run migration:run

# Salir del container
exit
```

**O ejecutar directamente:**
```bash
docker-compose exec app npm run migration:run
```

### 5. ✅ VERIFICAR QUE TODO FUNCIONE

**Verificar servicios activos:**
```bash
docker-compose ps
```

**Probar endpoints:**
```bash
# Health check
curl http://localhost:3000/health

# API documentation
open http://localhost:3000/api-docs

# pgAdmin (si está habilitado)
open http://localhost:5050
```

## 📊 SERVICIOS INCLUIDOS

### 🖥️ **Aplicación Principal** (`app`)
- **Puerto:** 3000
- **Tipo:** NestJS API con PEPS/FIFO completo
- **Health Check:** Automático cada 30 segundos
- **Optimizada:** Multi-stage build, usuario no-root

### 🗄️ **Base de Datos** (`db`)
- **Puerto:** 5432
- **Tipo:** PostgreSQL 15.3
- **Persistent:** Volumen `postgres_data`
- **Optimizada:** Configuración de performance incluida

### 🔧 **Administrador DB** (`pgadmin`)
- **Puerto:** 5050
- **Tipo:** pgAdmin4 para gestión visual
- **Usuario:** Configurado via `.env`

### 🌐 **Proxy Nginx** (solo producción)
- **Puerto:** 80/443
- **Tipo:** Reverse proxy y balanceador
- **SSL:** Preparado para certificados

## ⚡ COMANDOS ÚTILES

### 📋 **Gestión de Containers:**
```bash
# Ver containers activos
docker ps

# Ver todos los containers
docker ps -a

# Parar todos los servicios
docker-compose down

# Parar y eliminar volúmenes (CUIDADO: borra la BD)
docker-compose down -v

# Reiniciar un servicio específico
docker-compose restart app
```

### 🔍 **Debug y Logs:**
```bash
# Ver logs de todos los servicios
docker-compose logs

# Seguir logs en tiempo real
docker-compose logs -f app

# Acceder al container para debug
docker-compose exec app sh
docker-compose exec db psql -U postgres -d baudex
```

### 🏗️ **Build y Deploy:**
```bash
# Re-construir imagen tras cambios
docker-compose build

# Re-construir sin cache
docker-compose build --no-cache

# Actualizar y reiniciar
docker-compose up -d --build
```

## 🌐 SUBIR A PRODUCCIÓN

### 1. **Servidor Cloud (AWS, GCP, Azure)**
```bash
# Copiar proyecto al servidor
scp -r . user@servidor:/opt/baudex

# En el servidor
cd /opt/baudex
docker-compose -f docker-compose.prod.yml up -d
```

### 2. **Container Registry (Docker Hub, AWS ECR)**
```bash
# Construir imagen tagged
docker build -t tu-usuario/baudex-api:v1.0.0 .

# Subir a Docker Hub
docker push tu-usuario/baudex-api:v1.0.0

# En producción
docker pull tu-usuario/baudex-api:v1.0.0
docker run -d -p 3000:3000 tu-usuario/baudex-api:v1.0.0
```

### 3. **Kubernetes (opcional)**
```bash
# Generar manifests desde docker-compose
kompose convert -f docker-compose.prod.yml

# Aplicar en cluster
kubectl apply -f .
```

## 🔒 CONFIGURACIÓN DE SEGURIDAD

### 🛡️ **Mejores Prácticas Incluidas:**
- ✅ Multi-stage build para imagen mínima
- ✅ Usuario no-root en containers
- ✅ Health checks automáticos
- ✅ Variables de entorno seguras
- ✅ Volúmenes persistentes
- ✅ Networks aisladas
- ✅ Resource limits configurados

### 🔐 **Para Producción:**
```bash
# Generar passwords seguros
openssl rand -base64 32  # Para JWT_SECRET
openssl rand -base64 16  # Para DB_PASSWORD

# Configurar firewall
ufw allow 80
ufw allow 443
ufw deny 3000  # Solo acceso interno
ufw deny 5432  # Solo acceso interno
```

## 🚨 TROUBLESHOOTING

### ❗ **Problemas Comunes:**

**Container no inicia:**
```bash
docker-compose logs app
# Revisar .env y puertos ocupados
```

**Error de base de datos:**
```bash
docker-compose logs db
# Verificar credenciales y permisos
```

**Error de migraciones:**
```bash
docker-compose exec app npm run migration:run
# Ejecutar manualmente si falla
```

**Puerto ocupado:**
```bash
lsof -i :3000
# Cambiar puerto en docker-compose.yml
```

## ✅ VERIFICACIÓN FINAL

**Todo funciona si ves:**
- ✅ `docker-compose ps` muestra todos los servicios "Up"
- ✅ `curl localhost:3000/health` retorna 200 OK
- ✅ `http://localhost:3000/api-docs` carga Swagger
- ✅ pgAdmin conecta a la base de datos
- ✅ Logs no muestran errores críticos

## 🎯 COMANDOS DE USO DIARIO

```bash
# Iniciar todo el sistema
docker-compose up -d

# Ver logs en vivo
docker-compose logs -f

# Parar sistema
docker-compose down

# Reiniciar tras cambios de código
docker-compose up -d --build

# Backup de base de datos
docker-compose exec db pg_dump -U postgres baudex > backup.sql

# Restore de base de datos
docker-compose exec -T db psql -U postgres baudex < backup.sql
```

---

## 🚀 **¡EL SISTEMA ESTÁ LISTO PARA DOCKER!**

**Con esta configuración tendrás:**
- 🐳 Containerización completa
- 🔄 Deploy automático  
- 🛡️ Seguridad optimizada
- 📊 Monitoring incluido
- 🚀 Producción-ready

**¡Todo el sistema PEPS/FIFO funcionando en contenedores!** 🎉