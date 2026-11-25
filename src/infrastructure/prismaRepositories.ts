import { PrismaClient, Prisma } from '@prisma/client';
import { prisma as defaultPrisma } from '../config/prisma.js';
import {
  Cliente,
  Credito,
  Cuota,
  Producto,
  Tienda,
  Pago,
  Bitacora,
  TipoDocumento,
  EstadoCredito,
  EstadoCuota,
  TipoPeriodoCuota,
} from '../domain/entities.js';
import {
  IClienteRepository,
  ICreditoRepository,
  ICuotaRepository,
  IProductoRepository,
  ITiendaRepository,
  IPagoRepository,
  IBitacoraRepository,
} from '../domain/repositories.js';
import { Repositories } from './inMemoryRepositories.js';
import { Moneda, TipoTasa, ModalidadCredito, formatearFechaISO, parsearFecha } from '../core/financialEngine.js';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

type DbClient = PrismaClient | PrismaTransactionClient;

function toNum(val: Prisma.Decimal | number | string | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

function splitNombreCompleto(nombreCompleto: string): { nombres: string; apellidos: string } {
  const partes = nombreCompleto.trim().split(/\s+/);
  if (partes.length <= 1) {
    return { nombres: partes[0] || 'Vecino', apellidos: '' };
  }
  if (partes.length === 2) {
    return { nombres: partes[0], apellidos: partes[1] };
  }
  const apellidos = partes.slice(-2).join(' ');
  const nombres = partes.slice(0, -2).join(' ');
  return { nombres, apellidos };
}

function mapEstadoCreditoToDb(estado: EstadoCredito): string {
  if (estado === 'Activo') return 'VIGENTE';
  if (estado === 'Cancelado') return 'CANCELADO';
  if (estado === 'Vencido') return 'VENCIDO';
  return 'VIGENTE';
}

function mapEstadoCreditoFromDb(estado: string): EstadoCredito {
  const upper = estado.toUpperCase();
  if (upper === 'CANCELADO') return 'Cancelado';
  if (upper === 'VENCIDO') return 'Vencido';
  return 'Activo';
}

function mapEstadoCuotaToDb(estado: EstadoCuota): string {
  if (estado === 'Pagada') return 'PAGADA';
  if (estado === 'Vencida') return 'VENCIDA';
  return 'PENDIENTE';
}

function mapEstadoCuotaFromDb(estado: string): EstadoCuota {
  const upper = estado.toUpperCase();
  if (upper === 'PAGADA') return 'Pagada';
  if (upper === 'VENCIDA') return 'Vencida';
  return 'Pendiente';
}

function mapTiendaFromDb(row: any): Tienda {
  return {
    id: row.id_tienda,
    nombre: row.nombre_comercial || row.razon_social,
    razonSocial: row.razon_social,
    nombreComercial: row.nombre_comercial,
    ruc: row.ruc,
    direccion: row.direccion,
    telefono: row.telefono ?? '',
    email: row.email,
    passwordHash: row.password_hash,
    rol: (row.rol as 'ADMIN_SISTEMA' | 'ADMIN_NEGOCIO') ?? 'ADMIN_NEGOCIO',
    monedaDefecto: (row.moneda_defecto as Moneda) ?? 'PEN',
    horaCorte: row.hora_corte ?? 18,
    estado: row.estado ?? 'ACTIVO',
    creadoEn: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

function mapClienteFromDb(row: any): Cliente {
  const nombreCompleto = [row.nombres, row.apellidos].filter(Boolean).join(' ').trim();
  return {
    id: row.id_cliente,
    tiendaId: row.id_tienda,
    nombreCompleto,
    nombres: row.nombres,
    apellidos: row.apellidos,
    telefono: row.telefono ?? undefined,
    direccion: row.direccion ?? undefined,
    email: row.email ?? undefined,
    passwordHash: row.password_hash ?? undefined,
    tipoDoc: row.tipo_doc as TipoDocumento,
    numDoc: row.num_doc,
    ingresosNetos: toNum(row.ingresos_netos),
    moneda: row.moneda as Moneda,
    tipoTasa: row.tipo_tasa as TipoTasa,
    tasa: toNum(row.valor_tasa),
    capitalizacion: row.capitalizacion ?? 12,
    teaMora: toNum(row.tea_mora),
    diaCorte: row.dia_corte,
    diaPago: row.dia_pago,
    limiteCredito: toNum(row.limite_credito),
    capitalVigente: toNum(row.capital_vigente),
    maxMeses: row.max_meses,
    activo: row.activo,
    creadoEn: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

function mapProductoFromDb(row: any): Producto {
  return {
    id: row.id_producto,
    tiendaId: row.id_tienda,
    sku: row.sku,
    nombre: row.nombre,
    marca: row.marca ?? undefined,
    descripcion: row.descripcion ?? undefined,
    unidadMedida: row.unidad_medida ?? undefined,
    imagenUrl: row.imagen_url ?? undefined,
    precioLista: toNum(row.precio_lista),
    precioContado: toNum(row.precio_contado),
    permiteCuotas: row.permite_cuotas,
    permitePagoUnico: row.permite_pago_unico,
    activo: row.activo,
    stock: row.stock ?? 0,
    creadoEn: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

function mapCreditoFromDb(row: any): Credito {
  return {
    id: row.id_credito,
    clienteId: row.id_cliente,
    tiendaId: row.id_tienda,
    productoId: row.id_producto ?? undefined,
    moneda: (row.moneda as Moneda) ?? 'PEN',
    modalidad: row.modalidad as ModalidadCredito,
    precioLista: toNum(row.precio_lista),
    precioContado: toNum(row.precio_contado),
    tipoTasa: (row.tipo_tasa as TipoTasa) ?? 'Efectiva',
    valorTasa: toNum(row.valor_tasa),
    capitalizacion: row.capitalizacion ?? 12,
    tea: toNum(row.tea_aplicada),
    tem: toNum(row.tem_aplicada),
    teaMora: toNum(row.tea_mora),
    plazoMeses: row.plazo_cuotas,
    diasGracia: row.dias_gracia,
    capitalCapitalizado: toNum(row.capital_capitalizado),
    cuota: toNum(row.cuota_referencial),
    tcea: toNum(row.tcea),
    trea: toNum(row.trea),
    fechaEmision: formatearFechaISO(new Date(row.fecha_compra)),
    fechaCorte: formatearFechaISO(new Date(row.fecha_corte)),
    primeraFechaPago: formatearFechaISO(new Date(row.fecha_primer_pago)),
    fechaVencimiento: formatearFechaISO(new Date(row.fecha_vencimiento)),
    estado: mapEstadoCreditoFromDb(row.estado),
    creadoEn: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

function mapCuotaFromDb(row: any): Cuota {
  return {
    id: row.id_cuota,
    creditoId: row.id_credito,
    clienteId: row.id_cliente,
    numero: row.nro_cuota,
    tipoPeriodo: (row.tipo_periodo as TipoPeriodoCuota) ?? 'Amortizacion',
    saldoInicial: toNum(row.saldo_inicial),
    interes: toNum(row.interes),
    amortizacion: toNum(row.amortizacion),
    cuota: toNum(row.cuota_monto),
    saldoFinal: toNum(row.saldo_final),
    fechaVencimiento: formatearFechaISO(new Date(row.fecha_vencimiento)),
    tK: row.dias_desde_compra,
    estado: mapEstadoCuotaFromDb(row.estado),
    diasMora: row.dias_mora ?? 0,
    interesMoratorio: toNum(row.interes_moratorio),
    totalPagado: toNum(row.total_pagado),
    fechaPago: row.fecha_pago ? formatearFechaISO(new Date(row.fecha_pago)) : undefined,
  };
}

function mapPagoFromDb(row: any): Pago {
  return {
    id: row.id_pago,
    cuotaId: row.id_cuota ?? '',
    creditoId: row.id_credito,
    clienteId: row.id_cliente,
    fechaPago: formatearFechaISO(new Date(row.fecha_pago)),
    montoPagado: toNum(row.monto_recibido),
    diasMora: row.dias_mora,
    interesMoratorio: toNum(row.interes_moratorio),
    interesCompensatorio: toNum(row.interes_compensatorio),
    amortizacionCapital: toNum(row.capital_amortizado),
    metodoPago: row.metodo_pago,
    creadoEn: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

function mapBitacoraFromDb(row: any): Bitacora {
  return {
    id: row.id_bitacora,
    tiendaId: row.id_tienda ?? undefined,
    usuario: row.usuario,
    accion: row.accion,
    entidad: row.entidad,
    idEntidad: row.id_entidad ?? undefined,
    detalle: row.detalle,
    fecha: row.fecha_hora instanceof Date ? row.fecha_hora.toISOString() : String(row.fecha_hora),
  };
}

async function resolveDefaultTiendaId(db: DbClient, providedTiendaId?: string): Promise<string> {
  if (providedTiendaId) return providedTiendaId;
  const primeraTienda = await db.tienda.findFirst({
    where: { rol: 'ADMIN_NEGOCIO' },
    orderBy: { created_at: 'asc' },
  });
  if (primeraTienda) return primeraTienda.id_tienda;
  const cualquierTienda = await db.tienda.findFirst({
    orderBy: { created_at: 'asc' },
  });
  if (cualquierTienda) return cualquierTienda.id_tienda;
  throw new Error('No existe ninguna tienda registrada en la base de datos para asociar la entidad');
}

export class PrismaTiendaRepository implements ITiendaRepository {
  constructor(private db: DbClient) {}

  async crear(datos: Omit<Tienda, 'id' | 'creadoEn'>): Promise<Tienda> {
    const row = await this.db.tienda.create({
      data: {
        ruc: datos.ruc,
        razon_social: datos.razonSocial ?? datos.nombre,
        nombre_comercial: datos.nombreComercial ?? datos.nombre,
        direccion: datos.direccion,
        telefono: datos.telefono ?? '',
        email: datos.email ?? `${datos.ruc}@defiabook.pe`,
        password_hash: datos.passwordHash ?? '',
        rol: datos.rol ?? 'ADMIN_NEGOCIO',
        moneda_defecto: datos.monedaDefecto ?? 'PEN',
        hora_corte: datos.horaCorte ?? 18,
        estado: datos.estado ?? 'ACTIVO',
      },
    });
    return mapTiendaFromDb(row);
  }

  async obtenerPorId(id: string): Promise<Tienda | null> {
    const row = await this.db.tienda.findUnique({
      where: { id_tienda: id },
    });
    return row ? mapTiendaFromDb(row) : null;
  }

  async obtenerPorEmail(email: string): Promise<Tienda | null> {
    const row = await this.db.tienda.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    return row ? mapTiendaFromDb(row) : null;
  }

  async obtenerPorRuc(ruc: string): Promise<Tienda | null> {
    const row = await this.db.tienda.findUnique({
      where: { ruc },
    });
    return row ? mapTiendaFromDb(row) : null;
  }

  async listarTodas(): Promise<Tienda[]> {
    const rows = await this.db.tienda.findMany({
      orderBy: { created_at: 'asc' },
    });
    return rows.map(mapTiendaFromDb);
  }

  async actualizar(id: string, parcial: Partial<Tienda>): Promise<Tienda | null> {
    const existe = await this.db.tienda.findUnique({ where: { id_tienda: id } });
    if (!existe) return null;

    const row = await this.db.tienda.update({
      where: { id_tienda: id },
      data: {
        ...(parcial.nombre !== undefined && { nombre_comercial: parcial.nombre }),
        ...(parcial.nombreComercial !== undefined && { nombre_comercial: parcial.nombreComercial }),
        ...(parcial.razonSocial !== undefined && { razon_social: parcial.razonSocial }),
        ...(parcial.direccion !== undefined && { direccion: parcial.direccion }),
        ...(parcial.telefono !== undefined && { telefono: parcial.telefono }),
        ...(parcial.estado !== undefined && { estado: parcial.estado }),
        ...(parcial.rol !== undefined && { rol: parcial.rol }),
        ...(parcial.horaCorte !== undefined && { hora_corte: parcial.horaCorte }),
        ...(parcial.monedaDefecto !== undefined && { moneda_defecto: parcial.monedaDefecto }),
      },
    });
    return mapTiendaFromDb(row);
  }
}

export class PrismaClienteRepository implements IClienteRepository {
  constructor(private db: DbClient) {}

  async crear(datos: Omit<Cliente, 'id' | 'creadoEn'>): Promise<Cliente> {
    const tiendaId = await resolveDefaultTiendaId(this.db, datos.tiendaId);
    const { nombres, apellidos } =
      datos.nombres !== undefined
        ? { nombres: datos.nombres, apellidos: datos.apellidos ?? '' }
        : splitNombreCompleto(datos.nombreCompleto);

    const row = await this.db.cliente.create({
      data: {
        id_tienda: tiendaId,
        tipo_doc: datos.tipoDoc,
        num_doc: datos.numDoc,
        nombres,
        apellidos,
        telefono: datos.telefono ?? '',
        direccion: datos.direccion ?? '',
        email: datos.email ? datos.email.trim().toLowerCase() : null,
        password_hash: datos.passwordHash ?? null,
        ingresos_netos: datos.ingresosNetos,
        dia_corte: datos.diaCorte,
        dia_pago: datos.diaPago,
        limite_credito: datos.limiteCredito,
        capital_vigente: datos.capitalVigente ?? 0,
        max_meses: datos.maxMeses,
        moneda: datos.moneda,
        tipo_tasa: datos.tipoTasa,
        valor_tasa: datos.tasa,
        capitalizacion: datos.capitalizacion ?? 12,
        tea_mora: datos.teaMora,
        activo: datos.activo ?? true,
      },
    });
    return mapClienteFromDb(row);
  }

  async obtenerPorId(id: string): Promise<Cliente | null> {
    const row = await this.db.cliente.findUnique({
      where: { id_cliente: id },
    });
    return row ? mapClienteFromDb(row) : null;
  }

  async obtenerPorDoc(numDoc: string, tiendaId?: string): Promise<Cliente | null> {
    const row = await this.db.cliente.findFirst({
      where: {
        num_doc: numDoc,
        ...(tiendaId && { id_tienda: tiendaId }),
      },
    });
    return row ? mapClienteFromDb(row) : null;
  }

  async obtenerPorEmail(email: string): Promise<Cliente | null> {
    const row = await this.db.cliente.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    return row ? mapClienteFromDb(row) : null;
  }

  async listarTodos(tiendaId?: string): Promise<Cliente[]> {
    const rows = await this.db.cliente.findMany({
      where: tiendaId ? { id_tienda: tiendaId } : undefined,
      orderBy: { created_at: 'asc' },
    });
    return rows.map(mapClienteFromDb);
  }

  async actualizar(id: string, parcial: Partial<Cliente>): Promise<Cliente | null> {
    const existe = await this.db.cliente.findUnique({ where: { id_cliente: id } });
    if (!existe) return null;

    let nombresUpdate: { nombres?: string; apellidos?: string } = {};
    if (parcial.nombreCompleto) {
      nombresUpdate = splitNombreCompleto(parcial.nombreCompleto);
    }

    const row = await this.db.cliente.update({
      where: { id_cliente: id },
      data: {
        ...nombresUpdate,
        ...(parcial.nombres !== undefined && { nombres: parcial.nombres }),
        ...(parcial.apellidos !== undefined && { apellidos: parcial.apellidos }),
        ...(parcial.telefono !== undefined && { telefono: parcial.telefono }),
        ...(parcial.direccion !== undefined && { direccion: parcial.direccion }),
        ...(parcial.ingresosNetos !== undefined && { ingresos_netos: parcial.ingresosNetos }),
        ...(parcial.limiteCredito !== undefined && { limite_credito: parcial.limiteCredito }),
        ...(parcial.capitalVigente !== undefined && { capital_vigente: parcial.capitalVigente }),
        ...(parcial.diaCorte !== undefined && { dia_corte: parcial.diaCorte }),
        ...(parcial.diaPago !== undefined && { dia_pago: parcial.diaPago }),
        ...(parcial.tasa !== undefined && { valor_tasa: parcial.tasa }),
        ...(parcial.teaMora !== undefined && { tea_mora: parcial.teaMora }),
        ...(parcial.activo !== undefined && { activo: parcial.activo }),
      },
    });
    return mapClienteFromDb(row);
  }

  async actualizarCapitalVigente(id: string, nuevoCapital: number): Promise<void> {
    await this.db.cliente.update({
      where: { id_cliente: id },
      data: { capital_vigente: nuevoCapital },
    });
  }
}

export class PrismaProductoRepository implements IProductoRepository {
  constructor(private db: DbClient) {}

  async crear(datos: Omit<Producto, 'id' | 'creadoEn'>): Promise<Producto> {
    const tiendaId = await resolveDefaultTiendaId(this.db, datos.tiendaId);
    const row = await this.db.producto.create({
      data: {
        id_tienda: tiendaId,
        sku: datos.sku,
        nombre: datos.nombre,
        marca: datos.marca ?? null,
        descripcion: datos.descripcion ?? null,
        unidad_medida: datos.unidadMedida ?? null,
        imagen_url: datos.imagenUrl ?? null,
        precio_lista: datos.precioLista,
        precio_contado: datos.precioContado,
        permite_cuotas: datos.permiteCuotas,
        permite_pago_unico: datos.permitePagoUnico ?? true,
        activo: datos.activo ?? true,
        stock: datos.stock ?? 0,
      },
    });
    return mapProductoFromDb(row);
  }

  async obtenerPorId(id: string): Promise<Producto | null> {
    const row = await this.db.producto.findUnique({
      where: { id_producto: id },
    });
    return row ? mapProductoFromDb(row) : null;
  }

  async obtenerPorSku(sku: string, tiendaId?: string): Promise<Producto | null> {
    const row = await this.db.producto.findFirst({
      where: {
        sku,
        ...(tiendaId && { id_tienda: tiendaId }),
      },
    });
    return row ? mapProductoFromDb(row) : null;
  }

  async listarTodos(tiendaId?: string): Promise<Producto[]> {
    const rows = await this.db.producto.findMany({
      where: tiendaId ? { id_tienda: tiendaId } : undefined,
      orderBy: { created_at: 'asc' },
    });
    return rows.map(mapProductoFromDb);
  }

  async actualizar(id: string, parcial: Partial<Producto>): Promise<Producto | null> {
    const existe = await this.db.producto.findUnique({ where: { id_producto: id } });
    if (!existe) return null;

    const row = await this.db.producto.update({
      where: { id_producto: id },
      data: {
        ...(parcial.nombre !== undefined && { nombre: parcial.nombre }),
        ...(parcial.precioLista !== undefined && { precio_lista: parcial.precioLista }),
        ...(parcial.precioContado !== undefined && { precio_contado: parcial.precioContado }),
        ...(parcial.permiteCuotas !== undefined && { permite_cuotas: parcial.permiteCuotas }),
        ...(parcial.permitePagoUnico !== undefined && { permite_pago_unico: parcial.permitePagoUnico }),
        ...(parcial.activo !== undefined && { activo: parcial.activo }),
        ...(parcial.stock !== undefined && { stock: parcial.stock }),
      },
    });
    return mapProductoFromDb(row);
  }
}

export class PrismaCreditoRepository implements ICreditoRepository {
  constructor(private db: DbClient) {}

  async crear(datos: Omit<Credito, 'id' | 'creadoEn'>): Promise<Credito> {
    const row = await this.db.credito.create({
      data: {
        id_tienda: datos.tiendaId,
        id_cliente: datos.clienteId,
        id_producto: datos.productoId ?? null,
        moneda: datos.moneda,
        modalidad: datos.modalidad,
        plazo_cuotas: datos.plazoMeses,
        fecha_compra: parsearFecha(datos.fechaEmision),
        fecha_corte: parsearFecha(datos.fechaCorte),
        fecha_primer_pago: parsearFecha(datos.primeraFechaPago),
        fecha_vencimiento: parsearFecha(datos.fechaVencimiento),
        dias_gracia: datos.diasGracia,
        precio_contado: datos.precioContado,
        precio_lista: datos.precioLista,
        tipo_tasa: datos.tipoTasa,
        valor_tasa: datos.valorTasa,
        capitalizacion: datos.capitalizacion,
        capital_capitalizado: datos.capitalCapitalizado,
        tea_aplicada: datos.tea,
        tem_aplicada: datos.tem,
        tea_mora: datos.teaMora,
        cuota_referencial: datos.cuota,
        tcea: datos.tcea,
        trea: datos.trea,
        estado: mapEstadoCreditoToDb(datos.estado),
      },
    });
    return mapCreditoFromDb(row);
  }

  async obtenerPorId(id: string): Promise<Credito | null> {
    const row = await this.db.credito.findUnique({
      where: { id_credito: id },
    });
    return row ? mapCreditoFromDb(row) : null;
  }

  async listarPorCliente(clienteId: string): Promise<Credito[]> {
    const rows = await this.db.credito.findMany({
      where: { id_cliente: clienteId },
      orderBy: { created_at: 'asc' },
    });
    return rows.map(mapCreditoFromDb);
  }

  async listarTodos(tiendaId?: string): Promise<Credito[]> {
    const rows = await this.db.credito.findMany({
      where: tiendaId ? { id_tienda: tiendaId } : undefined,
      orderBy: { created_at: 'asc' },
    });
    return rows.map(mapCreditoFromDb);
  }

  async actualizar(id: string, parcial: Partial<Credito>): Promise<Credito | null> {
    const existe = await this.db.credito.findUnique({ where: { id_credito: id } });
    if (!existe) return null;

    const row = await this.db.credito.update({
      where: { id_credito: id },
      data: {
        ...(parcial.estado !== undefined && { estado: mapEstadoCreditoToDb(parcial.estado) }),
      },
    });
    return mapCreditoFromDb(row);
  }
}

export class PrismaCuotaRepository implements ICuotaRepository {
  constructor(private db: DbClient) {}

  async crearMuchas(datos: Array<Omit<Cuota, 'id'>>): Promise<Cuota[]> {
    const creadas: Cuota[] = [];
    for (const d of datos) {
      const row = await this.db.cuota.create({
        data: {
          id_credito: d.creditoId,
          id_cliente: d.clienteId,
          nro_cuota: d.numero,
          tipo_periodo: d.tipoPeriodo,
          fecha_vencimiento: parsearFecha(d.fechaVencimiento),
          saldo_inicial: d.saldoInicial,
          interes: d.interes,
          amortizacion: d.amortizacion,
          cuota_monto: d.cuota,
          saldo_final: d.saldoFinal,
          dias_desde_compra: d.tK,
          estado: mapEstadoCuotaToDb(d.estado),
          dias_mora: d.diasMora,
          interes_moratorio: d.interesMoratorio,
          total_pagado: d.totalPagado,
          fecha_pago: d.fechaPago ? parsearFecha(d.fechaPago) : null,
        },
      });
      creadas.push(mapCuotaFromDb(row));
    }
    return creadas;
  }

  async obtenerPorId(id: string): Promise<Cuota | null> {
    const row = await this.db.cuota.findUnique({
      where: { id_cuota: id },
    });
    return row ? mapCuotaFromDb(row) : null;
  }

  async listarPorCredito(creditoId: string): Promise<Cuota[]> {
    const rows = await this.db.cuota.findMany({
      where: { id_credito: creditoId },
      orderBy: { nro_cuota: 'asc' },
    });
    return rows.map(mapCuotaFromDb);
  }

  async listarPorCliente(clienteId: string): Promise<Cuota[]> {
    const rows = await this.db.cuota.findMany({
      where: { id_cliente: clienteId },
      orderBy: [{ fecha_vencimiento: 'asc' }, { nro_cuota: 'asc' }],
    });
    return rows.map(mapCuotaFromDb);
  }

  async listarPendientesPorCliente(clienteId: string): Promise<Cuota[]> {
    const rows = await this.db.cuota.findMany({
      where: {
        id_cliente: clienteId,
        estado: { not: 'PAGADA' },
      },
      orderBy: [{ fecha_vencimiento: 'asc' }, { nro_cuota: 'asc' }],
    });
    return rows.map(mapCuotaFromDb);
  }

  async actualizar(id: string, parcial: Partial<Cuota>): Promise<Cuota | null> {
    const existe = await this.db.cuota.findUnique({ where: { id_cuota: id } });
    if (!existe) return null;

    const row = await this.db.cuota.update({
      where: { id_cuota: id },
      data: {
        ...(parcial.estado !== undefined && { estado: mapEstadoCuotaToDb(parcial.estado) }),
        ...(parcial.diasMora !== undefined && { dias_mora: parcial.diasMora }),
        ...(parcial.interesMoratorio !== undefined && { interes_moratorio: parcial.interesMoratorio }),
        ...(parcial.totalPagado !== undefined && { total_pagado: parcial.totalPagado }),
        ...(parcial.fechaPago !== undefined && { fecha_pago: parsearFecha(parcial.fechaPago) }),
      },
    });
    return mapCuotaFromDb(row);
  }
}

export class PrismaPagoRepository implements IPagoRepository {
  constructor(private db: DbClient) {}

  async crear(datos: Omit<Pago, 'id' | 'creadoEn'>): Promise<Pago> {
    const row = await this.db.pago.create({
      data: {
        id_cliente: datos.clienteId,
        id_credito: datos.creditoId,
        id_cuota: datos.cuotaId || null,
        fecha_pago: parsearFecha(datos.fechaPago),
        monto_recibido: datos.montoPagado,
        dias_mora: datos.diasMora,
        interes_moratorio: datos.interesMoratorio,
        interes_compensatorio: datos.interesCompensatorio,
        capital_amortizado: datos.amortizacionCapital,
        metodo_pago: datos.metodoPago ?? 'EFECTIVO',
      },
    });
    return mapPagoFromDb(row);
  }

  async listarPorCredito(creditoId: string): Promise<Pago[]> {
    const rows = await this.db.pago.findMany({
      where: { id_credito: creditoId },
      orderBy: { fecha_pago: 'asc' },
    });
    return rows.map(mapPagoFromDb);
  }

  async listarPorCliente(clienteId: string): Promise<Pago[]> {
    const rows = await this.db.pago.findMany({
      where: { id_cliente: clienteId },
      orderBy: { fecha_pago: 'asc' },
    });
    return rows.map(mapPagoFromDb);
  }

  async listarTodos(tiendaId?: string): Promise<Pago[]> {
    const rows = await this.db.pago.findMany({
      where: tiendaId
        ? {
            credito: {
              id_tienda: tiendaId,
            },
          }
        : undefined,
      orderBy: { fecha_pago: 'asc' },
    });
    return rows.map(mapPagoFromDb);
  }
}

export class PrismaBitacoraRepository implements IBitacoraRepository {
  constructor(private db: DbClient) {}

  async registrar(datos: Omit<Bitacora, 'id' | 'fecha'>): Promise<Bitacora> {
    let tiendaId = datos.tiendaId;
    if (!tiendaId) {
      const primeraTienda = await this.db.tienda.findFirst({ orderBy: { created_at: 'asc' } });
      tiendaId = primeraTienda?.id_tienda;
    }

    const row = await this.db.bitacora.create({
      data: {
        id_tienda: tiendaId ?? null,
        usuario: datos.usuario,
        accion: datos.accion,
        entidad: datos.entidad ?? 'SISTEMA',
        id_entidad: datos.idEntidad ?? null,
        detalle: datos.detalle,
      },
    });
    return mapBitacoraFromDb(row);
  }

  async listar(tiendaId?: string): Promise<Bitacora[]> {
    const rows = await this.db.bitacora.findMany({
      where: tiendaId ? { id_tienda: tiendaId } : undefined,
      orderBy: { fecha_hora: 'desc' },
    });
    return rows.map(mapBitacoraFromDb);
  }
}

export function createPrismaRepositories(client: DbClient = defaultPrisma): Repositories {
  const buildForClient = (db: DbClient): Repositories => ({
    clientes: new PrismaClienteRepository(db),
    creditos: new PrismaCreditoRepository(db),
    cuotas: new PrismaCuotaRepository(db),
    productos: new PrismaProductoRepository(db),
    tiendas: new PrismaTiendaRepository(db),
    pagos: new PrismaPagoRepository(db),
    bitacora: new PrismaBitacoraRepository(db),
  });

  const repos = buildForClient(client);

  if ('$transaction' in client && typeof client.$transaction === 'function') {
    repos.ejecutarTransaccion = async <T>(fn: (txRepos: Repositories) => Promise<T>): Promise<T> => {
      return (client as PrismaClient).$transaction(async (tx) => {
        const txRepos = buildForClient(tx);
        return fn(txRepos);
      });
    };
  } else {
    repos.ejecutarTransaccion = async <T>(fn: (txRepos: Repositories) => Promise<T>): Promise<T> => {
      return fn(repos);
    };
  }

  return repos;
}
