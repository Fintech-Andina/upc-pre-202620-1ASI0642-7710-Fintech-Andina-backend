import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import {
  createInMemoryRepositories,
  Repositories,
} from '../infrastructure/inMemoryRepositories.js';
import { seedInitialData } from '../infrastructure/seedData.js';

describe('API RESTful Endpoints - Defia Book Backend', () => {
  let repos: Repositories;
  let app: any;
  let seedIds: {
    tiendaId: string;
    cliente1Id: string;
    cliente2Id: string;
    producto1Id: string;
    producto2Id: string;
  };

  beforeEach(async () => {
    repos = createInMemoryRepositories();
    seedIds = await seedInitialData(repos);
    app = createApp(repos);
  });

  describe('GET /api/health & GET /', () => {
    it('Responde 200 con información de salud del sistema', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.organizacion).toBe('Fintech Andina S.A.C.');
    });

    it('Responde 200 con la documentación de rutas en la raíz', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.nombre).toContain('Defia Book');
      expect(res.body.swaggerUi).toBeDefined();
    });

    it('Sirve la especificación OpenAPI de Swagger en /api/docs.json', async () => {
      const res = await request(app).get('/api/docs.json');
      expect(res.status).toBe(200);
      expect(res.body.openapi).toBe('3.0.3');
      expect(res.body.info.title).toContain('Defia Book');
    });

    it('Sirve la interfaz HTML de Swagger UI en /api/docs/', async () => {
      const res = await request(app).get('/api/docs/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('swagger-ui');
    });
  });

  describe('POST /api/creditos/simular', () => {
    it('Simula exitosamente el CASO 1 (S/ 1,500.00 a 6 cuotas con 30 días de gracia)', async () => {
      const payload = {
        precioLista: 1500.0,
        moneda: 'PEN',
        tipoTasa: 'Nominal',
        tasa: 0.36,
        capitalizacion: 12,
        modalidad: 'Cuotas',
        plazoMeses: 6,
        diasGracia: 30,
        fCompra: '2026-03-15',
        diaCorte: 15,
        diaPago: 25,
      };

      const res = await request(app).post('/api/creditos/simular').send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      const data = res.body.data;

      expect(data.capitalCapitalizado).toBe(1545.0);
      expect(data.cuotaReferencial).toBe(285.2);
      expect(data.totalPagar).toBe(1711.21);
      expect((data.tcea * 100).toFixed(2)).toBe('42.57');
      expect(data.cronograma).toHaveLength(6);
      expect(data.cronograma[0].cuota).toBe(285.2);
      expect(data.cronograma[5].cuota).toBe(285.21);
      expect(data.cronograma[5].saldoFinal).toBe(0.0);
    });

    it('Simula exitosamente el CASO 2 (US$ 2,000.00 a 4 cuotas sin gracia)', async () => {
      const payload = {
        precioLista: 2000.0,
        moneda: 'USD',
        tipoTasa: 'Efectiva',
        tasa: 0.2,
        modalidad: 'Cuotas',
        plazoMeses: 4,
        diasGracia: 0,
        fCompra: '2026-05-15',
        diaCorte: 15,
        diaPago: 15,
      };

      const res = await request(app).post('/api/creditos/simular').send(payload);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.cuotaReferencial).toBe(519.28);
      expect(data.cronograma[0].cuota).toBe(519.28);
      expect(data.cronograma[3].cuota).toBe(519.29);
      expect(data.cronograma[3].saldoFinal).toBe(0.0);
      expect((data.tcea * 100).toFixed(2)).toBe('20.00');
    });

    it('Rechaza simulación con montos o días inválidos', async () => {
      const payloadInvalido = {
        precioLista: -100, // Inválido
        moneda: 'PEN',
        tipoTasa: 'Nominal',
        tasa: 0.36,
        modalidad: 'Cuotas',
        plazoMeses: 6,
        diaCorte: 31, // Inválido (> 28)
        diaPago: 25,
      };

      const res = await request(app).post('/api/creditos/simular').send(payloadInvalido);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/creditos/emitir', () => {
    it('Emite crédito, persiste cronograma y actualiza capital vigente', async () => {
      const payload = {
        clienteId: seedIds.cliente1Id,
        precioLista: 1500.0,
        modalidad: 'Cuotas',
        plazoMeses: 6,
        fCompra: '2026-03-15',
        usuario: 'ASESOR_JUAN',
      };

      const res = await request(app).post('/api/creditos/emitir').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      const data = res.body.data;

      expect(data.credito.precioLista).toBe(1500.0);
      expect(data.cuotas).toHaveLength(6);
      expect(data.nuevoCapitalVigente).toBe(1500.0);
      expect(data.lineaDisponible).toBe(1500.0); // 3000 - 1500

      // Verificar que el cliente en BD se actualizó
      const clienteActual = await repos.clientes.obtenerPorId(seedIds.cliente1Id);
      expect(clienteActual?.capitalVigente).toBe(1500.0);
    });

    it('Rechaza emisión si excede el límite de crédito (F-17)', async () => {
      const payloadExcesivo = {
        clienteId: seedIds.cliente1Id, // Límite S/ 3,000
        precioLista: 3500.0, // Excede límite
        modalidad: 'Cuotas',
        plazoMeses: 6,
      };

      const res = await request(app).post('/api/creditos/emitir').send(payloadExcesivo);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('excede el límite de crédito');
    });

    it('Rechaza emisión con cliente inexistente', async () => {
      const payload = {
        clienteId: 'cliente-inexistente-123',
        precioLista: 500.0,
        modalidad: 'Cuotas',
        plazoMeses: 3,
      };

      const res = await request(app).post('/api/creditos/emitir').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('no encontrado');
    });
  });

  describe('GET /api/clientes & Estado de Cuenta', () => {
    it('Lista todos los clientes registrados', async () => {
      const res = await request(app).get('/api/clientes');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].nombreCompleto).toContain('Carlos Quispe');
    });

    it('Registra nuevo cliente validando topes BCRP', async () => {
      const nuevoCliente = {
        nombreCompleto: 'Rosa Pérez Flores',
        tipoDoc: 'DNI',
        numDoc: '78945612',
        ingresosNetos: 3200.0,
        moneda: 'PEN',
        tipoTasa: 'Efectiva',
        tasa: 0.35,
        teaMora: 0.2,
        diaCorte: 12,
        diaPago: 22,
        limiteCredito: 2000.0,
        maxMeses: 6,
      };

      const res = await request(app).post('/api/clientes').send(nuevoCliente);
      expect(res.status).toBe(201);
      expect(res.body.data.nombreCompleto).toBe('Rosa Pérez Flores');
    });

    it('Genera estado de cuenta consolidado al corte', async () => {
      // Emitir crédito previo
      await request(app).post('/api/creditos/emitir').send({
        clienteId: seedIds.cliente1Id,
        precioLista: 1500.0,
        modalidad: 'Cuotas',
        plazoMeses: 6,
        fCompra: '2026-03-15',
      });

      const res = await request(app)
        .get(`/api/clientes/${seedIds.cliente1Id}/estado-cuenta`)
        .query({ fCorte: '2026-03-15' });

      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data.cliente.nombreCompleto).toContain('Carlos Quispe');
      expect(data.cliente.capitalVigente).toBe(1500.0);
      expect(data.ciclo).toBeDefined();
      expect(data.resumenLiquidacion).toBeDefined();
    });
  });

  describe('POST /api/pagos/liquidar (Cobranza y Mora)', () => {
    it('Liquida cuota con 10 días de mora (Caso 2: IM = US$ 4.45)', async () => {
      // 1. Emitir crédito Caso 2 para Cliente 2 (María Alva)
      const emisionRes = await request(app).post('/api/creditos/emitir').send({
        clienteId: seedIds.cliente2Id,
        precioLista: 2000.0,
        modalidad: 'Cuotas',
        plazoMeses: 4,
        diasGracia: 0,
        fCompra: '2026-05-15',
      });

      const cuotas = emisionRes.body.data.cuotas;
      const cuota2 = cuotas[1]; // Cuota 2
      const fechaVencimientoCuota2 = cuota2.fechaVencimiento; // YYYY-06-10

      // Calcular fecha de pago con 10 días exactos de mora
      const fechaPagoConMora = new Date(fechaVencimientoCuota2);
      fechaPagoConMora.setDate(fechaPagoConMora.getDate() + 10);
      const fPagoISO = fechaPagoConMora.toISOString().split('T')[0];

      // Cuota base US$ 519.28 + Mora US$ 4.45 = US$ 523.73
      const payloadPago = {
        clienteId: seedIds.cliente2Id,
        cuotaIds: [cuota2.id],
        fPago: fPagoISO,
        montoRecibido: 523.73,
        usuario: 'CAJERO_ANA',
      };

      const res = await request(app).post('/api/pagos/liquidar').send(payloadPago);
      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data.pagoRegistrado.totalExigibleBase).toBe(519.28);
      expect(data.pagoRegistrado.totalInteresMoratorio).toBe(4.45);
      expect(data.pagoRegistrado.totalPagado).toBe(523.73);

      // Prelación legal de imputación: 1° Mora, 2° Compensatorio, 3° Capital
      expect(data.imputacionLegal.moratorio).toBe(4.45);
      expect(data.imputacionLegal.compensatorio).toBe(23.14);
      expect(data.imputacionLegal.capital).toBe(496.14);

      // El capital vigente se reduce exactamente por el capital amortizado
      expect(data.nuevoCapitalVigente).toBe(1503.86); // 2000 - 496.14
    });

    it('Rechaza categóricamente pago parcial menor al total exigible', async () => {
      // 1. Emitir crédito Caso 2
      const emisionRes = await request(app).post('/api/creditos/emitir').send({
        clienteId: seedIds.cliente2Id,
        precioLista: 2000.0,
        modalidad: 'Cuotas',
        plazoMeses: 4,
        diasGracia: 0,
        fCompra: '2026-05-15',
      });

      const cuota1 = emisionRes.body.data.cuotas[0];

      // Intentar pagar menos de los US$ 519.28 debidos (ej. US$ 500.00)
      const payloadIncompleto = {
        clienteId: seedIds.cliente2Id,
        cuotaIds: [cuota1.id],
        fPago: cuota1.fechaVencimiento,
        montoRecibido: 500.0, // Insuficiente
      };

      const res = await request(app).post('/api/pagos/liquidar').send(payloadIncompleto);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('No se admiten pagos parciales');
    });
  });

  describe('GET /api/reportes/dashboard', () => {
    it('Devuelve métricas operativas consolidadas y TREA ponderada', async () => {
      // Emitir 1 crédito para que haya actividad
      await request(app).post('/api/creditos/emitir').send({
        clienteId: seedIds.cliente1Id,
        precioLista: 1500.0,
        modalidad: 'Cuotas',
        plazoMeses: 6,
        fCompra: '2026-03-15',
      });

      const res = await request(app).get('/api/reportes/dashboard');

      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data.resumenCartera.totalCapitalColocado).toBe(1500.0);
      expect(data.resumenCartera.carteraVigenteActiva).toBe(1500.0);
      expect(data.resumenCartera.treaPromedioPonderadaPct).toBeGreaterThan(0);
      expect(data.volumenOperativo.totalCreditosEmitidos).toBe(1);
    });
  });
});
