import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { EstadoCuentaService } from '../services/index.js';
import { validarParametrosCliente } from '../core/financialEngine.js';

export class ClienteController {
  private estadoCuentaService: EstadoCuentaService;

  constructor(private repos: Repositories) {
    this.estadoCuentaService = new EstadoCuentaService(repos);
  }

  listar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tiendaId = req.tienda?.id;
      const clientes = await this.repos.clientes.listarTodos(tiendaId);
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

      if (req.user?.rol === 'CLIENTE' && req.user.clienteId !== id) {
        res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN_CLIENT_ACCESS',
          message: 'Un cliente solo puede consultar su propia información',
        });
        return;
      }

      const cliente = await this.repos.clientes.obtenerPorId(id);
      if (!cliente || (req.tienda?.id && cliente.tiendaId && cliente.tiendaId !== req.tienda.id)) {
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
      const tiendaId = req.tienda?.id ?? body.tiendaId;

      // Verificar si ya existe cliente con mismo documento en la misma tienda
      const existente = await this.repos.clientes.obtenerPorDoc(body.numDoc, tiendaId);
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

      const { password, ...restBody } = body;
      const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;

      const nuevoCliente = await this.repos.clientes.crear({
        ...restBody,
        ...(tiendaId && { tiendaId }),
        ...(passwordHash && { passwordHash }),
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

      if (req.user?.rol === 'CLIENTE' && req.user.clienteId !== id) {
        res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN_CLIENT_ACCESS',
          message: 'Un cliente solo puede consultar su propio estado de cuenta',
        });
        return;
      }

      if (req.tienda?.id) {
        const cliente = await this.repos.clientes.obtenerPorId(id);
        if (cliente && cliente.tiendaId && cliente.tiendaId !== req.tienda.id) {
          res.status(404).json({
            status: 'error',
            code: 'NOT_FOUND',
            message: `Cliente con ID ${id} no encontrado en esta tienda`,
          });
          return;
        }
      }

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
