# Multi-stage build para optimizar tamaño de imagen
FROM node:18-alpine AS builder

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
FROM node:18-alpine AS production

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

# Cambiar propietario de archivos
RUN chown -R nestjs:nodejs /usr/src/app

# Cambiar a usuario no-root
USER nestjs

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/healthcheck.js || exit 1

# Usar dumb-init como proceso principal
ENTRYPOINT ["dumb-init", "--"]

# Comando por defecto
CMD ["node", "dist/main"]