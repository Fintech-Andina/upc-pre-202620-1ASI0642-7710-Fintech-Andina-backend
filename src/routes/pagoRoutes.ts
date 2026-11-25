import { Router } from 'express';
import { PagoController } from '../controllers/pagoController.js';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { validateBody } from '../middlewares/validateRequest.js';
import { liquidarPagoSchema, previsualizarPagoSchema } from '../middlewares/schemas.js';

export function createPagoRouter(repos: Repositories): Router {
  const router = Router();
  const controller = new PagoController(repos);

  /**
   * POST /api/pagos/previsualizar
   * Calcula el desglose exacto de cuota, mora e imputación legal sin persistir
   */
  router.post('/previsualizar', validateBody(previsualizarPagoSchema), controller.previsualizar);

  /**
   * POST /api/pagos/liquidar
   * Procesa el abono de cuotas con desglose de mora e imputación legal
   */
  router.post('/liquidar', validateBody(liquidarPagoSchema), controller.liquidar);

  /**
   * GET /api/pagos/cliente/:clienteId
   * Historial de pagos de un cliente
   */
  router.get('/cliente/:clienteId', controller.listarPorCliente);

  return router;
}
