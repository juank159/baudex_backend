export const ERROR_MESSAGES = {
  // Generales
  NOT_FOUND: 'Recurso no encontrado',
  UNAUTHORIZED: 'No autorizado',
  FORBIDDEN: 'Acceso denegado',
  INTERNAL_ERROR: 'Error interno del servidor',

  // Validación
  VALIDATION_FAILED: 'Error de validación',
  INVALID_UUID: 'ID debe ser un UUID válido',
  INVALID_EMAIL: 'Email debe tener un formato válido',
  INVALID_PASSWORD: 'La contraseña no cumple con los requisitos',

  // Usuarios
  USER_NOT_FOUND: 'Usuario no encontrado',
  USER_EMAIL_EXISTS: 'El email ya está registrado',
  USER_INACTIVE: 'Usuario inactivo',
  INVALID_CREDENTIALS: 'Credenciales inválidas',
  PASSWORD_MISMATCH: 'Las contraseñas no coinciden',
  CURRENT_PASSWORD_INCORRECT: 'Contraseña actual incorrecta',

  // Categorías
  CATEGORY_NOT_FOUND: 'Categoría no encontrada',
  CATEGORY_SLUG_EXISTS: 'El slug ya está en uso',
  CATEGORY_HAS_PRODUCTS: 'No se puede eliminar una categoría con productos',
  CATEGORY_HAS_CHILDREN: 'No se puede eliminar una categoría con subcategorías',
  CATEGORY_CIRCULAR_REFERENCE: 'No se puede asignar un descendiente como padre',

  // Productos
  PRODUCT_NOT_FOUND: 'Producto no encontrado',
  PRODUCT_SKU_EXISTS: 'El SKU ya está en uso',
  PRODUCT_BARCODE_EXISTS: 'El código de barras ya está en uso',
  INSUFFICIENT_STOCK: 'Stock insuficiente',
  PRICE_TYPE_EXISTS: 'Ya existe un precio activo de este tipo para el producto',

  // Archivos
  FILE_TOO_LARGE: 'El archivo es demasiado grande',
  INVALID_FILE_TYPE: 'Tipo de archivo no permitido',
} as const;
