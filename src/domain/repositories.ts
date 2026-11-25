import {
  Cliente,
  Credito,
  Cuota,
  Producto,
  Tienda,
  Pago,
  Bitacora,
} from './entities.js';

export interface IClienteRepository {
  crear(cliente: Omit<Cliente, 'id' | 'creadoEn'>): Promise<Cliente>;
  obtenerPorId(id: string): Promise<Cliente | null>;
  obtenerPorDoc(numDoc: string, tiendaId?: string): Promise<Cliente | null>;
  obtenerPorEmail?(email: string): Promise<Cliente | null>;
  listarTodos(tiendaId?: string): Promise<Cliente[]>;
  actualizar(id: string, parcial: Partial<Cliente>): Promise<Cliente | null>;
  actualizarCapitalVigente(id: string, nuevoCapital: number): Promise<void>;
}

export interface ICreditoRepository {
  crear(credito: Omit<Credito, 'id' | 'creadoEn'>): Promise<Credito>;
  obtenerPorId(id: string): Promise<Credito | null>;
  listarPorCliente(clienteId: string): Promise<Credito[]>;
  listarTodos(tiendaId?: string): Promise<Credito[]>;
  actualizar(id: string, parcial: Partial<Credito>): Promise<Credito | null>;
}

export interface ICuotaRepository {
  crearMuchas(cuotas: Array<Omit<Cuota, 'id'>>): Promise<Cuota[]>;
  obtenerPorId(id: string): Promise<Cuota | null>;
  listarPorCredito(creditoId: string): Promise<Cuota[]>;
  listarPorCliente(clienteId: string): Promise<Cuota[]>;
  listarPendientesPorCliente(clienteId: string): Promise<Cuota[]>;
  actualizar(id: string, parcial: Partial<Cuota>): Promise<Cuota | null>;
}

export interface IProductoRepository {
  crear(producto: Omit<Producto, 'id' | 'creadoEn'>): Promise<Producto>;
  obtenerPorId(id: string): Promise<Producto | null>;
  obtenerPorSku(sku: string, tiendaId?: string): Promise<Producto | null>;
  listarTodos(tiendaId?: string): Promise<Producto[]>;
  actualizar(id: string, parcial: Partial<Producto>): Promise<Producto | null>;
}

export interface ITiendaRepository {
  crear(tienda: Omit<Tienda, 'id' | 'creadoEn'>): Promise<Tienda>;
  obtenerPorId(id: string): Promise<Tienda | null>;
  obtenerPorEmail?(email: string): Promise<Tienda | null>;
  obtenerPorRuc?(ruc: string): Promise<Tienda | null>;
  listarTodas(): Promise<Tienda[]>;
  actualizar?(id: string, parcial: Partial<Tienda>): Promise<Tienda | null>;
}

export interface IPagoRepository {
  crear(pago: Omit<Pago, 'id' | 'creadoEn'>): Promise<Pago>;
  listarPorCredito(creditoId: string): Promise<Pago[]>;
  listarPorCliente(clienteId: string): Promise<Pago[]>;
  listarTodos(tiendaId?: string): Promise<Pago[]>;
}

export interface IBitacoraRepository {
  registrar(registro: Omit<Bitacora, 'id' | 'fecha'>): Promise<Bitacora>;
  listar(tiendaId?: string): Promise<Bitacora[]>;
}
