import { Request, Response, NextFunction } from 'express';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { DashboardReporteService } from '../services/index.js';

export class ReporteController {
  private dashboardService: DashboardReporteService;

  constructor(repos: Repositories) {
    this.dashboardService = new DashboardReporteService(repos);
  }

  dashboard = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const metricas = await this.dashboardService.ejecutar();
      res.status(200).json({
        status: 'success',
        mensaje: 'Métricas de cartera y cobranza calculadas exitosamente',
        data: metricas,
      });
    } catch (error) {
      next(error);
    }
  };
}
