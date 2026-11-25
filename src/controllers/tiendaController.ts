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
