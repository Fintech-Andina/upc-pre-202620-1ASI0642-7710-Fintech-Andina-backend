import { Router } from 'express';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { createCreditoRouter } from './creditoRoutes.js';
import { createClienteRouter } from './clienteRoutes.js';
import { createPagoRouter } from './pagoRoutes.js';
import { createReporteRouter } from './reporteRoutes.js';
import { createProductoRouter } from './productoRoutes.js';
import { createAuthRouter } from './authRoutes.js';
import { createTiendaRouter } from './tiendaRoutes.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

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

  // Rutas de Autenticación y Gestión de Tiendas (ADMIN_SISTEMA)
  router.use('/auth', createAuthRouter(repos));
  router.use('/tiendas', createTiendaRouter(repos));

  // Rutas operativas con middleware JWT + aislamiento multi-tenant
  router.use('/creditos', authMiddleware, createCreditoRouter(repos));
  router.use('/clientes', authMiddleware, createClienteRouter(repos));
  router.use('/pagos', authMiddleware, createPagoRouter(repos));
  router.use('/reportes', authMiddleware, createReporteRouter(repos));
  router.use('/productos', authMiddleware, createProductoRouter(repos));

  return router;
}
