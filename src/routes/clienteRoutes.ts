import { Router } from 'express';
import { ClienteController } from '../controllers/clienteController.js';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { validateBody } from '../middlewares/validateRequest.js';
import { crearClienteSchema } from '../middlewares/schemas.js';

export function createClienteRouter(repos: Repositories): Router {
  const router = Router();
  const controller = new ClienteController(repos);

  /**
   * GET /api/clientes
   * Lista todos los vecinos registrados
   */
  router.get('/', controller.listar);

  /**
   * POST /api/clientes
   * Registra un nuevo vecino con validación de topes BCRP
   */
  router.post('/', validateBody(crearClienteSchema), controller.crear);

  /**
   * GET /api/clientes/:id
   * Detalle de un vecino
   */
  router.get('/:id', controller.obtenerPorId);

  /**
   * GET /api/clientes/:id/estado-cuenta
   * Genera el estado de cuenta consolidado al corte
   */
  router.get('/:id/estado-cuenta', controller.estadoCuenta);

  return router;
}
