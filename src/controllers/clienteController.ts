import { Request, Response, NextFunction } from 'express';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { EstadoCuentaService } from '../services/index.js';
import { validarParametrosCliente } from '../core/financialEngine.js';

export class ClienteController {
  private estadoCuentaService: EstadoCuentaService;

  constructor(private repos: Repositories) {
    this.estadoCuentaService = new EstadoCuentaService(repos);
  }

  listar = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientes = await this.repos.clientes.listarTodos();
      res.status(200).json({
        status: 'success',
        cantidad: clientes.length,
        data: clientes,
      });
    } catch (error) {
      next(error);
    }
  };

  obtenerPorId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const cliente = await this.repos.clientes.obtenerPorId(id);
      if (!cliente) {
        res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          message: `Cliente con ID ${id} no encontrado`,
        });
        return;
      }
      res.status(200).json({
        status: 'success',
        data: cliente,
      });
    } catch (error) {
      next(error);
    }
  };

  crear = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body;

      // Verificar si ya existe cliente con mismo documento
      const existente = await this.repos.clientes.obtenerPorDoc(body.numDoc);
      if (existente) {
        res.status(409).json({
          status: 'error',
          code: 'DOCUMENT_ALREADY_EXISTS',
          message: `Ya existe un cliente registrado con el documento ${body.numDoc}`,
        });
        return;
      }

      // Validar frente a normas BCRP (A8)
      const validacion = validarParametrosCliente(body);
      if (!validacion.valido) {
        res.status(400).json({
          status: 'error',
          code: 'REGULATORY_LIMIT_EXCEEDED',
          message: validacion.motivo,
        });
        return;
      }

      const nuevoCliente = await this.repos.clientes.crear({
        ...body,
        capitalVigente: 0.0,
        activo: true,
      });

      res.status(201).json({
        status: 'success',
        mensaje: 'Cliente registrado exitosamente',
        data: nuevoCliente,
      });
    } catch (error) {
      next(error);
    }
  };

  estadoCuenta = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const fCorte = req.query.fCorte as string | undefined;
      const estado = await this.estadoCuentaService.ejecutar(id, fCorte);
      res.status(200).json({
        status: 'success',
        mensaje: 'Estado de cuenta consolidado generado exitosamente',
        data: estado,
      });
    } catch (error) {
      next(error);
    }
  };
}
