/**
 * Defia Book - Motor Financiero Matemático Puro (Core Domain)
 * Fintech Andina S.A.C.
 *
 * Implementación estricta de las fórmulas F-1 a F-17 y algoritmos A1 a A8
 * basadas en el estándar de 360 días anuales y meses comerciales de 30 días homogéneos.
 */

export type TipoTasa = 'Efectiva' | 'Nominal';
export type Moneda = 'PEN' | 'USD';
export type ModalidadCredito = 'Cuotas' | 'PagoUnico';

export interface ParametrosRegulatorios {
  topeCompensatorioPEN: number;
  topeMoratorioPEN: number;
  topeCompensatorioUSD: number;
  topeMoratorioUSD: number;
}

export const PARAMETROS_REGULATORIOS_DEFECTO: ParametrosRegulatorios = {
  // Tasas máximas referenciales BCRP (expresadas en TEA decimal)
  topeCompensatorioPEN: 1.00, // 100.00% TEA
  topeMoratorioPEN: 0.50,     // 50.00% TEA
  topeCompensatorioUSD: 0.80, // 80.00% TEA
  topeMoratorioUSD: 0.40,     // 40.00% TEA
};

export interface FilaCronograma {
  k: number;
  fechaVencimiento: string; // ISO YYYY-MM-DD
  saldoInicial: number;
  interes: number;
  amortizacion: number;
  cuota: number;
  saldoFinal: number;
  tK: number; // Días transcurridos base 360
}

export interface CronogramaResultado {
  filas: FilaCronograma[];
  capitalCapitalizado: number;
  tem: number;
  cuotaReferencial: number;
  totalInteres: number;
  totalAmortizacion: number;
  totalPagado: number;
  tcea: number;
  trea: number;
}

export interface FilaLiquidacion {
  k: number;
  fechaVencimiento: string;
  cuotaBase: number;
  diasMora: number;
  interesMoratorio: number;
  totalCuotaConMora: number;
  imputacion: {
    moratorio: number;
    compensatorio: number;
    capital: number;
  };
}

export interface LiquidacionResultado {
  filas: FilaLiquidacion[];
  totalExigibleBase: number;
  totalInteresMoratorio: number;
  totalPagar: number;
  imputacionTotal: {
    moratorio: number;
    compensatorio: number;
    capital: number;
  };
}

/**
 * Redondeo formal comercial a 2 decimales (R2).
 * Previene discrepancias de coma flotante IEEE-754 sumando un épsilon ínfimo.
 */
export function r2(valor: number): number {
  return Math.round((valor + 1e-12) * 100) / 100;
}

/**
 * Convierte TNA o TEA a TEA efectiva anual (F-1 / A1).
 * @param tipoTasa 'Efectiva' o 'Nominal'
 * @param valorTasa Tasa en valor decimal (ej. 0.36 para 36%)
 * @param m Número de capitalizaciones por año (12 mensual, 360 diaria)
 */
export function convertirATEA(tipoTasa: TipoTasa, valorTasa: number, m: number = 12): number {
  if (tipoTasa === 'Efectiva') {
    return valorTasa;
  }
  if (m <= 0) {
    throw new Error('El número de capitalizaciones m debe ser mayor a 0');
  }
  // F-1: TEA = (1 + TNA/m)^m - 1
  return Math.pow(1 + valorTasa / m, m) - 1;
}

/**
 * Convierte TEA a TNA (F-2).
 * TNA = m * [(1 + TEA)^(1/m) - 1]
 */
export function convertirTEAATNA(tea: number, m: number = 12): number {
  if (m <= 0) {
    throw new Error('El número de capitalizaciones m debe ser mayor a 0');
  }
  return m * (Math.pow(1 + tea, 1 / m) - 1);
}

/**
 * Tasa efectiva equivalente para d días en base 360 (F-3).
 * i(d) = (1 + TEA)^(d / 360) - 1
 */
export function calcularTasaEfectivaPeriodo(tea: number, d: number): number {
  return Math.pow(1 + tea, d / 360) - 1;
}

/**
 * Tasa Efectiva Mensual comercial (d = 30) (F-11).
 * TEM = (1 + TEA)^(30 / 360) - 1
 */
