import dotenv from 'dotenv';
import { createApp } from './app.js';
import { createInMemoryRepositories } from './infrastructure/inMemoryRepositories.js';
import { seedInitialData } from './infrastructure/seedData.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

async function bootstrap() {
  const repos = createInMemoryRepositories();

  // Precargar datos de demostración
  const { tiendaId, cliente1Id, cliente2Id } = await seedInitialData(repos);

  const app = createApp(repos);

  app.listen(PORT, HOST, () => {
    console.log('================================================================');
    console.log(`🚀 Servidor Defia Book Backend iniciado en http://${HOST}:${PORT}`);
    console.log('🏛️  Fintech Andina S.A.C. - Sistema de Crédito Vecinal');
    console.log('================================================================');
    console.log(`[SEED] Tienda precargada ID: ${tiendaId}`);
    console.log(`[SEED] Cliente 1 (PEN - Caso 1): ${cliente1Id}`);
    console.log(`[SEED] Cliente 2 (USD - Caso 2): ${cliente2Id}`);
    console.log('----------------------------------------------------------------');
    console.log(`📖 Documentación Swagger UI: http://${HOST}:${PORT}/api/docs`);
    console.log('----------------------------------------------------------------');
    console.log('Endpoints disponibles:');
    console.log(`  POST http://${HOST}:${PORT}/api/creditos/simular`);
    console.log(`  POST http://${HOST}:${PORT}/api/creditos/emitir`);
    console.log(`  GET  http://${HOST}:${PORT}/api/clientes`);
    console.log(`  GET  http://${HOST}:${PORT}/api/clientes/:id/estado-cuenta`);
    console.log(`  POST http://${HOST}:${PORT}/api/pagos/liquidar`);
    console.log(`  GET  http://${HOST}:${PORT}/api/reportes/dashboard`);
    console.log(`  GET  http://${HOST}:${PORT}/api/productos`);
    console.log('================================================================');
  });
}

bootstrap().catch((err) => {
  console.error('Error al iniciar el servidor:', err);
  process.exit(1);
});
