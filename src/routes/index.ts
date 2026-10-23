import { Router } from 'express';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { createCreditoRouter } from './creditoRoutes.js';
import { createClienteRouter } from './clienteRoutes.js';
import { createPagoRouter } from './pagoRoutes.js';
import { createReporteRouter } from './reporteRoutes.js';
import { createProductoRouter } from './productoRoutes.js';

export function createApiRouter(repos: Repositories): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'healthy',
      app: 'Defia Book Backend',
      version: '1.0.0',
      organizacion: 'Fintech Andina S.A.C.',
      timestamp: new Date().toISOString(),
    });
  });

  router.use('/creditos', createCreditoRouter(repos));
  router.use('/clientes', createClienteRouter(repos));
  router.use('/pagos', createPagoRouter(repos));
  router.use('/reportes', createReporteRouter(repos));
  router.use('/productos', createProductoRouter(repos));

  return router;
}