export function calcularTEM(tea: number): number {
  return calcularTasaEfectivaPeriodo(tea, 30);
}

/**
 * Tasa Efectiva Diaria comercial (d = 1).
 * TED = (1 + TEA)^(1 / 360) - 1
 */
export function calcularTED(tea: number): number {
  return calcularTasaEfectivaPeriodo(tea, 1);
}

/**
 * Convierte un objeto Date o string a representación normalizada YYYY-MM-DD.
 */
export function formatearFechaISO(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parsea una fecha en formato YYYY-MM-DD o Date asegurando hora local pura sin distorsión UTC.
 */
export function parsearFecha(fecha: Date | string): Date {
  if (fecha instanceof Date) {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), fecha.getHours(), fecha.getMinutes(), fecha.getSeconds());
  }
  if (typeof fecha === 'string') {
    // Si contiene 'T', parsear con cuidado
    const partes = fecha.split('T')[0].split('-');
    if (partes.length === 3) {
      const year = parseInt(partes[0], 10);
      const month = parseInt(partes[1], 10) - 1;
      const day = parseInt(partes[2], 10);
      return new Date(year, month, day, 12, 0, 0);
    }
    return new Date(fecha);
  }
  return new Date();
}

/**
 * Días calendario exactos transcurridos entre dos fechas.
 */
export function diasEntreFechas(fechaInicio: Date | string, fechaFin: Date | string): number {
  const d1 = parsearFecha(fechaInicio);
  const d2 = parsearFecha(fechaFin);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  const diffMs = d2.getTime() - d1.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Agrega meses a una fecha manteniendo el día fijo (ej. para vencimientos mensuales sucesivos).
 */
export function agregarMeses(fechaBase: Date, meses: number, diaFijo?: number): Date {
  const d = new Date(fechaBase.getFullYear(), fechaBase.getMonth() + meses, 1);
  const targetDay = diaFijo ?? fechaBase.getDate();
  const maxDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(targetDay, maxDays));
  return d;
}

/**
 * Algoritmo de Determinación del ciclo de corte y de la primera fecha de pago (A2 / F-4).
 * @param fCompra Fecha en que se efectúa la compra
 * @param c Día de corte mensual (1 a 28)
 * @param p Día de pago mensual (1 a 28)
 * @param horaCorte Hora de cierre de operaciones del día de corte (defecto: 18)
 */
export function determinarCiclo(
  fCompra: Date | string,
  c: number,
  p: number,
  horaCorte: number = 18
): { corte: Date; primeraFechaPago: Date; diasGracia: number } {
  if (c < 1 || c > 28) {
    throw new Error('El día de corte c debe estar entre 1 y 28');
  }
  if (p < 1 || p > 28) {
    throw new Error('El día de pago p debe estar entre 1 y 28');
  }

  const fc = parsearFecha(fCompra);
  const diaCompra = fc.getDate();
  const horaCompra = fc.getHours();

  const esAnterior = diaCompra < c || (diaCompra === c && horaCompra <= horaCorte);

  let anioCorte = fc.getFullYear();
  let mesCorte = fc.getMonth(); // 0-indexed

  if (!esAnterior) {
    mesCorte += 1;
    if (mesCorte > 11) {
      mesCorte = 0;
      anioCorte += 1;
    }
  }

  const C = new Date(anioCorte, mesCorte, c);

  let anioPago = anioCorte;
  let mesPago = mesCorte;

  if (p > c) {
    // F0 es el día p del mes de C
    mesPago = mesCorte;
  } else {
    // F0 es el día p del mes siguiente a C
    mesPago = mesCorte + 1;
    if (mesPago > 11) {
      mesPago = 0;
      anioPago += 1;
    }
  }

  const F0 = new Date(anioPago, mesPago, p);

  // F-4: g = F0 - fc (días transcurridos)
  const g = Math.max(0, diasEntreFechas(fc, F0));

  return {
    corte: C,
    primeraFechaPago: F0,
    diasGracia: g,
  };
}

/**
 * Interés compensatorio para compras a pago único diferidas d días (F-5).
 * Ic = PL * [(1 + TEA)^(d / 360) - 1]
 */
