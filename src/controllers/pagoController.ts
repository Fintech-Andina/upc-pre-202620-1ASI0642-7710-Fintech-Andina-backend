import { Request, Response, NextFunction } from 'express';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { RegistrarPagoService } from '../services/index.js';

export class PagoController {
  private registrarPagoService: RegistrarPagoService;

  constructor(private repos: Repositories) {
    this.registrarPagoService = new RegistrarPagoService(repos);
  }

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
