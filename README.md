# Sistema de Facturación - API REST

## 🚀 Descripción

Sistema de facturación escalable desarrollado con NestJS, TypeORM y PostgreSQL. Incluye gestión de usuarios, categorías, productos con múltiples precios, control de stock y soft delete.

## ✨ Características

- 🔐 **Autenticación JWT** (próximamente)
- 👥 **Gestión de usuarios** con roles y permisos
- 📁 **Categorías jerárquicas** con subcategorías
- 📦 **Productos completos** con stock, dimensiones, imágenes
- 💰 **Múltiples precios** por producto (público, mayorista, distribuidor)
- 🗑️ **Soft delete** para integridad de datos
- 📊 **Estadísticas** y reportes básicos
- 🔍 **Búsqueda avanzada** con filtros
- 📄 **Paginación** en todas las consultas
- ✅ **Validaciones robustas** en todos los endpoints

## 🛠️ Tecnologías

- **Backend**: NestJS, TypeScript
- **Base de datos**: PostgreSQL
- **ORM**: TypeORM
- **Validación**: class-validator, class-transformer
- **Documentación**: Swagger (próximamente)

## 📦 Instalación

1. **Clonar el repositorio**

```bash
git clone <repo-url>
cd facturacion-system
```

2. **Instalar dependencias**

```bash
npm install
```

3. **Configurar variables de entorno**

```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

4. **Configurar PostgreSQL**

```bash
# Crear base de datos
createdb facturacion_db

# O usar el script incluido
npm run db:create
```

5. **Ejecutar migraciones y seeds**

```bash
npm run migration:run
npm run seed
```

6. **Iniciar la aplicación**

```bash
# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod
```

## 🗃️ Variables de Entorno

```env
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=tu_password
DB_NAME=facturacion_db

# JWT (próximamente)
JWT_SECRET=tu_jwt_secret_super_seguro
JWT_EXPIRATION=7d
```

## 📚 API Endpoints

### 👥 Usuarios

- `GET /api/users` - Listar usuarios con filtros
- `POST /api/users` - Crear usuario
- `GET /api/users/:id` - Obtener usuario
- `PATCH /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Eliminar usuario (soft delete)
- `GET /api/users/stats` - Estadísticas de usuarios

### 📁 Categorías

- `GET /api/categories` - Listar categorías
- `POST /api/categories` - Crear categoría
- `GET /api/categories/tree` - Árbol de categorías
- `GET /api/categories/:id` - Obtener categoría
- `PATCH /api/categories/:id` - Actualizar categoría
- `POST /api/categories/reorder` - Reordenar categorías

### 📦 Productos

- `GET /api/products` - Listar productos con filtros
- `POST /api/products` - Crear producto
- `GET /api/products/search?term=` - Buscar productos
- `GET /api/products/low-stock` - Productos con stock bajo
- `GET /api/products/:id` - Obtener producto
- `PATCH /api/products/:id/stock` - Actualizar stock

### 💰 Precios de Productos

- `GET /api/products/:id/prices` - Listar precios del producto
- `POST /api/products/:id/prices` - Crear precio
- `PATCH /api/products/:id/prices/:priceId` - Actualizar precio
- `POST /api/products/:id/prices/bulk-update` - Actualización masiva

### 🔧 Utilidades

- `GET /health` - Health check
- `GET /api/info` - Información de la API

## 🗂️ Estructura del Proyecto

```
src/
├── app.module.ts
├── main.ts
├── common/                    # Módulos compartidos
│   ├── entities/
│   │   └── base.entity.ts    # Entidad base con soft delete
│   ├── dto/
│   │   ├── pagination.dto.ts
│   │   └── pagination-response.dto.ts
│   ├── services/             # Servicios utilitarios
│   ├── interceptors/         # Interceptores globales
│   ├── filters/              # Filtros de excepción
│   ├── middlewares/          # Middlewares
│   └── validators/           # Validadores personalizados
├── database/
│   ├── database.module.ts
│   ├── database.config.ts
│   ├── typeorm.config.ts
│   ├── migrations/
│   └── seeds/
└── modules/
    ├── users/
    │   ├── entities/
    │   ├── dto/
    │   ├── services/
    │   ├── repositories/
    │   ├── controllers/
    │   └── user.module.ts
    ├── categories/
    └── products/
```

## 🎯 Roadmap

### ✅ Completado

- [x] Configuración base del proyecto
- [x] Entidades principales (User, Category, Product, ProductPrice)
- [x] DTOs con validaciones completas
- [x] Repositorios y servicios
- [x] Controladores con endpoints básicos
- [x] Soft delete en todas las entidades
- [x] Sistema de múltiples precios
- [x] Paginación y filtros

