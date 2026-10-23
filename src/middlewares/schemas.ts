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
  usuario: z.string().optional().default('CAJERO'),
});

export const crearClienteSchema = z.object({
  nombreCompleto: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  tipoDoc: z.enum(['DNI', 'CE', 'RUC']),
  numDoc: z.string().refine((val) => {
    // Si es DNI debe tener 8 dígitos
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
