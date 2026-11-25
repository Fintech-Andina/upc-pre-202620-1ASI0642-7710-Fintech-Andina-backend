import { Router } from 'express';
import { TiendaController } from '../controllers/tiendaController.js';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';
import { validateBody } from '../middlewares/validateRequest.js';
import { cambiarEstadoTiendaSchema } from '../middlewares/schemas.js';

export function createTiendaRouter(repos: Repositories): Router {
  const router = Router();
  const controller = new TiendaController(repos);

  /**
   * GET /api/tiendas
   * Lista todas las tiendas (protegido para ADMIN_SISTEMA)
   */
  router.get('/', requireAuth, requireRole('ADMIN_SISTEMA'), controller.listar);

  /**
   * PATCH /api/tiendas/:id/estado
   * Da de alta o baja (ACTIVO / INACTIVO) a una tienda (exclusivo ADMIN_SISTEMA)
   */
  router.patch(
    '/:id/estado',
    requireAuth,
    requireRole('ADMIN_SISTEMA'),
    validateBody(cambiarEstadoTiendaSchema),
    controller.cambiarEstado
  );

  return router;
}
