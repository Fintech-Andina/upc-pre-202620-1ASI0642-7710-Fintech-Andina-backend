import { Repositories } from './inMemoryRepositories.js';

export async function seedInitialData(repos: Repositories): Promise<{
  tiendaId: string;
  cliente1Id: string;
  cliente2Id: string;
  producto1Id: string;
  producto2Id: string;
}> {
  // 1. Tienda
  const tienda = await repos.tiendas.crear({
    nombre: 'Bodega & Minimarket Don Pepe S.A.C.',
    ruc: '20601234567',
    direccion: 'Av. Los Próceres 123, Santiago de Surco, Lima',
    telefono: '+51 987654321',
    monedaDefecto: 'PEN',
    horaCorte: 18,
  });

  // 2. Clientes
  const cliente1 = await repos.clientes.crear({
    nombreCompleto: 'Carlos Quispe Mamani',
    tipoDoc: 'DNI',
    numDoc: '10234567',
    ingresosNetos: 2800.0,
    moneda: 'PEN',
    tipoTasa: 'Nominal',
    tasa: 0.36, // 36% TNA
    capitalizacion: 12, // Mensual
    teaMora: 0.36, // 36% TEA mora
    diaCorte: 15,
    diaPago: 25,
    limiteCredito: 3000.0,
    capitalVigente: 0.0,
    maxMeses: 12,
    activo: true,
  });

  const cliente2 = await repos.clientes.crear({
    nombreCompleto: 'María Alva Gonzales',
    tipoDoc: 'DNI',
    numDoc: '45678912',
    ingresosNetos: 4500.0,
    moneda: 'USD',
    tipoTasa: 'Efectiva',
    tasa: 0.20, // 20% TEA
    capitalizacion: 12,
    teaMora: 0.36, // 36% TEA mora
    diaCorte: 10,
    diaPago: 20,
    limiteCredito: 2500.0,
    capitalVigente: 0.0,
    maxMeses: 12,
    activo: true,
  });

  // 3. Productos
  const prod1 = await repos.productos.crear({
    tiendaId: tienda.id,
    sku: 'PROD-SMARTPHONE-01',
    nombre: 'Smartphone Samsung Galaxy A54 5G',
    precioLista: 1500.0,
    precioContado: 1500.0,
    permiteCuotas: true,
    stock: 25,
  });

  const prod2 = await repos.productos.crear({
    tiendaId: tienda.id,
    sku: 'PROD-LAPTOP-02',
    nombre: 'Laptop Lenovo ThinkBook 15 G4',
    precioLista: 2000.0,
    precioContado: 2000.0,
    permiteCuotas: true,
    stock: 10,
  });

  await repos.bitacora.registrar({
    usuario: 'SISTEMA',
    accion: 'SEED_DATA',
    detalle: 'Datos iniciales de demostración cargados en memoria.',
  });

  return {
    tiendaId: tienda.id,
    cliente1Id: cliente1.id,
    cliente2Id: cliente2.id,
    producto1Id: prod1.id,
    producto2Id: prod2.id,
  };
}
