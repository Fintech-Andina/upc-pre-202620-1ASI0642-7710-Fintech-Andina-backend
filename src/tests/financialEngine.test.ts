import { describe, it, expect } from 'vitest';
import {
  r2,
  convertirATEA,
  convertirTEAATNA,
  calcularTEM,
  calcularTED,
  calcularCapitalCapitalizado,
  calcularCuotaConstante,
  generarCronogramaFrances,
  calcularTCEA,
  calcularTCEAPagoUnico,
  calcularInteresMoratorio,
  validarLimiteCredito,
  liquidarPagoConMora,
  determinarCiclo,
  validarParametrosCliente,
} from '../core/financialEngine.js';

describe('Motor Financiero Puro - Defia Book (Fórmulas F-1 a F-17 y Algoritmos A1 a A8)', () => {
  describe('CASO 1: Crédito con Gracia Total (Informe Oficial)', () => {
    // Parámetros del Caso 1
    const PL = 1500.0;
    const tna = 0.36; // 36%
    const m = 12; // Capitalización mensual
    const n = 6; // 6 cuotas
    const diasGracia = 30; // 1 mes de gracia total
    const primeraFechaPago = '2026-04-15';

    it('F-1 / A1: Convierte TNA 36% cap. mensual a TEA ≈ 42.5761%', () => {
      const tea = convertirATEA('Nominal', tna, m);
      expect(tea).toBeCloseTo(0.425761, 5);
      expect((tea * 100).toFixed(4)).toBe('42.5761');
    });

    it('F-11: Calcula TEM ≈ 3.0000%', () => {
      const tea = convertirATEA('Nominal', tna, m);
      const tem = calcularTEM(tea);
      expect(tem).toBeCloseTo(0.03, 6);
      expect((tem * 100).toFixed(4)).toBe('3.0000');
    });

    it('F-10: Capitaliza saldo durante periodo de gracia P\' = S/ 1,545.00', () => {
      const tea = convertirATEA('Nominal', tna, m);
      const Pcap = calcularCapitalCapitalizado(PL, tea, diasGracia);
      expect(Pcap).toBe(1545.0);
    });

    it('F-12: Determina cuota constante ordinaria FRC R = S/ 285.20', () => {
      const tea = convertirATEA('Nominal', tna, m);
      const Pcap = calcularCapitalCapitalizado(PL, tea, diasGracia);
      const tem = calcularTEM(tea);
      const R = calcularCuotaConstante(Pcap, tem, n);
      expect(R).toBe(285.2);
    });

    it('A4 / F-13: Genera cronograma francés exacto con cuota final de ajuste S/ 285.21 y saldo 0.00', () => {
      const tea = convertirATEA('Nominal', tna, m);
      const resultado = generarCronogramaFrances(PL, tea, diasGracia, n, primeraFechaPago);

      expect(resultado.capitalCapitalizado).toBe(1545.0);
      expect(resultado.filas).toHaveLength(6);

      // Cuota 1
      expect(resultado.filas[0]).toMatchObject({
        k: 1,
        fechaVencimiento: '2026-05-15',
        saldoInicial: 1545.0,
        interes: 46.35,
        amortizacion: 238.85,
        cuota: 285.2,
        saldoFinal: 1306.15,
        tK: 60,
      });

      // Cuota 2
      expect(resultado.filas[1]).toMatchObject({
        k: 2,
        fechaVencimiento: '2026-06-15',
        saldoInicial: 1306.15,
        interes: 39.18,
        amortizacion: 246.02,
        cuota: 285.2,
        saldoFinal: 1060.13,
        tK: 90,
      });

      // Cuota 3
      expect(resultado.filas[2]).toMatchObject({
        k: 3,
        fechaVencimiento: '2026-07-15',
        saldoInicial: 1060.13,
        interes: 31.8,
        amortizacion: 253.4,
        cuota: 285.2,
        saldoFinal: 806.73,
        tK: 120,
      });

      // Cuota 4
      expect(resultado.filas[3]).toMatchObject({
        k: 4,
        fechaVencimiento: '2026-08-15',
        saldoInicial: 806.73,
        interes: 24.2,
        amortizacion: 261.0,
        cuota: 285.2,
        saldoFinal: 545.73,
        tK: 150,
      });

      // Cuota 5
      expect(resultado.filas[4]).toMatchObject({
        k: 5,
        fechaVencimiento: '2026-09-15',
        saldoInicial: 545.73,
        interes: 16.37,
        amortizacion: 268.83,
        cuota: 285.2,
        saldoFinal: 276.9,
        tK: 180,
      });

      // Cuota 6 (Ajuste final por redondeo)
      expect(resultado.filas[5]).toMatchObject({
        k: 6,
        fechaVencimiento: '2026-10-15',
        saldoInicial: 276.9,
        interes: 8.31,
        amortizacion: 276.9,
        cuota: 285.21,
        saldoFinal: 0.0,
        tK: 210,
      });

      // Totales
      expect(resultado.totalPagado).toBe(1711.21);
      expect(resultado.totalAmortizacion).toBe(1545.0);
      expect(resultado.totalInteres).toBe(166.21);

      // TCEA y TREA coinciden exactamente con TEA (diferencia mínima por redondeo)
      expect((resultado.tcea * 100).toFixed(4)).toBe('42.5739');
      expect((resultado.trea * 100).toFixed(4)).toBe('42.5739');
    });
  });

  describe('CASO 2: Crédito con Pago Moratorio (Informe Oficial)', () => {
    // Parámetros del Caso 2
    const PL = 2000.0;
    const tea = 0.2; // 20%
    const n = 4;
    const diasGracia = 0;
    const primeraFechaPago = '2026-05-15';
    const teaMora = 0.36; // 36% TEA moratoria
    const diasMoraCuota2 = 10;

    it('F-11: Calcula TEM ≈ 1.5309%', () => {
      const tem = calcularTEM(tea);
      expect((tem * 100).toFixed(4)).toBe('1.5309');
    });

    it('F-12 & F-13: Genera cronograma con cuotas de US$ 519.28 y final US$ 519.29', () => {
      const resultado = generarCronogramaFrances(PL, tea, diasGracia, n, primeraFechaPago);
      expect(resultado.filas).toHaveLength(4);

      expect(resultado.filas[0]).toMatchObject({
        k: 1,
        fechaVencimiento: '2026-05-15',
        saldoInicial: 2000.0,
        interes: 30.62,
        amortizacion: 488.66,
        cuota: 519.28,
        saldoFinal: 1511.34,
      });

      expect(resultado.filas[1]).toMatchObject({
        k: 2,
        fechaVencimiento: '2026-06-15',
        saldoInicial: 1511.34,
        interes: 23.14,
        amortizacion: 496.14,
        cuota: 519.28,
        saldoFinal: 1015.2,
      });

      expect(resultado.filas[2]).toMatchObject({
        k: 3,
        fechaVencimiento: '2026-07-15',
        saldoInicial: 1015.2,
        interes: 15.54,
        amortizacion: 503.74,
        cuota: 519.28,
        saldoFinal: 511.46,
      });

      expect(resultado.filas[3]).toMatchObject({
        k: 4,
        fechaVencimiento: '2026-08-15',
        saldoInicial: 511.46,
        interes: 7.83,
        amortizacion: 511.46,
        cuota: 519.29,
        saldoFinal: 0.0,
      });

      expect((resultado.tcea * 100).toFixed(4)).toBe('20.0003');
    });

    it('F-8: Calcula interés moratorio exacto de US$ 4.45 para la cuota 2 con 10 días de atraso', () => {
      const cuota2 = 519.28;
      const im = calcularInteresMoratorio(cuota2, teaMora, diasMoraCuota2);
      expect(im).toBe(4.45);
      expect(r2(cuota2 + im)).toBe(523.73);
    });

    it('A7 / F-9: Liquidación con mora y prelación legal estricta de imputación', () => {
      const cuota2 = {
        k: 2,
        fechaVencimiento: '2026-06-15',
        cuota: 519.28,
        interes: 23.14,
        amortizacion: 496.14,
      };

      // Fecha de pago real: 10 días después del vencimiento
      const fPagoReal = '2026-06-25';
      const liquidacion = liquidarPagoConMora([cuota2], fPagoReal, teaMora, 523.73);

      expect(liquidacion.totalExigibleBase).toBe(519.28);
      expect(liquidacion.totalInteresMoratorio).toBe(4.45);
      expect(liquidacion.totalPagar).toBe(523.73);

      // Prelación legal: 1° Mora, 2° Interés Compensatorio, 3° Capital
      expect(liquidacion.filas[0].imputacion).toEqual({
        moratorio: 4.45,
        compensatorio: 23.14,
        capital: 496.14,
      });

      expect(liquidacion.imputacionTotal).toEqual({
        moratorio: 4.45,
        compensatorio: 23.14,
        capital: 496.14,
      });
    });

    it('A7: Rechaza categóricamente pagos parciales', () => {
      const cuota2 = {
        k: 2,
        fechaVencimiento: '2026-06-15',
        cuota: 519.28,
        interes: 23.14,
        amortizacion: 496.14,
      };

      // Intento de pagar solo la cuota base sin la mora (519.28 en vez de 523.73)
      expect(() => {
        liquidarPagoConMora([cuota2], '2026-06-25', teaMora, 519.28);
      }).toThrow(/No se admiten pagos parciales/);
    });
  });

  describe('Validaciones y Fórmulas Complementarias', () => {
    it('F-1: Soporta TNA con capitalización diaria (m = 360)', () => {
      const tna = 0.36;
      const teaDiaria = convertirATEA('Nominal', tna, 360);
      expect(teaDiaria).toBeGreaterThan(0.425761); // Capitalización más frecuente da mayor TEA
      expect((teaDiaria * 100).toFixed(4)).toBe('43.3072');
    });

    it('F-2: Convierte TEA a TNA recíprocamente', () => {
      const tea = 0.4257608868;
      const tna = convertirTEAATNA(tea, 12);
      expect(tna).toBeCloseTo(0.36, 6);
    });

    it('F-3: Calcula TED a partir de TEA', () => {
      const tea = 0.2;
      const ted = calcularTED(tea);
      expect(ted).toBeGreaterThan(0);
      expect((Math.pow(1 + ted, 360) - 1)).toBeCloseTo(tea, 6);
    });

    it('F-16: Solución cerrada para compras a pago único', () => {
      const PL = 1000.0;
      const tea = 0.3;
      const dias = 30;
      const Ic = r2(PL * (Math.pow(1 + tea, dias / 360) - 1));
      const tcea = calcularTCEAPagoUnico(PL, Ic, PL, dias);
      // Al no haber comisiones y Pc = PL, la TCEA coincide con la TEA (diferencia mínima por R2)
      expect(tcea).toBeCloseTo(tea, 3);
    });

    it('F-17: Control de límite de crédito', () => {
      expect(validarLimiteCredito(500, 400, 1000)).toBe(true);
      expect(validarLimiteCredito(500, 500, 1000)).toBe(true);
      expect(validarLimiteCredito(500, 500.01, 1000)).toBe(false);
    });

    it('A2 / F-4: Determinación correcta de ciclo de corte y primera fecha de pago', () => {
      // Compra el día 5, corte día 10, pago día 20 (p > c)
      const ciclo1 = determinarCiclo('2026-05-05', 10, 20, 18);
      expect(ciclo1.corte.getDate()).toBe(10);
      expect(ciclo1.primeraFechaPago.getDate()).toBe(20);
      expect(ciclo1.diasGracia).toBe(15);

      // Compra después del corte (día 15, corte día 10, pago día 5) (p <= c)
      const ciclo2 = determinarCiclo('2026-05-15', 10, 5, 18);
      expect(ciclo2.corte.getMonth()).toBe(5); // Junio (mes siguiente)
      expect(ciclo2.primeraFechaPago.getDate()).toBe(5);
    });

    it('A8: Validación de topes regulatorios y parámetros de cliente', () => {
      const clienteValido = {
        tipoTasa: 'Efectiva' as const,
        tasa: 0.4,
        teaMora: 0.25,
        diaCorte: 15,
        diaPago: 25,
        limite: 3000,
        maxMeses: 12,
        moneda: 'PEN' as const,
      };
      expect(validarParametrosCliente(clienteValido).valido).toBe(true);

      // Tasa que excede tope BCRP
      const clienteUsura = { ...clienteValido, tasa: 1.5 }; // 150% TEA
      expect(validarParametrosCliente(clienteUsura).valido).toBe(false);

      // Día de corte inválido (> 28)
      const clienteDiaInvalido = { ...clienteValido, diaCorte: 31 };
      expect(validarParametrosCliente(clienteDiaInvalido).valido).toBe(false);
    });

    it('A4: En modalidad Cuotas con gracia total (g > 0), cuota k vence en AgregarMeses(F0, k)', () => {
      // Ejemplo del enunciado: compra 15/09, corte 20, pago 26 -> F0 = 26/09 (g = 11) -> Cuota 1 el 26/10
      const cicloEnunciado = determinarCiclo('2026-09-15', 20, 26, 18);
      expect(cicloEnunciado.diasGracia).toBe(11);
      expect(cicloEnunciado.primeraFechaPago.getFullYear()).toBe(2026);
      expect(cicloEnunciado.primeraFechaPago.getMonth()).toBe(8); // Septiembre
      expect(cicloEnunciado.primeraFechaPago.getDate()).toBe(26);

      const cronoEnunciado = generarCronogramaFrances(
        1000,
        0.3,
        cicloEnunciado.diasGracia,
        3,
        cicloEnunciado.primeraFechaPago
      );
      expect(cronoEnunciado.filas[0].fechaVencimiento).toBe('2026-10-26');
      expect(cronoEnunciado.filas[0].tK).toBe(41);
      expect(cronoEnunciado.filas[1].fechaVencimiento).toBe('2026-11-26');
      expect(cronoEnunciado.filas[1].tK).toBe(71);
      expect(cronoEnunciado.filas[2].fechaVencimiento).toBe('2026-12-26');
      expect(cronoEnunciado.filas[2].tK).toBe(101);

      // Caso detectado en vivo: compra 25/11/2026, corte 5, pago 15 -> F0 = 15/12/2026 (g = 20) -> Cuota 1 el 15/01/2027
      const cicloVivo = determinarCiclo('2026-11-25', 5, 15, 18);
      expect(cicloVivo.diasGracia).toBe(20);
      expect(cicloVivo.primeraFechaPago.getFullYear()).toBe(2026);
      expect(cicloVivo.primeraFechaPago.getMonth()).toBe(11); // Diciembre
      expect(cicloVivo.primeraFechaPago.getDate()).toBe(15);

      const cronoVivo = generarCronogramaFrances(
        1200,
        0.3,
        cicloVivo.diasGracia,
        2,
        cicloVivo.primeraFechaPago
      );
      expect(cronoVivo.filas[0].fechaVencimiento).toBe('2027-01-15');
      expect(cronoVivo.filas[0].tK).toBe(50);
      expect(cronoVivo.filas[1].fechaVencimiento).toBe('2027-02-15');
      expect(cronoVivo.filas[1].tK).toBe(80);
    });
  });
});
