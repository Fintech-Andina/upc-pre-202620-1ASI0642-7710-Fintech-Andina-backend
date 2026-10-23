import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { Cuota } from '../domain/entities.js';
import {
  determinarCiclo,
  calcularInteresMoratorio,
  diasEntreFechas,
  r2,
  formatearFechaISO,
  parsearFecha,
} from '../core/financialEngine.js';

export interface DetalleFilaEstadoCuenta {
  cuotaId: string;
  creditoId: string;
  numeroCuota: number;
  fechaVencimiento: string;
  saldoInicial: number;
  amortizacion: number;
  interesCompensatorio: number;
  cuotaBase: number;
  diasMora: number;
  interesMoratorio: number;
  totalExigible: number;
  estado: string;
}

export interface EstadoCuentaOutput {
  cliente: {
    id: string;
    nombreCompleto: string;
    tipoDoc: string;
    numDoc: string;
    moneda: string;
    limiteCredito: number;
    capitalVigente: number;
    lineaDisponible: number;
    diaCorte: number;
    diaPago: number;
    teaCompensatoria: number;
    teaMoratoria: number;
  };
  ciclo: {
    fechaCorte: string;
    fechaPagoOportuno: string;
    diasGraciaCiclo: number;
  };
  resumenLiquidacion: {
    totalCapitalCiclo: number;
    totalInteresCiclo: number;
    subtotalCiclo: number; // F-6: T
    totalDeudaVencidaAnterior: number;
    totalInteresMoratorio: number;
    totalExigibleHoy: number; // Total a pagar a la fecha de consulta
  };
  cuotasCicloActual: DetalleFilaEstadoCuenta[];
  cuotasVencidasAnteriores: DetalleFilaEstadoCuenta[];
  cuotasFuturas: DetalleFilaEstadoCuenta[];
  historialPagadas: Cuota[];
}

export class EstadoCuentaService {
  constructor(private repos: Repositories) {}

  async ejecutar(clienteId: string, fConsulta?: string | Date): Promise<EstadoCuentaOutput> {
    const cliente = await this.repos.clientes.obtenerPorId(clienteId);
    if (!cliente) {
      throw new Error(`Cliente con ID ${clienteId} no encontrado`);
    }

    const fechaRef = fConsulta ? parsearFecha(fConsulta) : new Date();

    // Determinar ciclo según día de corte y pago
    const ciclo = determinarCiclo(fechaRef, cliente.diaCorte, cliente.diaPago, 18);
    const fCorteISO = formatearFechaISO(ciclo.corte);
    const fPagoISO = formatearFechaISO(ciclo.primeraFechaPago);

    const todasCuotas = await this.repos.cuotas.listarPorCliente(cliente.id);

    const cuotasCicloActual: DetalleFilaEstadoCuenta[] = [];
    const cuotasVencidasAnteriores: DetalleFilaEstadoCuenta[] = [];
    const cuotasFuturas: DetalleFilaEstadoCuenta[] = [];
    const historialPagadas: Cuota[] = [];

    let totalCapitalCiclo = 0;
    let totalInteresCiclo = 0;
    let totalDeudaVencidaAnterior = 0;
    let totalInteresMoratorio = 0;

    for (const c of todasCuotas) {
      if (c.estado === 'Pagada') {
        historialPagadas.push(c);
        continue;
      }

      // Cuota pendiente: analizar según vencimiento
      if (c.fechaVencimiento < fCorteISO) {
        // Vencida en cortes anteriores y no pagada
        const dm = Math.max(0, diasEntreFechas(c.fechaVencimiento, fechaRef));
        const im = calcularInteresMoratorio(c.cuota, cliente.teaMora, dm);
        const total = r2(c.cuota + im);

        totalDeudaVencidaAnterior = r2(totalDeudaVencidaAnterior + c.cuota);
        totalInteresMoratorio = r2(totalInteresMoratorio + im);

        cuotasVencidasAnteriores.push({
          cuotaId: c.id,
          creditoId: c.creditoId,
          numeroCuota: c.numero,
          fechaVencimiento: c.fechaVencimiento,
          saldoInicial: c.saldoInicial,
          amortizacion: c.amortizacion,
          interesCompensatorio: c.interes,
          cuotaBase: c.cuota,
          diasMora: dm,
          interesMoratorio: im,
          totalExigible: total,
          estado: 'Vencida',
        });
      } else if (c.fechaVencimiento <= fPagoISO) {
        // Pertenece a la facturación del ciclo actual
        const dm = Math.max(0, diasEntreFechas(c.fechaVencimiento, fechaRef));
        const im = dm > 0 ? calcularInteresMoratorio(c.cuota, cliente.teaMora, dm) : 0;
        const total = r2(c.cuota + im);

        totalCapitalCiclo = r2(totalCapitalCiclo + c.amortizacion);
        totalInteresCiclo = r2(totalInteresCiclo + c.interes);
        if (dm > 0) {
          totalInteresMoratorio = r2(totalInteresMoratorio + im);
        }

        cuotasCicloActual.push({
          cuotaId: c.id,
          creditoId: c.creditoId,
          numeroCuota: c.numero,
          fechaVencimiento: c.fechaVencimiento,
          saldoInicial: c.saldoInicial,
          amortizacion: c.amortizacion,
          interesCompensatorio: c.interes,
          cuotaBase: c.cuota,
          diasMora: dm,
          interesMoratorio: im,
          totalExigible: total,
          estado: 'Exigible',
        });
      } else {
        // Cuotas futuras
        cuotasFuturas.push({
          cuotaId: c.id,
          creditoId: c.creditoId,
          numeroCuota: c.numero,
          fechaVencimiento: c.fechaVencimiento,
          saldoInicial: c.saldoInicial,
          amortizacion: c.amortizacion,
          interesCompensatorio: c.interes,
          cuotaBase: c.cuota,
          diasMora: 0,
          interesMoratorio: 0,
          totalExigible: c.cuota,
          estado: 'PorVencer',
        });
      }
    }

    // F-6: T = Capital + Interés del ciclo
    const subtotalCiclo = r2(totalCapitalCiclo + totalInteresCiclo);
    const totalExigibleHoy = r2(subtotalCiclo + totalDeudaVencidaAnterior + totalInteresMoratorio);

    return {
      cliente: {
        id: cliente.id,
        nombreCompleto: cliente.nombreCompleto,
        tipoDoc: cliente.tipoDoc,
        numDoc: cliente.numDoc,
        moneda: cliente.moneda,
        limiteCredito: cliente.limiteCredito,
        capitalVigente: cliente.capitalVigente,
        lineaDisponible: r2(cliente.limiteCredito - cliente.capitalVigente),
        diaCorte: cliente.diaCorte,
        diaPago: cliente.diaPago,
        teaCompensatoria: cliente.tasa,
        teaMoratoria: cliente.teaMora,
      },
      ciclo: {
        fechaCorte: fCorteISO,
        fechaPagoOportuno: fPagoISO,
        diasGraciaCiclo: ciclo.diasGracia,
      },
      resumenLiquidacion: {
        totalCapitalCiclo,
        totalInteresCiclo,
        subtotalCiclo,
        totalDeudaVencidaAnterior,
        totalInteresMoratorio,
        totalExigibleHoy,
      },
      cuotasCicloActual,
      cuotasVencidasAnteriores,
      cuotasFuturas,
      historialPagadas,
    };
  }
}
