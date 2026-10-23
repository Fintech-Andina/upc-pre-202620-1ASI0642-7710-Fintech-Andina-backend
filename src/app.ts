import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import {
  Repositories,
  createInMemoryRepositories,
} from './infrastructure/inMemoryRepositories.js';
import { createApiRouter } from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { swaggerSpec } from './docs/swaggerSpec.js';

export function createApp(repositories?: Repositories): Express {
  const app = express();
  const repos = repositories ?? createInMemoryRepositories();

  // Middlewares estándar
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Interfaz Interactiva de Swagger UI
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Defia Book API - Documentación Swagger',
  }));
  app.get('/api/docs.json', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Ruta raíz
  app.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      nombre: 'Defia Book Backend API',
      empresa: 'Fintech Andina S.A.C.',
      descripcion: 'Motor Financiero Matemático Puro y API RESTful de Crédito Vecinal',
      swaggerUi: 'http://localhost:3000/api/docs',
      documentacionRutas: {
        swagger: 'GET /api/docs',
        simular: 'POST /api/creditos/simular',
        emitir: 'POST /api/creditos/emitir',
        clientes: 'GET /api/clientes',
        estadoCuenta: 'GET /api/clientes/:id/estado-cuenta',
        liquidarPago: 'POST /api/pagos/liquidar',
        dashboard: 'GET /api/reportes/dashboard',
        productos: 'GET /api/productos',
        health: 'GET /api/health',
      },
    });
  });

  // Rutas de API
  app.use('/api', createApiRouter(repos));

  // Manejo de 404
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      status: 'error',
      code: 'ROUTE_NOT_FOUND',
      message: 'Ruta no encontrada en la API de Defia Book',
    });
  });

  // Manejador centralizado de errores
  app.use(errorHandler);

  return app;
}
