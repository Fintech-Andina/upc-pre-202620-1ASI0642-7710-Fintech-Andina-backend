import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { EstadoCuentaService } from '../services/index.js';
import { validarParametrosCliente } from '../core/financialEngine.js';
import { Cliente } from '../domain/entities.js';

function sanitizeCliente(cliente: Cliente) {
  const { passwordHash: _ph, ...safe } = cliente;
  return safe;
}

export class ClienteController {
  private estadoCuentaService: EstadoCuentaService;

  constructor(private repos: Repositories) {
    this.estadoCuentaService = new EstadoCuentaService(repos);
  }

  listar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user?.rol === 'CLIENTE' && req.user.clienteId) {
        const propio = await this.repos.clientes.obtenerPorId(req.user.clienteId);
        const lista = propio ? [sanitizeCliente(propio)] : [];
        res.status(200).json({
          status: 'success',
          cantidad: lista.length,
          data: lista,
        });
        return;
      }

      const tiendaId = req.tienda?.id;
      const clientes = await this.repos.clientes.listarTodos(tiendaId);
      res.status(200).json({
        status: 'success',
        cantidad: clientes.length,
        data: clientes.map(sanitizeCliente),
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
        data: sanitizeCliente(cliente),
      });
    } catch (error) {
      next(error);
    }
  };

  crear = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user?.rol === 'CLIENTE') {
        res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN_ROLE',
          message: 'Un cliente no puede registrar otros clientes',
        });
        return;
      }

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

      await this.repos.bitacora.registrar({
        tiendaId: nuevoCliente.tiendaId ?? tiendaId,
        usuario: req.user?.email ?? 'ADMIN_NEGOCIO',
        accion: 'CREAR_CLIENTE',
        entidad: 'Cliente',
        idEntidad: nuevoCliente.id,
        detalle: `Cliente registrado: ${nuevoCliente.nombreCompleto} (${nuevoCliente.tipoDoc} ${nuevoCliente.numDoc}), Límite: ${nuevoCliente.limiteCredito} ${nuevoCliente.moneda}`,
      });

      res.status(201).json({
        status: 'success',
        mensaje: 'Cliente registrado exitosamente',
        data: sanitizeCliente(nuevoCliente),
      });
    } catch (error) {
      next(error);
    }
  };

  actualizar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user?.rol === 'CLIENTE') {
        res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN_ROLE',
          message: 'Un cliente no puede modificar parámetros crediticios',
        });
        return;
      }

      const id = req.params.id as string;
      const actual = await this.repos.clientes.obtenerPorId(id);
      if (!actual || (req.tienda?.id && actual.tiendaId && actual.tiendaId !== req.tienda.id)) {
        res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          message: `Cliente con ID ${id} no encontrado`,
        });
        return;
      }

      const body = req.body;
      if (body.numDoc && body.numDoc !== actual.numDoc) {
        const dup = await this.repos.clientes.obtenerPorDoc(body.numDoc, actual.tiendaId);
        if (dup && dup.id !== id) {
          res.status(409).json({
            status: 'error',
            code: 'DOCUMENT_ALREADY_EXISTS',
            message: `Ya existe otro cliente con el documento ${body.numDoc}`,
          });
          return;
        }
      }

      const mergedForValidation = {
        tipoTasa: body.tipoTasa ?? actual.tipoTasa,
        tasa: body.tasa ?? actual.tasa,
        capitalizacion: body.capitalizacion ?? actual.capitalizacion,
        teaMora: body.teaMora ?? actual.teaMora,
        diaCorte: body.diaCorte ?? actual.diaCorte,
        diaPago: body.diaPago ?? actual.diaPago,
        limiteCredito: body.limiteCredito ?? actual.limiteCredito,
        maxMeses: body.maxMeses ?? actual.maxMeses,
        moneda: body.moneda ?? actual.moneda,
      };

      const validacion = validarParametrosCliente(mergedForValidation);
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

      const actualizado = await this.repos.clientes.actualizar(id, {
        ...restBody,
        ...(passwordHash && { passwordHash }),
      });

      await this.repos.bitacora.registrar({
        tiendaId: actual.tiendaId,
        usuario: req.user?.email ?? 'ADMIN_NEGOCIO',
        accion: 'EDITAR_CLIENTE',
        entidad: 'Cliente',
        idEntidad: id,
        detalle: `Cliente actualizado: ${actualizado?.nombreCompleto ?? actual.nombreCompleto} (${actualizado?.tipoDoc ?? actual.tipoDoc} ${actualizado?.numDoc ?? actual.numDoc})`,
      });

      res.status(200).json({
        status: 'success',
        mensaje: 'Cliente actualizado exitosamente',
        data: actualizado ? sanitizeCliente(actualizado) : null,
      });
    } catch (error) {
      next(error);
    }
  };

  cambiarEstado = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user?.rol === 'CLIENTE') {
        res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN_ROLE',
          message: 'Un cliente no puede cambiar su propio estado',
        });
        return;
      }

      const id = req.params.id as string;
      const actual = await this.repos.clientes.obtenerPorId(id);
      if (!actual || (req.tienda?.id && actual.tiendaId && actual.tiendaId !== req.tienda.id)) {
        res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          message: `Cliente con ID ${id} no encontrado`,
        });
        return;
      }

      const { activo } = req.body;
      const actualizado = await this.repos.clientes.actualizar(id, { activo });

      await this.repos.bitacora.registrar({
        tiendaId: actual.tiendaId,
        usuario: req.user?.email ?? 'ADMIN_NEGOCIO',
        accion: 'CAMBIO_ESTADO_CLIENTE',
        entidad: 'Cliente',
        idEntidad: id,
        detalle: `Estado de cliente ${actual.nombreCompleto} cambiado a ${activo ? 'ACTIVO' : 'INACTIVO'}`,
      });

      res.status(200).json({
        status: 'success',
        mensaje: `Cliente ${activo ? 'activado' : 'desactivado'} exitosamente`,
        data: actualizado ? sanitizeCliente(actualizado) : null,
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
