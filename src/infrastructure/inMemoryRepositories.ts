import { v4 as uuidv4 } from 'uuid';
import {
  Cliente,
  Credito,
  Cuota,
  Producto,
  Tienda,
  Pago,
  Bitacora,
} from '../domain/entities.js';
import {
  IClienteRepository,
  ICreditoRepository,
  ICuotaRepository,
  IProductoRepository,
  ITiendaRepository,
  IPagoRepository,
  IBitacoraRepository,
} from '../domain/repositories.js';

export class InMemoryClienteRepository implements IClienteRepository {
  private clientes: Map<string, Cliente> = new Map();

  async crear(datos: Omit<Cliente, 'id' | 'creadoEn'>): Promise<Cliente> {
    const id = uuidv4();
    const cliente: Cliente = {
      ...datos,
      id,
      creadoEn: new Date().toISOString(),
    };
    this.clientes.set(id, { ...cliente });
    return { ...cliente };
  }

  async obtenerPorId(id: string): Promise<Cliente | null> {
    const cliente = this.clientes.get(id);
    return cliente ? { ...cliente } : null;
  }

  async obtenerPorDoc(numDoc: string): Promise<Cliente | null> {
    for (const c of this.clientes.values()) {
      if (c.numDoc === numDoc) {
        return { ...c };
      }
    }
    return null;
  }

  async listarTodos(): Promise<Cliente[]> {
    return Array.from(this.clientes.values()).map((c) => ({ ...c }));
  }

  async actualizar(id: string, parcial: Partial<Cliente>): Promise<Cliente | null> {
    const actual = this.clientes.get(id);
    if (!actual) return null;
    const actualizado = { ...actual, ...parcial };
    this.clientes.set(id, actualizado);
    return { ...actualizado };
  }

  async actualizarCapitalVigente(id: string, nuevoCapital: number): Promise<void> {
    const cliente = this.clientes.get(id);
    if (cliente) {
      cliente.capitalVigente = nuevoCapital;
      this.clientes.set(id, { ...cliente });
    }
  }

  // Utilidad para tests y reset
  limpiar(): void {
    this.clientes.clear();
  }
}

export class InMemoryCreditoRepository implements ICreditoRepository {
  private creditos: Map<string, Credito> = new Map();

  async crear(datos: Omit<Credito, 'id' | 'creadoEn'>): Promise<Credito> {
    const id = uuidv4();
    const credito: Credito = {
      ...datos,
      id,
      creadoEn: new Date().toISOString(),
    };
    this.creditos.set(id, { ...credito });
    return { ...credito };
  }

  async obtenerPorId(id: string): Promise<Credito | null> {
    const credito = this.creditos.get(id);
    return credito ? { ...credito } : null;
  }

  async listarPorCliente(clienteId: string): Promise<Credito[]> {
    return Array.from(this.creditos.values())
      .filter((c) => c.clienteId === clienteId)
      .map((c) => ({ ...c }));
  }

  async listarTodos(): Promise<Credito[]> {
    return Array.from(this.creditos.values()).map((c) => ({ ...c }));
  }

  async actualizar(id: string, parcial: Partial<Credito>): Promise<Credito | null> {
    const actual = this.creditos.get(id);
    if (!actual) return null;
    const actualizado = { ...actual, ...parcial };
    this.creditos.set(id, actualizado);
    return { ...actualizado };
  }

  limpiar(): void {
    this.creditos.clear();
  }
}

export class InMemoryCuotaRepository implements ICuotaRepository {
  private cuotas: Map<string, Cuota> = new Map();

  async crearMuchas(datos: Array<Omit<Cuota, 'id'>>): Promise<Cuota[]> {
    const creadas: Cuota[] = [];
    for (const d of datos) {
      const id = uuidv4();
      const cuota: Cuota = { ...d, id };
      this.cuotas.set(id, { ...cuota });
      creadas.push({ ...cuota });
    }
    return creadas;
  }

  async obtenerPorId(id: string): Promise<Cuota | null> {
    const cuota = this.cuotas.get(id);
    return cuota ? { ...cuota } : null;
  }

  async listarPorCredito(creditoId: string): Promise<Cuota[]> {
    return Array.from(this.cuotas.values())
      .filter((c) => c.creditoId === creditoId)
      .sort((a, b) => a.numero - b.numero)
      .map((c) => ({ ...c }));
  }

  async listarPorCliente(clienteId: string): Promise<Cuota[]> {
    return Array.from(this.cuotas.values())
      .filter((c) => c.clienteId === clienteId)
      .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))
      .map((c) => ({ ...c }));
  }

  async listarPendientesPorCliente(clienteId: string): Promise<Cuota[]> {
    return Array.from(this.cuotas.values())
      .filter((c) => c.clienteId === clienteId && c.estado !== 'Pagada')
      .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))
      .map((c) => ({ ...c }));
  }

  async actualizar(id: string, parcial: Partial<Cuota>): Promise<Cuota | null> {
    const actual = this.cuotas.get(id);
    if (!actual) return null;
    const actualizado = { ...actual, ...parcial };
    this.cuotas.set(id, actualizado);
    return { ...actualizado };
  }

  limpiar(): void {
    this.cuotas.clear();
  }
}

