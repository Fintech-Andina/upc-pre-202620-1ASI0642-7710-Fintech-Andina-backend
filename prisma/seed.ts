import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { createPrismaRepositories } from '../src/infrastructure/prismaRepositories.js';
import { EmitirCreditoService } from '../src/services/emitirCreditoService.js';
import { RegistrarPagoService } from '../src/services/registrarPagoService.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de Defia Book en PostgreSQL...');

  // Limpiar tablas en orden respetando llaves foráneas
  await prisma.bitacora.deleteMany();
  await prisma.pago.deleteMany();
  await prisma.cuota.deleteMany();
  await prisma.credito.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.tienda.deleteMany();

  const repos = createPrismaRepositories(prisma);
  const emitirCreditoService = new EmitirCreditoService(repos);
  const registrarPagoService = new RegistrarPagoService(repos);

  const passwordHashDemo = await bcrypt.hash('12345678', 10);

  // 1. Usuario ADMIN_SISTEMA demo
  const adminSistema = await repos.tiendas.crear({
    nombre: 'Fintech Andina - Administración Central',
    razonSocial: 'Fintech Andina S.A.C.',
    nombreComercial: 'Fintech Andina Admin',
    ruc: '20600000001',
    direccion: 'Av. Javier Prado Este 456, San Isidro, Lima',
    telefono: '+51 999000111',
    email: 'admin@fintechandina.pe',
    passwordHash: passwordHashDemo,
    rol: 'ADMIN_SISTEMA',
    monedaDefecto: 'PEN',
    horaCorte: 18,
    estado: 'ACTIVO',
  });
  console.log(`✅ [ADMIN_SISTEMA] Creado: ${adminSistema.email} (ID: ${adminSistema.id})`);

  // 2. Tienda Demo "Bodega El Vecino" (Don Lucho - ADMIN_NEGOCIO)
  const tiendaVecino = await repos.tiendas.crear({
    nombre: 'Bodega El Vecino',
    razonSocial: 'Bodega El Vecino de Don Lucho E.I.R.L.',
    nombreComercial: 'Bodega El Vecino',
    ruc: '20601234567',
    direccion: 'Jr. Las Magnolias 245, Santiago de Surco, Lima',
    telefono: '+51 987654321',
    email: 'donlucho@bodegaelvecino.pe',
    passwordHash: passwordHashDemo,
    rol: 'ADMIN_NEGOCIO',
    monedaDefecto: 'PEN',
    horaCorte: 18,
    estado: 'ACTIVO',
  });
  console.log(`✅ [ADMIN_NEGOCIO] Tienda creada: "${tiendaVecino.nombre}" (${tiendaVecino.email})`);

  // 3. Catálogo de Productos de "Bodega El Vecino"
  const prodCocina = await repos.productos.crear({
    tiendaId: tiendaVecino.id,
    sku: 'PROD-COCINA-01',
    nombre: 'Cocina a gas 2 hornillas Surge',
    marca: 'Surge',
    descripcion: 'Cocina a gas GLP de 2 hornillas en acero inoxidable para hogar',
    unidadMedida: 'UNIDAD',
    precioLista: 1500.0,
    precioContado: 1500.0,
    permiteCuotas: true,
    permitePagoUnico: true,
    activo: true,
    stock: 15,
  });

  const prodArroz = await repos.productos.crear({
    tiendaId: tiendaVecino.id,
    sku: 'PROD-ARROZ-50KG',
    nombre: 'Saco de arroz 50kg Costeño Extra',
    marca: 'Costeño',
    descripcion: 'Saco de arroz extra superior de 50 kilogramos',
    unidadMedida: 'SACO',
    precioLista: 220.0,
    precioContado: 220.0,
    permiteCuotas: true,
    permitePagoUnico: true,
    activo: true,
    stock: 40,
  });

  const prodElectroUSD = await repos.productos.crear({
    tiendaId: tiendaVecino.id,
    sku: 'PROD-REFRI-02',
    nombre: 'Exhibidora Comercial Conservadora LG',
    marca: 'LG',
    descripcion: 'Conservadora vertical de bebidas y lácteos',
    unidadMedida: 'UNIDAD',
    precioLista: 2000.0,
    precioContado: 2000.0,
    permiteCuotas: true,
    permitePagoUnico: false,
    activo: true,
    stock: 5,
  });

  const prodCanasta = await repos.productos.crear({
    tiendaId: tiendaVecino.id,
    sku: 'PROD-CANASTA-MES',
    nombre: 'Canasta Familiar Mensual de Abarrotes',
    marca: 'Bodega El Vecino',
    descripcion: 'Aceite, azúcar, menestras, leche y conservas para el mes',
    unidadMedida: 'PACK',
    precioLista: 300.0,
    precioContado: 300.0,
    permiteCuotas: false,
    permitePagoUnico: true,
    activo: true,
    stock: 50,
  });

  console.log(`✅ [PRODUCTOS] 4 productos creados en el catálogo de Bodega El Vecino`);

  // 4. Clientes con sus días de corte/pago, límites de crédito y credenciales (rol CLIENTE)
  const cliente1 = await repos.clientes.crear({
    tiendaId: tiendaVecino.id,
    nombreCompleto: 'Carlos Quispe Mamani',
    nombres: 'Carlos',
    apellidos: 'Quispe Mamani',
    tipoDoc: 'DNI',
    numDoc: '10234567',
    telefono: '+51 912345678',
    direccion: 'Calle Los Pinos 118, Surco',
    email: 'carlos.quispe@vecino.pe',
    passwordHash: passwordHashDemo,
    ingresosNetos: 2800.0,
    moneda: 'PEN',
    tipoTasa: 'Nominal',
    tasa: 0.36, // 36% TNA cap. mensual (m = 12) -> TEA 42.5761%
    capitalizacion: 12,
    teaMora: 0.36,
    diaCorte: 15,
    diaPago: 25,
    limiteCredito: 3000.0,
    capitalVigente: 0.0,
    maxMeses: 12,
    activo: true,
  });

  const cliente2 = await repos.clientes.crear({
    tiendaId: tiendaVecino.id,
    nombreCompleto: 'María Alva Gonzales',
    nombres: 'María',
    apellidos: 'Alva Gonzales',
    tipoDoc: 'DNI',
    numDoc: '45678912',
    telefono: '+51 923456789',
    direccion: 'Av. Caminos del Inca 890, Surco',
    email: 'maria.alva@vecino.pe',
    passwordHash: passwordHashDemo,
    ingresosNetos: 4500.0,
    moneda: 'USD',
    tipoTasa: 'Efectiva',
    tasa: 0.20, // 20% TEA
    capitalizacion: 12,
    teaMora: 0.36,
    diaCorte: 10,
    diaPago: 15,
    limiteCredito: 2500.0,
    capitalVigente: 0.0,
    maxMeses: 12,
    activo: true,
  });

  const cliente3 = await repos.clientes.crear({
    tiendaId: tiendaVecino.id,
    nombreCompleto: 'Rosa Pérez Flores',
    nombres: 'Rosa',
    apellidos: 'Pérez Flores',
    tipoDoc: 'DNI',
    numDoc: '78945612',
    telefono: '+51 934567890',
    direccion: 'Jr. Monte Rosa 310, Surco',
    email: 'rosa.perez@vecino.pe',
    passwordHash: passwordHashDemo,
    ingresosNetos: 2200.0,
    moneda: 'PEN',
    tipoTasa: 'Efectiva',
    tasa: 0.30, // 30% TEA
    capitalizacion: 12,
    teaMora: 0.25,
    diaCorte: 20,
    diaPago: 28,
    limiteCredito: 1200.0,
    capitalVigente: 0.0,
    maxMeses: 6,
    activo: true,
  });

  console.log(`✅ [CLIENTES] 3 vecinos registrados con credenciales de acceso (clave: 12345678)`);

  // 5. CASO 1 VALIDADO EN EL INFORME:
  // S/ 1,500.00 a 6 cuotas mensuales con 30 días de gracia total (TNA 36% cap. mensual)
  // P' = 1,545.00 | Cuota R = 285.20 | Cuota 6 = 285.21 | Total = 1,711.21 | TCEA = 42.5739%
  const caso1 = await emitirCreditoService.ejecutar({
    clienteId: cliente1.id,
    tiendaId: tiendaVecino.id,
    productoId: prodCocina.id,
    precioLista: 1500.0,
    precioContado: 1500.0,
    modalidad: 'Cuotas',
    plazoMeses: 6,
    diasGracia: 30,
    fCompra: '2026-03-15',
    usuario: tiendaVecino.email,
  });
  console.log(
    `✅ [CASO 1 INFORME] Crédito emitido ID: ${caso1.credito.id} | P': S/ ${caso1.credito.capitalCapitalizado.toFixed(2)} | Cuota: S/ ${caso1.credito.cuota.toFixed(2)} | TCEA: ${(caso1.credito.tcea * 100).toFixed(4)}%`
  );

  // 6. CASO 2 VALIDADO EN EL INFORME:
  // US$ 2,000.00 a 4 cuotas mensuales sin gracia (TEA 20.00%)
  // Cuota R = 519.28 | Cuota 4 = 519.29 | TCEA = 20.0003%
  // Y liquidación de Cuota 2 con 10 días de mora (TEA mora 36% -> IM = US$ 4.45, Total = US$ 523.73)
  const caso2 = await emitirCreditoService.ejecutar({
    clienteId: cliente2.id,
    tiendaId: tiendaVecino.id,
    productoId: prodElectroUSD.id,
    precioLista: 2000.0,
    precioContado: 2000.0,
    modalidad: 'Cuotas',
    plazoMeses: 4,
    diasGracia: 0,
    fCompra: '2026-05-15',
    usuario: tiendaVecino.email,
  });
  console.log(
    `✅ [CASO 2 INFORME] Crédito emitido ID: ${caso2.credito.id} | Cuota: US$ ${caso2.credito.cuota.toFixed(2)} | TCEA: ${(caso2.credito.tcea * 100).toFixed(4)}%`
  );

  // Liquidar Cuota 1 a tiempo y Cuota 2 con 10 días exactos de mora (IM = US$ 4.45)
  const cuota1Caso2 = caso2.cuotas[0];
  await registrarPagoService.ejecutar({
    clienteId: cliente2.id,
    cuotaIds: [cuota1Caso2.id],
    fPago: cuota1Caso2.fechaVencimiento,
    montoRecibido: 519.28,
    metodoPago: 'TRANSFERENCIA',
    usuario: tiendaVecino.email,
  });

  const cuota2Caso2 = caso2.cuotas[1];
  const fechaVenc2 = new Date(cuota2Caso2.fechaVencimiento + 'T12:00:00');
  fechaVenc2.setDate(fechaVenc2.getDate() + 10);
  const fPagoMoraISO = fechaVenc2.toISOString().split('T')[0];

  const pagoMoraCaso2 = await registrarPagoService.ejecutar({
    clienteId: cliente2.id,
    cuotaIds: [cuota2Caso2.id],
    fPago: fPagoMoraISO,
    montoRecibido: 523.73,
    metodoPago: 'EFECTIVO',
    usuario: tiendaVecino.email,
  });
  console.log(
    `✅ [CASO 2 MORA] Cuota 2 liquidada con 10 días de mora: Base US$ ${pagoMoraCaso2.pagoRegistrado.totalExigibleBase.toFixed(2)} + Mora US$ ${pagoMoraCaso2.pagoRegistrado.totalInteresMoratorio.toFixed(2)} = US$ ${pagoMoraCaso2.pagoRegistrado.totalPagado.toFixed(2)}`
  );

  // 7. CRÉDITO DEMO EN MODALIDAD PAGO ÚNICO (Fin de mes)
  const creditoPagoUnico = await emitirCreditoService.ejecutar({
    clienteId: cliente3.id,
    tiendaId: tiendaVecino.id,
    productoId: prodArroz.id,
    precioLista: 220.0,
    precioContado: 220.0,
    modalidad: 'PagoUnico',
    plazoMeses: 1,
    fCompra: '2026-04-05',
    usuario: tiendaVecino.email,
  });
  console.log(
    `✅ [PAGO ÚNICO] Crédito a fin de mes emitido ID: ${creditoPagoUnico.credito.id} para ${cliente3.nombreCompleto} | Total a pagar en fecha de pago: S/ ${creditoPagoUnico.credito.cuota.toFixed(2)}`
  );

  console.log('🎉 Seed completado exitosamente en PostgreSQL.');
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
