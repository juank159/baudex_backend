# 📋 Endpoint de Renovación de Suscripciones

## 🎯 Descripción General

Este endpoint permite renovar suscripciones de organizaciones de forma fácil y segura, reemplazando la necesidad de hacer cambios manuales en la base de datos.

---

## 🔗 Endpoints Disponibles

### 1. **Renovar Suscripción**

**URL:** `POST /api/admin/subscriptions/renew`

**Descripción:** Renueva la suscripción de una organización creando una nueva suscripción y marcando las anteriores como expiradas.

#### **Headers Requeridos:**
```http
Authorization: Bearer your_jwt_token
Content-Type: application/json
```

#### **Body de la Solicitud:**
```json
{
  "organizationId": "c99d0fd8-667b-4b8b-a52b-10380fbbf611",
  "plan": "basic",
  "durationMonths": 1,
  "price": 29.99,
  "currency": "USD",
  "paymentMethod": "credit_card"
}
```

#### **Campos Requeridos:**

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `organizationId` | `string (UUID)` | **REQUERIDO** - ID de la organización | `"c99d0fd8-667b-4b8b-a52b-10380fbbf611"` |
| `plan` | `string` | **REQUERIDO** - Plan de suscripción | `"basic"` |
| `durationMonths` | `number` | **REQUERIDO** - Duración en meses (1-36) | `1` |

#### **Campos Opcionales:**

| Campo | Tipo | Descripción | Ejemplo | Por Defecto |
|-------|------|-------------|---------|-------------|
| `price` | `number` | Precio de la suscripción | `29.99` | Precio automático según plan |
| `currency` | `string` | Moneda | `"USD"` | `"USD"` |
| `paymentMethod` | `string` | Método de pago | `"credit_card"` | `"manual_renewal"` |

#### **Planes Disponibles:**
- `"trial"` - Plan de prueba (precio: $0)
- `"basic"` - Plan básico (precio: $29.99)
- `"premium"` - Plan premium (precio: $59.99)
- `"enterprise"` - Plan empresarial (precio: $199.99)

#### **Respuesta Exitosa (200):**
```json
{
  "success": true,
  "message": "Suscripción renovada exitosamente. Plan basic por 1 mes(es)",
  "data": {
    "subscriptionId": "d88f3cca-39da-47c6-b925-457037698353",
    "organizationId": "c99d0fd8-667b-4b8b-a52b-10380fbbf611",
    "organizationName": "Mi Empresa Test",
    "organizationSlug": "miempresatest",
    "plan": "basic",
    "status": "active",
    "startDate": "2025-07-27T03:29:57.464Z",
    "endDate": "2025-08-27T03:29:57.464Z",
    "durationMonths": 1,
    "price": 29.99,
    "currency": "USD",
    "previousSubscriptions": 1,
    "expiredSubscriptions": 1
  },
  "timestamp": "2025-07-27T03:30:19.306Z"
}
```

#### **Errores Posibles:**

**404 - Organización no encontrada:**
```json
{
  "statusCode": 404,
  "message": "Organización con ID c99d0fd8-667b-4b8b-a52b-10380fbbf611 no encontrada",
  "error": "Not Found"
}
```

**400 - Datos inválidos:**
```json
{
  "statusCode": 400,
  "message": [
    "El organizationId debe ser un UUID válido",
    "El plan debe ser uno de: trial, basic, premium, enterprise",
    "La duración debe estar entre 1 y 36 meses"
  ],
  "error": "Bad Request"
}
```

---

### 2. **Obtener Detalles de Suscripciones**

**URL:** `GET /api/admin/subscriptions/organization/{organizationId}/details`

**Descripción:** Obtiene información detallada de todas las suscripciones de una organización.

#### **Parámetros de URL:**
- `organizationId` (UUID): ID de la organización

#### **Ejemplo:**
```http
GET /api/admin/subscriptions/organization/c99d0fd8-667b-4b8b-a52b-10380fbbf611/details
Authorization: Bearer your_jwt_token
```

