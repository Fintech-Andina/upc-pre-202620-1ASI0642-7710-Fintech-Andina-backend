import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { validateBody } from '../middlewares/validateRequest.js';
import {
  registerTiendaSchema,
  loginSchema,
  loginClienteSchema,
} from '../middlewares/schemas.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

export function createAuthRouter(repos: Repositories): Router {
  const router = Router();
  const controller = new AuthController(repos);

  /**
   * POST /api/auth/register
   * Registra una nueva tienda (o administrador) y devuelve JWT
   */
  router.post('/register', validateBody(registerTiendaSchema), controller.register);

  /**
   * POST /api/auth/login
   * Autentica ADMIN_SISTEMA, ADMIN_NEGOCIO o CLIENTE por email y password
   */
  router.post('/login', validateBody(loginSchema), controller.login);

  /**
   * POST /api/auth/login-cliente
   * Autentica un vecino (CLIENTE) por email o numDoc + password
   */
  router.post('/login-cliente', validateBody(loginClienteSchema), controller.loginCliente);

  /**
   * GET /api/auth/me
   * Obtiene el perfil del usuario autenticado
   */
  router.get('/me', requireAuth, controller.me);

  return router;
}
