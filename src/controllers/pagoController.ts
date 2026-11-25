import { Request, Response, NextFunction } from 'express';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { RegistrarPagoService } from '../services/index.js';

export class PagoController {
  private registrarPagoService: RegistrarPagoService;

  constructor(private repos: Repositories) {
    this.registrarPagoService = new RegistrarPagoService(repos);
  }

  previsualizar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resultado = await this.registrarPagoService.previsualizar(req.body);
      res.status(200).json({
        status: 'success',
        mensaje: 'Previsualización de liquidación y mora calculada exitosamente',
        data: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  liquidar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resultado = await this.registrarPagoService.ejecutar(req.body);
      res.status(200).json({
        status: 'success',
        mensaje: 'Pago liquidado e imputado exitosamente según prelación legal',
        data: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  listarPorCliente = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clienteId = req.params.clienteId as string;
      if (req.user?.rol === 'CLIENTE' && req.user.clienteId !== clienteId) {
        res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN_CLIENT_ACCESS',
          message: 'Un cliente solo puede consultar su propio historial de pagos',
        });
        return;
      }
      const pagos = await this.repos.pagos.listarPorCliente(clienteId);
      res.status(200).json({
        status: 'success',
        cantidad: pagos.length,
        data: pagos,
      });
    } catch (error) {
      next(error);
    }
  };
}
