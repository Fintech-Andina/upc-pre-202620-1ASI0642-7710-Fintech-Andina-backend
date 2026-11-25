import { Router } from 'express';
import { ProductoController } from '../controllers/productoController.js';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { validateBody } from '../middlewares/validateRequest.js';
import {
  crearProductoSchema,
  actualizarProductoSchema,
  cambiarEstadoActivoSchema,
} from '../middlewares/schemas.js';

export function createProductoRouter(repos: Repositories): Router {
  const router = Router();
  const controller = new ProductoController(repos);

  /**
   * GET /api/productos
   * Catálogo de productos disponibles
   */
  router.get('/', controller.listar);

  /**
   * POST /api/productos
   * Crea un nuevo producto o servicio en el catálogo
   */
  router.post('/', validateBody(crearProductoSchema), controller.crear);

  /**
   * GET /api/productos/:id
   * Detalle de un producto por ID
   */
  router.get('/:id', controller.obtenerPorId);

  /**
   * PUT /api/productos/:id
   * Actualiza un producto del catálogo
   */
  router.put('/:id', validateBody(actualizarProductoSchema), controller.actualizar);

  /**
   * PATCH /api/productos/:id/estado
   * Activa o desactiva un producto del catálogo
   */
  router.patch('/:id/estado', validateBody(cambiarEstadoActivoSchema), controller.cambiarEstado);

  return router;
}
