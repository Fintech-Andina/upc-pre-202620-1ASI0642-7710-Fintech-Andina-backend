import { z } from 'zod';

export const simularCreditoSchema = z.object({
  precioLista: z.number().positive('El precio de lista debe ser mayor a 0'),
  precioContado: z.number().positive().optional(),
  moneda: z.enum(['PEN', 'USD'], {
    error: 'La moneda debe ser PEN o USD',
  }),
  tipoTasa: z.enum(['Efectiva', 'Nominal'], {
    error: 'El tipo de tasa debe ser Efectiva o Nominal',
  }),
  tasa: z.number().positive('La tasa debe ser mayor a 0'),
  capitalizacion: z.number().int().positive().optional().default(12),
  modalidad: z.enum(['Cuotas', 'PagoUnico'], {
    error: 'La modalidad debe ser Cuotas o PagoUnico',
  }),
  plazoMeses: z.number().int().min(1, 'El plazo en meses debe ser de al menos 1'),
  diasGracia: z.number().int().min(0, 'Los días de gracia no pueden ser negativos').optional(),
  fCompra: z.string().optional(),
  diaCorte: z
    .number()
    .int()
    .min(1, 'El día de corte debe ser entre 1 y 28')
    .max(28, 'El día de corte debe ser entre 1 y 28'),
  diaPago: z
    .number()
    .int()
    .min(1, 'El día de pago debe ser entre 1 y 28')
    .max(28, 'El día de pago debe ser entre 1 y 28'),
  horaCorte: z.number().int().min(0).max(23).optional().default(18),
});

export const emitirCreditoSchema = z.object({
  clienteId: z.string().min(1, 'El ID de cliente es obligatorio'),
  tiendaId: z.string().optional(),
  productoId: z.string().optional(),
  precioLista: z.number().positive('El precio de lista debe ser mayor a 0').optional(),
  precioContado: z.number().positive().optional(),
  modalidad: z.enum(['Cuotas', 'PagoUnico'], {
    error: 'La modalidad debe ser Cuotas o PagoUnico',
  }),
  plazoMeses: z.number().int().min(1).optional().default(1),
  diasGracia: z.number().int().min(0, 'Los días de gracia no pueden ser negativos').optional(),
  fCompra: z.string().optional(),
  usuario: z.string().optional().default('ASESOR'),
});

export const liquidarPagoSchema = z.object({
  clienteId: z.string().min(1, 'El ID del cliente es obligatorio'),
  cuotaIds: z.array(z.string()).optional(),
  fPago: z.string().optional(),
  montoRecibido: z.number().positive('El monto recibido debe ser mayor a 0'),
  metodoPago: z.string().optional().default('EFECTIVO'),
  usuario: z.string().optional().default('CAJERO'),
});

