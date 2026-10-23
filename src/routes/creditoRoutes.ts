import { Router } from 'express';
import { CreditoController } from '../controllers/creditoController.js';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { validateBody } from '../middlewares/validateRequest.js';
import {
  simularCreditoSchema,
  emitirCreditoSchema,
} from '../middlewares/schemas.js';

export function createCreditoRouter(repos: Repositories): Router {
  const router = Router();
  const controller = new CreditoController(repos);

  /**
   * POST /api/creditos/simular
   * Calcula cronograma proyectado, TCEA y TREA sin persistir
   */
  router.post('/simular', validateBody(simularCreditoSchema), controller.simular);

  /**
   * POST /api/creditos/emitir
   * Registra compra a crédito, valida límite Kv + PL <= L y persiste
   */
  router.post('/emitir', validateBody(emitirCreditoSchema), controller.emitir);

  /**
   * GET /api/creditos
   * Lista todos los créditos emitidos
   */
  router.get('/', controller.listar);

  /**
   * GET /api/creditos/:id
   * Obtiene el detalle de un crédito con su cronograma de cuotas
   */
  router.get('/:id', controller.obtenerPorId);

  return router;
}
