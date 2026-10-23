import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { Credito, Cuota } from '../domain/entities.js';
import {
  ModalidadCredito,
  convertirATEA,
  determinarCiclo,
  generarCronogramaFrances,
  calcularTCEAPagoUnico,
  validarLimiteCredito,
  validarParametrosCliente,
  r2,
  formatearFechaISO,
  parsearFecha,
} from '../core/financialEngine.js';

export interface EmitirCreditoInput {
  clienteId: string;
  tiendaId?: string;
  productoId?: string;
  precioLista?: number;
  precioContado?: number;
  modalidad: ModalidadCredito;
  plazoMeses?: number;
  diasGracia?: number;
  fCompra?: string | Date;
  usuario?: string;
}

export interface EmitirCreditoOutput {
  credito: Credito;
  cuotas: Cuota[];
  nuevoCapitalVigente: number;
  lineaDisponible: number;
}

export class EmitirCreditoService {
  constructor(private repos: Repositories) {}

  async ejecutar(input: EmitirCreditoInput): Promise<EmitirCreditoOutput> {
    const cliente = await this.repos.clientes.obtenerPorId(input.clienteId);
    if (!cliente) {
      throw new Error(`Cliente con ID ${input.clienteId} no encontrado`);
    }
    if (!cliente.activo) {
      throw new Error('El cliente se encuentra inactivo para operaciones crediticias');
    }

    // A8: Validar parámetros de cliente frente a normas BCRP
    const validacionRegulatoria = validarParametrosCliente(cliente);
    if (!validacionRegulatoria.valido) {
      throw new Error(`Validación regulatoria fallida: ${validacionRegulatoria.motivo}`);
    }

    // Determinar precio de lista y precio de contado
    let PL = input.precioLista;
    let Pc = input.precioContado;
    let tiendaId = input.tiendaId;

    if (input.productoId) {
      const producto = await this.repos.productos.obtenerPorId(input.productoId);
      if (!producto) {
        throw new Error(`Producto con ID ${input.productoId} no encontrado`);
      }
      if (input.modalidad === 'Cuotas' && !producto.permiteCuotas) {
        throw new Error('El producto seleccionado no admite financiamiento en cuotas');
      }
      if (producto.stock <= 0) {
        throw new Error('El producto no cuenta con stock disponible');
      }
      PL = PL ?? producto.precioLista;
      Pc = Pc ?? producto.precioContado;
      tiendaId = tiendaId ?? producto.tiendaId;

      // Descontar stock
      await this.repos.productos.actualizar(producto.id, {
        stock: producto.stock - 1,
      });
    }

    if (!PL || PL <= 0) {
      throw new Error('El precio de lista (PL) debe ser mayor a 0');
    }
    Pc = Pc ?? PL;

    if (!tiendaId) {
      const tiendas = await this.repos.tiendas.listarTodas();
      if (tiendas.length > 0) {
        tiendaId = tiendas[0].id;
      } else {
        throw new Error('No se encontró una tienda emisora configurada');
      }
    }

    // F-17: Control de límite de crédito (Kv + PL <= L)
    const limiteValido = validarLimiteCredito(cliente.capitalVigente, PL, cliente.limiteCredito);
    if (!limiteValido) {
      const disponible = r2(cliente.limiteCredito - cliente.capitalVigente);
      throw new Error(
        `La compra excede el límite de crédito del cliente. Límite: ${cliente.limiteCredito.toFixed(2)}, Deuda vigente: ${cliente.capitalVigente.toFixed(2)}, Disponible: ${disponible.toFixed(2)}, Solicitado: ${PL.toFixed(2)}`
      );
    }

    const n = input.modalidad === 'PagoUnico' ? 1 : input.plazoMeses ?? 1;
    if (n < 1 || n > cliente.maxMeses) {
      throw new Error(`El número de cuotas (${n}) excede el plazo máximo permitido para el cliente (${cliente.maxMeses} meses)`);
    }

    const fCompraDate = input.fCompra ? parsearFecha(input.fCompra) : new Date();
    const tienda = await this.repos.tiendas.obtenerPorId(tiendaId);
    const horaCorte = tienda?.horaCorte ?? 18;

    // A1: Convertir a TEA
    const tea = convertirATEA(cliente.tipoTasa, cliente.tasa, cliente.capitalizacion);
    // A2: Determinar Ciclo
    const ciclo = determinarCiclo(fCompraDate, cliente.diaCorte, cliente.diaPago, horaCorte);
    const diasGracia = input.diasGracia !== undefined ? input.diasGracia : ciclo.diasGracia;

    let capitalCapitalizado = PL;
    let cuotaReferencial = PL;
    let tcea = tea;
    let trea = tea;
    let tem = 0;
    const cuotasParaCrear: Array<Omit<Cuota, 'id'>> = [];
    let fechaVencimientoFinal = formatearFechaISO(ciclo.primeraFechaPago);

    if (input.modalidad === 'PagoUnico') {
      const g = diasGracia;
      const Ic = r2(PL * (Math.pow(1 + tea, g / 360) - 1));
      const totalPagar = r2(PL + Ic);
      tcea = g > 0 ? calcularTCEAPagoUnico(PL, Ic, Pc, g) : tea;
      trea = tcea;
      cuotaReferencial = totalPagar;

      cuotasParaCrear.push({
        creditoId: '', // Se asignará tras crear el crédito
        clienteId: cliente.id,
        numero: 1,
        tipoPeriodo: 'PagoUnico',
        saldoInicial: PL,
        interes: Ic,
        amortizacion: PL,
        cuota: totalPagar,
        saldoFinal: 0.0,
        fechaVencimiento: formatearFechaISO(ciclo.primeraFechaPago),
        tK: g,
        estado: 'Pendiente',
        diasMora: 0,
        interesMoratorio: 0.0,
        totalPagado: 0.0,
      });
    } else {
      // Modalidad Cuotas (A4)
      const resultado = generarCronogramaFrances(
        PL,
        tea,
        diasGracia,
        n,
        ciclo.primeraFechaPago,
        Pc
      );

      capitalCapitalizado = resultado.capitalCapitalizado;
      cuotaReferencial = resultado.cuotaReferencial;
      tem = resultado.tem;
      tcea = resultado.tcea;
      trea = resultado.trea;

      fechaVencimientoFinal = resultado.filas[resultado.filas.length - 1].fechaVencimiento;

      for (const f of resultado.filas) {
        cuotasParaCrear.push({
          creditoId: '',
          clienteId: cliente.id,
          numero: f.k,
          tipoPeriodo: 'Amortizacion',
          saldoInicial: f.saldoInicial,
          interes: f.interes,
          amortizacion: f.amortizacion,
          cuota: f.cuota,
          saldoFinal: f.saldoFinal,
          fechaVencimiento: f.fechaVencimiento,
          tK: f.tK,
          estado: 'Pendiente',
          diasMora: 0,
          interesMoratorio: 0.0,
          totalPagado: 0.0,
        });
      }
    }

    // Guardar Crédito
    const creditoCreado = await this.repos.creditos.crear({
      clienteId: cliente.id,
      tiendaId,
      productoId: input.productoId,
      moneda: cliente.moneda,
      modalidad: input.modalidad,
      precioLista: PL,
      precioContado: Pc,
      tipoTasa: cliente.tipoTasa,
      valorTasa: cliente.tasa,
      capitalizacion: cliente.capitalizacion,
      tea,
      tem,
      teaMora: cliente.teaMora,
      plazoMeses: n,
      diasGracia,
      capitalCapitalizado,
      cuota: cuotaReferencial,
      tcea,
      trea,
      fechaEmision: formatearFechaISO(fCompraDate),
      fechaCorte: formatearFechaISO(ciclo.corte),
      primeraFechaPago: formatearFechaISO(ciclo.primeraFechaPago),
      fechaVencimiento: fechaVencimientoFinal,
      estado: 'Activo',
    });

    // Asignar creditoId y persistir cuotas
    const cuotasConCreditoId = cuotasParaCrear.map((c) => ({
      ...c,
      creditoId: creditoCreado.id,
    }));
    const cuotasCreadas = await this.repos.cuotas.crearMuchas(cuotasConCreditoId);

    // Actualizar capital vigente del cliente (F-17)
    const nuevoCapitalVigente = r2(cliente.capitalVigente + PL);
    await this.repos.clientes.actualizarCapitalVigente(cliente.id, nuevoCapitalVigente);

    // Bitácora
    await this.repos.bitacora.registrar({
      usuario: input.usuario ?? 'SISTEMA',
      accion: 'EMISION_CREDITO',
      detalle: `Crédito emitido ID: ${creditoCreado.id} para cliente ${cliente.nombreCompleto}. Monto PL: ${PL.toFixed(2)} ${cliente.moneda}, Cuotas: ${n}, TCEA: ${(tcea * 100).toFixed(2)}%`,
    });

    return {
      credito: creditoCreado,
      cuotas: cuotasCreadas,
      nuevoCapitalVigente,
      lineaDisponible: r2(cliente.limiteCredito - nuevoCapitalVigente),
    };
  }
}
