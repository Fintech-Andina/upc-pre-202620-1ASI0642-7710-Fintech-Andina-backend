import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { r2, formatearFechaISO } from '../core/financialEngine.js';

export interface DashboardReporteOutput {
  resumenCartera: {
    totalCapitalColocado: number;
    carteraVigenteActiva: number;
    carteraVencidaEnMora: number;
    ratioMorosidadPct: number;
    treaPromedioPonderadaPct: number;
  };
  recaudacion: {
    totalRecaudado: number;
    totalCapitalRecuperado: number;
    totalInteresCompensatorioRecaudado: number;
    totalInteresMoratorioRecaudado: number;
  };
  volumenOperativo: {
    totalClientes: number;
    totalCreditosEmitidos: number;
    totalCreditosActivos: number;
    totalCuotasEmitidas: number;
    totalCuotasPagadas: number;
  };
}

export class DashboardReporteService {
  constructor(private repos: Repositories) {}

  async ejecutar(tiendaId?: string): Promise<DashboardReporteOutput> {
    const clientes = await this.repos.clientes.listarTodos(tiendaId);
    const creditos = await this.repos.creditos.listarTodos(tiendaId);
    const pagos = await this.repos.pagos.listarTodos(tiendaId);

    const hoyISO = formatearFechaISO(new Date());

    // 1. Capital colocado y TREA ponderada
    let totalCapitalColocado = 0;
    let sumaTreaPonderada = 0;
    let totalCreditosActivos = 0;

    for (const c of creditos) {
      totalCapitalColocado = r2(totalCapitalColocado + c.precioLista);
      sumaTreaPonderada += c.trea * c.precioLista;
      if (c.estado === 'Activo') {
        totalCreditosActivos++;
      }
    }

    const treaPromedioPonderadaPct =
      totalCapitalColocado > 0 ? r2((sumaTreaPonderada / totalCapitalColocado) * 100) : 0;

    // 2. Cartera vigente
    let carteraVigenteActiva = 0;
    for (const cl of clientes) {
      carteraVigenteActiva = r2(carteraVigenteActiva + cl.capitalVigente);
    }

    // 3. Cartera vencida en mora
    let carteraVencidaEnMora = 0;
    let totalCuotasEmitidas = 0;
    let totalCuotasPagadas = 0;

    for (const cl of clientes) {
      const cuotas = await this.repos.cuotas.listarPorCliente(cl.id);
      for (const cu of cuotas) {
        totalCuotasEmitidas++;
        if (cu.estado === 'Pagada') {
          totalCuotasPagadas++;
        } else if (cu.fechaVencimiento < hoyISO) {
          carteraVencidaEnMora = r2(carteraVencidaEnMora + cu.cuota);
        }
      }
    }

    const ratioMorosidadPct =
      carteraVigenteActiva > 0
        ? r2((carteraVencidaEnMora / carteraVigenteActiva) * 100)
        : 0;

    // 4. Recaudación
    let totalRecaudado = 0;
    let totalCapitalRecuperado = 0;
    let totalInteresCompensatorioRecaudado = 0;
    let totalInteresMoratorioRecaudado = 0;

    const clienteIdsSet = new Set(clientes.map((c) => c.id));
    for (const p of pagos) {
      if (tiendaId && !clienteIdsSet.has(p.clienteId)) {
        continue;
      }
      totalRecaudado = r2(totalRecaudado + p.montoPagado);
      totalCapitalRecuperado = r2(totalCapitalRecuperado + p.amortizacionCapital);
      totalInteresCompensatorioRecaudado = r2(
        totalInteresCompensatorioRecaudado + p.interesCompensatorio
      );
      totalInteresMoratorioRecaudado = r2(
        totalInteresMoratorioRecaudado + p.interesMoratorio
      );
    }

    return {
      resumenCartera: {
        totalCapitalColocado,
        carteraVigenteActiva,
        carteraVencidaEnMora,
        ratioMorosidadPct,
        treaPromedioPonderadaPct,
      },
      recaudacion: {
        totalRecaudado,
        totalCapitalRecuperado,
        totalInteresCompensatorioRecaudado,
        totalInteresMoratorioRecaudado,
      },
      volumenOperativo: {
        totalClientes: clientes.length,
        totalCreditosEmitidos: creditos.length,
        totalCreditosActivos,
        totalCuotasEmitidas,
        totalCuotasPagadas,
      },
    };
  }
}
