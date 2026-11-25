import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RolUsuario } from '../domain/entities.js';

export interface AuthUserPayload {
  id: string;
  rol: RolUsuario;
  tiendaId?: string;
  clienteId?: string;
  email?: string;
  ruc?: string;
  nombre?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
      tienda?: {
        id: string;
        rol: RolUsuario;
        email?: string;
        ruc?: string;
        nombre?: string;
      };
    }
  }
}

export function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'defia_book_jwt_secret_2026_fintech_andina';
}

/**
 * Middleware de autenticación configurable:
 * - Si se envía `Authorization: Bearer <token>`, valida el JWT y puebla `req.user` y `req.tienda` (para aislamiento multi-tenant).
 * - Si no se envía token y `process.env.REQUIRE_AUTH === 'true'`, responde 401.
 * - Si no se envía token y `REQUIRE_AUTH` no está activo (ej. tests existentes), permite continuar sin sesión.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const requireAuthEnv = process.env.REQUIRE_AUTH === 'true';

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (requireAuthEnv) {
      res.status(401).json({
        status: 'error',
        code: 'TOKEN_REQUIRED',
        message: 'Se requiere autenticación mediante token Bearer JWT',
      });
      return;
    }
    next();
    return;
  }

  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUserPayload;
    req.user = decoded;

    if (decoded.rol === 'ADMIN_NEGOCIO' && (decoded.tiendaId || decoded.id)) {
      req.tienda = {
        id: decoded.tiendaId ?? decoded.id,
        rol: decoded.rol,
        email: decoded.email,
        ruc: decoded.ruc,
        nombre: decoded.nombre,
      };
    }
    next();
  } catch (_err) {
    res.status(401).json({
      status: 'error',
      code: 'INVALID_TOKEN',
      message: 'Token JWT inválido o expirado',
    });
  }
}

/**
 * Middleware estricto que exige un JWT válido independientemente de REQUIRE_AUTH.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      status: 'error',
      code: 'TOKEN_REQUIRED',
      message: 'Se requiere autenticación mediante token Bearer JWT',
    });
    return;
  }

  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUserPayload;
    req.user = decoded;
    if (decoded.rol === 'ADMIN_NEGOCIO' && (decoded.tiendaId || decoded.id)) {
      req.tienda = {
        id: decoded.tiendaId ?? decoded.id,
        rol: decoded.rol,
        email: decoded.email,
        ruc: decoded.ruc,
        nombre: decoded.nombre,
      };
    }
    next();
  } catch (_err) {
    res.status(401).json({
      status: 'error',
      code: 'INVALID_TOKEN',
      message: 'Token JWT inválido o expirado',
    });
  }
}

/**
 * Middleware de autorización por rol (`ADMIN_SISTEMA`, `ADMIN_NEGOCIO`, `CLIENTE`).
 */
export function requireRole(...rolesPermitidos: RolUsuario[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        status: 'error',
        code: 'TOKEN_REQUIRED',
        message: 'Se requiere sesión autenticada',
      });
      return;
    }

    if (!rolesPermitidos.includes(req.user.rol)) {
      res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN_ROLE',
        message: `Acceso denegado. Se requiere uno de los siguientes perfiles: ${rolesPermitidos.join(', ')}`,
      });
      return;
    }

    next();
  };
}
