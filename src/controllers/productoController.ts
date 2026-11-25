import { Request, Response, NextFunction } from 'express';
import { Repositories } from '../infrastructure/inMemoryRepositories.js';

export class ProductoController {
  constructor(private repos: Repositories) {}

  private async resolveTiendaId(req: Request): Promise<string> {
    if (req.tienda?.id) return req.tienda.id;
    if (req.user?.tiendaId) return req.user.tiendaId;
    const tiendas = await this.repos.tiendas.listarTodas();
    const comercio = tiendas.find((t) => t.rol !== 'ADMIN_SISTEMA') ?? tiendas[0];
    if (!comercio) {
      throw new Error('No existe ninguna tienda registrada para asociar el producto');
    }
    return comercio.id;
  }

  listar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tiendaId = req.tienda?.id ?? (req.user?.rol === 'CLIENTE' ? req.user.tiendaId : undefined);
      const productos = await this.repos.productos.listarTodos(tiendaId);
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
      if (!producto || (req.tienda?.id && producto.tiendaId !== req.tienda.id)) {
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

  crear = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user?.rol === 'CLIENTE') {
        res.status(403).json({
          status: 'error',
          code: 'FORBIDDEN_ROLE',
          message: 'Los clientes no pueden registrar productos en el catálogo',
        });
        return;
      }

      const tiendaId = await this.resolveTiendaId(req);
      const body = req.body;
      const skuFinal =
        body.sku?.trim() ||
        `PROD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 90 + 10)}`;

      const existente = await this.repos.productos.obtenerPorSku(skuFinal, tiendaId);
      if (existente) {
        res.status(409).json({
          status: 'error',
          code: 'SKU_ALREADY_EXISTS',
          message: `Ya existe un producto con el SKU ${skuFinal} en esta tienda`,
        });
        return;
      }

      const nuevoProducto = await this.repos.productos.crear({
        tiendaId,
        sku: skuFinal,
        nombre: body.nombre.trim(),
        marca: body.marca?.trim() || undefined,
        proveedor: body.proveedor?.trim() || undefined,
        descripcion: body.descripcion?.trim() || undefined,
        unidadMedida: body.unidadMedida?.trim() || undefined,
        imagenUrl: body.imagenUrl?.trim() || undefined,
        precioContado: body.precioContado,
        precioLista: body.precioLista,
        permiteCuotas: body.permiteCuotas ?? true,
        permitePagoUnico: body.permitePagoUnico ?? true,
        activo: body.activo ?? true,
        stock: 0,
      });

      await this.repos.bitacora.registrar({
        tiendaId,
        usuario: req.user?.email ?? 'ADMIN_NEGOCIO',
        accion: 'CREAR_PRODUCTO',
        entidad: 'Producto',
        idEntidad: nuevoProducto.id,
        detalle: `Producto creado: ${nuevoProducto.nombre} (SKU: ${nuevoProducto.sku}, Pc: ${nuevoProducto.precioContado}, PL: ${nuevoProducto.precioLista})`,
      });

      res.status(201).json({
        status: 'success',
        mensaje: 'Producto registrado exitosamente',
        data: nuevoProducto,
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
          message: 'Los clientes no pueden editar productos',
        });
        return;
      }

      const id = req.params.id as string;
      const actual = await this.repos.productos.obtenerPorId(id);
      if (!actual || (req.tienda?.id && actual.tiendaId !== req.tienda.id)) {
        res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          message: `Producto con ID ${id} no encontrado`,
        });
        return;
      }

      const body = req.body;
      if (body.sku && body.sku.trim() !== actual.sku) {
        const dup = await this.repos.productos.obtenerPorSku(body.sku.trim(), actual.tiendaId);
        if (dup && dup.id !== id) {
          res.status(409).json({
            status: 'error',
            code: 'SKU_ALREADY_EXISTS',
            message: `Ya existe otro producto con el SKU ${body.sku.trim()}`,
          });
          return;
        }
      }

      const permiteCuotas = body.permiteCuotas ?? actual.permiteCuotas;
      const permitePagoUnico = body.permitePagoUnico ?? actual.permitePagoUnico ?? true;
      if (!permiteCuotas && !permitePagoUnico) {
        res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'El producto debe permitir al menos una modalidad (Cuotas o Pago Único)',
        });
        return;
      }

      const actualizado = await this.repos.productos.actualizar(id, {
        ...(body.sku !== undefined && { sku: body.sku.trim() }),
        ...(body.nombre !== undefined && { nombre: body.nombre.trim() }),
        ...(body.marca !== undefined && { marca: body.marca.trim() || undefined }),
        ...(body.proveedor !== undefined && { proveedor: body.proveedor.trim() || undefined }),
        ...(body.descripcion !== undefined && { descripcion: body.descripcion.trim() || undefined }),
        ...(body.unidadMedida !== undefined && { unidadMedida: body.unidadMedida.trim() || undefined }),
        ...(body.imagenUrl !== undefined && { imagenUrl: body.imagenUrl.trim() || undefined }),
        ...(body.precioContado !== undefined && { precioContado: body.precioContado }),
        ...(body.precioLista !== undefined && { precioLista: body.precioLista }),
        ...(body.permiteCuotas !== undefined && { permiteCuotas: body.permiteCuotas }),
        ...(body.permitePagoUnico !== undefined && { permitePagoUnico: body.permitePagoUnico }),
        ...(body.activo !== undefined && { activo: body.activo }),
      });

      await this.repos.bitacora.registrar({
        tiendaId: actual.tiendaId,
        usuario: req.user?.email ?? 'ADMIN_NEGOCIO',
        accion: 'EDITAR_PRODUCTO',
        entidad: 'Producto',
        idEntidad: id,
        detalle: `Producto actualizado: ${actualizado?.nombre ?? actual.nombre} (SKU: ${actualizado?.sku ?? actual.sku})`,
      });

      res.status(200).json({
        status: 'success',
        mensaje: 'Producto actualizado exitosamente',
        data: actualizado,
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
          message: 'Los clientes no pueden modificar el estado de productos',
        });
        return;
      }

      const id = req.params.id as string;
      const actual = await this.repos.productos.obtenerPorId(id);
      if (!actual || (req.tienda?.id && actual.tiendaId !== req.tienda.id)) {
        res.status(404).json({
          status: 'error',
          code: 'NOT_FOUND',
          message: `Producto con ID ${id} no encontrado`,
        });
        return;
      }

      const { activo } = req.body;
      const actualizado = await this.repos.productos.actualizar(id, { activo });

      await this.repos.bitacora.registrar({
        tiendaId: actual.tiendaId,
        usuario: req.user?.email ?? 'ADMIN_NEGOCIO',
        accion: 'CAMBIO_ESTADO_PRODUCTO',
        entidad: 'Producto',
        idEntidad: id,
        detalle: `Estado de producto ${actual.nombre} cambiado a ${activo ? 'ACTIVO' : 'INACTIVO'}`,
      });

      res.status(200).json({
        status: 'success',
        mensaje: `Producto ${activo ? 'activado' : 'desactivado'} exitosamente`,
        data: actualizado,
      });
    } catch (error) {
      next(error);
    }
  };
}