### 🚧 En Desarrollo

- [ ] Sistema de autenticación JWT
- [ ] Guards y decoradores de autorización
- [ ] Módulo de gastos
- [ ] Módulo de estadísticas avanzadas
- [ ] Sistema de facturación

### 📋 Por Implementar

- [ ] Documentación con Swagger
- [ ] Sistema de archivos/imágenes
- [ ] Módulo de reportes
- [ ] Dashboard administrativo
- [ ] API de facturación electrónica
- [ ] Notificaciones
- [ ] Auditoría completa
- [ ] Tests unitarios y e2e

## 🧪 Testing

```bash
# Tests unitarios
npm run test

# Tests con coverage
npm run test:cov

# Tests e2e
npm run test:e2e

# Tests en modo watch
npm run test:watch
```

## 📊 Base de Datos

### Scripts Útiles

```bash
# Crear migración
npm run migration:generate -- NombreMigracion

# Ejecutar migraciones
npm run migration:run

# Revertir última migración
npm run migration:revert

# Reset completo de la DB
npm run db:reset

# Setup completo para desarrollo
npm run dev:setup
```

### Usuarios por Defecto (Seeds)

- **Admin**: admin@facturacion.com / Admin123!
- **Manager**: manager@facturacion.com / Manager123!
- **User**: user@facturacion.com / User123!

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -am 'Agregar nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Crea un Pull Request

## 📝 Notas Importantes

- Todas las entidades tienen **soft delete** activado
- Los precios soportan **descuentos** y **fechas de vigencia**
- Las categorías pueden tener **jerarquías** (padre-hijo)
- Los productos manejan **stock automático**
- Sistema de **validaciones robustas** en español
- **Paginación** incluida en todas las consultas de listado

## 🐛 Problemas Conocidos

- Los endpoints de perfil requieren autenticación (pendiente)
- Upload de archivos no implementado
- Algunos endpoints de admin están como placeholders

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.
\*/

// .gitignore
/\*

# Logs

logs
_.log
npm-debug.log_
pnpm-debug.log*
yarn-debug.log*
yarn-error.log\*

# Runtime data

pids
_.pid
_.seed
\*.pid.lock

# Coverage directory used by tools like istanbul

coverage
\*.lcov

# nyc test coverage

.nyc_output

# Dependency directories

node_modules/

# Optional npm cache directory

.npm

# Optional eslint cache

.eslintcache

# Output of 'npm pack'

\*.tgz

# Yarn Integrity file

.yarn-integrity

# dotenv environment variables file

.env
.env.test
.env.production
.env.local

# IDE

.vscode/
.idea/

# OS

.DS_Store
Thumbs.db

# Build

dist/
build/

# Uploads

uploads/
public/images/

# Database

_.sqlite
_.db
\*/

// docker-compose.yml
/\*
version: '3.8'

services:
postgres:
image: postgres:15-alpine
restart: always
environment:
POSTGRES_DB: facturacion_db
POSTGRES_USER: postgres
POSTGRES_PASSWORD: postgres
ports: - "5432:5432"
volumes: - postgres_data:/var/lib/postgresql/data - ./init.sql:/docker-entrypoint-initdb.d/init.sql

app:
build: .
restart: always
ports: - "3000:3000"
environment:
DB_HOST: postgres
DB_PORT: 5432
DB_USERNAME: postgres
DB_PASSWORD: postgres
DB_NAME: facturacion_db
NODE_ENV: production
depends_on: - postgres
volumes: - ./uploads:/app/uploads

volumes:
postgres_data:
\*/

// Dockerfile
/\*
FROM node:18-alpine

WORKDIR /app

# Copiar package files

COPY package\*.json ./

# Instalar dependencias

RUN npm ci --only=production

# Copiar código fuente

COPY . .

# Build de la aplicación

RUN npm run build

# Exponer puerto

EXPOSE 3000

# Comando por defecto

CMD ["npm", "run", "start:prod"]
\*/

// .env.example
/\*
NODE_ENV=development
PORT=3000

# Database Configuration

DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password_here
DB_NAME=facturacion_db

# JWT Configuration

JWT_SECRET=your_jwt_secret_here
JWT_EXPIRATION=7d

# CORS Configuration

CORS_ORIGIN=\*

# Upload Configuration

UPLOAD_MAX_SIZE=5242880
UPLOAD_DEST=./uploads
\*/
# baudex_backend
