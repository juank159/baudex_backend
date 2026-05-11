# Multi-stage build para optimizar tamaño de imagen
FROM node:20-alpine AS builder

# Crear directorio de la aplicación
WORKDIR /usr/src/app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias (incluye devDependencies para build)
RUN npm ci

# Copiar código fuente
COPY . .

# Compilar la aplicación
RUN npm run build

# Etapa de producción
FROM node:20-alpine AS production

# Instalar dumb-init para manejo de señales
RUN apk add --no-cache dumb-init

# Crear usuario no-root por seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Crear directorio de trabajo
WORKDIR /usr/src/app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --only=production && npm cache clean --force

# Copiar aplicación compilada desde builder
COPY --from=builder /usr/src/app/dist ./dist

# Copiar el entrypoint (responsable de correr migraciones + arrancar
# el server). Va como archivo separado para que Dokploy / panels de
# hosting NO puedan sobrescribirlo desde una "Start command" custom.
COPY --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh

# Cambiar propietario de archivos
RUN chown -R nestjs:nodejs /usr/src/app

# Cambiar a usuario no-root
USER nestjs

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/healthcheck.js || exit 1

# ENTRYPOINT con dumb-init (manejo de señales correcto) + nuestro
# script que aplica migraciones antes de arrancar. El script termina
# con `exec` para que `node dist/main` reciba directamente PID 1 vía
# dumb-init — señales SIGTERM/SIGINT le llegan limpias.
ENTRYPOINT ["dumb-init", "--", "./docker-entrypoint.sh"]