export function calcularInteresCompensatorio(PL: number, tea: number, dias: number): number {
  return r2(PL * (Math.pow(1 + tea, dias / 360) - 1));
}

/**
 * Capital capitalizado por efecto del periodo de gracia total (F-10).
 * P' = PL * (1 + TEA)^(g / 360)
 */
export function calcularCapitalCapitalizado(PL: number, tea: number, diasGracia: number): number {
  if (diasGracia === 0) {
    return r2(PL);
  }
  return r2(PL * Math.pow(1 + tea, diasGracia / 360));
}

/**
 * Cuota fija ordinaria mediante Factor de Recuperación de Capital (FRC) (F-12).
 * R = P' * [TEM / (1 - (1 + TEM)^(-n))]
 */
export function calcularCuotaConstante(Pcap: number, tem: number, n: number): number {
  if (n <= 0) {
    throw new Error('El número de cuotas n debe ser mayor a 0');
  }
  if (tem === 0) {
    return r2(Pcap / n);
  }
  const factor = (tem * Math.pow(1 + tem, n)) / (Math.pow(1 + tem, n) - 1);
  return r2(Pcap * factor);
}

/**
 * Algoritmo de Cronograma por método francés vencido con gracia total (A4 / F-10, F-11, F-12, F-13, F-14).
 *
 * @param PL Precio de lista (capital nominal desembolsado)
 * @param tea Tasa Efectiva Anual pactada (decimal)
 * @param diasGracia Días del periodo de gracia total g
 * @param n Número de cuotas mensuales
 * @param primeraFechaPago Fecha base F0 para los vencimientos mensuales
 * @param Pc Precio de contado (para cálculo de TCEA). Si no se provee, Pc = PL.
 */
export function generarCronogramaFrances(
  PL: number,
  tea: number,
  diasGracia: number,
  n: number,
  primeraFechaPago: Date | string,
  Pc?: number
): CronogramaResultado {
  if (PL <= 0) {
    throw new Error('El precio de lista (PL) debe ser mayor a 0');
  }
  if (n <= 0) {
    throw new Error('El número de cuotas n debe ser mayor a 0');
  }

  const precioContado = Pc ?? PL;
  const Pcap = calcularCapitalCapitalizado(PL, tea, diasGracia); // F-10
  const tem = calcularTEM(tea); // F-11
  const R = calcularCuotaConstante(Pcap, tem, n); // F-12

  const f0Date = parsearFecha(primeraFechaPago);
  const diaPago = f0Date.getDate();

  const filas: FilaCronograma[] = [];
  let saldo = Pcap;

  let totalInteres = 0;
  let totalAmortizacion = 0;
  let totalPagado = 0;

  for (let k = 1; k <= n; k++) {
    // F-13: Interés del periodo
    const interes = r2(saldo * tem);
    let amort: number;
    let cuotaK: number;

    if (k < n) {
      amort = r2(R - interes);
      cuotaK = R;
    } else {
      // Regla de cierre en cuota final: absorción residual forzando Sn = 0.00
      amort = saldo;
      cuotaK = r2(interes + amort);
    }

    const saldoFin = r2(saldo - amort);

    // F-14: tk = g + 30 * k
    const tK = diasGracia + 30 * k;

    // En modalidad Cuotas con gracia total (g > 0), F0 marca el fin de la gracia total (periodo 0),
    // por lo que la cuota k (tK = g + 30*k) vence k meses después de F0: AgregarMeses(F0, k).
    // Cuando g === 0, F0 ya corresponde al vencimiento del primer mes (k = 1): AgregarMeses(F0, k - 1).
    const mesesOffset = diasGracia > 0 ? k : k - 1;
    const fechaK = agregarMeses(f0Date, mesesOffset, diaPago);

    filas.push({
      k,
      fechaVencimiento: formatearFechaISO(fechaK),
      saldoInicial: saldo,
      interes,
      amortizacion: amort,
      cuota: cuotaK,
      saldoFinal: Math.max(0, saldoFin),
      tK,
    });

    totalInteres = r2(totalInteres + interes);
    totalAmortizacion = r2(totalAmortizacion + amort);
    totalPagado = r2(totalPagado + cuotaK);

    saldo = saldoFin;
  }

  // A5: TCEA mediante bisección sobre el flujo descontado
  const cuotasArray = filas.map((f) => f.cuota);
  const tiemposArray = filas.map((f) => f.tK);
  const tcea = calcularTCEA(precioContado, cuotasArray, tiemposArray);

  return {
    filas,
    capitalCapitalizado: Pcap,
    tem,
    cuotaReferencial: R,
    totalInteres,
    totalAmortizacion,
    totalPagado,
    tcea,
    trea: tcea, // En ausencia de gastos/comisiones de terceros, TREA = TCEA
  };
}

