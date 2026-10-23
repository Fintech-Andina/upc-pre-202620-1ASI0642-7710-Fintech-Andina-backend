import {
  Moneda,
  TipoTasa,
  ModalidadCredito,
  convertirATEA,
  determinarCiclo,
  calcularTEM,
  generarCronogramaFrances,
  calcularTCEAPagoUnico,
  r2,
  formatearFechaISO,
  parsearFecha,
  FilaCronograma,
} from '../core/financialEngine.js';

export interface SimularCreditoInput {
  precioLista: number;
  precioContado?: number;
  moneda: Moneda;
  tipoTasa: TipoTasa;
  tasa: number; // Decimal (ej. 0.36 para 36%)
  capitalizacion?: number; // 12 mensual, 360 diaria
  modalidad: ModalidadCredito;
  plazoMeses: number; // n
  diasGracia?: number;
  fCompra?: string | Date;
  diaCorte: number;
  diaPago: number;
  horaCorte?: number;
}

export interface SimularCreditoOutput {
  precioLista: number;
  precioContado: number;
  moneda: Moneda;
  modalidad: ModalidadCredito;
  tea: number;
  tem: number;
  diasGracia: number;
  fechaCorte: string;
  primeraFechaPago: string;
  capitalCapitalizado: number;
  cuotaReferencial: number;
  totalInteres: number;
  totalAmortizacion: number;
  totalPagar: number;
  tcea: number;
  trea: number;
  cronograma: FilaCronograma[];
}

export class SimularCreditoService {
  ejecutar(input: SimularCreditoInput): SimularCreditoOutput {
    if (input.precioLista <= 0) {
      throw new Error('El precio de lista debe ser mayor a 0');
    }
    if (input.diaCorte < 1 || input.diaCorte > 28) {
      throw new Error('El día de corte debe estar entre 1 y 28');
    }
    if (input.diaPago < 1 || input.diaPago > 28) {
      throw new Error('El día de pago debe estar entre 1 y 28');
    }
    if (input.plazoMeses < 1) {
      throw new Error('El plazo de meses debe ser al menos 1');
    }

    const Pc = input.precioContado ?? input.precioLista;
    const fCompraDate = input.fCompra ? parsearFecha(input.fCompra) : new Date();

    // F-1 / A1: Convertir a TEA
    const tea = convertirATEA(input.tipoTasa, input.tasa, input.capitalizacion ?? 12);
    const tem = calcularTEM(tea);

    // A2 / F-4: Determinar ciclo de facturación y gracia
    const ciclo = determinarCiclo(
      fCompraDate,
      input.diaCorte,
      input.diaPago,
      input.horaCorte ?? 18
    );

    const fCorteStr = formatearFechaISO(ciclo.corte);
    const f0Str = formatearFechaISO(ciclo.primeraFechaPago);
    const g = input.diasGracia !== undefined ? input.diasGracia : ciclo.diasGracia;

    if (input.modalidad === 'PagoUnico') {
      // F-5: Interés compensatorio diferido
      const Ic = r2(input.precioLista * (Math.pow(1 + tea, g / 360) - 1));
      const totalPagar = r2(input.precioLista + Ic);
      const tcea = g > 0 ? calcularTCEAPagoUnico(input.precioLista, Ic, Pc, g) : tea;

      const fila: FilaCronograma = {
        k: 1,
        fechaVencimiento: f0Str,
        saldoInicial: input.precioLista,
        interes: Ic,
        amortizacion: input.precioLista,
        cuota: totalPagar,
        saldoFinal: 0.0,
        tK: g,
      };

      return {
        precioLista: input.precioLista,
        precioContado: Pc,
        moneda: input.moneda,
        modalidad: input.modalidad,
        tea,
        tem,
        diasGracia: g,
        fechaCorte: fCorteStr,
        primeraFechaPago: f0Str,
        capitalCapitalizado: input.precioLista,
        cuotaReferencial: totalPagar,
        totalInteres: Ic,
        totalAmortizacion: input.precioLista,
        totalPagar,
        tcea,
        trea: tcea,
        cronograma: [fila],
      };
    }

    // Modalidad Cuotas: Método Francés Vencido con Gracia Total (A4)
    const resultado = generarCronogramaFrances(
      input.precioLista,
      tea,
      g,
      input.plazoMeses,
      ciclo.primeraFechaPago,
      Pc
    );

    return {
      precioLista: input.precioLista,
      precioContado: Pc,
      moneda: input.moneda,
      modalidad: input.modalidad,
      tea,
      tem: resultado.tem,
      diasGracia: g,
      fechaCorte: fCorteStr,
      primeraFechaPago: f0Str,
      capitalCapitalizado: resultado.capitalCapitalizado,
      cuotaReferencial: resultado.cuotaReferencial,
      totalInteres: resultado.totalInteres,
      totalAmortizacion: resultado.totalAmortizacion,
      totalPagar: resultado.totalPagado,
      tcea: resultado.tcea,
      trea: resultado.trea,
      cronograma: resultado.filas,
    };
  }
}
