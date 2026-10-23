import { Moneda, TipoTasa, ModalidadCredito } from '../core/financialEngine.js';

export interface Tienda {
  id: string;
  nombre: string;
  ruc: string;
  direccion: string;
  telefono: string;
  monedaDefecto: Moneda;
  horaCorte: number; // Por defecto 18 (6:00 PM)
  creadoEn: string;
}

export type TipoDocumento = 'DNI' | 'CE' | 'RUC';

export interface Cliente {
  id: string;
  nombreCompleto: string;
  tipoDoc: TipoDocumento;
  numDoc: string;
  ingresosNetos: number;
  moneda: Moneda;
  tipoTasa: TipoTasa;
  tasa: number; // Decimal (ej. 0.36 para 36%)
  capitalizacion: number; // 12 mensual, 360 diaria
  teaMora: number; // Decimal (ej. 0.36 para 36%)
  diaCorte: number; // 1 a 28
  diaPago: number; // 1 a 28
  limiteCredito: number; // L
  capitalVigente: number; // Kv
  maxMeses: number; // Plazo máximo permitido
  activo: boolean;
  creadoEn: string;
}

export interface Producto {
  id: string;
  tiendaId: string;
  sku: string;
  nombre: string;
  precioLista: number; // PL
  precioContado: number; // Pc
  permiteCuotas: boolean;
  stock: number;
  creadoEn: string;
}

export type EstadoCredito = 'Activo' | 'Cancelado' | 'Vencido';

export interface Credito {
  id: string;
  clienteId: string;
  tiendaId: string;
  productoId?: string;
  moneda: Moneda;
  modalidad: ModalidadCredito;
  precioLista: number; // PL
  precioContado: number; // Pc
  tipoTasa: TipoTasa;
  valorTasa: number;
  capitalizacion: number;
  tea: number;
  tem: number;
  teaMora: number;
  plazoMeses: number;
  diasGracia: number;
  capitalCapitalizado: number; // P'
  cuota: number; // R
  tcea: number;
  trea: number;
  fechaEmision: string; // YYYY-MM-DD
  fechaCorte: string; // C
  primeraFechaPago: string; // F0
  fechaVencimiento: string; // Vencimiento de la última cuota
  estado: EstadoCredito;
  creadoEn: string;
}

export type EstadoCuota = 'Pendiente' | 'Pagada' | 'Vencida';
export type TipoPeriodoCuota = 'Gracia' | 'Amortizacion' | 'PagoUnico';

export interface Cuota {
  id: string;
  creditoId: string;
  clienteId: string;
  numero: number; // k
  tipoPeriodo: TipoPeriodoCuota;
  saldoInicial: number;
  interes: number;
  amortizacion: number;
  cuota: number;
  saldoFinal: number;
  fechaVencimiento: string; // YYYY-MM-DD
  tK: number;
  estado: EstadoCuota;
  diasMora: number;
  interesMoratorio: number;
  totalPagado: number;
  fechaPago?: string;
}

export interface Pago {
  id: string;
  cuotaId: string;
  creditoId: string;
  clienteId: string;
  fechaPago: string;
  montoPagado: number;
  diasMora: number;
  interesMoratorio: number;
  interesCompensatorio: number;
  amortizacionCapital: number;
  creadoEn: string;
}

export interface Bitacora {
  id: string;
  usuario: string;
  accion: string;
  detalle: string;
  fecha: string;
}
