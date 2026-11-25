import { Request, Response, NextFunction } from 'express';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';
import { Tienda } from '../domain/entities.js';

function sanitizeTienda(tienda: Tienda) {
  const { passwordHash: _ph, ...safe } = tienda;
  return safe;
}

export class TiendaController {
  constructor(private repos: Repositories) {}

  listar = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tiendas = await this.repos.tiendas.listarTodas();
      res.status(200).json({
        status: 'success',
        cantidad: tiendas.length,
        data: tiendas.map(sanitizeTienda),
      });
    } catch (error) {
      next(error);
    }
  };

  actualizarMiTienda = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tiendaId = req.user?.tiendaId ?? req.user?.id;
      if (!tiendaId) {
        res.status(401).json({
          status: 'error',
          code: 'UNAUTHORIZED',
          message: 'No se pudo identificar la tienda autenticada',
        });
        return;
      }

      const tiendaActual = await this.repos.tiendas.obtenerPorId(tiendaId);
      if (!tiendaActual) {
        res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          message: 'Tienda no encontrada',
        });
        return;
      }

      if (!this.repos.tiendas.actualizar) {
        throw new Error('Operación de actualización de tienda no soportada');
      }

      const body = req.body;
      const nombreFinal = body.nombreComercial ?? body.nombre ?? tiendaActual.nombreComercial ?? tiendaActual.nombre;

      const actualizada = await this.repos.tiendas.actualizar(tiendaId, {
        ...(body.razonSocial !== undefined && { razonSocial: body.razonSocial }),
        ...(body.nombreComercial !== undefined && { nombreComercial: body.nombreComercial, nombre: body.nombreComercial }),
        ...(body.nombre !== undefined && { nombre: body.nombre, nombreComercial: body.nombreComercial ?? body.nombre }),
        ...(body.direccion !== undefined && { direccion: body.direccion }),
        ...(body.telefono !== undefined && { telefono: body.telefono }),
        ...(body.monedaDefecto !== undefined && { monedaDefecto: body.monedaDefecto }),
        ...(body.horaCorte !== undefined && { horaCorte: body.horaCorte }),
      });

      await this.repos.bitacora.registrar({
        tiendaId,
        usuario: req.user?.email ?? 'ADMIN_NEGOCIO',
        accion: 'EDITAR_TIENDA',
        entidad: 'Tienda',
        idEntidad: tiendaId,
        detalle: `Configuración de tienda ${nombreFinal} actualizada`,
      });

      res.status(200).json({
        status: 'success',
        mensaje: 'Configuración de la tienda actualizada exitosamente',
        data: actualizada ? sanitizeTienda(actualizada) : null,
      });
    } catch (error) {
      next(error);
    }
  };

  cambiarEstado = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { estado } = req.body;

      const tiendaActual = await this.repos.tiendas.obtenerPorId(id);
      if (!tiendaActual) {
        res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          message: `Tienda con ID ${id} no encontrada`,
        });
        return;
      }

      if (!this.repos.tiendas.actualizar) {
        throw new Error('Operación de actualización de tienda no soportada');
      }

      const actualizada = await this.repos.tiendas.actualizar(id, { estado });

      await this.repos.bitacora.registrar({
        tiendaId: id,
        usuario: req.user?.email ?? 'ADMIN_SISTEMA',
        accion: 'CAMBIO_ESTADO_TIENDA',
        entidad: 'Tienda',
        idEntidad: id,
        detalle: `Estado de tienda ${tiendaActual.nombre} cambiado a ${estado}`,
      });

      res.status(200).json({
        status: 'success',
        mensaje: `Estado de la tienda actualizado a ${estado}`,
        data: actualizada ? sanitizeTienda(actualizada) : null,
      });
    } catch (error) {
      next(error);
    }
  };
}
