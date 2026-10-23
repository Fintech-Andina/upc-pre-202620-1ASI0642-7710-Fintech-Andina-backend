import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'Error de validación en los datos de la solicitud',
          errores: error.issues.map((i) => ({
            campo: i.path.join('.'),
            mensaje: i.message,
          })),
        });
        return;
      }
      next(error);
    }
  };
}