export const crearClienteSchema = z.object({
  tiendaId: z.string().optional(),
  nombreCompleto: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  nombres: z.string().optional(),
  apellidos: z.string().optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  email: z.string().email('El formato de correo es inválido').optional(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  tipoDoc: z.enum(['DNI', 'CE', 'RUC']),
  numDoc: z.string().refine((val) => {
    return /^\d{8,11}$/.test(val);
  }, 'El número de documento debe tener entre 8 y 11 dígitos numéricos'),
  ingresosNetos: z.number().min(0, 'Los ingresos netos no pueden ser negativos'),
  moneda: z.enum(['PEN', 'USD']),
  tipoTasa: z.enum(['Efectiva', 'Nominal']),
  tasa: z.number().positive('La tasa debe ser mayor a 0'),
  capitalizacion: z.number().int().positive().optional().default(12),
  teaMora: z.number().min(0, 'La tasa moratoria no puede ser negativa'),
  diaCorte: z.number().int().min(1).max(28, 'El día de corte debe estar entre 1 y 28'),
  diaPago: z.number().int().min(1).max(28, 'El día de pago debe estar entre 1 y 28'),
  limiteCredito: z.number().positive('El límite de crédito debe ser mayor a 0'),
  maxMeses: z.number().int().min(1, 'El plazo máximo debe ser de al menos 1 mes'),
});

export const registerTiendaSchema = z.object({
  ruc: z.string().regex(/^\d{11}$/, 'El RUC debe tener 11 dígitos numéricos'),
  razonSocial: z.string().min(3, 'La razón social es obligatoria').optional(),
  nombreComercial: z.string().min(2, 'El nombre comercial es obligatorio').optional(),
  nombre: z.string().min(2).optional(),
  direccion: z.string().min(3, 'La dirección es obligatoria'),
  telefono: z.string().optional().default(''),
  email: z.string().email('Debe proporcionar un correo electrónico válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  rol: z.enum(['ADMIN_SISTEMA', 'ADMIN_NEGOCIO']).optional().default('ADMIN_NEGOCIO'),
  monedaDefecto: z.enum(['PEN', 'USD']).optional().default('PEN'),
  horaCorte: z.number().int().min(0).max(23).optional().default(18),
});

export const loginSchema = z.object({
  email: z.string().email('Debe proporcionar un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export const loginClienteSchema = z
  .object({
    email: z.string().email().optional(),
    numDoc: z.string().optional(),
    tiendaId: z.string().optional(),
    password: z.string().min(1, 'La contraseña es obligatoria'),
  })
  .refine((data) => Boolean(data.email || data.numDoc), {
    message: 'Debe proporcionar email o numDoc del cliente',
  });

export const cambiarEstadoTiendaSchema = z.object({
  estado: z.enum(['ACTIVO', 'INACTIVO'], {
    error: 'El estado debe ser ACTIVO o INACTIVO',
  }),
});

export const actualizarMiTiendaSchema = z.object({
  razonSocial: z.string().min(3, 'La razón social debe tener al menos 3 caracteres').optional(),
  nombreComercial: z.string().min(2, 'El nombre comercial debe tener al menos 2 caracteres').optional(),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  direccion: z.string().min(3, 'La dirección debe tener al menos 3 caracteres').optional(),
  telefono: z.string().optional(),
  monedaDefecto: z.enum(['PEN', 'USD']).optional(),
  horaCorte: z.number().int().min(0).max(23).optional(),
});

export const crearProductoSchema = z
  .object({
    sku: z.string().min(2, 'El SKU debe tener al menos 2 caracteres').optional(),
    nombre: z.string().min(2, 'El nombre del producto es obligatorio'),
    marca: z.string().optional(),
    proveedor: z.string().optional(),
    descripcion: z.string().optional(),
    unidadMedida: z.string().optional(),
    imagenUrl: z.string().optional(),
    precioContado: z.number().positive('El precio al contado (Pc) debe ser mayor a 0'),
    precioLista: z.number().positive('El precio de lista (PL) debe ser mayor a 0'),
    permiteCuotas: z.boolean().optional().default(true),
    permitePagoUnico: z.boolean().optional().default(true),
    activo: z.boolean().optional().default(true),
  })
  .refine((data) => data.permiteCuotas || data.permitePagoUnico, {
    message: 'El producto debe permitir al menos una modalidad (Cuotas o Pago Único)',
  });

export const actualizarProductoSchema = z.object({
  sku: z.string().min(2, 'El SKU debe tener al menos 2 caracteres').optional(),
  nombre: z.string().min(2, 'El nombre del producto debe tener al menos 2 caracteres').optional(),
  marca: z.string().optional(),
  proveedor: z.string().optional(),
  descripcion: z.string().optional(),
  unidadMedida: z.string().optional(),
  imagenUrl: z.string().optional(),
  precioContado: z.number().positive('El precio al contado (Pc) debe ser mayor a 0').optional(),
  precioLista: z.number().positive('El precio de lista (PL) debe ser mayor a 0').optional(),
  permiteCuotas: z.boolean().optional(),
  permitePagoUnico: z.boolean().optional(),
  activo: z.boolean().optional(),
});

export const cambiarEstadoActivoSchema = z.object({
  activo: z.boolean({
    error: 'El campo activo debe ser booleano (true o false)',
  }),
});

export const actualizarClienteSchema = z.object({
  nombreCompleto: z.string().min(3, 'El nombre debe tener al menos 3 caracteres').optional(),
  nombres: z.string().optional(),
  apellidos: z.string().optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  email: z.string().email('El formato de correo es inválido').optional(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  tipoDoc: z.enum(['DNI', 'CE', 'RUC']).optional(),
  numDoc: z
    .string()
    .refine((val) => /^\d{8,11}$/.test(val), 'El número de documento debe tener entre 8 y 11 dígitos numéricos')
    .optional(),
  ingresosNetos: z.number().min(0, 'Los ingresos netos no pueden ser negativos').optional(),
  moneda: z.enum(['PEN', 'USD']).optional(),
  tipoTasa: z.enum(['Efectiva', 'Nominal']).optional(),
  tasa: z.number().positive('La tasa debe ser mayor a 0').optional(),
  capitalizacion: z.number().int().positive().optional(),
  teaMora: z.number().min(0, 'La tasa moratoria no puede ser negativa').optional(),
  diaCorte: z.number().int().min(1).max(28, 'El día de corte debe estar entre 1 y 28').optional(),
  diaPago: z.number().int().min(1).max(28, 'El día de pago debe estar entre 1 y 28').optional(),
  limiteCredito: z.number().positive('El límite de crédito debe ser mayor a 0').optional(),
  maxMeses: z.number().int().min(1, 'El plazo máximo debe ser de al menos 1 mes').optional(),
  activo: z.boolean().optional(),
});

export const previsualizarPagoSchema = z.object({
  clienteId: z.string().min(1, 'El ID del cliente es obligatorio'),
  cuotaIds: z.array(z.string()).optional(),
  fPago: z.string().optional(),
});
