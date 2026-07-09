import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { isProduction } from '../env.js';

export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload failed validation',
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Unknown error';
  // CORS rejection surfaces as a plain Error from the cors middleware.
  if (message.startsWith('Origin ') && message.endsWith(' is not allowed by CORS')) {
    res.status(403).json({ error: { code: 'CORS_FORBIDDEN', message } });
    return;
  }

  const payload: Record<string, unknown> = {
    code: 'INTERNAL_ERROR',
    message: isProduction ? 'Internal server error' : message,
  };
  if (!isProduction && err instanceof Error && err.stack) {
    payload.stack = err.stack;
  }

  res.status(500).json({ error: payload });
};
