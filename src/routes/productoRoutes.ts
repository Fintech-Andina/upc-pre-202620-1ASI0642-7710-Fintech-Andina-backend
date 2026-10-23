import { Router } from 'express';
import { ProductoController } from '../controllers/productoController.js';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';

export function createProductoRouter(repos: Repositories): Router {
  const router = Router();
  const controller = new ProductoController(repos);

  /**
   * GET /api/productos
   * Catálogo de productos disponibles
   */
  router.get('/', controller.listar);

  /**
   * GET /api/productos/:id
   * Detalle de un producto por ID
   */
  router.get('/:id', controller.obtenerPorId);

  return router;
}
