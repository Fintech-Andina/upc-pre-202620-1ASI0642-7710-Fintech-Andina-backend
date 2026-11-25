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

  describe('Autenticación JWT, 3 Roles (ADMIN_SISTEMA, ADMIN_NEGOCIO, CLIENTE) y Aislamiento Multi-Tienda', () => {
    it('Registra y autentica una tienda (ADMIN_NEGOCIO) y registra el login en Bitácora', async () => {
      const regRes = await request(app).post('/api/auth/register').send({
        ruc: '20609998887',
        razonSocial: 'Bodega El Vecino E.I.R.L.',
        nombreComercial: 'Bodega El Vecino',
        direccion: 'Jr. Las Magnolias 245, Surco',
        email: 'donlucho@bodegaelvecino.pe',
        password: '12345678',
      });

      expect(regRes.status).toBe(201);
      expect(regRes.body.data.token).toBeDefined();
      expect(regRes.body.data.rol).toBe('ADMIN_NEGOCIO');

      const loginRes = await request(app).post('/api/auth/login').send({
        email: 'donlucho@bodegaelvecino.pe',
        password: '12345678',
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.token).toBeDefined();

      const bitacora = await repos.bitacora.listar();
      expect(bitacora.some((b) => b.accion === 'LOGIN')).toBe(true);
    });

    it('Permite a ADMIN_SISTEMA activar/desactivar tiendas (PATCH /api/tiendas/:id/estado) y bloquea a ADMIN_NEGOCIO', async () => {
      const adminRes = await request(app).post('/api/auth/register').send({
        ruc: '20600000001',
        razonSocial: 'Fintech Andina S.A.C.',
        nombreComercial: 'Fintech Andina Admin',
        direccion: 'Av. Javier Prado 456',
        email: 'admin@fintechandina.pe',
        password: '12345678',
        rol: 'ADMIN_SISTEMA',
      });
      const adminToken = adminRes.body.data.token;

      const tiendaRes = await request(app).post('/api/auth/register').send({
        ruc: '20601112223',
        razonSocial: 'Minimarket Sur E.I.R.L.',
        nombreComercial: 'Minimarket Sur',
        direccion: 'Av. Surco 100',
        email: 'sur@minimarket.pe',
        password: '12345678',
      });
      const tiendaToken = tiendaRes.body.data.token;
      const tiendaId = tiendaRes.body.data.tienda.id;

      // Intento con ADMIN_NEGOCIO -> 403
      const forbiddenRes = await request(app)
        .patch(`/api/tiendas/${tiendaId}/estado`)
        .set('Authorization', `Bearer ${tiendaToken}`)
        .send({ estado: 'INACTIVO' });
      expect(forbiddenRes.status).toBe(403);

      // Con ADMIN_SISTEMA -> 200
      const patchRes = await request(app)
        .patch(`/api/tiendas/${tiendaId}/estado`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ estado: 'INACTIVO' });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.estado).toBe('INACTIVO');

      // Tienda inactiva no puede iniciar sesión
      const loginInactivo = await request(app).post('/api/auth/login').send({
        email: 'sur@minimarket.pe',
        password: '12345678',
      });
      expect(loginInactivo.status).toBe(403);
    });

    it('Permite login de CLIENTE y restringe consulta de estado de cuenta solo a su propio ID', async () => {
      // Crear cliente con credenciales
      const crearRes = await request(app).post('/api/clientes').send({
        nombreCompleto: 'Vecino Con Acceso',
        email: 'vecino@correo.pe',
        password: '12345678',
        tipoDoc: 'DNI',
        numDoc: '87654321',
        ingresosNetos: 2500,
        moneda: 'PEN',
        tipoTasa: 'Efectiva',
        tasa: 0.3,
        teaMora: 0.2,
        diaCorte: 15,
        diaPago: 25,
        limiteCredito: 1500,
        maxMeses: 6,
      });
      expect(crearRes.status).toBe(201);
      const clienteId = crearRes.body.data.id;

      const loginCli = await request(app).post('/api/auth/login-cliente').send({
        email: 'vecino@correo.pe',
        password: '12345678',
      });
      expect(loginCli.status).toBe(200);
      const cliToken = loginCli.body.data.token;

      // Puede ver su propio estado de cuenta
      const propioRes = await request(app)
        .get(`/api/clientes/${clienteId}/estado-cuenta`)
        .set('Authorization', `Bearer ${cliToken}`);
      expect(propioRes.status).toBe(200);

      // No puede ver el estado de cuenta de otro vecino
      const ajenoRes = await request(app)
        .get(`/api/clientes/${seedIds.cliente1Id}/estado-cuenta`)
        .set('Authorization', `Bearer ${cliToken}`);
      expect(ajenoRes.status).toBe(403);
    });

    it('Aísla clientes por tienda (Multi-Tenant) permitiendo el mismo DNI en dos tiendas distintas', async () => {
      const t1 = await request(app).post('/api/auth/register').send({
        ruc: '20603334441',
        direccion: 'Calle 1',
        nombre: 'Tienda A',
        email: 'tiendaa@test.pe',
        password: '12345678',
      });
      const t2 = await request(app).post('/api/auth/register').send({
        ruc: '20603334442',
        direccion: 'Calle 2',
        nombre: 'Tienda B',
        email: 'tiendab@test.pe',
        password: '12345678',
      });

      const tokenA = t1.body.data.token;
      const tokenB = t2.body.data.token;

      const payloadVecino = {
        nombreCompleto: 'Vecino Compartido',
        tipoDoc: 'DNI',
        numDoc: '44556677',
        ingresosNetos: 3000,
        moneda: 'PEN',
        tipoTasa: 'Efectiva',
        tasa: 0.25,
        teaMora: 0.15,
        diaCorte: 10,
        diaPago: 20,
        limiteCredito: 1000,
        maxMeses: 6,
      };

      const resA = await request(app)
        .post('/api/clientes')
        .set('Authorization', `Bearer ${tokenA}`)
        .send(payloadVecino);
      expect(resA.status).toBe(201);

      const resB = await request(app)
        .post('/api/clientes')
        .set('Authorization', `Bearer ${tokenB}`)
        .send(payloadVecino);
      expect(resB.status).toBe(201);

      // Al listar con tokenB solo ve los clientes de Tienda B (o sin tiendaId global)
      const listB = await request(app)
        .get('/api/clientes')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(listB.status).toBe(200);
      expect(listB.body.data.some((c: any) => c.id === resA.body.data.id)).toBe(false);
      expect(listB.body.data.some((c: any) => c.id === resB.body.data.id)).toBe(true);
    });
  });

  describe('Endpoints Opción A: CRUD Productos, Clientes, Configuración, Previsualización Mora y Aislamiento CLIENTE', () => {
    it('Crea, edita y cambia estado de productos con proveedor y auditoría en Bitacora', async () => {
      const regRes = await request(app).post('/api/auth/register').send({
        ruc: '20609998881',
        razonSocial: 'Bodega Prueba E.I.R.L.',
        nombreComercial: 'Bodega Prueba',
        direccion: 'Av. Central 123',
        email: 'tienda.prod@test.pe',
        password: '12345678',
      });
      const token = regRes.body.data.token;

      const createRes = await request(app)
        .post('/api/productos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          sku: 'SKU-TEST-01',
          nombre: 'Refrigeradora Frost 250L',
          marca: 'Samsung',
          proveedor: 'Distribuidora Lima Sur S.A.C.',
          descripcion: 'Electrodoméstico hogar',
          unidadMedida: 'UNIDAD',
          imagenUrl: 'https://example.com/refri.png',
          precioContado: 1100,
          precioLista: 1200,
          permitePagoUnico: true,
          permiteCuotas: true,
        });
      expect(createRes.status).toBe(201);
      expect(createRes.body.data.proveedor).toBe('Distribuidora Lima Sur S.A.C.');
      const prodId = createRes.body.data.id;

      const editRes = await request(app)
        .put(`/api/productos/${prodId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          precioLista: 1250,
          proveedor: 'Importadora Andina',
        });
      expect(editRes.status).toBe(200);
      expect(editRes.body.data.precioLista).toBe(1250);
      expect(editRes.body.data.proveedor).toBe('Importadora Andina');

      const stateRes = await request(app)
        .patch(`/api/productos/${prodId}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });
      expect(stateRes.status).toBe(200);
      expect(stateRes.body.data.activo).toBe(false);

      const bitacora = await repos.bitacora.listar(regRes.body.data.tienda.id);
      expect(bitacora.some((b) => b.accion === 'CREAR_PRODUCTO' && b.idEntidad === prodId)).toBe(true);
      expect(bitacora.some((b) => b.accion === 'EDITAR_PRODUCTO' && b.idEntidad === prodId)).toBe(true);
      expect(bitacora.some((b) => b.accion === 'CAMBIO_ESTADO_PRODUCTO' && b.idEntidad === prodId)).toBe(true);
    });

    it('Edita y cambia estado de clientes validando topes BCRP y registrando en Bitacora', async () => {
      const regRes = await request(app).post('/api/auth/register').send({
        ruc: '20609998882',
        direccion: 'Av. Test 222',
        nombreComercial: 'Bodega Clientes',
        email: 'tienda.cli@test.pe',
        password: '12345678',
      });
      const token = regRes.body.data.token;

      const cliRes = await request(app)
        .post('/api/clientes')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombreCompleto: 'Luis Ramos Vega',
          tipoDoc: 'DNI',
          numDoc: '40506070',
          ingresosNetos: 2400,
          moneda: 'PEN',
          tipoTasa: 'Efectiva',
          tasa: 0.3,
          teaMora: 0.2,
          diaCorte: 15,
          diaPago: 25,
          limiteCredito: 1800,
          maxMeses: 6,
        });
      expect(cliRes.status).toBe(201);
      const cliId = cliRes.body.data.id;

      // Intento exceder tope BCRP en edición -> 400
      const badEdit = await request(app)
        .put(`/api/clientes/${cliId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ tasa: 1.5 });
      expect(badEdit.status).toBe(400);
      expect(badEdit.body.code).toBe('REGULATORY_LIMIT_EXCEEDED');

      const goodEdit = await request(app)
        .put(`/api/clientes/${cliId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ limiteCredito: 2500, telefono: '+51 999888777' });
      expect(goodEdit.status).toBe(200);
      expect(goodEdit.body.data.limiteCredito).toBe(2500);

      const estadoRes = await request(app)
        .patch(`/api/clientes/${cliId}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });
      expect(estadoRes.status).toBe(200);
      expect(estadoRes.body.data.activo).toBe(false);

      const bitacora = await repos.bitacora.listar(regRes.body.data.tienda.id);
      expect(bitacora.some((b) => b.accion === 'CREAR_CLIENTE' && b.idEntidad === cliId)).toBe(true);
      expect(bitacora.some((b) => b.accion === 'EDITAR_CLIENTE' && b.idEntidad === cliId)).toBe(true);
      expect(bitacora.some((b) => b.accion === 'CAMBIO_ESTADO_CLIENTE' && b.idEntidad === cliId)).toBe(true);
    });

    it('Permite a ADMIN_NEGOCIO actualizar su tienda (PATCH /api/tiendas/mi-tienda) con Bitacora', async () => {
      const regRes = await request(app).post('/api/auth/register').send({
        ruc: '20609998883',
        razonSocial: 'Mi Bodega S.A.C.',
        nombreComercial: 'Mi Bodega',
        direccion: 'Jr. Lima 100',
        email: 'tienda.conf@test.pe',
        password: '12345678',
      });
      const token = regRes.body.data.token;

      const patchRes = await request(app)
        .patch('/api/tiendas/mi-tienda')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombreComercial: 'Mi Bodega Renovada',
          horaCorte: 20,
          monedaDefecto: 'USD',
        });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.nombreComercial).toBe('Mi Bodega Renovada');
      expect(patchRes.body.data.horaCorte).toBe(20);
      expect(patchRes.body.data.monedaDefecto).toBe('USD');

      const bitacora = await repos.bitacora.listar(regRes.body.data.tienda.id);
      expect(bitacora.some((b) => b.accion === 'EDITAR_TIENDA')).toBe(true);
    });

    it('Previsualiza mora exacta en POST /api/pagos/previsualizar sin persistir y aísla créditos para CLIENTE', async () => {
      // Crear 2 clientes con credenciales y emitir 1 crédito a cada uno
      const c1 = await request(app).post('/api/clientes').send({
        nombreCompleto: 'Cliente Uno',
        email: 'c1@vecino.pe',
        password: '12345678',
        tipoDoc: 'DNI',
        numDoc: '11223344',
        ingresosNetos: 3000,
        moneda: 'USD',
        tipoTasa: 'Efectiva',
        tasa: 0.2,
        teaMora: 0.36,
        diaCorte: 15,
        diaPago: 15,
        limiteCredito: 3000,
        maxMeses: 12,
      });
      const c2 = await request(app).post('/api/clientes').send({
        nombreCompleto: 'Cliente Dos',
        email: 'c2@vecino.pe',
        password: '12345678',
        tipoDoc: 'DNI',
        numDoc: '22334455',
        ingresosNetos: 3000,
        moneda: 'PEN',
        tipoTasa: 'Efectiva',
        tasa: 0.3,
        teaMora: 0.2,
        diaCorte: 15,
        diaPago: 25,
        limiteCredito: 3000,
        maxMeses: 12,
      });

      const cr1 = await request(app).post('/api/creditos/emitir').send({
        clienteId: c1.body.data.id,
        precioLista: 2000,
        modalidad: 'Cuotas',
        plazoMeses: 4,
        diasGracia: 0,
        fCompra: '2026-05-15',
      });
      const cr2 = await request(app).post('/api/creditos/emitir').send({
        clienteId: c2.body.data.id,
        precioLista: 1000,
        modalidad: 'Cuotas',
        plazoMeses: 3,
        diasGracia: 0,
        fCompra: '2026-05-15',
      });
      expect(cr1.status).toBe(201);
      expect(cr2.status).toBe(201);

      // Previsualizar cuota 2 con 10 días de atraso (Caso 2: 519.28 + 4.45 = 523.73)
      const cuota2 = cr1.body.data.cuotas[1];
      const venc2 = new Date(cuota2.fechaVencimiento + 'T12:00:00');
      venc2.setDate(venc2.getDate() + 10);
      const fPago10d = venc2.toISOString().split('T')[0];

      const prevMora = await request(app).post('/api/pagos/previsualizar').send({
        clienteId: c1.body.data.id,
        cuotaIds: [cuota2.id],
        fPago: fPago10d,
      });
      expect(prevMora.status).toBe(200);
      expect(prevMora.body.data.totalExigibleBase).toBe(519.28);
      expect(prevMora.body.data.totalInteresMoratorio).toBe(4.45);
      expect(prevMora.body.data.totalExigible).toBe(523.73);
      expect(prevMora.body.data.filas[0].diasMora).toBe(10);

      // Confirmar que no se persistió ningún pago
      const pagosRes = await request(app).get(`/api/pagos/cliente/${c1.body.data.id}`);
      expect(pagosRes.body.data).toHaveLength(0);

      // Aislamiento de CLIENTE en GET /api/creditos y GET /api/creditos/:id
      const loginC1 = await request(app).post('/api/auth/login-cliente').send({
        email: 'c1@vecino.pe',
        password: '12345678',
      });
      const tokenC1 = loginC1.body.data.token;

      const listC1 = await request(app)
        .get('/api/creditos')
        .set('Authorization', `Bearer ${tokenC1}`);
      expect(listC1.status).toBe(200);
      expect(listC1.body.data.every((cr: any) => cr.clienteId === c1.body.data.id)).toBe(true);
      expect(listC1.body.data.some((cr: any) => cr.id === cr2.body.data.credito.id)).toBe(false);

      const ajenoCred = await request(app)
        .get(`/api/creditos/${cr2.body.data.credito.id}`)
        .set('Authorization', `Bearer ${tokenC1}`);
      expect(ajenoCred.status).toBe(403);
    });
  });
});
