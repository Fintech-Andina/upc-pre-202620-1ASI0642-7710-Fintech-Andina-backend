import { Router } from 'express';
import { ReporteController } from '../controllers/reporteController.js';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';

export function createReporteRouter(repos: Repositories): Router {
  const router = Router();
  const controller = new ReporteController(repos);

  /**
   * GET /api/reportes/dashboard
   * Métricas gerenciales: capital colocado, mora y TREA ponderada
   */
  router.get('/dashboard', controller.dashboard);

  return router;
}
