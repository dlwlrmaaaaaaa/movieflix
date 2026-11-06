import { Request, Response, NextFunction } from 'express';
import { logger, safeLogMessage } from '../services/logger';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const message = err instanceof Error ? err.message : 'Unknown server error';
  logger.error('http.unhandled_error', { requestId: res.locals.requestId, message: safeLogMessage(err) });

  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error occurred.' : message,
  });
}