#### **Respuesta Exitosa (200):**
```json
{
  "success": true,
  "data": {
    "organization": {
      "id": "c99d0fd8-667b-4b8b-a52b-10380fbbf611",
      "name": "Mi Empresa Test",
      "slug": "miempresatest",
      "subscriptionPlan": "basic",
      "subscriptionStatus": "active",
      "subscriptionStartDate": "2025-07-27T03:30:19.306Z",
      "subscriptionEndDate": "2025-08-27T03:30:19.306Z"
    },
    "activeSubscription": {
      "id": "d88f3cca-39da-47c6-b925-457037698353",
      "plan": "basic",
      "status": "active",
      "startDate": "2025-07-27T03:29:57.464Z",
      "endDate": "2025-08-27T03:29:57.464Z",
      "isExpired": false,
      "daysUntilExpiration": 31
    },
    "allSubscriptions": [
      {
        "id": "d88f3cca-39da-47c6-b925-457037698353",
        "plan": "basic",
        "status": "active",
        "startDate": "2025-07-27T03:29:57.464Z",
        "endDate": "2025-08-27T03:29:57.464Z",
        "createdAt": "2025-07-27T03:29:57.464Z"
      },
      {
        "id": "72944305-74be-47b0-ac20-526814f0bd56",
        "plan": "basic",
        "status": "expired",
        "startDate": "2025-07-24T14:03:47.056Z",
        "endDate": "2025-07-24T16:14:37.000Z",
        "createdAt": "2025-07-24T14:03:47.056Z"
      }
    ],
    "stats": {
      "totalSubscriptions": 2,
      "activeSubscriptions": 1,
      "expiredSubscriptions": 1
    }
  },
  "timestamp": "2025-07-27T03:30:19.306Z"
}
```

---

## 🚀 Ejemplos de Uso

### **Ejemplo 1: Renovar a Plan Básico por 1 mes**
```bash
curl -X POST "http://localhost:3000/api/admin/subscriptions/renew" \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "c99d0fd8-667b-4b8b-a52b-10380fbbf611",
    "plan": "basic",
    "durationMonths": 1
  }'
```

### **Ejemplo 2: Renovar a Plan Premium por 6 meses**
```bash
curl -X POST "http://localhost:3000/api/admin/subscriptions/renew" \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "c99d0fd8-667b-4b8b-a52b-10380fbbf611",
    "plan": "premium",
    "durationMonths": 6,
    "price": 299.99,
    "paymentMethod": "bank_transfer"
  }'
```

### **Ejemplo 3: Renovar Trial por 1 mes**
```bash
curl -X POST "http://localhost:3000/api/admin/subscriptions/renew" \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "c99d0fd8-667b-4b8b-a52b-10380fbbf611",
    "plan": "trial",
    "durationMonths": 1
  }'
```

### **Ejemplo 4: Ver detalles de suscripciones**
```bash
curl -X GET "http://localhost:3000/api/admin/subscriptions/organization/c99d0fd8-667b-4b8b-a52b-10380fbbf611/details" \
  -H "Authorization: Bearer your_jwt_token"
```

---

## 🔒 Permisos y Seguridad

- **Autenticación:** JWT Token requerido
- **Autorización:** Solo usuarios con rol `ADMIN` (super admins)
- **Validación:** Todos los inputs son validados automáticamente
- **Logs:** Todas las operaciones se registran en los logs del servidor

---

## 📊 Lo Que Hace Internamente

1. **Verifica** que la organización existe
2. **Marca** todas las suscripciones actuales como `expired`
3. **Crea** una nueva suscripción con el plan especificado
4. **Actualiza** campos legacy en la tabla `organizations`
5. **Registra** logs detallados de la operación
6. **Retorna** información completa de la nueva suscripción

---

## 💡 Notas Importantes

- **Automático:** El endpoint maneja automáticamente la expiración de suscripciones anteriores
- **Legacy:** Actualiza tanto la nueva tabla `subscriptions` como los campos legacy en `organizations`
- **Precios:** Si no especificas precio, usa precios por defecto según el plan
- **Logs:** Revisa los logs del servidor para información detallada de cada operación
- **Validación:** El endpoint valida que el plan y duración sean válidos antes de procesar

¡Ahora puedes renovar suscripciones fácilmente sin tocar la base de datos directamente! 🎉