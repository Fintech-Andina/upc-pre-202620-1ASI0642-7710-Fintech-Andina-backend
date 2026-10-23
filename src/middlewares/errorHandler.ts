import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.status || err.statusCode || 400;
  const message = err.message || 'Error interno del servidor';

  res.status(statusCode).json({
    status: 'error',
    code: err.code || 'BUSINESS_RULE_ERROR',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
