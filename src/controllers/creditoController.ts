import { Request, Response, NextFunction } from 'express';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import {
  SimularCreditoService,
  EmitirCreditoService,
} from '../services/index.js';

export class CreditoController {
  private simularService: SimularCreditoService;
  private emitirService: EmitirCreditoService;

  constructor(private repos: Repositories) {
    this.simularService = new SimularCreditoService();
    this.emitirService = new EmitirCreditoService(repos);
  }

  simular = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resultado = this.simularService.ejecutar(req.body);
      res.status(200).json({
        status: 'success',
        mensaje: 'Simulación de crédito calculada exitosamente',
        data: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  emitir = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = {
        ...req.body,
        tiendaId: req.tienda?.id ?? req.body.tiendaId,
        usuario: req.user?.email ?? req.body.usuario,
      };
      const resultado = await this.emitirService.ejecutar(input);
      res.status(201).json({
        status: 'success',
        mensaje: 'Crédito emitido y cronograma persistido exitosamente',
        data: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  listar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user?.rol === 'CLIENTE' && req.user.clienteId) {
        const creditosCliente = await this.repos.creditos.listarPorCliente(req.user.clienteId);
        res.status(200).json({
          status: 'success',
          cantidad: creditosCliente.length,
          data: creditosCliente,
        });
        return;
      }

      const tiendaId = req.tienda?.id;
      const creditos = await this.repos.creditos.listarTodos(tiendaId);
      res.status(200).json({
        status: 'success',
        cantidad: creditos.length,
        data: creditos,
      });
    } catch (error) {
      next(error);
    }
  };

  obtenerPorId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const credito = await this.repos.creditos.obtenerPorId(id);
      if (!credito || (req.tienda?.id && credito.tiendaId !== req.tienda.id)) {
        res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          message: `Crédito con ID ${id} no encontrado`,
        });
        return;
      }
      if (req.user?.rol === 'CLIENTE' && credito.clienteId !== req.user.clienteId) {
        res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN_CLIENT_ACCESS',
          message: 'Un cliente solo puede consultar el detalle de sus propios créditos',
        });
        return;
      }
      const cuotas = await this.repos.cuotas.listarPorCredito(id);
      res.status(200).json({
        status: 'success',
        data: {
          credito,
          cuotas,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
