import { Request, Response, NextFunction } from 'express';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';

export class ProductoController {
  constructor(private repos: Repositories) {}

  listar = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const productos = await this.repos.productos.listarTodos();
      res.status(200).json({
        status: 'success',
        cantidad: productos.length,
        data: productos,
      });
    } catch (error) {
      next(error);
    }
  };

  obtenerPorId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const producto = await this.repos.productos.obtenerPorId(id);
      if (!producto) {
        res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          message: `Producto con ID ${id} no encontrado`,
        });
        return;
      }
      res.status(200).json({
        status: 'success',
        data: producto,
      });
    } catch (error) {
      next(error);
    }
  };
}