export class InMemoryProductoRepository implements IProductoRepository {
  private productos: Map<string, Producto> = new Map();

  async crear(datos: Omit<Producto, 'id' | 'creadoEn'>): Promise<Producto> {
    const id = uuidv4();
    const producto: Producto = {
      ...datos,
      id,
      creadoEn: new Date().toISOString(),
    };
    this.productos.set(id, { ...producto });
    return { ...producto };
  }

  async obtenerPorId(id: string): Promise<Producto | null> {
    const producto = this.productos.get(id);
    return producto ? { ...producto } : null;
  }

  async obtenerPorSku(sku: string): Promise<Producto | null> {
    for (const p of this.productos.values()) {
      if (p.sku === sku) {
        return { ...p };
      }
    }
    return null;
  }

  async listarTodos(): Promise<Producto[]> {
    return Array.from(this.productos.values()).map((p) => ({ ...p }));
  }

  async actualizar(id: string, parcial: Partial<Producto>): Promise<Producto | null> {
    const actual = this.productos.get(id);
    if (!actual) return null;
    const actualizado = { ...actual, ...parcial };
    this.productos.set(id, actualizado);
    return { ...actualizado };
  }

  limpiar(): void {
    this.productos.clear();
  }
}

export class InMemoryTiendaRepository implements ITiendaRepository {
  private tiendas: Map<string, Tienda> = new Map();

  async crear(datos: Omit<Tienda, 'id' | 'creadoEn'>): Promise<Tienda> {
    const id = uuidv4();
    const tienda: Tienda = {
      ...datos,
      id,
      creadoEn: new Date().toISOString(),
    };
    this.tiendas.set(id, { ...tienda });
    return { ...tienda };
  }

  async obtenerPorId(id: string): Promise<Tienda | null> {
    const tienda = this.tiendas.get(id);
    return tienda ? { ...tienda } : null;
  }

  async listarTodas(): Promise<Tienda[]> {
    return Array.from(this.tiendas.values()).map((t) => ({ ...t }));
  }

  limpiar(): void {
    this.tiendas.clear();
  }
}

export class InMemoryPagoRepository implements IPagoRepository {
  private pagos: Map<string, Pago> = new Map();

  async crear(datos: Omit<Pago, 'id' | 'creadoEn'>): Promise<Pago> {
    const id = uuidv4();
    const pago: Pago = {
      ...datos,
      id,
      creadoEn: new Date().toISOString(),
    };
    this.pagos.set(id, { ...pago });
    return { ...pago };
  }

  async listarPorCredito(creditoId: string): Promise<Pago[]> {
    return Array.from(this.pagos.values())
      .filter((p) => p.creditoId === creditoId)
      .map((p) => ({ ...p }));
  }

  async listarPorCliente(clienteId: string): Promise<Pago[]> {
    return Array.from(this.pagos.values())
      .filter((p) => p.clienteId === clienteId)
      .map((p) => ({ ...p }));
  }

  async listarTodos(): Promise<Pago[]> {
    return Array.from(this.pagos.values()).map((p) => ({ ...p }));
  }

  limpiar(): void {
    this.pagos.clear();
  }
}

export class InMemoryBitacoraRepository implements IBitacoraRepository {
  private registros: Bitacora[] = [];

  async registrar(datos: Omit<Bitacora, 'id' | 'fecha'>): Promise<Bitacora> {
    const id = uuidv4();
    const registro: Bitacora = {
      ...datos,
      id,
      fecha: new Date().toISOString(),
    };
    this.registros.push({ ...registro });
    return { ...registro };
  }

  async listar(): Promise<Bitacora[]> {
    return this.registros.map((r) => ({ ...r }));
  }

  limpiar(): void {
    this.registros = [];
  }
}

/**
 * Contenedor de Repositorios (Inversión de dependencias).
 */
export interface Repositories {
  clientes: IClienteRepository;
  creditos: ICreditoRepository;
  cuotas: ICuotaRepository;
  productos: IProductoRepository;
  tiendas: ITiendaRepository;
  pagos: IPagoRepository;
  bitacora: IBitacoraRepository;
}

export function createInMemoryRepositories(): Repositories {
  return {
    clientes: new InMemoryClienteRepository(),
    creditos: new InMemoryCreditoRepository(),
    cuotas: new InMemoryCuotaRepository(),
    productos: new InMemoryProductoRepository(),
    tiendas: new InMemoryTiendaRepository(),
    pagos: new InMemoryPagoRepository(),
    bitacora: new InMemoryBitacoraRepository(),
  };
}
