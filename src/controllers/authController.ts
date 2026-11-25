import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { AuthUserPayload, getJwtSecret } from '../middlewares/authMiddleware.js';
import { Tienda, Cliente } from '../domain/entities.js';

function sanitizeTienda(tienda: Tienda) {
  const { passwordHash: _ph, ...safe } = tienda;
  return safe;
}

function sanitizeCliente(cliente: Cliente) {
  const { passwordHash: _ph, ...safe } = cliente;
  return safe;
}

export class AuthController {
  constructor(private repos: Repositories) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        ruc,
        razonSocial,
        nombreComercial,
        nombre,
        direccion,
        telefono,
        email,
        password,
        rol,
        monedaDefecto,
        horaCorte,
      } = req.body;

      const emailNorm = email.trim().toLowerCase();

      if (this.repos.tiendas.obtenerPorEmail) {
        const existeEmail = await this.repos.tiendas.obtenerPorEmail(emailNorm);
        if (existeEmail) {
          res.status(409).json({
            status: 'error',
            code: 'EMAIL_ALREADY_EXISTS',
            message: `Ya existe una cuenta registrada con el correo ${emailNorm}`,
          });
          return;
        }
      }

      if (this.repos.tiendas.obtenerPorRuc) {
        const existeRuc = await this.repos.tiendas.obtenerPorRuc(ruc);
        if (existeRuc) {
          res.status(409).json({
            status: 'error',
            code: 'RUC_ALREADY_EXISTS',
            message: `Ya existe una tienda registrada con el RUC ${ruc}`,
          });
          return;
        }
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const nombreFinal = nombreComercial || nombre || razonSocial;

      const nuevaTienda = await this.repos.tiendas.crear({
        nombre: nombreFinal,
        razonSocial: razonSocial || nombreFinal,
        nombreComercial: nombreComercial || nombreFinal,
        ruc,
        direccion,
        telefono: telefono ?? '',
        email: emailNorm,
        passwordHash,
        rol: rol ?? 'ADMIN_NEGOCIO',
        monedaDefecto: monedaDefecto ?? 'PEN',
        horaCorte: horaCorte ?? 18,
        estado: 'ACTIVO',
      });

      await this.repos.bitacora.registrar({
        tiendaId: nuevaTienda.id,
        usuario: emailNorm,
        accion: 'REGISTRO_TIENDA',
        entidad: 'Tienda',
        idEntidad: nuevaTienda.id,
        detalle: `Registro de tienda ${nuevaTienda.nombre} (RUC: ${nuevaTienda.ruc}, Rol: ${nuevaTienda.rol})`,
      });

      const payload: AuthUserPayload = {
        id: nuevaTienda.id,
        rol: nuevaTienda.rol ?? 'ADMIN_NEGOCIO',
        tiendaId: nuevaTienda.id,
        email: nuevaTienda.email,
        ruc: nuevaTienda.ruc,
        nombre: nuevaTienda.nombre,
      };

      const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '24h' });

      res.status(201).json({
        status: 'success',
        mensaje: 'Tienda registrada y autenticada exitosamente',
        data: {
          token,
          rol: payload.rol,
          tienda: sanitizeTienda(nuevaTienda),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      const emailNorm = email.trim().toLowerCase();

      // 1. Buscar primero en Tienda (ADMIN_SISTEMA o ADMIN_NEGOCIO)
      const tienda = this.repos.tiendas.obtenerPorEmail
        ? await this.repos.tiendas.obtenerPorEmail(emailNorm)
        : null;

      if (tienda && tienda.passwordHash) {
        if (tienda.estado && tienda.estado.toUpperCase() !== 'ACTIVO') {
          res.status(403).json({
            status: 'error',
            code: 'TIENDA_INACTIVA',
            message: 'La tienda se encuentra desactivada por el Administrador del Sistema',
          });
          return;
        }

        const passwordValido = await bcrypt.compare(password, tienda.passwordHash);
        if (!passwordValido) {
          res.status(401).json({
            status: 'error',
            code: 'INVALID_CREDENTIALS',
            message: 'Credenciales de acceso inválidas',
          });
          return;
        }

        const rol = tienda.rol ?? 'ADMIN_NEGOCIO';
        const payload: AuthUserPayload = {
          id: tienda.id,
          rol,
          tiendaId: tienda.id,
          email: tienda.email,
          ruc: tienda.ruc,
          nombre: tienda.nombre,
        };

        const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '24h' });

        await this.repos.bitacora.registrar({
          tiendaId: tienda.id,
          usuario: emailNorm,
          accion: 'LOGIN',
          entidad: 'Tienda',
          idEntidad: tienda.id,
          detalle: `Inicio de sesión exitoso de ${tienda.nombre} con rol ${rol}`,
        });

        res.status(200).json({
          status: 'success',
          mensaje: 'Inicio de sesión exitoso',
          data: {
            token,
            rol,
            tienda: sanitizeTienda(tienda),
          },
        });
        return;
      }

      // 2. Si no es Tienda, buscar en Cliente (perfil CLIENTE)
      const cliente = this.repos.clientes.obtenerPorEmail
        ? await this.repos.clientes.obtenerPorEmail(emailNorm)
        : null;

      if (cliente && cliente.passwordHash) {
        if (!cliente.activo) {
          res.status(403).json({
            status: 'error',
            code: 'CLIENTE_INACTIVO',
            message: 'La cuenta del cliente se encuentra inactiva',
          });
          return;
        }

        const passwordValido = await bcrypt.compare(password, cliente.passwordHash);
        if (!passwordValido) {
          res.status(401).json({
            status: 'error',
            code: 'INVALID_CREDENTIALS',
            message: 'Credenciales de acceso inválidas',
          });
          return;
        }

        const payload: AuthUserPayload = {
          id: cliente.id,
          rol: 'CLIENTE',
          clienteId: cliente.id,
          tiendaId: cliente.tiendaId,
          email: cliente.email,
          nombre: cliente.nombreCompleto,
        };

        const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '24h' });

        await this.repos.bitacora.registrar({
          tiendaId: cliente.tiendaId,
          usuario: emailNorm,
          accion: 'LOGIN_CLIENTE',
          entidad: 'Cliente',
          idEntidad: cliente.id,
          detalle: `Inicio de sesión exitoso del vecino ${cliente.nombreCompleto} (Doc: ${cliente.numDoc})`,
        });

        res.status(200).json({
          status: 'success',
          mensaje: 'Inicio de sesión de cliente exitoso',
          data: {
            token,
            rol: 'CLIENTE',
            cliente: sanitizeCliente(cliente),
          },
        });
        return;
      }

      res.status(401).json({
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'Credenciales de acceso inválidas',
      });
    } catch (error) {
      next(error);
    }
  };

  loginCliente = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, numDoc, tiendaId, password } = req.body;

      let cliente: Cliente | null = null;
      if (email && this.repos.clientes.obtenerPorEmail) {
        cliente = await this.repos.clientes.obtenerPorEmail(email.trim().toLowerCase());
      } else if (numDoc) {
        cliente = await this.repos.clientes.obtenerPorDoc(numDoc, tiendaId);
      }

      if (!cliente || !cliente.passwordHash) {
        res.status(401).json({
          status: 'error',
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciales de cliente inválidas',
        });
        return;
      }

      if (!cliente.activo) {
        res.status(403).json({
          status: 'error',
          code: 'CLIENTE_INACTIVO',
          message: 'El cliente se encuentra inactivo',
        });
        return;
      }

      const passwordValido = await bcrypt.compare(password, cliente.passwordHash);
      if (!passwordValido) {
        res.status(401).json({
          status: 'error',
          code: 'INVALID_CREDENTIALS',
          message: 'Credenciales de cliente inválidas',
        });
        return;
      }

      const payload: AuthUserPayload = {
        id: cliente.id,
        rol: 'CLIENTE',
        clienteId: cliente.id,
        tiendaId: cliente.tiendaId,
        email: cliente.email,
        nombre: cliente.nombreCompleto,
      };

      const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '24h' });

      await this.repos.bitacora.registrar({
        tiendaId: cliente.tiendaId,
        usuario: cliente.email ?? cliente.numDoc,
        accion: 'LOGIN_CLIENTE',
        entidad: 'Cliente',
        idEntidad: cliente.id,
        detalle: `Inicio de sesión exitoso del cliente ${cliente.nombreCompleto}`,
      });

      res.status(200).json({
        status: 'success',
        mensaje: 'Inicio de sesión de cliente exitoso',
        data: {
          token,
          rol: 'CLIENTE',
          cliente: sanitizeCliente(cliente),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'No autenticado',
        });
        return;
      }

      if (req.user.rol === 'CLIENTE' && req.user.clienteId) {
        const cliente = await this.repos.clientes.obtenerPorId(req.user.clienteId);
        res.status(200).json({
          status: 'success',
          data: {
            usuario: req.user,
            cliente: cliente ? sanitizeCliente(cliente) : null,
          },
        });
        return;
      }

      const tienda = await this.repos.tiendas.obtenerPorId(req.user.tiendaId ?? req.user.id);
      res.status(200).json({
        status: 'success',
        data: {
          usuario: req.user,
          tienda: tienda ? sanitizeTienda(tienda) : null,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
