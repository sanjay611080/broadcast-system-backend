import type { Request, Response, NextFunction } from 'express';
import type { Schema } from 'joi';
import { ApiError } from '../utils/ApiError';

type Source = 'body' | 'query' | 'params';

export function validate(schema: Schema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      return next(
        ApiError.badRequest(
          'Validation failed',
          error.details.map((d) => ({ path: d.path.join('.'), message: d.message })),
        ),
      );
    }
    (req as unknown as Record<Source, unknown>)[source] = value;
    next();
  };
}