/**
 * Algoritmo de Cálculo de la TCEA / TREA por bisección numérica (A5 / F-15).
 * Resuelve la ecuación de Valor Actual Neto en 60 iteraciones sobre [0, 10] (0% a 1000%).
 *
 * -P_c + sum(R_k / (1 + r)^(t_k / 360)) = 0
 */
export function calcularTCEA(
  desembolso: number,
  cuotas: number[],
  tiempos: number[],
  maxIter: number = 60
): number {
  if (desembolso <= 0) {
    throw new Error('El desembolso debe ser positivo');
  }
  if (cuotas.length === 0 || cuotas.length !== tiempos.length) {
    throw new Error('Las listas de cuotas y tiempos deben tener la misma longitud y no estar vacías');
  }

  let inf = 0.0;
  let sup = 10.0; // Rango de 0% a 1000% anual

  for (let i = 0; i < maxIter; i++) {
    const medio = (inf + sup) / 2;
    let van = -desembolso;

    for (let k = 0; k < cuotas.length; k++) {
      van += cuotas[k] / Math.pow(1 + medio, tiempos[k] / 360);
    }

    if (van > 0) {
      inf = medio;
    } else {
      sup = medio;
    }
  }

  return (inf + sup) / 2;
}

/**
 * Solución cerrada de TCEA para operaciones a pago único (F-16).
 * TCEA = ((PL + Ic) / Pc)^(360 / g) - 1
 */
export function calcularTCEAPagoUnico(PL: number, Ic: number, Pc: number, diasGracia: number): number {
  if (diasGracia <= 0) {
    throw new Error('Los días de gracia deben ser mayores a 0 para el cálculo de TCEA');
  }
  if (Pc <= 0) {
    throw new Error('El precio de contado Pc debe ser mayor a 0');
  }
  return Math.pow((PL + Ic) / Pc, 360 / diasGracia) - 1;
}

/**
 * Control del límite de crédito (F-17).
 * Kv + PL <= L
 */
export function validarLimiteCredito(capitalVigente: number, nuevoPL: number, limiteCredito: number): boolean {
  return r2(capitalVigente + nuevoPL) <= r2(limiteCredito);
}

/**
 * Interés Moratorio sobre deuda exigible sin capitalizar (F-8).
 * IM = T * [(1 + TEAm)^(dm / 360) - 1]
 */
export function calcularInteresMoratorio(montoExigible: number, teaMora: number, diasMora: number): number {
  if (diasMora <= 0 || teaMora <= 0) {
    return 0.0;
  }
  return r2(montoExigible * (Math.pow(1 + teaMora, diasMora / 360) - 1));
}

/**
 * Algoritmo de Registro de pago con mora e imputación legal (A7 / F-7, F-8, F-9).
 * - Rechaza pagos parciales (montoRecibido < totalExigible)
 * - Imputación en prelación legal estricta: 1° Mora, 2° Interés Compensatorio, 3° Capital.
 */
