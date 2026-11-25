import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { Cuota, Pago } from '../domain/entities.js';
import {
  liquidarPagoConMora,
  r2,
  formatearFechaISO,
  parsearFecha,
} from '../core/financialEngine.js';

export interface RegistrarPagoInput {
  clienteId: string;
  cuotaIds?: string[];
  fPago?: string | Date;
  montoRecibido: number;
  metodoPago?: string;
  usuario?: string;
}

export interface RegistrarPagoOutput {
  pagoRegistrado: {
    clienteId: string;
    totalExigibleBase: number;
    totalInteresMoratorio: number;
    totalPagado: number;
    fechaPago: string;
  };
  imputacionLegal: {
    moratorio: number;
    compensatorio: number;
    capital: number;
  };
  cuotasAfectadas: Cuota[];
  nuevoCapitalVigente: number;
  lineaDisponible: number;
  pagos: Pago[];
}

export class RegistrarPagoService {
  constructor(private repos: Repositories) {}

  async ejecutar(input: RegistrarPagoInput): Promise<RegistrarPagoOutput> {
    const cliente = await this.repos.clientes.obtenerPorId(input.clienteId);
    if (!cliente) {
      throw new Error(`Cliente con ID ${input.clienteId} no encontrado`);
    }

    const fPagoDate = input.fPago ? parsearFecha(input.fPago) : new Date();
    const fPagoISO = formatearFechaISO(fPagoDate);

    // 1. Obtener cuotas a liquidar
    let cuotasPendientes: Cuota[] = [];

    if (input.cuotaIds && input.cuotaIds.length > 0) {
      for (const id of input.cuotaIds) {
        const c = await this.repos.cuotas.obtenerPorId(id);
        if (!c) {
          throw new Error(`Cuota ID ${id} no encontrada`);
        }
        if (c.clienteId !== cliente.id) {
          throw new Error(`La cuota ID ${id} no pertenece al cliente ${cliente.nombreCompleto}`);
        }
        if (c.estado === 'Pagada') {
          throw new Error(`La cuota ID ${id} ya se encuentra pagada`);
        }
        cuotasPendientes.push(c);
      }
    } else {
      // Si no especifica IDs, liquidar las cuotas vencidas/exigibles a la fecha de pago
      const todasPendientes = await this.repos.cuotas.listarPendientesPorCliente(cliente.id);
      cuotasPendientes = todasPendientes.filter(
        (c) => c.fechaVencimiento <= fPagoISO
      );
      if (cuotasPendientes.length === 0 && todasPendientes.length > 0) {
        // Si no hay vencidas pero hay pendientes, toma la más próxima a vencer
        cuotasPendientes = [todasPendientes[0]];
      }
    }

    if (cuotasPendientes.length === 0) {
      throw new Error('No hay cuotas exigibles o pendientes de pago para el cliente');
    }

    // 2. Liquidar cálculo con mora y verificar pago parcial (A7 / F-7, F-8, F-9)
    const cuotasParaCalculo = cuotasPendientes.map((c) => ({
      k: c.numero,
      fechaVencimiento: c.fechaVencimiento,
      cuota: c.cuota,
      interes: c.interes,
      amortizacion: c.amortizacion,
    }));

    const resultadoLiquidacion = liquidarPagoConMora(
      cuotasParaCalculo,
      fPagoDate,
      cliente.teaMora,
      input.montoRecibido
    );

    // 3. Aplicar pagos y actualizar cuotas de forma transaccional
    const persistirPago = async (txRepos: Repositories): Promise<RegistrarPagoOutput> => {
      const pagosGenerados: Pago[] = [];
      const cuotasActualizadas: Cuota[] = [];
      let capitalAmortizadoTotal = 0;

      for (let i = 0; i < cuotasPendientes.length; i++) {
        const cuotaOriginal = cuotasPendientes[i];
        const filaLiq = resultadoLiquidacion.filas[i];

        const pago = await txRepos.pagos.crear({
          cuotaId: cuotaOriginal.id,
          creditoId: cuotaOriginal.creditoId,
          clienteId: cliente.id,
          fechaPago: fPagoISO,
          montoPagado: filaLiq.totalCuotaConMora,
          diasMora: filaLiq.diasMora,
          interesMoratorio: filaLiq.interesMoratorio,
          interesCompensatorio: filaLiq.imputacion.compensatorio,
          amortizacionCapital: filaLiq.imputacion.capital,
          metodoPago: input.metodoPago ?? 'EFECTIVO',
        });
        pagosGenerados.push(pago);

        const cuotaActualizada = await txRepos.cuotas.actualizar(cuotaOriginal.id, {
          estado: 'Pagada',
          diasMora: filaLiq.diasMora,
          interesMoratorio: filaLiq.interesMoratorio,
          totalPagado: filaLiq.totalCuotaConMora,
          fechaPago: fPagoISO,
        });

        if (cuotaActualizada) {
          cuotasActualizadas.push(cuotaActualizada);
        }

        capitalAmortizadoTotal = r2(capitalAmortizadoTotal + filaLiq.imputacion.capital);

        // Verificar si el crédito se canceló completamente
        const cuotasCredito = await txRepos.cuotas.listarPorCredito(cuotaOriginal.creditoId);
        const pendientesRestantes = cuotasCredito.filter(
          (c) => c.estado !== 'Pagada' && c.id !== cuotaOriginal.id
        );
        if (pendientesRestantes.length === 0) {
          await txRepos.creditos.actualizar(cuotaOriginal.creditoId, {
            estado: 'Cancelado',
          });
        }
      }

      // 4. Actualizar capital vigente del cliente
      const nuevoCapitalVigente = Math.max(0, r2(cliente.capitalVigente - capitalAmortizadoTotal));
      await txRepos.clientes.actualizarCapitalVigente(cliente.id, nuevoCapitalVigente);

      // 5. Bitácora
      await txRepos.bitacora.registrar({
        tiendaId: cliente.tiendaId,
        usuario: input.usuario ?? 'CAJERO',
        accion: 'REGISTRO_PAGO',
        entidad: 'Pago',
        idEntidad: pagosGenerados[0]?.id,
        detalle: `Pago procesado para cliente ${cliente.nombreCompleto}. Monto: ${resultadoLiquidacion.totalPagar.toFixed(2)} ${cliente.moneda}. Mora: ${resultadoLiquidacion.totalInteresMoratorio.toFixed(2)}, Amortización: ${capitalAmortizadoTotal.toFixed(2)}`,
      });

      return {
        pagoRegistrado: {
          clienteId: cliente.id,
          totalExigibleBase: resultadoLiquidacion.totalExigibleBase,
          totalInteresMoratorio: resultadoLiquidacion.totalInteresMoratorio,
          totalPagado: resultadoLiquidacion.totalPagar,
          fechaPago: fPagoISO,
        },
        imputacionLegal: resultadoLiquidacion.imputacionTotal,
        cuotasAfectadas: cuotasActualizadas,
        nuevoCapitalVigente,
        lineaDisponible: r2(cliente.limiteCredito - nuevoCapitalVigente),
        pagos: pagosGenerados,
      };
    };

    if (this.repos.ejecutarTransaccion) {
      return this.repos.ejecutarTransaccion(persistirPago);
    }
    return persistirPago(this.repos);
  }
}