export function liquidarPagoConMora(
  cuotasExigibles: Array<{
    k: number;
    fechaVencimiento: Date | string;
    cuota: number;
    interes: number;
    amortizacion: number;
  }>,
  fPago: Date | string,
  teaMora: number,
  montoRecibido?: number
): LiquidacionResultado {
  const fp = parsearFecha(fPago);
  const filas: FilaLiquidacion[] = [];

  let totalExigibleBase = 0;
  let totalInteresMoratorio = 0;
  let totalMoratorioImputado = 0;
  let totalCompensatorioImputado = 0;
  let totalCapitalImputado = 0;

  for (const c of cuotasExigibles) {
    // F-7: dm = MAX(0, diasEntre(fechaVencimiento, fPago))
    const dm = Math.max(0, diasEntreFechas(c.fechaVencimiento, fp));
    // F-8: IM = cuota * [(1 + teaMora)^(dm / 360) - 1]
    const im = calcularInteresMoratorio(c.cuota, teaMora, dm);
    const cuotaConMora = r2(c.cuota + im);

    // Prelación legal de imputación por cuota
    const moratorio = im;
    const compensatorio = c.interes;
    const capital = c.amortizacion;

    filas.push({
      k: c.k,
      fechaVencimiento: typeof c.fechaVencimiento === 'string' ? c.fechaVencimiento : formatearFechaISO(c.fechaVencimiento),
      cuotaBase: c.cuota,
      diasMora: dm,
      interesMoratorio: im,
      totalCuotaConMora: cuotaConMora,
      imputacion: {
        moratorio,
        compensatorio,
        capital,
      },
    });

    totalExigibleBase = r2(totalExigibleBase + c.cuota);
    totalInteresMoratorio = r2(totalInteresMoratorio + im);
    totalMoratorioImputado = r2(totalMoratorioImputado + moratorio);
    totalCompensatorioImputado = r2(totalCompensatorioImputado + compensatorio);
    totalCapitalImputado = r2(totalCapitalImputado + capital);
  }

  // F-9: Total = T + IM
  const totalPagar = r2(totalExigibleBase + totalInteresMoratorio);

  if (montoRecibido !== undefined) {
    if (r2(montoRecibido) < totalPagar) {
      throw new Error(`No se admiten pagos parciales. Monto requerido: ${totalPagar.toFixed(2)}, monto recibido: ${montoRecibido.toFixed(2)}`);
    }
  }

  return {
    filas,
    totalExigibleBase,
    totalInteresMoratorio,
    totalPagar,
    imputacionTotal: {
      moratorio: totalMoratorioImputado,
      compensatorio: totalCompensatorioImputado,
      capital: totalCapitalImputado,
    },
  };
}

/**
 * Algoritmo de Validación de condiciones pactadas del cliente (A8).
 */
export function validarParametrosCliente(
  cliente: {
    tipoTasa: TipoTasa;
    tasa: number;
    capitalizacion?: number;
    teaMora: number;
    diaCorte: number;
    diaPago: number;
    limite?: number;
    limiteCredito?: number;
    maxMeses: number;
    moneda: Moneda;
  },
  parametros: ParametrosRegulatorios = PARAMETROS_REGULATORIOS_DEFECTO
): { valido: boolean; motivo?: string } {
  const tea = convertirATEA(cliente.tipoTasa, cliente.tasa, cliente.capitalizacion ?? 12);

  const topeCompensatorio =
    cliente.moneda === 'PEN' ? parametros.topeCompensatorioPEN : parametros.topeCompensatorioUSD;
  const topeMoratorio =
    cliente.moneda === 'PEN' ? parametros.topeMoratorioPEN : parametros.topeMoratorioUSD;

  if (tea > topeCompensatorio) {
    return { valido: false, motivo: `TEA compensatoria ${(tea * 100).toFixed(4)}% excede el tope BCRP de ${(topeCompensatorio * 100).toFixed(2)}%` };
  }
  if (cliente.teaMora > topeMoratorio) {
    return { valido: false, motivo: `TEA moratoria ${(cliente.teaMora * 100).toFixed(4)}% excede el tope BCRP de ${(topeMoratorio * 100).toFixed(2)}%` };
  }
  if (cliente.diaCorte < 1 || cliente.diaCorte > 28) {
    return { valido: false, motivo: 'Día de corte debe estar entre 1 y 28' };
  }
  if (cliente.diaPago < 1 || cliente.diaPago > 28) {
    return { valido: false, motivo: 'Día de pago debe estar entre 1 y 28' };
  }
  const lim = cliente.limite ?? cliente.limiteCredito ?? 0;
  if (lim <= 0) {
    return { valido: false, motivo: 'El límite de crédito debe ser mayor a 0' };
  }
  if (cliente.maxMeses < 1) {
    return { valido: false, motivo: 'El plazo máximo en meses debe ser al menos 1' };
  }

  return { valido: true };
}
